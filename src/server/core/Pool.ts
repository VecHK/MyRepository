import { Memo, Signal } from 'new-vait'
import { Tag, TagID } from './Tag'
import { TagPool, deleteTag } from './TagPool'
import { ItemPool, getItem, listingItemSimple, updateItem } from './ItemPool'
import { Item, ItemID } from './Item'
import Immutable from 'immutable'

export function diffItemPoolMap(map_new: ItemPool['map'], map_prev: ItemPool['map']) {
  return map_new.reduce(({ dels, adds, changes }, item_new) => {
    const item_prev = map_prev.get(item_new.id)
    if (item_prev) {
      const new_dels = dels.delete(item_new.id)
      if (item_prev !== item_new) {
        return { adds, dels: new_dels, changes: changes.set(item_prev.id, item_new) }
      } else {
        return { adds, changes, dels: new_dels }
      }
    } else {
      return { dels, changes, adds: adds.set(item_new.id, item_new) }
    }
  }, {
    dels: map_prev,
    adds: Immutable.Map<ItemID, Item>(),
    changes: Immutable.Map<ItemID, Item>(),
  })
}

export function diffTagPoolMap(map_new: TagPool['map'], map_prev: TagPool['map']) {
  return map_new.reduce(({ dels, adds, changes }, item_new) => {
    const item_prev = map_prev.get(item_new.id)
    if (item_prev) {
      const new_dels = dels.delete(item_new.id)
      if (item_prev !== item_new) {
        return { adds, dels: new_dels, changes: changes.set(item_prev.id, item_new) }
      } else {
        return { adds, changes, dels: new_dels }
      }
    } else {
      return { dels, changes, adds: adds.set(item_new.id, item_new) }
    }
  }, {
    dels: map_prev,
    adds: Immutable.Map<TagID, Tag>(),
    changes: Immutable.Map<TagID, Tag>(),
  })
}

export function PoolOperation<Pool, PoolItem>(
  pool: Pool,
  updatedCallback:
    <OpFn>(opfn: OpFn, prev: Pool) => void
) {
  const [getPool, setPool] = Memo<Pool>(pool)
  return [
    getPool,
    <
      T,
      A extends T[],
      IP extends Pool,
      I extends PoolItem,
      M extends Readonly<[I, IP]>,
      R extends IP | M,
      OpFn extends <Args extends A>(p: Pool, ...args: Args) => R,
      OpReturn extends ReturnType<OpFn>,
      RA = OpReturn extends IP ? void : I
    >(
      opFn: OpFn,
      ...args: A
    ): RA => {
      const res = opFn<A>(getPool(), ...args)
      const prev = getPool()

      if (Array.isArray(res)) {
        const [ item, newpool ] = res as M
        setPool(newpool)
        updatedCallback(opFn, prev)
        return item as unknown as RA
      } else {
        setPool(res as Pool)
        updatedCallback(opFn, prev)
        return undefined as RA
      }
    },
    setPool,
  ] as const
}

export function deleteTagAndUpdateItems(
  tag_pool: TagPool,
  item_pool: ItemPool,
  will_remove_tag_id: TagID
): Readonly<[TagPool, ItemPool]> {
  const list = listingItemSimple(item_pool, 'id', undefined, 0, true, [{
    name: 'has_tag',
    input: will_remove_tag_id,
    invert: false,
    logic: 'and'
  }])

  const [getItemPool, itemOp] = PoolOperation<ItemPool, Item>(item_pool, () => {})

  list.map(item_id => {
    return getItem(item_pool, item_id)
  }).filter(item => {
    return item.tags.includes(will_remove_tag_id)
  }).forEach((item) => {
    itemOp(updateItem, item.id, {
      tags: item.tags.filter(tag_id => {
        return tag_id !== will_remove_tag_id
      })
    })
  })

  return [
    deleteTag(tag_pool, will_remove_tag_id),
    getItemPool()
  ]
}

export function deleteTagAndUpdateItemsOperate(
  will_delete_tag_id: TagID,
  [getTagPool, setTagPool]: readonly [() => TagPool, (v: TagPool) => void],
  [getItemPool, setItemPool]: readonly [() => ItemPool, (v: ItemPool) => void],
) {
  const [ new_tag_pool, new_item_pool ] = deleteTagAndUpdateItems(
    getTagPool(), getItemPool(), will_delete_tag_id
  )
  setTagPool(new_tag_pool)
  setItemPool(new_item_pool)
}
