// eslint-disable-next-line @typescript-eslint/no-var-requires
const assert = require('power-assert')

import { FilterGroup, FilterRule, ItemPool, addItem, createItemPool, deleteItem, getItem, insertReleaseDateToIndex, listingItemAdvanced, listingItemSimple, updateItem } from '../src/server/core/ItemPool'
import { ItemID, Item_raw, constructNewItem, itemID, parseRawItems } from '../src/server/core/Item'
import { TagPool, createTagPool, deleteTag, getTag, newTag, updateTag } from '../src/server/core/TagPool'
import { TagID, tagID } from '../src/server/core/Tag'
import { timeout } from 'vait'
import { last, partial, range } from 'ramda'
import { ItemOperation, TagOperation, createForm, generateRawItems } from './common'
import { deleteTagAndUpdateItemsOperate } from '../src/server/core/Pool'

beforeEach(() => {
  // fs.rmSync(config_object.storage_path, { recursive: true, force: true });
  // expect(
  //   fs.existsSync(config_object.storage_path)
  // ).toEqual(false)
})

const listingItem = listingItemSimple

test('测试分页', async () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))

  const listing = partial(listingItem, [item_pool, 'id'])

  {
    expect(listing(undefined, 3, true, []).length).toBe(3)
    expect(listing(undefined, 3, false, []).length).toBe(3)
  }
  {
    expect(listing(undefined, 1, true, []).length).toBe(1)
    expect(listing(undefined, 1, false, []).length).toBe(1)
  }
  {
    expect(listing(undefined, 3, true, [])).toStrictEqual([9, 4, 3])
    expect(listing(undefined, 3, false, [])).toStrictEqual([1, 2, 3])
  }
  {
    expect(listing(itemID(9), 3, true, [])).toStrictEqual([4, 3, 2])
    expect(listing(itemID(9), 3, false, [])).toStrictEqual([])
    expect(listing(itemID(4), 3, false, [])).toStrictEqual([9])
  }
})

test('Filter Rule(title)', async () => {
  const [getPool, op] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )
  const input_title = 'halasjfiasjfosajoifjasiofjioqjiojafoiafsjioasjfoiajsl'
  const list = listingItem(getPool(), 'id', undefined, 0, true, [{
    name: 'title',
    input: input_title,
    logic: 'and',
    // use_regexp: false,
    // invert: false,
  }])
  expect(list.length).toBe(0)

  {
    const new_item = op(addItem, createForm({ title: input_title }))
    const list = listingItem(getPool(), 'id', undefined, 0, true, [{
      name: 'title',
      input: input_title.slice(0, 9),
      logic: 'and',
      use_regexp: false,
      invert: false,
    }])
    expect(list[0]).toBe(new_item.id)
    expect(list.length).toBe(1)
  }
})
test('Filter Rule(has_multi_original)', async () => {
  const [getPool, op] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )
  const list = listingItem(getPool(), 'id', undefined, 0, true, [{
    name: 'has_multi_original',
    input: null,
    logic: 'and',
    // use_regexp: false,
    // invert: false,
  }])
  expect(list.length).toBe(0)
  {
    const new_item = op(addItem, createForm({
      title: 'hag',
      original: [1, 2].map(itemID),
    }))
    const list = listingItem(getPool(), 'id', undefined, 0, true, [{
      name: 'has_multi_original',
      input: null,
      logic: 'and',
      // use_regexp: false,
      // invert: false,
    }])
    expect(list.length).toBe(1)
  }
})

