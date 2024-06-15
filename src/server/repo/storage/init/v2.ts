import path from 'path'
import fs from 'fs/promises'
import Storage, { PartFields } from './v1-type'
import { IOloadPart, IOsavePart } from './io'
import { Item, ItemID, Item_raw, parseRawItem, parseRawItems } from '../../../core/Item'
import { splitPoint } from '../../file-pool'
import { checkDirectory, prepareWriteDirectory } from '../../../utils/directory'
import { Queue, QueueSignal, Signal, runTask } from 'vait'
import { processingStatus } from '../../../utils/cli'
import { concurrentMap } from 'vait'
import { Driver, StorageObject, StorageQueue} from '../storage-queue'
import { Tag, TagID } from '../../../core/Tag'

const __MAX_CONCURRENCY = 100

const __POOL_SPLIT_INTERVAL__ = 4000

export function LoadPart(storage_path: string) {
  return <P extends PartFields>(part: P) => {
    return IOloadPart<P, Storage[P]>(storage_path, part)
  }
}

export function SavePart(storage_path: string) {
  return <P extends PartFields>(part: P, obj: any) => {
    return IOsavePart<P, Storage[P]>(storage_path, part, obj)
  }
}

const fsQueue = Queue(QueueSignal())
fsQueue.setMaxConcurrent(__MAX_CONCURRENCY)

const poolPath = (storage_path: string, cat: string) => (
  path.join( storage_path, `${cat}-pool` )
)

function Id2Path<ID extends number>(storage_path: string, cat: string) {
  function jsonPath(prefix: string, id: ID) {
    const split_num = splitPoint(__POOL_SPLIT_INTERVAL__, id)
    return path.join(
      prefix,
      `${split_num}`,
      `${id}.json`
    )
  }

  const id2Path = (id: ID) => jsonPath(poolPath(storage_path, cat), id)

  return id2Path
}

function queueCheckDirectory(path: string) {
  return runTask(fsQueue, async () => {
    try {
      return await checkDirectory(path)
    } catch (err) {
      console.error('await checkDirectory(path)', err)
      throw err
    }
  })
}

function InitDriver<
  ID extends number,
  Obj extends StorageObject<ID>
>(
  cat: string,
  storage_path: string,
): Driver<ID, Obj> {
  const id2Path = Id2Path<ID>(storage_path, cat)

  async function writeJSON(path: string, obj: Obj) {
    await runTask(fsQueue, () => fs.writeFile(path, JSON.stringify(obj)))
  }

  const NAME = `${cat}Driver`

  function throwNotFound(type: keyof Driver<ID, Obj>, id: ID, path: string): never {
    throw new Error(`${NAME}: ${type} failure because ${cat}(id=${id}) is non-exists. path: ${path}`)
  }
  function throwDirectory(type: keyof Driver<ID, Obj>, id: ID, path: string): never {
    throw new Error(`${NAME}: ${type} failure because ${cat}(id=${id})'s write path is a directory. path: ${path}`)
  }
  function throwExists(type: keyof Driver<ID, Obj>, id: ID, path: string): never {
    throw new Error(`${NAME}: ${type} failure because ${cat}(id=${id}) is non-exists. path: ${path}`)
  }

  return {
    async readRaw(id) {
      const p = id2Path(id)
      const res = await queueCheckDirectory(p)
      if (res === 'notfound') {
        throwNotFound('readRaw', id, p)
      } else if (res === 'dir') {
        throwDirectory('readRaw', id, p)
      } else {
        const data = await runTask(fsQueue, () => fs.readFile(p, { encoding: 'utf8' }))
        return data
      }
    },

    async create(obj) {
      const p = id2Path(obj.id)
      const res = await queueCheckDirectory(p)
      if (res === 'notfound') {
        await prepareWriteDirectory(p)
        await writeJSON(p, obj)
      } else if (res === 'dir') {
        throwDirectory('create', obj.id, p)
      } else {
        throwExists('create', obj.id, p)
      }
    },

    async delete(id) {
      const p = id2Path(id)
      const res = await queueCheckDirectory(p)
      if (res === 'notfound') {
        throwNotFound('delete', id, p)
      } else if (res === 'dir') {
        throwDirectory('delete', id, p)
      } else {
        await runTask(fsQueue, () => fs.unlink(p))
      }
    },

    async update(obj) {
      const p = id2Path(obj.id)
      const res = await queueCheckDirectory(p)
      if (res === 'notfound') {
        throwNotFound('update', obj.id, p)
      } else if (res === 'dir') {
        throwDirectory('update', obj.id, p)
      } else {
        await writeJSON(p, obj)
      }
    },
  }
}

