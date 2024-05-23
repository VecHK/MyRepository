import { concat, remove, sort } from 'ramda'
import { CreateItemForm, Item, ItemDateFields, ItemID, Item_raw, NullableFileID, NullableFileIDFields, createItem, itemID, parseRawItems, unique } from './Item'
import { TagID } from './Tag'
import { maxId } from './ID'
import { FileID } from './File'
import Immutable from 'immutable'

export type ItemIndexedField = 'id' | 'release_date' | 'create_date' | 'update_date' // | 'title'
export type ItemPool = {
  latest_id: ItemID
  index: Record<ItemIndexedField, ItemID[]>
  map: Immutable.Map<ItemID, Item>
}

function getItemByIdCertain(map: ItemPool['map'], id: ItemID) {
  return map.get(id) as Item
}

function map2list(map: ItemPool['map']) {
  return [...map.values()]
}

function createDateIndex(prop: keyof ItemDateFields<Date>, map: ItemPool['map'], id_list: ItemID[]) {
  return sort((a_id, b_id) => {
    const a = getItemByIdCertain(map, a_id)
    const b = getItemByIdCertain(map, b_id)
    const a_date = a[prop]
    const b_date = b[prop]
    if (
      (a_date === null) ||
      (b_date === null)
    ) {
      return 1
    } else {
      return (a_date < b_date) ? -1 : 1
    }
  }, id_list)
}

function constructItemIndex(map: ItemPool['map']): ItemPool['index'] {
  const id_list: ItemID[] = []
  for (const item_id of map.keys()) {
    id_list.push(item_id)
  }
  return {
    id: sort((a_id, b_id) => {
      return (a_id < b_id) ? -1 : 1
    }, id_list),
    create_date: createDateIndex('create_date', map, id_list),
    update_date: createDateIndex('update_date', map, id_list),
    release_date: createDateIndex('release_date', map, id_list),
  }
}

export function createItemPool(items: Item[]): ItemPool {
  const map = items.reduce((map, item) => {
    return map.set(item.id, item)
  }, Immutable.Map<ItemID, Item>())
  return {
    latest_id: itemID(maxId(items)),
    index: constructItemIndex(map),
    map,
  }
}

function moveToLatest(ids: ItemID[], item_id: ItemID) {
  // const idx = ids.indexOf(item_id)
  // if (idx === -1) {
  //   throw new Error('moveToLatest: item_id not found')
  // } else {
  //   return [
  //     ...remove(idx, 1, ids),
  //     item_id
  //   ]
  // }
  return [
    ...ids.filter(finding_id => finding_id !== item_id),
    item_id
  ]
}

export function addItem(old_pool: ItemPool, create_form: CreateItemForm): readonly [
  Item,
  ItemPool
] {
  const new_id = (old_pool.latest_id + 1) as ItemID
  const new_item = createItem(new_id, create_form)

  if (Array.isArray(new_item.original)) {
    old_pool = setItemsParent(old_pool, new_item.original, new_item.id)
  }

  const new_map = old_pool.map.set(new_id, new_item)

  return [
    new_item,
    {
      latest_id: new_id,
      map: new_map,
      index: {
        id: [ ...old_pool.index.id, new_id ],
        create_date: [ ...old_pool.index.create_date, new_id ],
        update_date: moveToLatest(old_pool.index.update_date, new_id),
        release_date: createDateIndex(
          'release_date',
          new_map,
          [...old_pool.index.release_date, new_id],
        )
      }
    }
  ]
}

export function deleteItem(oldpool: ItemPool, will_del_id: number): ItemPool {
  const found_item = getItemById(oldpool.map, will_del_id)
  if (found_item === null) {
    throw new Error(`removeItem: Item(id=${will_del_id}) not found`)
  }
  else if (found_item.parent) {
    throw new Error(`removeItem: Item(id=${will_del_id}) can't delete because these is a child item`)
  }
  else if (Array.isArray(found_item.original) && (found_item.original.length !== 0)) {
    throw new Error(`removeItem: Item(id=${will_del_id}) can't delete because these parent item has childs`)
  }
  else {
    oldpool = updateItem(oldpool, found_item.id, { original: null }) // 通过指定original=null来删除子项目
    const new_map = oldpool.map.delete(found_item.id)
    return {
      ...oldpool,
      map: new_map,
      index: constructItemIndex(new_map),
    }
  }
}

