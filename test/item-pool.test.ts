import fs from 'fs'
import path from 'path'
import assert from 'assert'
// import config_object from './config'
import { initConfig } from '../src/server/init'
import { addItem, createItemPool, deleteItem, deleteTagAndUpdateItems, getItem, listingItem, updateItem } from '../src/server/core/ItemPool'
import { CreateItemForm, ItemID, Item_raw, itemID, parseRawItems } from '../src/server/core/Item'
import { createTagPool, deleteTag, getTag, newTag, updateTag } from '../src/server/core/TagPool'
import { tagID } from '../src/server/core/Tag'
import { timeout } from 'vait'
import { partial, range } from 'ramda'
import { createForm, generateRawItems } from './common'

beforeEach(() => {
  // fs.rmSync(config_object.storage_path, { recursive: true, force: true });
  // expect(
  //   fs.existsSync(config_object.storage_path)
  // ).toEqual(false)
})

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
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  const input_title = 'halasjfiasjfosajoifjasiofjioqjiojafoiafsjioasjfoiajsl'
  const list = listingItem(item_pool, 'id', undefined, 0, true, [{
    name: 'title',
    input: input_title,
    logic: 'and',
    // use_regexp: false,
    // invert: false,
  }])
  expect(list.length).toBe(0)

  {
    const new_item = addItem(item_pool, createForm({ title: input_title }))
    const list = listingItem(item_pool, 'id', undefined, 0, true, [{
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
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  const list = listingItem(item_pool, 'id', undefined, 0, true, [{
    name: 'has_multi_original',
    input: null,
    logic: 'and',
    // use_regexp: false,
    // invert: false,
  }])
  expect(list.length).toBe(0)
  {
    const new_item = addItem(item_pool, createForm({
      title: 'hag',
      original: [1, 2].map(itemID),
    }))
    const list = listingItem(item_pool, 'id', undefined, 0, true, [{
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
    const item_pool = createItemPool(parseRawItems(generateRawItems()))
    const list = listingItem(item_pool, 'id', undefined, 0, true, [{
      name: 'is_child_item',
      input: null,
      logic: 'and',
      invert: true,
    }])
    expect(list.length).toBe(5)
  }
  { // is_child_item （更细致的检查
    const item_pool = createItemPool(parseRawItems(generateRawItems()))
    const list = listingItem(item_pool, 'id', undefined, 0, true, [{
      name: 'is_child_item',
      input: null,
      logic: 'and',
      // use_regexp: false,
      // invert: false,
    }])
    const before_count = [...item_pool.map.values()].length
    expect(list.length).toBe(0)
    {
      const new_item = addItem(item_pool, createForm({
        title: 'hag',
        original: [1, 2].map(itemID),
      }))
      const list = listingItem(item_pool, 'id', undefined, 0, true, [{
        name: 'is_child_item',
        input: null,
        logic: 'and',
        // use_regexp: false,
        // invert: false,
      }])
      expect(list.length).toBe(2)
      expect([...item_pool.map.values()].length).toBe(before_count + 1)

      const JSONData = JSON.stringify([...item_pool.map.values()])
      {
        updateItem(item_pool, new_item.id, { original: null })
        deleteItem(item_pool, new_item.id)
        const list = listingItem(item_pool, 'id', undefined, 0, true, [{
          name: 'is_child_item',
          input: null,
          logic: 'and',
        }])
        expect(list.length).toBe(0)
      }

      {
        const item_pool = createItemPool(JSON.parse(JSONData))
        updateItem(item_pool, new_item.id, { original: null })
        const list = listingItem(item_pool, 'id', undefined, 0, true, [{
          name: 'is_child_item',
          input: null,
          logic: 'and',
        }])
        expect(list.length).toBe(0)
      }

      {
        const item_pool = createItemPool(JSON.parse(JSONData))
        updateItem(item_pool, new_item.id, { original: [itemID(3)] })
        const list = listingItem(item_pool, 'id', undefined, 0, true, [{
          name: 'is_child_item',
          input: null,
          logic: 'and',
        }])
        expect(list.length).toBe(1)
      }
    }
  }
})

test.todo('Filter Rule(has_tag)')

test('Filter Rule(empty_tag)', async () => {
  const item_pool = createItemPool([])
  const tag_pool = createTagPool([])
  const new_tag = newTag(tag_pool, { name: 'hehe', attributes: {} })

  const __count = 100

  for (let i = 0; i < __count; ++i) {
    addItem(item_pool, createForm({
      tags: []
    }))
  }

  const ids = listingItem(item_pool, 'id', undefined, 0, true, [{
    name: 'empty_tag',
    input: null,
    logic: 'and',
    invert: false,
  }])
  expect(ids.length).toBe(__count)

  for (let i = 0; i < __count; ++i) {
    updateItem(item_pool, ids[i], { tags: [ new_tag.id ] })
    {
      const list = listingItem(item_pool, 'id', undefined, 0, true, [{
        name: 'empty_tag',
        input: null,
        logic: 'and',
        invert: false,
      }])
      expect(list.length).toBe(__count - (i + 1))
    }
  }
})

test('Multi Fileter Rule', () => {
})

test('Filter Rule(invert option)', () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))

  const total_list = [...item_pool.map.values()]
  const list = listingItem(item_pool, 'id', undefined, 0, true, [{
    name: 'has_multi_original',
    input: null,
    logic: 'and',
    invert: true,
  }])
  expect(list.length).toBe(total_list.length)
})

test.todo('Filter Rule(logic option)')

test.todo('Filter Rule(empty_release_date)')

test('listingItem(sort)', async () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))

  const total_list = [...item_pool.map.values()]

  {
    expect(
      listingItem(item_pool, 'id', undefined, 0, true, []).length
    ).toBe(total_list.length)
    expect(
      listingItem(item_pool, 'create_date', undefined, 0, true, []).length
    ).toBe(total_list.length)
    expect(
      listingItem(item_pool, 'update_date', undefined, 0, true, []).length
    ).toBe(total_list.length)
    expect(
      listingItem(item_pool, 'release_date', undefined, 0, true, []).length
    ).toBe(total_list.length)
  }

  {
    const item_id = listingItem(item_pool, 'id', undefined, 0, true, [])[0]
    expect(item_id).toBe(9)

    {
      const item_id = listingItem(item_pool, 'id', undefined, 0, false, [])[0]
      expect(item_id).toBe(1)
    }
  }

  {
    const before_item_id = listingItem(item_pool, 'create_date', undefined, 0, true, [])[0]
    await timeout(100)
    const new_item = addItem(item_pool, createForm())
    const item_id = listingItem(item_pool, 'create_date', undefined, 0, true, [])[0]
    expect(item_id).toBe(new_item.id)
    assert(before_item_id !== new_item.id)
    {
      const item_list = listingItem(item_pool, 'create_date', undefined, 0, false, [])
      expect(item_list[item_list.length - 1]).toBe(new_item.id)
    }
  }

  {
    for (let i = 0; i < 10; ++i) {
      addItem(item_pool, createForm())
      await timeout(10)
    }

    const middle_id = listingItem(item_pool, 'update_date', undefined, 0, true, [])[3]
    const middle_item = getItem(item_pool, middle_id)
    await timeout(100)
    updateItem(item_pool, middle_id, { title: 'hello!' })
    const updated_middle = getItem(item_pool, middle_id)
    assert(updated_middle.update_date !== middle_item.update_date)

    expect(
      listingItem(item_pool, 'update_date', undefined, 0, true, [])[0]
    ).toBe(updated_middle.id)

    {
      const list = listingItem(item_pool, 'update_date', undefined, 0, false, [])
      expect(
        list[list.length - 1]
      ).toBe(updated_middle.id)
    }
  }
})