test('Filter Rule(is_child_item)', async () => {
  {  // is_child_item （通常
    const [getPool, op] = ItemOperation(
      createItemPool(parseRawItems(generateRawItems()))
    )
    const list = listingItem(getPool(), 'id', undefined, 0, true, [{
      name: 'is_child_item',
      input: null,
      logic: 'and',
      invert: true,
    }])
    expect(list.length).toBe([...getPool().map.values()].length)

    {
      const child_a = op(addItem, createForm({ title: 'he' }))
      const child_b = op(addItem, createForm({ title: 'he' }))

      const parent = op(addItem, createForm({
        original: [ child_a.id, child_b.id ]
      }))

      const list = listingItem(getPool(), 'id', undefined, 0, true, [{
        name: 'is_child_item',
        input: null,
        logic: 'and',
        invert: false,
      }])
      expect( list.length ).toBe(2)
      assert( list.includes(child_a.id) )
      assert( list.includes(child_b.id) )
    }
  }
  { // is_child_item （更细致的检查
    const [getPool, op] = ItemOperation(
      createItemPool(parseRawItems(generateRawItems()))
    )
    const list = listingItem(getPool(), 'id', undefined, 0, true, [{
      name: 'is_child_item',
      input: null,
      logic: 'and',
      // use_regexp: false,
      // invert: false,
    }])
    const before_count = [...getPool().map.values()].length
    expect(list.length).toBe(0)
    {
      const new_item = op(addItem, createForm({
        title: 'hag',
        original: [1, 2].map(itemID),
      }))
      const list = listingItem(getPool(), 'id', undefined, 0, true, [{
        name: 'is_child_item',
        input: null,
        logic: 'and',
        // use_regexp: false,
        // invert: false,
      }])
      expect(list.length).toBe(2)
      expect([...getPool().map.values()].length).toBe(before_count + 1)

      const JSONData = JSON.stringify([...getPool().map.values()])
      {
        op(updateItem, new_item.id, { original: null })
        op(deleteItem, new_item.id)
        const list = listingItem(getPool(), 'id', undefined, 0, true, [{
          name: 'is_child_item',
          input: null,
          logic: 'and',
        }])
        expect(list.length).toBe(0)
      }

      {
        const [getPool, op] = ItemOperation(
          createItemPool(JSON.parse(JSONData))
        )
        op(updateItem, new_item.id, { original: null })
        const list = listingItem(getPool(), 'id', undefined, 0, true, [{
          name: 'is_child_item',
          input: null,
          logic: 'and',
        }])
        expect(list.length).toBe(0)
      }

      {
        const [getPool, op] = ItemOperation(
          createItemPool(JSON.parse(JSONData))
        )
        op(updateItem, new_item.id, { original: [itemID(3)] })
        const list = listingItem(getPool(), 'id', undefined, 0, true, [{
          name: 'is_child_item',
          input: null,
          logic: 'and',
        }])
        expect(list.length).toBe(1)
      }
    }
  }
})

test('Filter Rule(has_tag)', async () => {
  {  // has_tag
    const [itemPool, itemOp] = ItemOperation(
      createItemPool(parseRawItems(generateRawItems()))
    )
    const [tagPool, tagOp] = TagOperation(createTagPool([]))

    const tag_a = tagOp(newTag, { name: 'a', attributes: {} })
    const tag_b = tagOp(newTag, { name: 'b', attributes: {} })
    const tag_c = tagOp(newTag, { name: 'c', attributes: {} })

    const new_item = itemOp(addItem, createForm({ tags: [ tag_a.id ] }))

    const ids = listingItem(itemPool(), 'id', undefined, 0, true, [{
      name: 'has_tag',
      input: tag_a.id,
      logic: 'and',
      invert: false
    }])
    expect(ids.length).toBe(1)
    expect(ids).toStrictEqual([ new_item.id ])

    itemOp(updateItem, new_item.id, { tags: [ tag_a.id, tag_b.id ] })

    {
      const ids = listingItem(itemPool(), 'id', undefined, 0, true, [{
        name: 'has_tag',
        input: tag_a.id,
        logic: 'and',
        invert: false
      }])
      expect(ids.length).toBe(1)
      expect(ids).toStrictEqual([ new_item.id ])
    }

    itemOp(updateItem, new_item.id, { tags: [ tag_b.id ] })

    {
      const ids = listingItem(itemPool(), 'id', undefined, 0, true, [{
        name: 'has_tag',
        input: tag_a.id,
        logic: 'and',
        invert: false
      }])
      expect(ids.length).toBe(0)
    }
  }
})