function getItemById(map: ItemPool['map'], id: number): Item | null {
  return map.get(id as ItemID) || null
}

function getMapItem(map: ItemPool['map'], id: number) {
  const item = getItemById(map, id)
  if (item === null) {
    throw new Error(`getItem: Item(id=${id}) not found`)
  } else {
    return item
  }
}

export function getItem(pool: ItemPool, id: number): Item {
  return getMapItem(pool.map, id)
}

function setItemParentDirect(
  map: ItemPool['map'],
  item_id: ItemID,
  parent: Item['parent']
): ItemPool['map'] {
  const prev_item = getMapItem(map, item_id)
  return map.set(item_id, { ...prev_item, parent })
}

function setItemsParent(
  pool: ItemPool,
  child_item_ids: ItemID[],
  parent: Item['parent']
): ItemPool {
  let new_map: ItemPool['map'] = pool.map
  for (const child_item_id of child_item_ids) {
    new_map = setItemParentDirect(new_map, child_item_id, parent)
  }
  return {
    ...pool,
    map: new_map
  }
}

function removeItemsParent(pool: ItemPool, child_item_ids: ItemID[]) {
  return setItemsParent(pool, child_item_ids, null)
}

function updateItemOriginal(
  pool: ItemPool, id: ItemID, new_original: Item['original']
): ItemPool {
  const prev_item = getItem(pool, id)
  const prev_original = prev_item.original

  if (Array.isArray(prev_original)) {
    const removed_pool = setItem(
      removeItemsParent(pool, prev_original),
      id,
      { ...prev_item, original: null }
    )
    return updateItemOriginal(removed_pool, id, new_original)
  } else {
    const new_item = { ...prev_item, original: new_original }

    if (Array.isArray(new_original)) {
      if (new_original.includes(id)) {
        throw new Error('updateItemOriginal: 子项目不能包括自己')
      } else {
        return setItem(
          setItemsParent(pool, new_original, id),
          id,
          new_item
        )
      }
    } else {
      return setItem(pool, id, new_item)
    }
  }
}

function setItem(pool: ItemPool, id: ItemID, item: Item) {
  return { ...pool, map: pool.map.set(id, item) }
}

export function updateItem(pool: ItemPool, id: number, updateForm: Partial<CreateItemForm>): ItemPool {
  if (updateForm.parent !== undefined) {
    throw new Error('updateItem: 不能更改parent字段，修改子item的引用请修改父item中的original')
  }

  const found_item = getItemById(pool.map, id)
  if (found_item === null) {
    throw new Error(`updateItem: Item(id=${id}) not found`)
  } else {
    if (updateForm.original !== undefined) {
      const form = { ...updateForm }
      Reflect.deleteProperty(form, 'original')
      return updateItem(
        updateItemOriginal(pool, id as ItemID, updateForm.original),
        id,
        form
      )
    }

    const update_form_tags = updateForm.tags

    const release_date_string = updateForm.release_date
    const need_update_release_date = release_date_string !== 'string'

    const new_map = pool.map.set(found_item.id, {
      ...found_item,
      ...updateForm,

      update_date: new Date,

      tags: Array.isArray(update_form_tags) ?
        unique(update_form_tags) : found_item.tags,

      release_date: release_date_string ?
        new Date(release_date_string) : null,
    })

    return {
      ...pool,
      map: new_map,
      index: {
        ...pool.index,
        update_date: moveToLatest(pool.index.update_date, found_item.id),
        release_date: (
          !need_update_release_date) ? pool.index.release_date : (
            createDateIndex(
              'release_date',
              new_map,
              map2list(new_map).map(item => item.id),
            )
          )
      }
    }
  }
}

function descIdx(len: number, idx: number) {
  console.log(len, idx)
  return (len - 1) - idx
}

export function idList2Items(pool: ItemPool, id_list: ItemID[]): Item[] {
  return id_list.map(id => {
    const item = pool.map.get(id)
    if (item === undefined) {
      throw new Error('id_list 含有不存在的 item')
    } else {
      return item
    }
  })
}

function iterateCond<T>(desc: boolean, list: T[], idx: number) {
  if (desc) {
    return idx >= 0
  } else {
    return idx < list.length
  }
}

