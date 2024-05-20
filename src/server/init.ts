import { Config, checkConfigObject } from './config'
import { StorageInst, StorageInstance } from './repo/storage/init'
import { ItemPool, createItemPool } from './core/ItemPool'
import { Item, parseRawItems } from './core/Item'
import { TagPool, createTagPool } from './core/TagPool'
import { Tag } from './core/Tag'
import { Wait } from 'vait'
import { initFilePool } from './repo/file-pool'
import fs from 'fs'

export function initConfig(obj: Record<string, unknown>) {
  return checkConfigObject(obj)
}

export type RepositoryInstance = Readonly<{
  config: Config,
  storage: Awaited<StorageInstance>
  file_pool: Awaited<ReturnType<typeof initFilePool>>,
  item_pool: ItemPool,
  tag_pool: TagPool,
}>

export function saveStorageSync(repo: RepositoryInstance) {
  // repo.storage.storage_path
  const { storage, item_pool, tag_pool } = repo
  const items: Item[] = []
  for (const [id, item] of item_pool.map) {
    items.push(item)
  }
  fs.writeFileSync(storage.partPath('items'), JSON.stringify(items))

  const tags: Tag[] = []
  for (const [id, tag] of tag_pool.map) {
    tags.push(tag)
  }
  fs.writeFileSync(storage.partPath('tags'), JSON.stringify(tags))
}

export async function initRepositoryInstance(config: Config): Promise<RepositoryInstance> {
  const storage = await StorageInst(config.storage_path)

  const storage_tags_P = storage.loadPart('tags')
  const storage_items_P = storage.loadPart('items')

  return createRepositoryInstance({
    config,
    storage,
    tags: await storage_tags_P,
    items: parseRawItems(await storage_items_P)
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
  return Object.freeze({
    config,
    storage,
    file_pool: await initFilePool(config.filepool_path),
    tag_pool: createTagPool(tags),
    item_pool: createItemPool(items)
  })
}