test('Filter Rule(empty_tag)', async () => {
  const [getItemPool, itemOp] = ItemOperation(createItemPool([]))
  const tag_pool = createTagPool([])
  const [new_tag] = newTag(tag_pool, { name: 'hehe', attributes: {} })

  const __count = 100

  for (let i = 0; i < __count; ++i) {
    itemOp(addItem, createForm({
      tags: []
    }))
  }

  const ids = listingItem(getItemPool(), 'id', undefined, 0, true, [{
    name: 'empty_tag',
    input: null,
    logic: 'and',
    invert: false,
  }])
  expect(ids.length).toBe(__count)

  for (let i = 0; i < __count; ++i) {
    itemOp(updateItem, ids[i], { tags: [ new_tag.id ] })
    {
      const list = listingItem(getItemPool(), 'id', undefined, 0, true, [{
        name: 'empty_tag',
        input: null,
        logic: 'and',
        invert: false,
      }])
      expect(list.length).toBe(__count - (i + 1))
    }
  }
})

test('Multi Fileter Group', () => {
  // 选取标题为'helloGroup'、或者 tag 为 tag_a/tag_b/tag_c 任意其中一个的项目
  const [itemPool, itemOp] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )
  const [tagPool, tagOp] = TagOperation(createTagPool([]))

  const tag_a = tagOp(newTag, { name: 'a', attributes: {} })
  const tag_b = tagOp(newTag, { name: 'b', attributes: {} })
  const tag_c = tagOp(newTag, { name: 'c', attributes: {} })

  const title_item = itemOp(addItem, createForm({ title: 'helloGroup' }))
  const tag_a_item = itemOp(addItem, createForm({ title: 'tag_a_item', tags: [ tag_a.id ] }))
  const tag_b_item = itemOp(addItem, createForm({ title: 'tag_b_item', tags: [ tag_b.id ] }))
  const tag_c_item = itemOp(addItem, createForm({ title: 'tag_c_item', tags: [ tag_c.id ] }))

  const groups: FilterGroup[] = [{
    invert: false,
    logic: 'or',
    rules: [{
      invert: false,
      logic: 'and',
      name: 'title',
      input: 'helloGroup'
    }]
  }, {
    invert: false,
    logic: 'or',
    rules: [tag_a, tag_b, tag_c].map<FilterRule>(tag => ({
      name: 'has_tag', invert: false, logic: 'or', input: tag.id
    }))
  }]
  const ids = listingItemAdvanced(itemPool(), 'id', undefined, 0, true, groups)
  expect(ids.length).toBe(4)
  assert( ids.includes(title_item.id) )
  assert( ids.includes(tag_a_item.id) )
  assert( ids.includes(tag_b_item.id) )
  assert( ids.includes(tag_c_item.id) )
})

test('Multi Fileter Group(case 2)', () => {
  // 选取标题为'helloGroup'、并且 tag 为 tag_a/tag_b/tag_c 任意其中一个的项目
  const [itemPool, itemOp] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )
  const [tagPool, tagOp] = TagOperation(createTagPool([]))

  const tag_a = tagOp(newTag, { name: 'a', attributes: {} })
  const tag_b = tagOp(newTag, { name: 'b', attributes: {} })
  const tag_c = tagOp(newTag, { name: 'c', attributes: {} })

  const tag_a_item = itemOp(addItem, createForm({ title: 'helloGroup', tags: [ tag_a.id ] }))
  const tag_b_item = itemOp(addItem, createForm({ title: 'helloGroup', tags: [ tag_b.id ] }))
  const tag_c_item = itemOp(addItem, createForm({ title: 'helloGroup', tags: [ tag_c.id ] }))

  const groups: FilterGroup[] = [{
    invert: false,
    logic: 'and',
    rules: [{
      invert: false,
      logic: 'and',
      name: 'title',
      input: 'helloGroup'
    }]
  }, {
    invert: false,
    logic: 'and',
    rules: [tag_a, tag_b, tag_c].map<FilterRule>(tag => ({
      name: 'has_tag', invert: false, logic: 'or', input: tag.id
    }))
  }]
  const ids = listingItemAdvanced(itemPool(), 'id', undefined, 0, true, groups)
  expect(ids.length).toBe(3)
  assert( ids.includes(tag_a_item.id) )
  assert( ids.includes(tag_b_item.id) )
  assert( ids.includes(tag_c_item.id) )
})

