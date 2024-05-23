import { TagPool, getTag } from '../../core/TagPool'
import { Item } from '../../core/Item'
import { ItemPool, getItem } from '../../core/ItemPool'
import { PoolOperation, diffItemPoolMap, diffTagPoolMap } from '../../core/Pool'
import { Tag } from '../../core/Tag'
import { PoolStorage } from './init/v2'

let has_failure: Error | null = null

export function ItemStorage(
  item_pool: ItemPool,
  storage_path: string
) {
  const { createItemFile, updateItemFile, deleteItemFile } = PoolStorage(storage_path)
  const [itemPool, tagOp, setItemPool] = PoolOperation<ItemPool, Item>(
    item_pool,
    (opfn, prev) => {
      if (has_failure) {
        console.error(has_failure)
        throw new Error('has failure')
      }

      const diff = diffItemPoolMap(itemPool().map, prev.map)
      for (const item_id of diff.adds.keys()) {
        createItemFile(getItem(itemPool(), item_id))
          .then(() => {
            console.log(`item(id=${item_id}) added.`)
          })
          .catch(err => {
            console.error('createItemFile failure!', err)
            has_failure = err
          })
      }
      for (const item_id of diff.dels.keys()) {
        deleteItemFile(item_id)
          .then(() => {
            console.log(`item(id=${item_id}) deleted.`)
          })
          .catch(err => {
            console.error('deleteItemFile failure!', err)
            has_failure = err
          })
      }
      for (const item_id of diff.changes.keys()) {
        updateItemFile(getItem(itemPool(), item_id))
          .then(() => {
            console.log(`item(id=${item_id}) updated.`)
          })
          .catch(err => {
            console.error('updateItemFile failure!', err)
            has_failure = err
          })
      }
    }
  )
  return [itemPool, tagOp, setItemPool] as const
}

export function TagStorage(
  init_tag_pool: TagPool,
  storage_path: string
) {
  const { createTagFile, updateTagFile, deleteTagFile } = PoolStorage(storage_path)
  const [tagPool, tagOp, setTagPool] = PoolOperation<TagPool, Tag>(
    init_tag_pool,
    (opfn, prev) => {
      if (has_failure) {
        console.error(has_failure)
        throw new Error('has failure')
      }

      const diff = diffTagPoolMap(tagPool().map, prev.map)
      for (const tag_id of diff.adds.keys()) {
        createTagFile(getTag(tagPool(), tag_id))
          .then(() => {
            console.log(`tag(id=${tag_id}) added.`)
          })
          .catch(err => {
            console.error('createTagFile failure', err)
            has_failure = err
          })
      }
      for (const tag_id of diff.dels.keys()) {
        deleteTagFile(tag_id)
          .then(() => {
            console.log(`tag(id=${tag_id}) deleted.`)
          })
          .catch(err => {
            console.error('deleteTagFile failure', err)
            has_failure = err
          })
      }
      for (const tag_id of diff.changes.keys()) {
        updateTagFile(getTag(tagPool(), tag_id))
          .then(() => {
            console.log(`tag(id=${tag_id}) updated.`)
          })
          .catch(err => {
            console.error('updateTagFile failure', err)
            has_failure = err
          })
      }
    }
  )
  return [tagPool, tagOp, setTagPool] as const
}
