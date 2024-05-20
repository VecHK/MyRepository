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
import { partial } from 'ramda'

beforeEach(() => {
  // fs.rmSync(config_object.storage_path, { recursive: true, force: true });
  // expect(
  //   fs.existsSync(config_object.storage_path)
  // ).toEqual(false)
})

function createForm(append: Partial<CreateItemForm> = {}): CreateItemForm {
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

function initPlainRawItem(id: number): Item_raw {
  return {
    ...createForm(),
    id: itemID(id),
    create_date: (new Date).toJSON(),
    update_date: (new Date).toJSON(),
  }
}

const generateRawItems = (): Item_raw[] => {
  return [
    initPlainRawItem(1),
    initPlainRawItem(2),
    initPlainRawItem(9),
    initPlainRawItem(3),
    initPlainRawItem(4),
  ]
}

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

test('测试筛选', async () => {
  // title
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  const listing = partial(listingItem, [item_pool, 'id'])

  const total_list = [...item_pool.map.values()]

  {
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
  }

  {
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
  }

  {  // 新创建了 item_pool
    const item_pool = createItemPool(parseRawItems(generateRawItems()))
    const list = listingItem(item_pool, 'id', undefined, 0, true, [{
      name: 'is_child_item',
      input: null,
      logic: 'and',
      invert: true,
    }])
    expect(list.length).toBe(5)
  }
  {
    // 新创建了 item_pool
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

// has_tag
})

test('测试多重筛选', () => {
})

test('测试取反', () => {
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

test('测试索引工作情况', async () => {
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

test('updateItem', () => {
  const pool = createItemPool(parseRawItems(generateRawItems()))

  const title = `${Date.now()}`
  updateItem(pool, 9, { title })
  expect(getItem(pool, 9).title).toBe(title)
})

test('newTag', () => {
  const items_pool = createItemPool(parseRawItems(generateRawItems()))
  const tag_pool = createTagPool([
    { id: tagID(1), name: 'name', attributes: {} }
  ])

  const new_tag = newTag(tag_pool, { name: 'new_name', attributes: {} })

  const found_tag = getTag(tag_pool, new_tag.id)
  expect(found_tag.name).toBe(new_tag.name)
  expect(found_tag.id).toBe(new_tag.id)

  {
    const new_item = addItem(items_pool, {
      ...createForm(),
      tags: [ new_tag.id ]
    })

    const found_item = getItem(items_pool, new_item.id)
    expect(found_item.tags.length).toBe(1)
    assert(found_item.tags.includes(new_tag.id))
  }

  {
    const new_item = addItem(items_pool, createForm())
    updateItem(items_pool, new_item.id, {
      tags: [ new_tag.id ]
    })

    const found_item = getItem(items_pool, new_item.id)
    expect(found_item.tags.length).toBe(1)
    assert(found_item.tags.includes(new_tag.id))
  }
})

test('deleteTag', () => {
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
  }
})

test('updateTag', async () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  const tag_pool = createTagPool([
    { id: tagID(1), name: 'name', attributes: {} }
  ])

  {
    const updated_tag = updateTag(tag_pool, tagID(1), { name: 'newname' })
    assert(updated_tag.name === 'newname')
    assert(updated_tag.id === 1)

    const found_tag = getTag(tag_pool, tagID(1))
    assert(found_tag.name === 'newname')
    assert(found_tag.id === 1)
  }
})

test('unique tag_id', async () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  const tag_pool = createTagPool([
    { id: tagID(1), name: 'name', attributes: {} }
  ])
  {
    const new_item = addItem(item_pool, createForm({
      tags: [tagID(1), tagID(1)]
    }))
    expect(new_item.tags.length).toBe(1)
    expect(new_item.tags[0]).toBe(tagID(1))
  }
  {
    const item = addItem(item_pool, createForm({
      tags: []
    }))
    expect(item.tags.length).toBe(0)

    updateItem(item_pool, item.id, {
      tags: [tagID(1), tagID(1)]
    })

    const updated_item = getItem(item_pool, item.id)
    expect(updated_item.tags.length).toBe(1)
    expect(updated_item.tags[0]).toBe(tagID(1))
  }
})