test('Filter Rule(invert option)', () => {
  const [getPool, op] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )

  const total_list = [...getPool().map.values()]
  const list = listingItem(getPool(), 'id', undefined, 0, true, [{
    name: 'has_multi_original',
    input: null,
    logic: 'and',
    invert: true,
  }])
  expect(list.length).toBe(total_list.length)
})

test('Filter Rule(logic or)', () => {
  const [itemPool, itemOp] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )
  const [tagPool, tagOp] = TagOperation(createTagPool([]))

  const tag_a = tagOp(newTag, { name: 'a', attributes: {} })
  const tag_b = tagOp(newTag, { name: 'b', attributes: {} })
  const tag_c = tagOp(newTag, { name: 'c', attributes: {} })

  const rules = [tag_a, tag_b, tag_c].map<FilterRule>(tag => ({
    name: 'has_tag',
    logic: 'or',
    invert: false,
    input: tag.id
  }))

  {
    const ids = listingItem( itemPool(), 'id', undefined, 0, true, rules )
    expect(ids.length).toBe(0)
  }

  const item_a = itemOp(addItem, createForm({ tags: [ tag_a.id ] }))
  const item_b = itemOp(addItem, createForm({ tags: [ tag_b.id ] }))
  const item_c = itemOp(addItem, createForm({ tags: [ tag_c.id ] }))

  {
    const ids = listingItem( itemPool(), 'id', undefined, 0, true, rules )
    expect(ids.length).toBe(3)
    assert(ids.includes(item_a.id))
    assert(ids.includes(item_b.id))
    assert(ids.includes(item_c.id))
  }
})

test('Filter Rule(logic or/and mixin)', () => {
  const [itemPool, itemOp] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )
  const [tagPool, tagOp] = TagOperation(createTagPool([]))

  const tag_a = tagOp(newTag, { name: 'a', attributes: {} })
  const tag_b = tagOp(newTag, { name: 'b', attributes: {} })
  const tag_c = tagOp(newTag, { name: 'c', attributes: {} })

  const or_rules = [tag_a, tag_b, tag_c].map<FilterRule>(tag => ({
    name: 'has_tag',
    logic: 'or',
    invert: false,
    input: tag.id
  }))

  const item_a = itemOp(addItem, createForm({ tags: [ tag_a.id ] }))
  const item_b = itemOp(addItem, createForm({ title: 'hello', tags: [ tag_b.id ] }))
  const item_c = itemOp(addItem, createForm({ tags: [ tag_c.id ] }))

  {
    const ids = listingItem( itemPool(), 'id', undefined, 0, true, [
      {
        name: 'title',
        input: 'hello',
        invert: false,
        logic: 'and',
      },
      ...or_rules
    ] )
    expect(ids.length).toBe(1)
    assert(ids.includes(item_b.id))
  }
})

test('Filter Rule(empty_release_date)', () => {
  const [itemPool, itemOp] = ItemOperation(createItemPool([]))
  const __range = 100
  for (let i = 0; i < __range; ++i) {
    const new_item = itemOp(addItem, createForm({ release_date: null }))
    const ids = listingItem( itemPool(), 'id', undefined, 0, true, [{
      name: 'empty_release_date',
      input: null,
      invert: false,
      logic: 'and'
    }])
    expect( ids.length ).toBe( i + 1 )
    assert( ids.includes(new_item.id) )
  }
  const items = [...itemPool().map.values()]
  for (let i = 0; i < items.length; ++i) {
    const item = items[i]
    itemOp(deleteItem, item.id)
    const ids = listingItem( itemPool(), 'id', undefined, 0, true, [{
      name: 'empty_release_date',
      input: null,
      invert: false,
      logic: 'and'
    }])
    expect( ids.length ).toBe( __range - (i + 1) )
    assert( ids.includes(item.id) === false )
  }
})

