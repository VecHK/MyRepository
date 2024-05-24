import { IOsavePart, fullPartPath } from './io'

// -------- 每次添加新的版本后，都得修改这块地方 --------
// -------- 隔壁 update.ts 的 updater 也要更新   --------
export type VERSIONS = 1 | 2
export const LATEST_VERSION: VERSIONS = 2
import V2 from './v2-type'
import { LoadPart, PoolStorage, SavePart } from './v2'
import { update } from './update'
export type LatestVersion = V2
// ------------------------------------------------------

import { mkdir } from 'fs/promises'
import { checkDirectory } from '../../../utils/directory'
import { readJSON } from '../../../utils/json'
import { curry, partial } from 'ramda'

async function initStorage(storage_path: string) {
  switch (await checkDirectory(storage_path)) {
    case 'is_not_dir':
      throw new Error(`初始化存储库失败，路径[${storage_path}]并不是一个目录`)

    case 'notfound':
      await mkdir(storage_path, { recursive: true })
      return initStorage(storage_path)

    case 'dir':
      await Promise.all([
        IOsavePart(storage_path, 'version', 1),
        IOsavePart(storage_path, 'items', []),
        IOsavePart(storage_path, 'tags', [])
      ])
      break
  }
}

export type StorageInstance = Awaited<ReturnType<typeof StorageInst>>

export function getStorageVersion(storage_path: string) {
  return readJSON<VERSIONS>(fullPartPath(storage_path, 'version'))
}

export async function StorageInst(storage_path: string) {
  const status = await checkDirectory(storage_path)

  const partPath = curry(fullPartPath)(storage_path)

  if (status === 'dir') {
    const current_version = await getStorageVersion(storage_path)
    if (current_version > LATEST_VERSION) {
      throw new Error(
        `存储库版本(v${current_version})超过程序所支持的版本(v${LATEST_VERSION})。🧎对不起，老版本的程序是无法读取更高版本的存储库的`
      )
    } else if (current_version < LATEST_VERSION) {
      throw new Error(`当前的存储库版本(v${current_version})较低，请更新至(v${LATEST_VERSION})。运行"npm run update-storage"以更新存储库`)
    } else {
      return Object.freeze({
        storage_version: current_version,
        storage_path,
        partPath,
        loadPart: LoadPart(storage_path),
        savePart: SavePart(storage_path),
      })
    }
  } else {
    await initStorage(storage_path)
    return StorageInst(storage_path)
  }
}