function select<T>(
  list: T[],
  direct: -1 | 1,
  start: number,
  limit: number,
  filterCond: (item: T) => boolean
): T[] {
  const new_list: T[] = []
  let found = 0
  const desc = direct === -1

  for (
    let idx = start;
    ((limit === 0) || (found < limit)) && iterateCond(desc, list, idx);
    idx += direct
  ) {
    if (filterCond(list[idx])) {
      found += 1
      new_list.push(list[idx])
    }
  }

  return new_list
}

type FilterRuleName = 'tag_contains' | 'has_tag' | 'search'
export type FilterRuleLogic = Readonly<'and'> | Readonly<'or'>
type DefineFilterRule <R = FilterRuleName, I = never>= {
  name: R
  input: I
  logic: FilterRuleLogic
  use_regexp?: boolean
  invert?: boolean
}

export type FilterRule =
  // DefineFilterRule<'tag_contains', string> |
  // DefineFilterRule<'search', string> |
  DefineFilterRule<'title', string> |
  DefineFilterRule<'has_multi_original', null> |
  DefineFilterRule<'is_child_item', null> |
  DefineFilterRule<'has_tag', TagID> |
  DefineFilterRule<'empty_tag', null> |
  DefineFilterRule<'empty_release_date', null>

function predicate(rule: FilterRule, item: Item): boolean {
  if (rule.name === 'has_tag') {
    return item.tags.includes(rule.input)
  } else if (rule.name === 'title') {
    return item.title.includes(rule.input)
  } else if (rule.name === 'has_multi_original') {
    return Array.isArray(item.original)
  } else if (rule.name === 'is_child_item') {
    return Boolean(item.parent)
  } else if (rule.name === 'empty_tag') {
    return item.tags.length === 0
  } else if (rule.name === 'empty_release_date') {
    return item.release_date === null
  } else {
    throw new Error(`unknown filter rule: ${JSON.stringify(rule)}`)
  }
}

function sortRule(rules: FilterRule[]) {
  return sort((a, b) => {
    return a.logic === 'or' ? -1 : 1
  }, rules)
}

function ItemFilterCond(rules: FilterRule[]): (item: Item) => boolean {
  return (item) => {
    for (const rule of sortRule(rules)) {
      const check_result = predicate(rule, item)
      const inverted = rule.invert ? (!check_result) : check_result
      if (rule.logic === 'and') {
        if (inverted !== true) {
          return false
        }
      } else {
        if (inverted === true) {
          return true
        }
      }
    }
    return true
  }
}

export function listingItem(
  pool: ItemPool,
  sort_by: keyof ItemPool['index'],
  after_id: ItemID | undefined,
  limit: number,
  desc: boolean = false,
  filter_rules: FilterRule[]
): ItemID[] {
  const id_list = pool.index[sort_by]

  const filterCond = (
    filter_rules.length === 0
  ) ? (() => true) : ItemFilterCond(filter_rules)

  if (id_list.length === 0) {
    return []
  } else if (after_id === undefined) {
    return select(
      id_list,
      desc ? -1 : 1,
      desc ? id_list.length - 1 : 0,
      limit,
      (item_id) => filterCond(getItem(pool, item_id))
    )
  } else {
    const after_id_idx = id_list.indexOf(after_id)
    // console.log('after_id_idx', after_id_idx)
    if (after_id_idx === -1) {
      throw new Error(`missing after_id: ${after_id}`)
    } else {
      return select(
        id_list,
        desc ? -1 : 1,
        desc ? (after_id_idx - 1) : (after_id_idx + 1),
        limit,
        (item_id) => filterCond(getItem(pool, item_id))
      )
    }
  }
}

export function collectReferencedFileIds(pool: ItemPool): string[] {
  const table = collectReferencedFileIdTable(pool)
  return Object.keys(table).map(key => {
    return table[key]
  }).flat()
}

export function collectReferencedFileIdTable(
  pool: ItemPool
): Record<NullableFileIDFields, Array<NullableFileID>> {
  const cover_fids: Array<FileID> = []
  const original_fids: Array<FileID> = []

  for (const item of pool.map.values()) {
    if (item.cover !== null) {
      cover_fids.push(item.cover)
    }
    if (
      (item.original !== null) &&
      !Array.isArray(item.original)
    ) {
      original_fids.push(item.original)
    }
  }

  return {
    cover: cover_fids,
    original: original_fids,
  }
}