function InitStorage<
  ID extends number,
  Obj extends StorageObject<ID>
>(
  cat: string,
  storage_path: string,
  parser: (raw: string) => Obj,
  driver = InitDriver(cat, storage_path)
) {
  const queue = StorageQueue<ID, Obj>(driver)

  async function readAllIgnoreSequence(
    itemLoadedCallback?: (obj: Obj) => void
  ): Promise<Obj[]> {
    const basepath = path.join(poolPath(storage_path, cat))

    const splits = await runTask(fsQueue, () => fs.readdir(basepath))

    const jsonfiles_P = (
      concurrentMap(3, splits, async (split) => {
        const split_path = path.join(basepath, split)
        return (
          queueCheckDirectory(split_path).then(status => {
            if (status === 'dir') {
              return runTask(fsQueue, () => (
                fs.readdir(split_path).then(jsonfiles => {
                  return jsonfiles.map(jsonfilename => {
                    return path.join(split_path, jsonfilename)
                  })
                })
              ))
            } else {
              return []
            }
          })
        )
      })
    )
    const jsonfiles = (await jsonfiles_P).flat()

    return (
      concurrentMap(
        __MAX_CONCURRENCY,
        jsonfiles,
        async (jsonfile_path) => {
          return runTask(fsQueue, async () => {
            const raw_json = await fs.readFile( jsonfile_path, { encoding: 'utf-8' } )
            const data = parser(raw_json) as Obj
            if (itemLoadedCallback) {
              itemLoadedCallback(data)
            }
            return data
          })
        },
      )
    )
  }

  async function readAll(itemLoadedCallback?: (item: Obj) => void) {
    let list: Obj[] = []

    queue.queuePool.addTask(0 as ID, 'other', () => Promise.resolve())
    await Signal.wait(queue.queuePool.signal.ALL_DONE)

    queue.queuePool.pause()
    try {
      list = await readAllIgnoreSequence(itemLoadedCallback)
    } finally {
      queue.queuePool.resume()
    }

    return list
  }

  return {
    queue,
    driver,
    readAllIgnoreSequence,
    readAll,
   } as const
}

export function itemPoolStorage(storage_path: string) {
  return (
    InitStorage<ItemID, Item>('item', storage_path, raw => {
      const item_raw = JSON.parse(raw) as Item_raw
      return parseRawItem(item_raw)
    })
  )
}

export function PoolStorage(storage_path: string) {
  return {
    item: itemPoolStorage(storage_path),
    tag: (
      InitStorage<TagID, Tag>('tag', storage_path, raw => {
        return JSON.parse(raw)
      })
    )
  }
}

export async function updater(
  storage_path: string
) {
  await processingStatus(async ({ updateStatus, done }) => {
    updateStatus('读取items.json')
    const raw_items = await LoadPart(storage_path)('items')
    const items = parseRawItems(raw_items)

    updateStatus('读取tags.json')
    const tags = await LoadPart(storage_path)('tags')

    const storage = PoolStorage(storage_path)

    for (const item of items) {
      await storage.item.driver.create(item)
      updateStatus(`📄 已创建 item(id=${item.id}) 文件`)
    }

    for (const tag of tags) {
      await storage.tag.driver.create(tag)
      updateStatus(`🏷️  已创建 tag(id=${tag.id}) 文件`)
    }

    done('')
  })
}
