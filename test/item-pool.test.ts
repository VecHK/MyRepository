import assert from 'assert'

import { ItemPool, addItem, createItemPool, deleteItem, getItem, listingItem, updateItem } from '../src/server/core/ItemPool'
import { ItemID, Item_raw, itemID, parseRawItems } from '../src/server/core/Item'
import { TagPool, createTagPool, deleteTag, getTag, newTag, updateTag } from '../src/server/core/TagPool'
import { TagID, tagID } from '../src/server/core/Tag'
import { timeout } from 'vait'
import { partial, range } from 'ramda'
import { ItemOperation, TagOperation, createForm, generateRawItems } from './common'
import { deleteTagAndUpdateItemsOperate } from '../src/server/core/Pool'

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
    expect(list.length).toBe(5)
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

test.todo('Filter Rule(has_tag)')

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

test.todo('Multi Fileter Rule')

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

test.todo('Filter Rule(logic option)')

test.todo('Filter Rule(empty_release_date)')

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

  const childs = range(0, 4).map(()=> {
    const [child, new_pool] = addItem(pool, createForm({ title: 'child' }))
    pool = new_pool
    return child
  })

  const [parent, new_pool] = addItem(pool, createForm({
    title: 'parent',
    original: childs.map((item) => item.id)
  }))
  pool = new_pool

  for (const child of childs) {
    expect(getItem(pool, child.id).parent).toBe(parent.id)
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