test('listingItem(sort)', async () => {
  const [getPool, op] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )

  const total_list = [...getPool().map.values()]

  {
    expect(
      listingItem(getPool(), 'id', undefined, 0, true, []).length
    ).toBe(total_list.length)
    expect(
      listingItem(getPool(), 'create_date', undefined, 0, true, []).length
    ).toBe(total_list.length)
    expect(
      listingItem(getPool(), 'update_date', undefined, 0, true, []).length
    ).toBe(total_list.length)
    expect(
      listingItem(getPool(), 'release_date', undefined, 0, true, []).length
    ).toBe(total_list.length)
  }

  {
    const item_id = listingItem(getPool(), 'id', undefined, 0, true, [])[0]
    expect(item_id).toBe(9)

    {
      const item_id = listingItem(getPool(), 'id', undefined, 0, false, [])[0]
      expect(item_id).toBe(1)
    }
  }

  {
    const before_item_id = listingItem(getPool(), 'create_date', undefined, 0, true, [])[0]
    await timeout(100)
    const new_item = op(addItem, createForm())
    const item_id = listingItem(getPool(), 'create_date', undefined, 0, true, [])[0]
    expect(item_id).toBe(new_item.id)
    assert(before_item_id !== new_item.id)
    {
      const item_list = listingItem(getPool(), 'create_date', undefined, 0, false, [])
      expect(item_list[item_list.length - 1]).toBe(new_item.id)
    }
  }

  {
    for (let i = 0; i < 10; ++i) {
      op(addItem, createForm())
      await timeout(10)
    }

    const middle_id = listingItem(getPool(), 'update_date', undefined, 0, true, [])[3]
    const middle_item = getItem(getPool(), middle_id)
    await timeout(100)
    op(updateItem, middle_id, { title: 'hello!' })
    const updated_middle = getItem(getPool(), middle_id)
    assert(updated_middle.update_date !== middle_item.update_date)

    expect(
      listingItem(getPool(), 'update_date', undefined, 0, true, [])[0]
    ).toBe(updated_middle.id)

    {
      const list = listingItem(getPool(), 'update_date', undefined, 0, false, [])
      expect(
        list[list.length - 1]
      ).toBe(updated_middle.id)
    }
  }
})

test('index', async () => {
  const [getPool, op] = ItemOperation(
    createItemPool([])
  )

  for (let i = 0; i < 10; ++i) {
    const item = op(addItem, createForm({  }))
    expect( getPool().index.id.length ).toBe( i + 1 )
    expect(last( getPool().index.id )).toBe(item.id)
    expect(last( getPool().index.update_date )).toBe(item.id)
    expect(last( getPool().index.create_date )).toBe(item.id)
    expect(last( getPool().index.release_date )).toBe(item.id)
  }

  const item_a_id = getPool().index.update_date[0]
  op(updateItem, item_a_id, { title: 'hello!' })
  expect(getPool().index.update_date[0]).not.toBe(item_a_id)
  expect(last( getPool().index.update_date )).toBe(item_a_id)

  const item_ids = [...getPool().map.keys()]
  for (const item_id of item_ids) {
    assert( getPool().index.id.includes(item_id) )
    assert( getPool().index.update_date.includes(item_id) )
    assert( getPool().index.create_date.includes(item_id) )
    assert( getPool().index.release_date.includes(item_id) )
    assert( item_ids.length === getPool().index.id.length )
    assert( item_ids.length === getPool().index.update_date.length )
    assert( item_ids.length === getPool().index.create_date.length )
    assert( item_ids.length === getPool().index.release_date.length )
  }

  for (let i = 0; i < item_ids.length; ++i) {
    const item_id = item_ids[i]
    op(deleteItem, item_id)
    assert( false === getPool().index.id.includes(item_id) )
    assert( false === getPool().index.update_date.includes(item_id) )
    assert( false === getPool().index.create_date.includes(item_id) )
    assert( false === getPool().index.release_date.includes(item_id) )

    assert( (item_ids.length - (i + 1)) === getPool().index.id.length )
    assert( (item_ids.length - (i + 1)) === getPool().index.update_date.length )
    assert( (item_ids.length - (i + 1)) === getPool().index.create_date.length )
    assert( (item_ids.length - (i + 1)) === getPool().index.release_date.length )
  }

  assert( 0 === [...getPool().map.keys()].length )
})

