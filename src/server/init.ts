import { Config, checkConfigObject } from './config'
import { StorageInst, StorageInstance } from './repo/storage/init'
import { ItemPool, addItem, createItemPool } from './core/ItemPool'
import { Item, Item_raw, parseRawItems } from './core/Item'
import { TagPool, createTagPool } from './core/TagPool'
import { Tag } from './core/Tag'
import { Wait } from 'vait'
import { initFilePool } from './repo/file-pool'
import fs from 'fs'
import { PoolOperation } from './core/Pool'
import { Signal } from 'new-vait'
import { ItemStorage, TagStorage } from './repo/storage'
import { PoolStorage } from './repo/storage/init/v2'

import pkg from '../../package.json' assert { type: 'json' }
import { createConfig } from './my-config'

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

export function saveStorageSync(repo: RepositoryInstance) {
  // repo.storage.storage_path
  throw new Error('saveStorageSync is deprecated')
  // const { storage, itempool_op: [getItemPool], tagpool_op: [getTagPool] } = repo
  // const items: Item[] = []
  // for (const [id, item] of getItemPool().map) {
  //   items.push(item)
  // }
  // fs.writeFileSync(storage.partPath('items'), JSON.stringify(items))

  // const tags: Tag[] = []
  // for (const [id, tag] of getTagPool().map) {
  //   tags.push(tag)
  // }
  // fs.writeFileSync(storage.partPath('tags'), JSON.stringify(tags))
}

export async function initRepositoryInstance(config: Config): Promise<RepositoryInstance> {
  const storage = await StorageInst(config.storage_path)

  const { readAll } = PoolStorage(config.storage_path)

  const tag_data_P = readAll<Tag>('tag')
  const item_raw_data_P = readAll<Item_raw>('item')

  return createRepositoryInstance({
    config,
    storage,
    tags: await tag_data_P,
    items: parseRawItems(await item_raw_data_P),
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
    // tag_pool: createTagPool(tags),
    // item_pool: createItemPool(items)
  })
}

export async function programStart() {
  console.log(`MyRepository ver${pkg.version}`)
  const config = createConfig()
  const repo = await initRepositoryInstance(config)
  return { repo, config }
}
