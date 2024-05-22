import { Memo } from 'new-vait'
import { TagID } from './Tag'
import { TagPool, deleteTag } from './TagPool'
import { ItemPool, getItem, listingItem, updateItem } from './ItemPool'

export function PoolOperation<Pool, PoolItem>(pool: Pool) {
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
      OpFn extends (p: Pool, ...args: A) => R,
      OpReturn extends ReturnType<OpFn>,
      RA = OpReturn extends IP ? void : I
    >(
      opFn: OpFn,
      ...args: A
    ): RA => {
      const res = opFn(getPool(), ...args)

      if (Array.isArray(res)) {
        const [ item, newpool ] = res as M
        setPool(newpool)
        return item as unknown as RA
      } else {
        setPool(res as Pool)
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
  const list = listingItem(item_pool, 'id', undefined, 0, true, [{
    name: 'has_tag',
    input: will_remove_tag_id,
    invert: false,
    logic: 'and'
  }])

  const [getItemPool, itemOp] = PoolOperation(item_pool)

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