test('insertReleaseDateToIndex', async () => {
  const [getPool, op] = ItemOperation(
    createItemPool([])
  )

  const item_a = op(addItem, createForm({ release_date: String(new Date('2001/01/01')) }))
  await timeout(100)
  const item_b = op(addItem, createForm({ release_date: String(new Date('2002/01/01')) }))
  await timeout(100)
  const item_c = op(addItem, createForm({ release_date: String(new Date('2003/01/01')) }))

  const new_item_id = itemID(99922)

  const ids = insertReleaseDateToIndex(
    'release_date',
    getPool().map,
    getPool().index.update_date,
    new_item_id,
    new Date('2004/01/01')
  )
  expect( ids.length ).toBe( 4 )
  expect( ids[0] ).toBe(item_a.id)
  expect( ids[1] ).toBe(item_b.id)
  expect( ids[2] ).toBe(item_c.id)
  expect( ids[ids.length - 1] ).toBe( new_item_id )
})

test('insertReleaseDateToIndex(same date)', async () => {
  const [getPool, op] = ItemOperation(
    createItemPool([])
  )

  const same_date = new Date('2008/01/01')

  const item_a = op(addItem, createForm({ release_date: String(same_date) }))
  await timeout(100)
  const item_b = op(addItem, createForm({ release_date: String(same_date) }))
  await timeout(100)
  const item_c = op(addItem, createForm({ release_date: String(same_date) }))

  const new_item_id = itemID(99922)

  const ids = insertReleaseDateToIndex(
    'release_date',
    getPool().map,
    getPool().index.update_date,
    new_item_id,
    same_date
  )
  expect( ids.length ).toBe( 4 )
  expect( ids[ids.length - 1] ).toBe( new_item_id ) // 同样的数值应该排到末尾
})

test('createItemPool', () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  expect(item_pool.latest_id).toBe(9)
  assert(item_pool.map.has(9 as ItemID))
})

test('addItem', () => {
  const old_pool = createItemPool(parseRawItems(generateRawItems()))
  expect(old_pool.latest_id).toBe(9)
  assert(old_pool.map.has(9 as ItemID))

  const [new_item, new_pool] = addItem(old_pool, createForm({ title: 'h!e!llo' }))
  expect(new_item.title).toBe('h!e!llo')

  assert( new_pool.latest_id !== old_pool.latest_id )
})

test('getItem', () => {
  const pool = createItemPool(parseRawItems(generateRawItems()))
  assert(getItem(pool, 9) !== null)
  expect(() => {
    const non_exists_id = 290418429
    getItem(pool, non_exists_id)
  }).toThrow(/not found/)
})

test('deleteItem', () => {
  let pool = createItemPool(parseRawItems(generateRawItems()))
  pool = deleteItem(pool, 9 as ItemID)
  expect(pool.map.has(9 as ItemID)).toBe(false)

  expect(() => {
    deleteItem(pool, 2141241)
  }).toThrow(/not found/)

  const [child_item, new_pool] = addItem(pool, createForm({ title: 'child' }))
  pool = new_pool

  const parent_item = addItem(pool, createForm({
    title: 'parent',
    original: [child_item.id]
  }))
})

test('create parent item', () => {
  let pool = createItemPool([])

  const release_datestring = (new Date).toJSON()

  const childs = range(0, 4).map(()=> {
    const [child, new_pool] = addItem(pool, createForm({
      title: 'child',
      release_date: release_datestring,
    }))
    pool = new_pool
    return child
  })

  const [parent, new_pool] = addItem(pool, createForm({
    title: 'parent',
    original: childs.map((item) => item.id),
    release_date: release_datestring,
  }))
  pool = new_pool

  for (const child of childs) {
    const { release_date } = getItem(pool, child.id)
    assert(release_date !== null)
    assert(release_date instanceof Date)
    if (release_date) {
      expect(release_date.toJSON()).toBe(release_datestring)
    } else {
      throw Error('ss')
    }
  }
})