test('createItemPool', () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  expect(item_pool.latest_id).toBe(9)
  assert(item_pool.map.has(9 as ItemID))
})

test('addItem', () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  expect(item_pool.latest_id).toBe(9)
  assert(item_pool.map.has(9 as ItemID))
})

test('getItem', () => {
  const pool = createItemPool(parseRawItems(generateRawItems()))
  assert(getItem(pool, 9) !== null)
  expect(() => {
    assert(getItem(pool, 290418429) === null)
  }).toThrow(/not found/)
})

test('deleteItem', () => {
  const pool = createItemPool(parseRawItems(generateRawItems()))
  deleteItem(pool, 9 as ItemID)
  expect(pool.map.has(9 as ItemID)).toBe(false)

  expect(() => {
    deleteItem(pool, 2141241)
  }).toThrow(/not found/)

  const child_item = addItem(pool, createForm({ title: 'child' }))
  const parent_item = addItem(pool, createForm({
    title: 'parent',
    original: [child_item.id]
  }))
})

test('create parent item', () => {
  const pool = createItemPool(parseRawItems(generateRawItems()))

  const childs = range(0, 4).map(()=> addItem(pool, createForm({ title: 'child' })))
  const parent = addItem(pool, createForm({
    title: 'parent',
    original: childs.map(item => item.id)
  }))

  for (const child of childs) {
    expect(getItem(pool, child.id).parent).toBe(parent.id)
  }
})

