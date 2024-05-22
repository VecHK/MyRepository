import { Config, checkConfigObject } from './config'
import { StorageInst, StorageInstance } from './repo/storage/init'
import { ItemOperation, ItemPool, createItemPool } from './core/ItemPool'
import { Item, parseRawItems } from './core/Item'
import { TagOperation, TagPool, createTagPool } from './core/TagPool'
import { Tag } from './core/Tag'
import { Wait } from 'vait'
import { initFilePool } from './repo/file-pool'
import fs from 'fs'
import { PoolOperation } from './core/Pool'

export function initConfig(obj: Record<string, unknown>) {
  return checkConfigObject(obj)
}

export type RepositoryInstance = {
  config: Config,
  storage: Awaited<StorageInstance>
  file_pool: Awaited<ReturnType<typeof initFilePool>>,
  itempool_op: ReturnType<typeof ItemOperation>
  tagpool_op: ReturnType<typeof TagOperation>
  // item_pool: ItemPool,
  // tag_pool: TagPool,
}

export function saveStorageSync(repo: RepositoryInstance) {
  // repo.storage.storage_path
  const { storage, itempool_op: [getItemPool], tagpool_op: [getTagPool] } = repo
  const items: Item[] = []
  for (const [id, item] of getItemPool().map) {
    items.push(item)
  }
  fs.writeFileSync(storage.partPath('items'), JSON.stringify(items))

  const tags: Tag[] = []
  for (const [id, tag] of getTagPool().map) {
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
  const tagpool_op = TagOperation(createTagPool(tags))
  const itempool_op = ItemOperation(createItemPool(items))
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
