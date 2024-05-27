import pkg from '../../package.json' assert { type: 'json' }

import { processingStatus } from './utils/cli'

import { Config, checkConfigObject } from './config'
import { createConfig } from './my-config'

import { Item, Item_raw, parseRawItems } from './core/Item'
import { Tag } from './core/Tag'
import { createItemPool } from './core/ItemPool'
import { createTagPool } from './core/TagPool'
import { StorageInst, StorageInstance } from './repo/storage/init'
import { ItemStorage, TagStorage } from './repo/storage'
import { PoolStorage } from './repo/storage/init/v2'
import { initFilePool } from './repo/file-pool'

export function initConfig(obj: Record<string, unknown>) {
  return checkConfigObject(obj)
}

export type RepositoryInstance = {
  config: Config,
  storage: Awaited<StorageInstance>
  file_pool: Awaited<ReturnType<typeof initFilePool>>,
  itempool_op: ReturnType<typeof ItemStorage>
  tagpool_op: ReturnType<typeof TagStorage>
}

export async function initRepositoryInstance(config: Config): Promise<RepositoryInstance> {
  const storage = await StorageInst(config.storage_path)

  const { readAllIgnoreSequence } = PoolStorage(config.storage_path)

  const [ tag_data, item_raw_data ] = await processingStatus(async ({ updateStatus, done }) => {
    let count_tag = 0
    let count_item = 0

    const refreshStatus = () => {
      updateStatus(`loading data...(found ${count_tag} tags) (found ${count_item} items)`)
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

    done('')

    return res
  })

  return createRepositoryInstance({
    config,
    storage,
    tags: tag_data,
    items: parseRawItems(item_raw_data),
  })
}

export async function createRepositoryInstance({
  config,
  storage,
  tags,
  items,
}: {
  config: Config,
  storage: StorageInstance,
  tags: Tag[],
  items: Item[],
}): Promise<RepositoryInstance> {
  const tagpool_op = TagStorage(createTagPool(tags), storage.storage_path)

  const itempool_op = ItemStorage(
    createItemPool(items),
    storage.storage_path
  )

  return Object.freeze({
    config,
    storage,
    file_pool: await initFilePool(config.filepool_path),
    tagpool_op,
    itempool_op,
  })
}

export async function programStart() {
  console.log(`MyRepository ver${pkg.version}`)
  const config = createConfig()
  const repo = await initRepositoryInstance(config)
  return { repo, config }
}