test('prevent modify item\'s parent field', () => {
  const [getPool, op] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )

  const childs = range(0, 4).map(
    ()=> op(addItem, createForm({ title: 'child' }))
  )
  const parent = op(addItem, createForm({
    title: 'parent',
    original: childs.map(item => item.id)
  }))

  for (const child of childs) {
    expect(() => {
      op(updateItem, child.id, { parent: null })
    }).toThrow()
    expect(() => {
      op(updateItem, child.id, { parent: 221 as ItemID })
    }).toThrow()
  }

  expect(() => {
    const new_item = op(addItem, createForm({}))
    op(updateItem, new_item.id, { parent: parent.id })
  }).toThrow()
})

test('prevent spec non-exists child', () => {
  const [getPool, op] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )

  const nonexists = op(addItem, createForm({ title: 'hehe' }))
  op(deleteItem, nonexists.id)

  expect(() => {
    getItem(getPool(), nonexists.id)
  }).toThrow()

  const child = op(addItem, createForm({ title: 'child' }))

  expect(() => {
    op(addItem, createForm({
      title: 'parent',
      original: [nonexists.id]
    }))
  }).toThrow()

  expect(() => {
    op(addItem, createForm({
      title: 'parent',
      original: [nonexists.id, child.id]
    }))
  }).toThrow()

  const item = op(addItem, createForm({}))
  expect(() => {
    op(updateItem, item.id, {
      original: [nonexists.id]
    })
  }).toThrow()
  expect(() => {
    op(updateItem, item.id, {
      original: [nonexists.id, child.id]
    })
  }).toThrow()
})

test('update item\'s release_date', () => {
  const [getPool, op] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )

  const date_string = (new Date()).toJSON()
  const new_date_string = (new Date('1997/09/09')).toJSON()

  const new_item = op(addItem, createForm({
    release_date: date_string,
  }))

  expect(new_item.release_date?.toJSON()).toBe(date_string)
  expect(
    getItem(getPool(), new_item.id).release_date?.toJSON()
  ).toBe(date_string)

  {
    op(updateItem, new_item.id, {
      title: 'hello!'
    })
    expect(new_item.release_date?.toJSON()).toBe(date_string)
    expect(
      getItem(getPool(), new_item.id).release_date?.toJSON()
    ).toBe(date_string)
  }
  {
    op(updateItem, new_item.id, {
      release_date: new_date_string
    })
    expect(
      getItem(getPool(), new_item.id).release_date?.toJSON()
    ).toBe(new_date_string)
  }
})

test('update item\'s original', () => {
  // const pool = createItemPool(parseRawItems(generateRawItems()))
  const [getPool, op] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )

  const childs = range(0, 4).map(()=>
    op(addItem, createForm({ title: 'child' }))
    // Op(p => addItem(p, createForm({ title: 'child' })))
  )
  const parent = op(addItem, createForm({ title: 'parent', original: [] }))

  const child_ids = childs.map(ch => ch.id)

  {
    op(updateItem, parent.id, { original: child_ids })
    // updateItem(pool, parent.id, { original: child_ids })
    // console.log(getItem(getPool(), parent.id))
    expect(
      getItem(getPool(), parent.id).original
    ).toBe(child_ids)
    for (const child of childs) {
      expect(getItem(getPool(), child.id).parent).toBe(parent.id)
    }
  }

  {
    op(updateItem, parent.id, { original: child_ids })

    op(updateItem, parent.id, { original: [] })

    assert(getItem(getPool(), parent.id).original !== null)

    assert( Array.isArray(getItem(getPool(), parent.id).original) )

    assert( getItem(getPool(), parent.id).original?.length === 0 )

    for (const child of childs) {
      expect(getItem(getPool(), child.id).parent).toBe(null)
    }
  }

  {
    op(updateItem, parent.id, { original: child_ids })
    op(updateItem, parent.id, { original: null })

    assert(getItem(getPool(), parent.id).original === null)
    for (const child of childs) {
      expect(getItem(getPool(), child.id).parent).toBe(null)
    }
  }
})

