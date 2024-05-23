import { CreateItemForm, Item, Item_raw, itemID } from '../src/server/core/Item'
import { ItemPool } from '../src/server/core/ItemPool'
import { PoolOperation } from '../src/server/core/Pool'
import { Tag } from '../src/server/core/Tag'
import { TagPool } from '../src/server/core/TagPool'

export function createForm(append: Partial<CreateItemForm> = {}): CreateItemForm {
  return {
    title: '',
    tags: [],
    attributes: {},
    cover: null,
    original: null,
    cover_width: 0,
    cover_height: 0,
    parent: null,
    release_date: null,
    ...append
  }
}

export function initPlainRawItem(id: number): Item_raw {
  return {
    ...createForm(),
    id: itemID(id),
    create_date: (new Date).toJSON(),
    update_date: (new Date).toJSON(),
  }
}

export const generateRawItems = (): Item_raw[] => {
  return [
    initPlainRawItem(1),
    initPlainRawItem(2),
    initPlainRawItem(9),
    initPlainRawItem(3),
    initPlainRawItem(4),
  ]
}

export function ItemOperation(p: ItemPool) {
  return PoolOperation<ItemPool, Item>(p, () => {})
}

export function TagOperation(p: TagPool) {
  return PoolOperation<TagPool, Tag>(p, () => {})
}
