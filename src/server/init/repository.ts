import { processingStatus } from '../utils/cli'

import { Config } from '../config'

import { Item, Item_raw, parseRawItems } from '../core/Item'
import { Tag } from '../core/Tag'
import { createItemPool } from '../core/ItemPool'
import { createTagPool } from '../core/TagPool'
import { StorageInst, StorageInstance } from '../repo/storage/init'
import { ApplyItemStorage, ApplyTagStorage } from '../repo/storage'
import { PoolStorage } from '../repo/storage/init/v2'
import { initFilePool } from '../repo/file-pool'

export type RepositoryInstance = {
  config: Config,
  storage: Awaited<StorageInstance>
  file_pool: Awaited<ReturnType<typeof initFilePool>>,
  itempool_op: ReturnType<typeof ApplyItemStorage>
  tagpool_op: ReturnType<typeof ApplyTagStorage>
}

export async function initRepositoryInstance(
  config: Config,
  slient = true
): Promise<RepositoryInstance> {
  const storage = await StorageInst(config.storage_path)

  const poolStorage = PoolStorage(config.storage_path)

  const [ items, tags ] = await processingStatus(async ({ updateStatus, done }) => {
    let count_tag = 0
    let count_item = 0

    const refreshStatus = () => {
      if (!slient) {
        updateStatus(`loading data...(found ${count_tag} tags) (found ${count_item} items)`)
      }
    }

    const item_data_P = poolStorage.item.readAllIgnoreSequence(item => {
      count_item += 1
      refreshStatus()
    })

    const tag_data_P = poolStorage.tag.readAllIgnoreSequence(tag => {
      count_tag += 1
      refreshStatus()
    })

    try {
      const res = [await item_data_P, await tag_data_P] as const

      if (!slient) {
        done('')
      }

      return res
    } catch (err) {
      console.error(err)
      throw err
    }
  })

  return createRepositoryInstance({
    config,
    storage,
    tags,
    items,
    slient,
  })
}

async function createRepositoryInstance({
  config,
  storage,
  tags,
  items,
  slient,
}: {
  config: Config,
  storage: StorageInstance,
  tags: Tag[],
  items: Item[],
  slient: boolean
}): Promise<RepositoryInstance> {
  const poolStorage = PoolStorage(config.storage_path)
  return Object.freeze({
    config,
    storage,
    file_pool: await initFilePool(config.filepool_path),
    tagpool_op: (
      ApplyTagStorage({
        tag_pool: createTagPool(tags),
        storageQueue: poolStorage.tag.queue,
        slient,
      })
    ),
    itempool_op: (
      ApplyItemStorage({
        item_pool: createItemPool(items),
        storageQueue: poolStorage.item.queue,
        slient,
      })
    ),
  })
}
