import { curry, partial, remove } from 'ramda'

import fs from 'fs'

import Koa from 'koa'
import path from 'path'
import Router from '@koa/router'
import multer from '@koa/multer'
import cors from '@koa/cors'
import { bodyParser } from '@koa/bodyparser'
import proxy from 'koa-proxies'

import { Config } from '../config'
import { RepositoryInstance } from '../init/repository'

import { FilterRule, ItemFilterCond, ItemIndexedField, addItem, deleteItem, getItem, idList2Items, listingItem, select, updateItem } from '../core/ItemPool'
import { ItemJSONForm, Item, ItemID, Item_raw } from '../core/Item'
import { FileID, constructFileID } from '../core/File'
import { TagForm, Tag, TagID } from '../core/Tag'
import { UpdateTagForm, getTag, getTagIdByName, idList2Tags, newTag, searchTag, tagnameHasDuplicate, updateTag } from '../core/TagPool'
import { generateThumb, getImageDimession } from '../utils/generate-image'
import { prepareWriteDirectory } from '../utils/directory'
import { deleteTagAndUpdateItemsOperate } from '../core/Pool'

function backFail(
  ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, any>,
  status: number,
  message: string,
) {
  return backData(ctx, { message }, status)
}

function backData(
  ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext, any>,
  body: any,
  status: number = 200
) {
  Object.assign(ctx, { status, body: JSON.stringify(body) })
}

export function createApi(
  config: Config,
  repo_inst: RepositoryInstance
) {
  const app = new Koa()
  const router = new Router()
  const upload = multer()

  app.use(cors({
    // allowMethods: `GET,HEAD,PUT,POST,DELETE,PATCH,OPTIONS`
  }))

  // 要放在 bodyParser 前面
  app.use(proxy('/files/:file_id', (params, ctx) => {
    return {
      target: `http://127.0.0.1:${config.internal_fileserver_http_port}`,
      changeOrigin: true,
      rewrite: () => repo_inst.file_pool.fileBasePath(params.file_id as any),
      logs: true
    }})
  )

  app.use(bodyParser())

  router.post('/action', async (ctx) => {
    if (
      (typeof ctx.request.body === 'object') &&
      ctx.request.body !== null
    ) {
      const actions = ActionRoute(
        repo_inst,
        // partial(backData, [ctx]),
        // partial(backFail, [ctx])
      )
      const act = actions[ctx.request.body.action]
      if (typeof act === 'function') {
        backData(
          ctx,
          await act(ctx.request.body.payload)
        )
      } else {
        backFail(ctx, 400, `unknown ACTION: ${ctx.request.body.action}`)
      }
    }
  })

  router.post('/file', upload.single('file'), async ctx => {
    const f_num = await repo_inst.file_pool.requestFileNumber()

    const { buffer, originalname } = ctx.request.file

    // @koa/multer 会出现中文乱码的问题，需要自行转换，呵呵
    const utf8_filename = Buffer.from(originalname, 'latin1').toString('utf8')

    const file_id = constructFileID(f_num, path.extname(utf8_filename).replace('.', ''))

    await repo_inst.file_pool.saveFile(file_id, ctx.request.file.buffer)

    backData(ctx, file_id, 200)
  })

  router.post('/refreshFile/:file_id', upload.single('file'), async ctx => {
    const { buffer, originalname } = ctx.request.file

    // @koa/multer 会出现中文乱码的问题，需要自行转换，呵呵
    const utf8_filename = Buffer.from(originalname, 'latin1').toString('utf8')

    const { file_id } = ctx.params
    if ((typeof file_id === 'string') && file_id.length) {
      if (await repo_inst.file_pool.fileExists(file_id as FileID)) {
        await repo_inst.file_pool.saveFile(file_id as FileID, ctx.request.file.buffer)
        backData(ctx, file_id, 200)
      } else {
        backFail(ctx, 400, `file(id=${file_id}) not found`)
      }
      backData(ctx, file_id, 200)
    } else {
      backFail(ctx, 400, 'illegal file_id')
    }
  })

  router.post('/readfile', async ctx => {
    if (
      (typeof ctx.request.body === 'object') &&
      ctx.request.body !== null
    ) {
      const file_id = ctx.request.body['file_id']
      const file_path = repo_inst.file_pool.getFilePath(file_id as FileID)
      const stream = fs.createReadStream(file_path)
      ctx.body = stream
    }
  })

  app.use(router.routes())
  app.use(router.allowedMethods())

  return app
}

export type ActionRouteTable = ReturnType<typeof ActionRoute>

type ParamType<T> = T extends (arg: infer P) => any ? P : T

