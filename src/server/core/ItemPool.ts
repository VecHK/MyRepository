import { remove, sort } from 'ramda'
import { ItemJSONForm, Item, ItemDateFields, ItemID, Item_raw, NullableFileID, NullableFileIDFields, constructNewItem, itemID, parseRawItems, unique } from './Item'
import { TagID } from './Tag'
import { maxId } from './ID'
import { FileID } from './File'
import Immutable from 'immutable'
import { AttributeFieldName, AttributeValueType } from './Attributes'
import { bisectionCallback } from '../utils/bisection'

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
      if (a_date === null) {
        return -1
      } else {
        return 1
      }
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

function moveToLast(ids: ItemID[], item_id: ItemID) {
  // const idx = ids.indexOf(item_id)
  // if (idx === -1) {
  //   throw new Error('moveToLast: item_id not found')
  // } else {
  //   return (
  //     remove(idx, 1, ids)
  //       .concat(item_id)
  //   )
  // }
  return (
    ids
      .filter(finding_id => finding_id !== item_id)
      .concat(item_id)
  )
}

// 使用二分法
export function insertReleaseDateToIndex(
  prop: keyof ItemDateFields<Date>,
  map: ItemPool['map'],
  id_list: ItemID[],
  insert_id: ItemID,
  insert_date: Date | null
): ItemID[] {
  const insert_date_value = (insert_date === null) ? 0 : insert_date.valueOf()
  const insert_index = bisectionCallback(
    id_list,
    () => insert_date_value,
    (item_id) => {
      const d = getItemByIdCertain(map, item_id)[prop]
      return (d === null) ? 0 : d.valueOf()
    }
  )
  if (insert_index === -1) {
    return [insert_id].concat(id_list)
  } else {
    return [
      ...id_list.slice(0, insert_index + 1),
      insert_id,
      ...id_list.slice(insert_index + 1, id_list.length)
    ]
  }
}

export function addItem(old_pool: ItemPool, create_form: ItemJSONForm): readonly [
  Item,
  ItemPool
] {
  const new_id = (old_pool.latest_id + 1) as ItemID
  const new_item = constructNewItem(new_id, create_form)

  if (Array.isArray(new_item.original)) {
    old_pool = setItemsParent(old_pool, new_item.original, new_item.id)
  }

  return [
    new_item,
    {
      latest_id: new_id,
      map: old_pool.map.set(new_id, new_item),
      index: {
        id: old_pool.index.id.concat(new_id),
        create_date: old_pool.index.create_date.concat(new_id),
        update_date: old_pool.index.update_date.concat(new_id),
        release_date: insertReleaseDateToIndex(
          'release_date',
          old_pool.map,
          old_pool.index.release_date,
          new_id,
          new_item.release_date
        )
      }
    }
  ]
}

function removeIndexedFieldItem(index_list: ItemID[], item_id: ItemID): ItemID[] {
  const idx = index_list.indexOf(item_id)
  if (idx === -1) {
    throw new Error(`removeIndexedFieldItem: item_id[id=${item_id}] not found`)
  } else {
    return [
      ...index_list.slice(0, idx),
      ...index_list.slice(idx + 1, index_list.length),
    ]
  }
}

function deleteIndexItem(index: ItemPool['index'], item_id: ItemID): ItemPool['index'] {
  return {
    id: removeIndexedFieldItem(index.id, item_id),
    release_date: removeIndexedFieldItem(index.release_date, item_id),
    update_date: removeIndexedFieldItem(index.update_date, item_id),
    create_date: removeIndexedFieldItem(index.create_date, item_id),
  }
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
    // oldpool = updateItem(oldpool, found_item.id, { original: null }) // 通过指定original=null来删除子项目
    return {
      latest_id: oldpool.latest_id,
      map: oldpool.map.delete(found_item.id),
      index: deleteIndexItem(oldpool.index, found_item.id),
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
  pool: ItemPool,
  item_id: ItemID,
  parent: Item['parent']
): ItemPool {
  const prev_item = getMapItem(pool.map, item_id)
  return changeItem(pool, item_id, { ...prev_item, parent })
}

function setItemsParent(
  pool: ItemPool,
  child_item_ids: ItemID[],
  parent: Item['parent']
): ItemPool {
  let latest_pool = pool
  for (const child_item_id of child_item_ids) {
    latest_pool = setItemParentDirect(latest_pool, child_item_id, parent)
  }
  return latest_pool
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
    const removed_pool = changeItem(
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
        return changeItem(
          setItemsParent(pool, new_original, id),
          id,
          new_item
        )
      }
    } else {
      return changeItem(pool, id, new_item)
    }
  }
}

function changeItem(pool: ItemPool, will_change_id: ItemID, new_item: Item) {
  const found_item = getItemById(pool.map, will_change_id)
  if (found_item === null) {
    throw new Error(`changeItem: Item(id=${will_change_id}) not found`)
  } else {
    const now_date = new Date
    const need_update_release_date = (found_item.release_date !== new_item.release_date)

    return {
      ...pool,
      map: pool.map.set(will_change_id, {
        ...new_item,
        update_date: now_date,
      }),
      index: {
        ...pool.index,
        update_date: moveToLast(pool.index.update_date, will_change_id),
        release_date: (!need_update_release_date) ? pool.index.release_date : (
          insertReleaseDateToIndex(
            'release_date',
            pool.map,
            removeIndexedFieldItem(pool.index.release_date, found_item.id),
            found_item.id,
            new_item.release_date
          )
        )
      },
    }
  }
}

