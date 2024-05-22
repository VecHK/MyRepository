import { remove, sort } from 'ramda'
import { CreateItemForm, Item, ItemDateFields, ItemID, Item_raw, NullableFileID, NullableFileIDFields, createItem, itemID, parseRawItems, unique } from './Item'
import { TagID } from './Tag'
import { TagPool, deleteTag } from './TagPool'
import { maxId } from './ID'
import { FileID } from './File'

type ItemIndexedField = 'id' | 'release_date' | 'create_date' | 'update_date' // | 'title'
export type ItemPool = {
  latest_id: ItemID
  index: Record<ItemIndexedField, ItemID[]>
  map: Map<ItemID, Item>
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

// 先采用最暴力的排序方式
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
  const map = new Map<ItemID, Item>()
  for (let i = 0; i < items.length; ++i) {
    const item = items[i]
    map.set(item.id, item)
  }

  return {
    latest_id: itemID(maxId(items)),
    map,
    index: constructItemIndex(map),
  }
}

export function deleteTagAndUpdateItems(
  tag_pool: TagPool,
  item_pool: ItemPool,
  will_remove_tag_id: TagID
) {
  const list = listingItem(item_pool, 'id', undefined, 0, true, [{
    name: 'has_tag',
    input: will_remove_tag_id,
    invert: false,
    logic: 'and'
  }])

  list.map(item_id => {
    return getItem(item_pool, item_id)
  }).filter(item => {
    return item.tags.includes(will_remove_tag_id)
  }).forEach((item) => {
    updateItem(item_pool, item.id, {
      tags: item.tags.filter(tag_id => {
        return tag_id !== will_remove_tag_id
      })
    })
  })

  deleteTag(tag_pool, will_remove_tag_id)
}

function moveToLatest(list: ItemID[], item_id: ItemID) {
  const new_list = list.filter(finding_id => {
    return finding_id !== item_id
  })
  new_list.push(item_id)
  return new_list
}

// function sort() {}

export function addItem(pool: ItemPool, create_form: CreateItemForm): Item {
  const new_id = (pool.latest_id + 1) as ItemID
  const new_item = createItem(new_id, create_form)
  pool.map.set(new_id, new_item)
  pool.latest_id = new_id

  pool.index.id.push(new_id)
  pool.index.create_date.push(new_id)

  pool.index.update_date = moveToLatest(pool.index.update_date, new_id)

  pool.index.release_date = createDateIndex(
    'release_date',
    pool.map,
    [...pool.index.release_date, new_id],
  )

  if (Array.isArray(create_form.original)) {
    if (create_form.original.includes(new_item.id)) {
      throw new Error('updateItem: 子项目不能包括自己')
    } else {
      setItemsParent(pool, create_form.original, new_item.id)
    }
  }

  return new_item
}

export function deleteItem(pool: ItemPool, will_del_id: number): Item {
  const found_item = getItemById(pool, will_del_id)
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
    updateItem(pool, found_item.id, { original: null }) // 通过指定original=null来删除子项目
    pool.map.delete(found_item.id)
    pool.index = constructItemIndex(pool.map)
    return found_item
  }
}

function getItemById(pool: ItemPool, id: number): Item | null {
  return pool.map.get(id as ItemID) || null
}

export function getItem(pool: ItemPool, id: number): Item {
  const item = getItemById(pool, id)
  if (item === null) {
    throw new Error(`getItem: Item(id=${id}) not found`)
  } else {
    return item
  }
}

function setItemsParent(pool: ItemPool, child_item_ids: ItemID[], parent: Item['parent']) {
  for (const item_id of child_item_ids) {
    const item = getItem(pool, item_id)
    pool.map.set(item.id, {
      ...item,
      parent
    })
  }
}

function removeItemsParent(pool: ItemPool, child_item_ids: ItemID[]) {
  return setItemsParent(pool, child_item_ids, null)
}

export function updateItem(pool: ItemPool, id: number, updateForm: Partial<CreateItemForm>): void {
  if (updateForm.parent !== undefined) {
    throw new Error('updateItem: 不能更改parent字段，修改子item的引用请修改父item中的original')
  }

  const found_item = getItemById(pool, id)
  if (found_item === null) {
    throw new Error(`updateItem: Item(id=${id}) not found`)
  } else {
    if (updateForm.original !== undefined) {
      if (Array.isArray(updateForm.original)) {
        if (updateForm.original.includes(found_item.id)) {
          throw new Error('updateItem: 子项目不能包括自己')
        } else {
          if (Array.isArray(found_item.original)) {
            removeItemsParent(pool, found_item.original)
          }
          setItemsParent(pool, updateForm.original, found_item.id)
        }
      } else {
        if (Array.isArray(found_item.original)) {
          removeItemsParent(pool, found_item.original)
        }
      }
    }

    const update_form_tags = updateForm.tags

    const release_date_string = updateForm.release_date
    pool.map.set(found_item.id, {
      ...found_item,
      ...updateForm,

      update_date: new Date,

      tags: Array.isArray(update_form_tags) ?
        unique(update_form_tags) : found_item.tags,

      release_date: release_date_string ?
        new Date(release_date_string) : null,
    })

    pool.index.update_date = moveToLatest(pool.index.update_date, found_item.id)

    if (typeof release_date_string === 'string') {
      pool.index.release_date = createDateIndex(
        'release_date',
        pool.map,
        map2list(pool.map).map(item => item.id),
      )
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
  DefineFilterRule<'empty_tag', null>

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