test('prevent modify item\'s parent field', () => {
  const pool = createItemPool(parseRawItems(generateRawItems()))

  const childs = range(0, 4).map(()=> addItem(pool, createForm({ title: 'child' })))
  const parent = addItem(pool, createForm({
    title: 'parent',
    original: childs.map(item => item.id)
  }))

  for (const child of childs) {
    expect(() => {
      updateItem(pool, child.id, { parent: null })
    }).toThrow()
    expect(() => {
      updateItem(pool, child.id, { parent: 221 as ItemID })
    }).toThrow()
  }

  expect(() => {
    updateItem(
      pool,
      addItem(pool, createForm({})).id,
      { parent: parent.id }
    )
  }).toThrow()
})

test('prevent spec non-exists child', () => {
  const pool = createItemPool(parseRawItems(generateRawItems()))

  const nonexists = addItem(pool, createForm({ title: 'child' }))
  deleteItem(pool, nonexists.id)
  expect(() => getItem(pool, nonexists.id)).toThrow()

  const child = addItem(pool, createForm({ title: 'child' }))

  expect(() => {
    addItem(pool, createForm({
      title: 'parent',
      original: [nonexists.id]
    }))
  }).toThrow()

  expect(() => {
    addItem(pool, createForm({
      title: 'parent',
      original: [nonexists.id, child.id]
    }))
  }).toThrow()

  const item = addItem(pool, createForm({}))
  expect(() => {
    updateItem(pool, item.id, {
      original: [nonexists.id]
    })
  }).toThrow()
  expect(() => {
    updateItem(pool, item.id, {
      original: [nonexists.id, child.id]
    })
  }).toThrow()
})

test('update item\'s original', () => {
  const pool = createItemPool(parseRawItems(generateRawItems()))

  const childs = range(0, 4).map(()=> addItem(pool, createForm({ title: 'child' })))
  const parent = addItem(pool, createForm({
    title: 'parent',
    original: []
  }))

  const child_ids = childs.map(ch => ch.id)

  {
    updateItem(pool, parent.id, { original: child_ids })
    expect(
      getItem(pool, parent.id).original
    ).toBe(child_ids)
    for (const child of childs) {
      expect(getItem(pool, child.id).parent).toBe(parent.id)
    }
  }

  {
    updateItem(pool, parent.id, { original: child_ids })
    updateItem(pool, parent.id, { original: [] })

    assert(getItem(pool, parent.id).original !== null)

    assert( Array.isArray(getItem(pool, parent.id).original) )

    assert( getItem(pool, parent.id).original?.length === 0 )

    for (const child of childs) {
      expect(getItem(pool, child.id).parent).toBe(null)
    }
  }

  {
    updateItem(pool, parent.id, { original: child_ids })
    updateItem(pool, parent.id, { original: null })
    assert(getItem(pool, parent.id).original === null)
    for (const child of childs) {
      expect(getItem(pool, child.id).parent).toBe(null)
    }
  }
})

