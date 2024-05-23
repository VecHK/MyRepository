import path from 'path'
import fs from 'fs/promises'
import Storage, { PartFields } from './v1-type'
import { IOloadPart, IOsavePart } from './io'
import { parseRawItems } from '../../../core/Item'
import { splitPoint } from '../../file-pool'
import { checkDirectory, prepareWriteDirectory } from '../../../utils/directory'
import { VERSIONS } from '.'
import { Serial } from 'new-vait'

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

  async function readAll<Type>(cat: string) {
    const list: Type[] = []

    await processingWithError(async () => {
      const basepath = path.join(poolPath(cat))
      const splits = await fs.readdir(basepath)

      for (const split of splits) {
        const split_path = path.join(basepath, split)
        const status = await checkDirectory(path.join(split_path))
        if (status === 'dir') {
          const jsonfiles = await fs.readdir(split_path)
          for (const jsonfilename of jsonfiles) {
            if (jsonfilename.includes('.json')) {
              const raw_json = await fs.readFile(path.join(split_path, jsonfilename), { encoding: 'utf-8' })
              const data = JSON.parse(raw_json) as Type
              list.push(data)
            }
          }
        }
      }
    })

    return list
  }

  function ReadFile(cat: string) {
  }

  function CreateFile(cat: string) {
    return async (obj: any) => {
      await processingWithError(async () => {
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
      })
    }
  }

  function UpdateFile(cat: string) {
    return async (obj: any) => {
      await processingWithError(async () => {
        const p = id2Path(cat, obj.id)
        const res = await checkDirectory(p)
        if (res === 'notfound') {
          throw new Error(`UpdateFile: update failure because ${cat}(id=${obj.id}) is non-exists. path: ${p}`)
        } else if (res === 'dir') {
          throw new Error(`UpdateFile: update failure because ${cat}(id=${obj.id})'s write path is a directory. path: ${p}`)
        } else {
          await writeJSON(p, obj)
        }
      })
    }
  }

  function DeleteFile(cat: string) {
    return async (id: number) => {
      await processingWithError(async () => {
        const p = id2Path(cat, id)
        const res = await checkDirectory(p)
        if (res === 'notfound') {
          throw new Error(`DeleteFile: delete failure because ${cat}(id=${id}) is non-exists. path: ${p}`)
        } else if (res === 'dir') {
          throw new Error(`DeleteFile: delete failure because ${cat}(id=${id})'s write path is a directory. path: ${p}`)
        } else {
          await fs.unlink(p)
        }
      })
    }
  }

  return {
    createItemFile: CreateFile('item'),
    updateItemFile: UpdateFile('item'),
    deleteItemFile: DeleteFile('item'),
    createTagFile: CreateFile('tag'),
    updateTagFile: UpdateFile('tag'),
    deleteTagFile: DeleteFile('tag'),
    readAll,
   } as const
}

export async function updater(storage_path: string) {
  const raw_items = await LoadPart(storage_path)('items')
  const items = parseRawItems(raw_items)
  const tags = await LoadPart(storage_path)('tags')

  const {
    createItemFile,
    createTagFile
  } = PoolStorage(storage_path)

  for (const item of items) {
    await createItemFile(item)
  }

  for (const tag of tags) {
    await createTagFile(tag)
  }
}
