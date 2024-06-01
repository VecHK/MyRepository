import path from 'path'
import fs from 'fs/promises'
import Storage, { PartFields } from './v1-type'
import { IOloadPart, IOsavePart } from './io'
import { Item_raw, parseRawItems } from '../../../core/Item'
import { splitPoint } from '../../file-pool'
import { checkDirectory, prepareWriteDirectory } from '../../../utils/directory'
import { Memo, Serial, timeout } from 'new-vait'
import { processingStatus } from '../../../utils/cli'
import concurrentMap from '../../../utils/concurrent-map'

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

const _processing = Serial()

function processingWithError(asyncFn: () => Promise<void>) {
  return new Promise((res, rej) => {
    _processing(async () => {
      try {
        await asyncFn()
        res(undefined)
      } catch (err) {
        rej(err)
      }
    })
  })
}

export function PoolStorage(storage_path: string) {
  function jsonPath(prefix: string, id: number) {
    const split_num = splitPoint(__POOL_SPLIT_INTERVAL__, id)
    return path.join(
      prefix,
      `${split_num}`,
      `${id}.json`
    )
  }

  async function writeJSON(path: string, obj: any) {
    await fs.writeFile(path, JSON.stringify(obj))
  }

  function poolPath(cat: string) {
    return path.join(storage_path, `${cat}-pool`)
  }

  function id2Path(cat: string, id: number) {
    return jsonPath( poolPath(cat), id )
  }

  const __READALL_CONCURRENT = 2000

  async function readAllIgnoreSequence<Type>(
    cat: string,
    itemLoadedCallback?: (item: Type) => void
  ): Promise<Type[]> {
    const basepath = path.join(poolPath(cat))
    const splits = await fs.readdir(basepath)

    const jsonfiles_P = splits.map(split => {
      const split_path = path.join(basepath, split)
      return (
        checkDirectory(path.join(split_path))
          .then(status => {
            if (status === 'dir') {
              return fs.readdir(split_path).then(jsonfiles => {
                return jsonfiles.map(jsonfilename => {
                  return path.join(split_path, jsonfilename)
                })
              })
            } else {
              return []
            }
          })
      )
    })

    const jsonfiles = (await Promise.all(jsonfiles_P)).flat()

    return concurrentMap(
      __READALL_CONCURRENT,
      jsonfiles,
      async (jsonfile_path) => {
        const raw_json = await fs.readFile( jsonfile_path, { encoding: 'utf-8' } )
        const data = JSON.parse(raw_json) as Type
        if (itemLoadedCallback) {
          itemLoadedCallback(data)
        }
        return data
      },
    )
  }

  async function readAll<Type>(cat: string, itemLoadedCallback?: (item: Type) => void) {
    let list: Type[] = []

    await processingWithError(async () => {
      list = await readAllIgnoreSequence(cat, itemLoadedCallback)
    })

    return list
  }

  function ReadFile(cat: string) {
  }

  async function createFileIgnoreSerial(cat: string, obj: any) {
    const p = id2Path(cat, obj.id)
    const res = await checkDirectory(p)
    if (res === 'notfound') {
      await prepareWriteDirectory(p)
      await writeJSON(p, obj)
    } else if (res === 'dir') {
      throw new Error(`CreateFile: create failure because ${cat}(id=${obj.id})'s write path is a directory. path: ${p}`)
    } else {
      throw new Error(`CreateFile: create failure because ${cat}(id=${obj.id})'s write path is exists. path: ${p}`)
    }
  }
  function CreateFiles(cat: string) {
    return async (objs: any[]) => {
      await processingWithError(async () => {
        await Promise.all(
          objs.map(obj => createFileIgnoreSerial(cat, obj))
        )
      })
    }
  }
  function CreateFile(cat: string) {
    return async (obj: any) => {
      await processingWithError(async () => {
        await createFileIgnoreSerial(cat, obj)
      })
    }
  }

  async function updateFileIgnoreSerial(cat: string, obj: any) {
    const p = id2Path(cat, obj.id)
    const res = await checkDirectory(p)
    if (res === 'notfound') {
      throw new Error(`UpdateFile: update failure because ${cat}(id=${obj.id}) is non-exists. path: ${p}`)
    } else if (res === 'dir') {
      throw new Error(`UpdateFile: update failure because ${cat}(id=${obj.id})'s write path is a directory. path: ${p}`)
    } else {
      await writeJSON(p, obj)
    }
  }
  function UpdateFiles(cat: string) {
    return async (objs: any[]) => {
      await processingWithError(async () => {
        await Promise.all(
          objs.map(obj => updateFileIgnoreSerial(cat, obj))
        )
      })
    }
  }
  function UpdateFile(cat: string) {
    return async (obj: any) => {
      await processingWithError(async () => {
        await updateFileIgnoreSerial(cat, obj)
      })
    }
  }

  async function deleteFile(cat: string, id: number) {
    const p = id2Path(cat, id)
    const res = await checkDirectory(p)
    if (res === 'notfound') {
      throw new Error(`DeleteFile: delete failure because ${cat}(id=${id}) is non-exists. path: ${p}`)
    } else if (res === 'dir') {
      throw new Error(`DeleteFile: delete failure because ${cat}(id=${id})'s write path is a directory. path: ${p}`)
    } else {
      await fs.unlink(p)
    }
  }
  function DeleteFiles(cat: string) {
    return async (ids: number[]) => {
      await processingWithError(async () => {
        await Promise.all(
          ids.map(id => deleteFile(cat, id))
        )
      })
    }
  }
  function DeleteFile(cat: string) {
    return async (id: number) => {
      await processingWithError(async () => {
        await deleteFile(cat, id)
      })
    }
  }

  return {
    createItemFiles: CreateFiles('item'),
    createItemFile: CreateFile('item'),
    updateItemFiles: UpdateFiles('item'),
    updateItemFile: UpdateFile('item'),
    deleteItemFiles: DeleteFiles('item'),
    deleteItemFile: DeleteFile('item'),
    createTagFile: CreateFile('tag'),
    updateTagFile: UpdateFile('tag'),
    deleteTagFile: DeleteFile('tag'),
    readAllIgnoreSequence,
    readAll,
   } as const
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

    const {
      createItemFile,
      createTagFile,
    } = PoolStorage(storage_path)

    for (const item of items) {
      await createItemFile(item)
      updateStatus(`📄 已创建 item(id=${item.id}) 文件`)
    }

    for (const tag of tags) {
      await createTagFile(tag)
      updateStatus(`🏷️  已创建 tag(id=${tag.id}) 文件`)
    }

    done('')
  })
}