test('prevent delete child item', () => {
  const [getPool, op] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )
  const child_a = op(addItem, createForm({}))
  const child_b = op(addItem, createForm({}))
  const child_c = op(addItem, createForm({}))

  const parent = op(addItem, createForm({ original: [ child_a.id, child_b.id, child_c.id ] }))

  expect(getItem(getPool(), parent.id).original).toStrictEqual([ child_a.id, child_b.id, child_c.id ])

  expect(() => op(deleteItem, child_a.id)).toThrow()
  expect(() => op(deleteItem, child_b.id)).toThrow()
  expect(() => op(deleteItem, child_c.id)).toThrow()

  expect(getItem(getPool(), parent.id).original).toStrictEqual([ child_a.id, child_b.id, child_c.id ])
})

test('prevent delete parent item that has childs', () => {
  const [getPool, op] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )

  const childs = range(0, 4).map(()=> op(addItem, createForm({ title: 'child' })))
  const child_ids = childs.map(ch => ch.id)
  const parent = op(addItem, createForm({
    title: 'parent',
    original: child_ids
  }))

  expect(() => op(deleteItem, parent.id)).toThrow()
  expect(getItem(getPool(), parent.id).original).toStrictEqual(child_ids)
  for (const child of childs) {
    expect(getItem(getPool(), child.id).parent).toBe(parent.id)
  }

  {
    const empty_parent = op(addItem, createForm({
      title: 'empty parent',
      original: []
    }))
    op(deleteItem, empty_parent.id)
    expect(() => getItem(getPool(), empty_parent.id)).toThrow()
  }
})

test('updateItem', () => {
  const [getPool, op] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )

  const title = `${Date.now()}`
  op(updateItem, 9, { title })
  expect(getItem(getPool(), 9).title).toBe(title)
})

test('deleteTagAndUpdateItems', () => {
  const [itemPool, itemOp, setItemPool] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )
  const [tagPool, tagOp, setTagPool] = TagOperation(
    createTagPool([
      { id: tagID(1), name: 'name', attributes: {} }
    ])
  )

  {
    const tag = tagOp(newTag, { name: 'hehe', attributes: {} })

    const new_item = itemOp(addItem, {
      ...createForm(),
      tags: [ tag.id ]
    })

    deleteTagAndUpdateItemsOperate(
      tag.id,
      [tagPool, setTagPool],
      [itemPool, setItemPool]
    )

    expect(() => {
      getTag(tagPool(), tag.id)
    }).toThrow()

    const found_item = getItem(itemPool(), new_item.id)
    expect(found_item.tags.includes(tag.id)).toBe(false)
    expect(found_item.tags.length).toBe(0)

    {
      const tagA = tagOp(newTag, { name: 'tagA', attributes: {} })
      const tagB = tagOp(newTag, { name: 'tagB', attributes: {} })
      const new_item = itemOp(addItem, {
        ...createForm(),
        tags: [ tagA.id, tagB.id ]
      })

      expect(new_item.tags.length).toBe(2)
      expect(getItem(itemPool(), new_item.id).tags).toEqual([ tagA.id, tagB.id ])

      deleteTagAndUpdateItemsOperate(
        tagA.id,
        [tagPool, setTagPool],
        [itemPool, setItemPool]
      )

      expect(getItem(itemPool(), new_item.id).tags.length).toBe(1)
      expect(getItem(itemPool(), new_item.id).tags).toEqual([ tagB.id ])

      deleteTagAndUpdateItemsOperate(
        tagB.id,
        [tagPool, setTagPool],
        [itemPool, setItemPool]
      )
      expect(getItem(itemPool(), new_item.id).tags.length).toBe(0)
    }

    {
      expect(() => {
        const non_exists = tagID(114141424214)
        deleteTagAndUpdateItemsOperate(
          non_exists,
          [tagPool, setTagPool],
          [itemPool, setItemPool]
        )
      }).toThrow()

      const removed_tag = tagOp(newTag, { name: 'tagA', attributes: {} })
      deleteTagAndUpdateItemsOperate(removed_tag.id, [tagPool, setTagPool], [itemPool, setItemPool])
      expect(() =>
        deleteTagAndUpdateItemsOperate(removed_tag.id, [tagPool, setTagPool], [itemPool, setItemPool])
      ).toThrow()
    }
  }
})
