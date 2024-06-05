import fs from 'fs'
import Koa from 'koa'
import path from 'path'

import Router from '@koa/router'
import cors from '@koa/cors'
import proxy from 'koa-proxies'
import { koaBody } from 'koa-body'
import { bodyParser } from '@koa/bodyparser'

import { Config } from '../config'
import { RepositoryInstance } from '../init/repository'

import { FilterGroup, FilterRule, ItemFilterCond, ItemIndexedField, addItem, deleteItem, getItem, idList2Items, listingItemAdvanced, listingItemSimple, select, updateItem } from '../core/ItemPool'
import { ItemJSONForm, Item, ItemID, Item_raw } from '../core/Item'
import { FileID, constructFileID } from '../core/File'
import { TagForm, Tag, TagID } from '../core/Tag'
import { UpdateTagForm, getTag, getTagIdByName, idList2Tags, newTag, searchTag, tagnameHasDuplicate, updateTag } from '../core/TagPool'
import { generateThumb, getImageDimession } from '../utils/generate-image'
import pathExists, { initDirectorySync, prepareWriteDirectory } from '../utils/directory'
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

function singleUploadRouter(
  repo_inst: RepositoryInstance
) {
  const router = new Router()

  const upload_temp_dir = path.join(
    repo_inst.storage.storage_path,
    './temp'
  )

  initDirectorySync(upload_temp_dir)
  const files = fs.readdirSync(upload_temp_dir)
  for (const file of files) {
    fs.unlinkSync(path.join(upload_temp_dir, file))
  }

  const singleFileUpload = koaBody({
    multipart: true,
    formidable: {
      maxFileSize: Infinity,
      multiples: false,
      maxFiles: 1,
      maxFields: 1,
      allowEmptyFiles: false,
      keepExtensions: true,
      uploadDir: upload_temp_dir,
      filter: part => part.name === 'file'
    },
  })

  function detectSingleFile(
    ctx: Koa.ParameterizedContext<Koa.DefaultState, Koa.DefaultContext & Router.RouterParamContext<Koa.DefaultState, Koa.DefaultContext>, any>
  ) {
    const { files } = ctx.request
    if (files === undefined) {
      throw new Error('upload failure, ctx.request.files === undefined')
    }
    if (Object.keys(files).length > 1) {
      throw new Error('upload failure, only require \'file\' fieldname')
    }

    const file = files['file']
    if (file === undefined) {
      throw new Error('upload failure, require \'file\' fieldname')
    } else if (Array.isArray(file)) {
      throw new Error('upload failure, require single upload')
    }

    return file
  }

  router.post('file/:file_id', singleFileUpload, async ctx => {
    const file = detectSingleFile(ctx)
    const { file_id } = ctx.params
    if ((typeof file_id === 'string') && file_id.length) {
      if (await repo_inst.file_pool.fileExists(file_id as FileID)) {
        const source_file_path = repo_inst.file_pool.getFilePath(file_id as FileID)
        await fs.promises.unlink(source_file_path)
        await fs.promises.rename(file.filepath, source_file_path)
        return backData(ctx, file_id, 200)
      } else {
        await fs.promises.unlink(file.filepath)
        return backFail(ctx, 400, `file(id=${file_id}) not found`)
      }
    } else {
      await fs.promises.unlink(file.filepath)
      return backFail(ctx, 400, 'illegal file_id')
    }
  })

  router.post('file', singleFileUpload, async (ctx) => {
    const uploaded = detectSingleFile(ctx)

    const f_num = await repo_inst.file_pool.requestFileNumber()
    const f_id_extname = path.extname(uploaded.originalFilename || '').replace('.', '')

    const file_id = constructFileID(f_num, f_id_extname)

    const new_file_write_path = repo_inst.file_pool.getFilePath(file_id)
    await prepareWriteDirectory(new_file_write_path)

    await fs.promises.rename(uploaded.filepath, new_file_write_path)

    return backData(ctx, file_id, 200)
  })

  router.delete('file/:file_id', async ctx => {
    const { file_id } = ctx.params
    if ( typeof file_id === 'string' ) {
      const file_path = repo_inst.file_pool.getFilePath(file_id as FileID)
      if (await pathExists(file_path)) {
        await fs.promises.unlink(file_path)
        backData(ctx, { message: 'done' }, 200)
      } else {
        backFail(ctx, 404, `file not found(file_id=${file_id})`)
      }
    } else {
      backFail(ctx, 400, 'require file_id')
    }
  })

  router.get('readfile/:file_id', async ctx => {
    const { file_id } = ctx.params
    if ( typeof file_id === 'string' ) {
      const file_path = repo_inst.file_pool.getFilePath(file_id as FileID)
      const stream = fs.createReadStream(file_path)
      ctx.body = stream
    }
  })

  return router
}

export function createApi(
  config: Config,
  repo_inst: RepositoryInstance
) {
  const app = new Koa()
  const router = new Router()

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

  const upload_router = singleUploadRouter(repo_inst)
  router.use('/', upload_router.routes(), upload_router.allowedMethods())

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

    filterList({ ids, filter_groups }: {
      ids: ItemID[],
      filter_groups: FilterGroup[]
    }): Item[] {
      return (
        idList2Items(itemPool(), ids).filter(
          ( filter_groups.length === 0 ) ?
          (() => true) : ItemFilterCond(filter_groups)
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
        listingItemSimple(
          itemPool(),
          payload.sort_by ? payload.sort_by : 'id',
          payload.after_id,
          payload.limit,
          Boolean(payload.desc),
          payload.filter_rules
        )
      )
    },

    listingItemAdvanced(payload: {
      sort_by?: ItemIndexedField
      after_id?: ItemID
      desc?: boolean
      limit: number
      filter_groups: FilterGroup[]
    }) {
      const prepost_groups = payload.filter_groups.map<FilterGroup>(group => {
        return {
          ...group,
          rules: group.rules.map(rule => {
            if (rule.name === '__tagname_contains') {
              return {
                ...rule,
                name: '__custom_predicate',
                input: (rule.input.length === 0) ? (() => false) : (() => {
                  const searched_tagids = searchTag(tagPool(), rule.input, 0)
                  return (item: Item) => item.tags.some(
                    tagid => searched_tagids.includes(tagid)
                  )
                })()
              }
            } else {
              return rule
            }
          })
        }
      })

      return idList2Items(
        itemPool(),
        listingItemAdvanced(
          itemPool(),
          payload.sort_by ? payload.sort_by : 'id',
          payload.after_id,
          payload.limit,
          Boolean(payload.desc),
          prepost_groups
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
