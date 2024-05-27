import { processingStatus } from '../utils/cli'

import { Config } from '../config'

import { Item, Item_raw, parseRawItems } from '../core/Item'
import { Tag } from '../core/Tag'
import { createItemPool } from '../core/ItemPool'
import { createTagPool } from '../core/TagPool'
import { StorageInst, StorageInstance } from '../repo/storage/init'
import { ItemStorage, TagStorage } from '../repo/storage'
import { PoolStorage } from '../repo/storage/init/v2'
import { initFilePool } from '../repo/file-pool'

export type RepositoryInstance = {
  config: Config,
  storage: Awaited<StorageInstance>
  file_pool: Awaited<ReturnType<typeof initFilePool>>,
  itempool_op: ReturnType<typeof ItemStorage>
  tagpool_op: ReturnType<typeof TagStorage>
}

export async function initRepositoryInstance(
  config: Config,
  slient = true
): Promise<RepositoryInstance> {
  const storage = await StorageInst(config.storage_path)

  const { readAllIgnoreSequence } = PoolStorage(config.storage_path)

  const [ tag_data, item_raw_data ] = await processingStatus(async ({ updateStatus, done }) => {
    let count_tag = 0
    let count_item = 0

    const refreshStatus = () => {
      if (!slient) {
        updateStatus(`loading data...(found ${count_tag} tags) (found ${count_item} items)`)
      }
    }

    const tag_data_P = readAllIgnoreSequence<Tag>('tag', tag => {
      count_tag += 1
      refreshStatus()
    })

    const item_raw_data_P = readAllIgnoreSequence<Item_raw>('item', item_raw => {
      count_item += 1
      refreshStatus()
    })

    const res = [await tag_data_P, await item_raw_data_P] as const

    if (!slient) {
      done('')
    }

    return res
  })

  return createRepositoryInstance({
    config,
    storage,
    tags: tag_data,
    items: parseRawItems(item_raw_data),
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
  const tagpool_op = TagStorage(
    createTagPool(tags),
    storage.storage_path,
    slient
  )

  const itempool_op = ItemStorage(
    createItemPool(items),
    storage.storage_path,
    slient
  )

  return Object.freeze({
    config,
    storage,
    file_pool: await initFilePool(config.filepool_path),
    tagpool_op,
    itempool_op,
  })
}
