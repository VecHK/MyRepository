import { Memo } from 'vait'
import Immutable from 'immutable'
import { Tag, TagID } from './Tag'
import { TagPool, deleteTag } from './TagPool'
import { ItemPool, getItem, listingItemSimple, updateItem } from './ItemPool'
import { Item, ItemID } from './Item'

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

function collectAdds(map_new: ItemPool['map'], from_id: ItemID, to_id: ItemID) {
  const adds: ItemID[] = []
  for (let id = from_id; id <= to_id; ++id) {
    if (map_new.get(id) !== undefined) {
      adds.push(id)
    }
  }
  return adds
}

function reverseIdx(idx: number, len: number) {
  return (len - 1) - idx
}

function collectChanges(prev_pool: ItemPool, current_pool: ItemPool) {
  const changes: ItemID[] = []

  const { update_date } = current_pool.index

  let current_idx = 0
  for (
    let prev_idx = 0;
    (prev_idx < prev_pool.index.update_date.length) &&
    (current_idx < current_pool.index.update_date.length);
  ) {
    const current_id = update_date[
      reverseIdx(current_idx, current_pool.index.update_date.length)
    ]
    const prev_id = prev_pool.index.update_date[
      reverseIdx(prev_idx, prev_pool.index.update_date.length)
    ]

    if ( current_id > prev_pool.latest_id ) {
      // 新增的，直接跳过
      current_idx += 1
    } else {
      const prev_item = prev_pool.map.get(current_id)
      const curr_item = current_pool.map.get(current_id)

      if ( current_id === prev_id ) {
        if (prev_item === curr_item) {
          return changes
        } else {
          changes.push( current_id )
          current_idx += 1
          prev_idx += 1
        }
      } else {
        if (!current_pool.map.has(prev_id)) {
          // 被删除了，直接跳过
          prev_idx += 1
        } else {
          if (prev_item === curr_item) {
            return changes
          } else {
            changes.push( current_id )
            current_idx += 1
            prev_idx += 1
          }
        }
      }
    }
  }

  return changes
}

function findDifferent(
  current_ids: ItemID[],
  prev_ids: ItemID[],
  start = 0,
  end = prev_ids.length - 1,
) {
  const range = end - start
  if (prev_ids.length === 0) {
    return 0
  } else if (prev_ids.length === 1) {
    return 0
  } else if ((end - start) <= 2) {
    return start
  } else {
    const mid_may_be_float = range / 2
    const mid = start + Math.floor(mid_may_be_float)

    if (prev_ids[mid] === current_ids[mid]) {
      return findDifferent(current_ids, prev_ids, mid, end)
    } else {
      const new_end = start + Math.ceil(mid_may_be_float)
      return findDifferent(current_ids, prev_ids, start, new_end)
    }
  }
}

function collectDels(
  current_pool: ItemPool,
  prev_pool: ItemPool
) {
  const dels: ItemID[] = []

  const start = findDifferent(current_pool.index.id, prev_pool.index.id)
  let current_idx = start
  for (
    let i = start;
    i < prev_pool.index.id.length;
    ++i
  ) {
    const prev_id = prev_pool.index.id[i]
    const current_id = current_pool.index.id[current_idx]
    if (prev_id !== current_id) {
      dels.push(prev_id)
    } else {
      current_idx += 1
    }
  }
  return dels
}

export function diffItemPoolMapFast(current_pool: ItemPool, prev_pool: ItemPool) {
  const dels = collectDels(
    current_pool,
    prev_pool,
  )

  const adds = collectAdds(
    current_pool.map,
    (prev_pool.latest_id + 1) as ItemID,
    current_pool.latest_id
  )

  const changes = collectChanges(prev_pool, current_pool)

  return { dels, adds, changes }
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