test('prevent delete child item', () => {
  const pool = createItemPool(parseRawItems(generateRawItems()))
  const child_a = addItem(pool, createForm({}))
  const child_b = addItem(pool, createForm({}))
  const child_c = addItem(pool, createForm({}))

  const parent = addItem(pool, createForm({ original: [ child_a.id, child_b.id, child_c.id ] }))

  expect(getItem(pool, parent.id).original).toStrictEqual([ child_a.id, child_b.id, child_c.id ])

  expect(() => deleteItem(pool, child_a.id)).toThrow()
  expect(() => deleteItem(pool, child_b.id)).toThrow()
  expect(() => deleteItem(pool, child_c.id)).toThrow()

  expect(getItem(pool, parent.id).original).toStrictEqual([ child_a.id, child_b.id, child_c.id ])
})

test('prevent delete parent item that has childs', () => {
  const pool = createItemPool(parseRawItems(generateRawItems()))

  const childs = range(0, 4).map(()=> addItem(pool, createForm({ title: 'child' })))
  const child_ids = childs.map(ch => ch.id)
  const parent = addItem(pool, createForm({
    title: 'parent',
    original: child_ids
  }))

  expect(() => deleteItem(pool, parent.id)).toThrow()
  expect(getItem(pool, parent.id).original).toStrictEqual(child_ids)
  for (const child of childs) {
    expect(getItem(pool, child.id).parent).toBe(parent.id)
  }

  {
    const empty_parent = addItem(pool, createForm({
      title: 'empty parent',
      original: []
    }))
    deleteItem(pool, empty_parent.id)
    expect(() => getItem(pool, empty_parent.id)).toThrow()
  }
})

test('updateItem', () => {
  const pool = createItemPool(parseRawItems(generateRawItems()))

  const title = `${Date.now()}`
  updateItem(pool, 9, { title })
  expect(getItem(pool, 9).title).toBe(title)
})

test('deleteTagAndUpdateItems', () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  const tag_pool = createTagPool([
    { id: tagID(1), name: 'name', attributes: {} }
  ])

  {
    const tag = newTag(tag_pool, { name: 'new_name', attributes: {} })

    const new_item = addItem(item_pool, {
      ...createForm(),
      tags: [ tag.id ]
    })

    deleteTagAndUpdateItems(
      tag_pool,
      item_pool,
      tag.id
    )

    expect(() => {
      getTag(tag_pool, tag.id)
    }).toThrow()

    const found_item = getItem(item_pool, new_item.id)
    expect(found_item.tags.includes(tag.id)).toBe(false)
    expect(found_item.tags.length).toBe(0)

    {
      const tagA = newTag(tag_pool, { name: 'tagA', attributes: {} })
      const tagB = newTag(tag_pool, { name: 'tagB', attributes: {} })
      const new_item = addItem(item_pool, {
        ...createForm(),
        tags: [ tagA.id, tagB.id ]
      })

      expect(new_item.tags.length).toBe(2)
      expect(getItem(item_pool, new_item.id).tags).toEqual([ tagA.id, tagB.id ])

      deleteTagAndUpdateItems(
        tag_pool,
        item_pool,
        tagA.id
      )

      expect(getItem(item_pool, new_item.id).tags.length).toBe(1)
      expect(getItem(item_pool, new_item.id).tags).toEqual([ tagB.id ])

      deleteTagAndUpdateItems(
        tag_pool,
        item_pool,
        tagB.id
      )
      expect(getItem(item_pool, new_item.id).tags.length).toBe(0)
    }

    {
      expect(() =>
        deleteTagAndUpdateItems(tag_pool, item_pool, tagID(114141424214))
      ).toThrow()

      const removed_tag = newTag(tag_pool, { name: 'tagA', attributes: {} })
      deleteTagAndUpdateItems(tag_pool, item_pool, removed_tag.id)
      expect(() =>
        deleteTagAndUpdateItems(tag_pool, item_pool, removed_tag.id)
      ).toThrow()
    }
  }
})