export type ActionName = keyof ActionRouteTable
export type ActionPayload<N extends ActionName> = ParamType<ActionRouteTable[N]>

function TagActionRoute(
  {
    tagpool_op: [ tagPool, tagOp, setTagPool ],
    itempool_op: [ itemPool, , setItemPool ]
  }: RepositoryInstance
) {
  return {
    newTag(form: TagForm): Tag {
      return tagOp(newTag, form)
    },

    deleteTag(payload: { tag_id: TagID }): { message: 'done' } {
      deleteTagAndUpdateItemsOperate(
        payload.tag_id,
        [ tagPool, setTagPool ],
        [ itemPool, setItemPool ]
      )
      return { message: 'done' }
    },

    getTag(payload: { tag_id: TagID }) {
      return getTag(tagPool(), payload.tag_id)
    },

    tagnameHasDuplicate(tagname_list: string[]): boolean[] {
      return tagname_list.map((tagname) => {
        return tagnameHasDuplicate(tagPool(), tagname)
      })
    },

    getTagIfNoexistsWillCreateIt(tagname: string): Tag {
      if (tagnameHasDuplicate(tagPool(), tagname)) {
        const tagid = getTagIdByName(tagPool(), tagname) as TagID
        return getTag(tagPool(), tagid)
      } else {
        const new_tag = tagOp(newTag, { name: tagname, attributes: {} })
        return new_tag
      }
    },

    updateTag(payload: { id: TagID; data: UpdateTagForm }): { message: 'done' } {
      tagOp(updateTag, payload.id, payload.data)
      return { message: 'done' }
    },

    searchTag(find_tag_name: string) {
      return idList2Tags(tagPool(), searchTag(tagPool(), find_tag_name))
    },
  }
}

function ItemActionRoute(
  {
    tagpool_op: [ tagPool, tagOp, setTagPool ],
    itempool_op: [ itemPool, itemOp, setItemPool ]
  }: RepositoryInstance
) {
  return {
    addItem(payload: ItemJSONForm) {
      return itemOp(addItem, payload)
    },

    getItem(payload: { item_id: ItemID }) {
      return getItem(itemPool(), payload.item_id)
    },

    getItems(ids: ItemID[]) {
      return ids.map(id => {
        return getItem(itemPool(), id)
      })
    },

    deleteItem(will_del_id: ItemID): { message: 'done' } {
      itemOp(deleteItem, will_del_id)
      return { message: 'done' }
    },

    filterList({ ids, filter_rules }: {
      ids: ItemID[],
      filter_rules: FilterRule[]
    }) {
      return (
        idList2Items(itemPool(), ids).filter(
          ( filter_rules.length === 0 ) ?
          (() => true) : ItemFilterCond(filter_rules)
        )
      )
    },

    listing(payload: {
      sort_by?: ItemIndexedField
      after_id?: ItemID
      desc?: boolean
      limit: number
      filter_rules: FilterRule[]
    }) {
      return idList2Items(
        itemPool(),
        listingItem(
          itemPool(),
          payload.sort_by ? payload.sort_by : 'id',
          payload.after_id,
          payload.limit,
          Boolean(payload.desc),
          payload.filter_rules
        )
      )
    },

    updateItem(payload: { id: ItemID, data: Partial<ItemJSONForm> }) {
      itemOp(updateItem, payload.id, payload.data)
      return { message: 'done' }
    },
  }
}

function ActionRoute(
  repo: RepositoryInstance,
  // backData: (body: any, status?: number) => void,
  // backFail: (status: number, message: string) => void,
) {
  return {
    ...ItemActionRoute(repo),

    ...TagActionRoute(repo),

    save(): { message: 'done' } {
      throw new Error('save action is deprecated.')
    },

    imageDimession(file_id: FileID) {
      const image_path = repo.file_pool.getFilePath(file_id)
      return getImageDimession(image_path)
    },

    async generateThumb(file_id: FileID) {
      console.log(`generateThumb: ${file_id}`)
      const source_image_path = repo.file_pool.getFilePath(file_id)
      const thumb_file_id_P = repo.file_pool.requestFileNumber()
      if (await repo.file_pool.fileExists(file_id)) {
        const thumb_fid = `${await thumb_file_id_P}.avif` as FileID
        const thumb_image_path = repo.file_pool.getFilePath(thumb_fid)
        await prepareWriteDirectory(thumb_image_path)
        await generateThumb({
          source_image_path,
          thumb_image_path,
        })
        return {
          id: thumb_fid,
          dimession: await getImageDimession(thumb_image_path)
        }
      } else {
        throw new Error(`缩略图生成失败，FileID[${file_id}]不存在`)
      }
    },
  } as const
}