export function updateItem(pool: ItemPool, id: number, updateForm: Partial<ItemJSONForm>): ItemPool {
  if (updateForm.parent !== undefined) {
    throw new Error('updateItem: 不能更改parent字段，修改子item的引用请修改父item中的original')
  }

  const found_item = getItemById(pool.map, id)
  if (found_item === null) {
    throw new Error(`updateItem: Item(id=${id}) not found`)
  } else if (updateForm.original !== undefined) {
    const form = { ...updateForm }
    Reflect.deleteProperty(form, 'original')
    return updateItem(
      updateItemOriginal(pool, itemID(id), updateForm.original),
      id,
      form,
    )
  } else {
    const update_form_tags = updateForm.tags

    let new_release_date = found_item.release_date
    const need_update_release_date = Reflect.has(updateForm, 'release_date')
    if (need_update_release_date) {
      if (typeof updateForm.release_date === 'string') {
        new_release_date = new Date(updateForm.release_date)
      }
    }

    return changeItem(pool, found_item.id, {
      ...found_item,
      ...updateForm,

      tags: Array.isArray(update_form_tags) ?
        unique(update_form_tags) : found_item.tags,

      release_date: new_release_date,
    })
  }
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

export function select<T>(
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
  DefineFilterRule<'empty_release_date', null> |
  DefineFilterRule<'attribute_equal', {
    name: AttributeFieldName,
    value: AttributeValueType
  }> |
  DefineFilterRule<'__tagname_contains', string> |
  DefineFilterRule<'__custom_predicate', (item: Item) => boolean>

type FilterRules = Array<FilterRule>
export type FilterGroup = {
  logic: FilterRuleLogic
  invert: boolean
  rules: FilterRules
}

function rulePredicate(rule: FilterRule, item: Item): boolean {
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
  } else if (rule.name === 'attribute_equal') {
    const { name, value: input_value } = rule.input
    if (!Reflect.has(item.attributes, name)) {
      return false
    } else {
      const attr_value = item.attributes[name]
      if (Array.isArray(input_value)) {
        if (!Array.isArray(attr_value)) {
          return false
        } else if (attr_value.length !== input_value.length) {
          return false
        } else {
          return attr_value.every((_, idx) => {
            return attr_value[idx] === input_value[idx]
          })
        }
      } else {
        return input_value === attr_value
      }
    }
  } else if (rule.name === '__custom_predicate') {
    return rule.input(item)
  } else {
    throw new Error(`unknown filter rule: ${JSON.stringify(rule)}`)
  }
}

function groupPredicate(filter_group: FilterGroup, item: Item): boolean {
  let any = true

  for (const rule of filter_group.rules) {
    const check_result = rulePredicate(rule, item)
    const inverted = rule.invert ? (!check_result) : check_result
    if (rule.logic === 'and') {
      if (inverted !== true) {
        return false
      }
    } else {
      if (inverted === true) {
        return true
      } else {
        any = false
      }
    }
  }

  return any
}

export function ItemFilterCond(filter_groups: FilterGroup[]): (item: Item) => boolean {
  return (item) => {
    let any = true

    for (const group of filter_groups) {
      const check_result = groupPredicate(group, item)
      const inverted = group.invert ? (!check_result) : check_result
      if (group.logic === 'and') {
        if (inverted !== true) {
          return false
        }
      } else {
        if (inverted === true) {
          return true
        } else {
          any = false
        }
      }
    }

    return any
  }
}

export function listingItemSimple(
  item_pool: ItemPool,
  sort_by: keyof ItemPool['index'],
  after_id: ItemID | undefined,
  limit: number,
  desc: boolean = false,
  filter_rules: FilterRule[]
): ItemID[] {
  return listingItemAdvanced(item_pool, sort_by, after_id, limit, desc, [{
    invert: false,
    logic: 'and',
    rules: filter_rules
  }])
}

export function listingItemAdvanced(
  item_pool: ItemPool,
  sort_by: keyof ItemPool['index'],
  after_id: ItemID | undefined,
  limit: number,
  desc: boolean = false,
  filter_groups: FilterGroup[]
): ItemID[] {
  const id_list = item_pool.index[sort_by]

  const filterCond = (
    filter_groups.length === 0
  ) ? (() => true) : ItemFilterCond(filter_groups)

  if (id_list.length === 0) {
    return []
  } else if (after_id === undefined) {
    return select(
      id_list,
      desc ? -1 : 1,
      desc ? id_list.length - 1 : 0,
      limit,
      (item_id) => filterCond(getItem(item_pool, item_id))
    )
  } else {
    const after_id_idx = id_list.indexOf(after_id)
    if (after_id_idx === -1) {
      throw new Error(`missing after_id: ${after_id}`)
    } else {
      return select(
        id_list,
        desc ? -1 : 1,
        desc ? (after_id_idx - 1) : (after_id_idx + 1),
        limit,
        (item_id) => filterCond(getItem(item_pool, item_id))
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
