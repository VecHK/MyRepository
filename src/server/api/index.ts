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
import { RepositoryInstance, saveStorageSync } from '../init'

import { FilterRule, addItem, deleteItem, deleteTagAndUpdateItems, getItem, idList2Items, listingItem, updateItem } from '../core/ItemPool'
import { CreateItemForm, ItemID } from '../core/Item'
import { FileID, constructFileID } from '../core/File'
import { CreateTagForm, Tag, TagID } from '../core/Tag'
import { UpdateTagForm, deleteTag, getTag, getTagByName, idList2Tags, newTag, searchTag, tagnameHasDuplicate, updateTag } from '../core/TagPool'
import { generateThumb, getImageDimession } from '../utils/generate-image'
import { initDirectory, prepareWriteDirectory } from '../utils/directory'

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
  tag_pool: RepositoryInstance['tag_pool'],
  item_pool: RepositoryInstance['item_pool'],
) {
  return {
    newTag(form: CreateTagForm) {
      return newTag(tag_pool, form)
    },

    deleteTag(payload: { tag_id: TagID }) {
      deleteTagAndUpdateItems(tag_pool, item_pool, payload.tag_id)
      return { message: 'done' }
    },

    getTag(payload: { tag_id: TagID }) {
      return getTag(tag_pool, payload.tag_id)
    },

    tagnameHasDuplicate(tagname_list: string[]): boolean[] {
      return tagname_list.map((tagname) => {
        return tagnameHasDuplicate(tag_pool, tagname)
      })
    },

    getTagIfNoexistsWillCreateIt(tagname: string): Tag {
      if (tagnameHasDuplicate(tag_pool, tagname)) {
        const tagid = getTagByName(tag_pool, tagname) as TagID
        return getTag(tag_pool, tagid)
      } else {
        return newTag(tag_pool, { name: tagname, attributes: {} })
      }
    },

    updateTag(payload: { id: TagID; data: UpdateTagForm }) {
      return updateTag(tag_pool, payload.id, payload.data)
    },

    searchTag(find_tag_name: string) {
      return idList2Tags(tag_pool, searchTag(tag_pool, find_tag_name))
    },
  }
}

function ItemActionRoute(
  item_pool: RepositoryInstance['item_pool']
) {
  return {
    addItem(payload: CreateItemForm) {
      return addItem(item_pool, payload)
    },

    getItem(payload: { item_id: ItemID }) {
      const item = getItem(item_pool, payload.item_id)
      return item
    },

    getItems(ids: ItemID[]) {
      return ids.map(id => {
        return getItem(item_pool, id)
      })
    },

    deleteItem(will_del_id: ItemID) {
      return deleteItem(item_pool, will_del_id)
    },

    listing(payload: { after_id?: ItemID; desc?: true; limit: number; filter_rules: FilterRule[] }) {
      return idList2Items(
        item_pool,
        listingItem(
          item_pool,
          'id',
          payload.after_id,
          payload.limit,
          payload.desc,
          payload.filter_rules
        )
      )
    },

    updateItem(payload: { id: ItemID, data: Partial<CreateItemForm> }) {
      updateItem(item_pool, payload.id, payload.data)
      return { message: 'done' }
    },
  }
}

function ActionRoute(
  // { action, payload }: { action: ActionName; payload: Actions },
  repo: RepositoryInstance,
  // backData: (body: any, status?: number) => void,
  // backFail: (status: number, message: string) => void,
) {
  return {
    ...ItemActionRoute(repo.item_pool),

    ...TagActionRoute(repo.tag_pool, repo.item_pool),

    save() {
      saveStorageSync(repo)
      return { message: 'done' }
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
