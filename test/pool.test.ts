const assert = require('power-assert')
import { last, remove, update } from 'ramda'
import { Item, ItemID, Item_raw, itemID, parseRawItems } from '../src/server/core/Item'
import { ItemPool, addItem, createItemPool, deleteItem, getItem, updateItem } from '../src/server/core/ItemPool'
import { PoolOperation, diffItemPoolMapFast } from '../src/server/core/Pool'
import { ItemOperation, createForm, generateRawItems, initPlainRawItem } from './common'

function bigItems() {
  const items: Item_raw[] = []
  for (let i = 1; i <= 10; ++i) {
    items.push(
      initPlainRawItem(i)
    )
  }
  return parseRawItems(items)
}

test('diffItemPoolMapFast add multi items', () => {
  const first_pool = createItemPool(bigItems())
  const [itemPool, op] = PoolOperation<ItemPool, Item>(first_pool, () => {})
  const created_items: Item[] = []
  for (let i = 0; i < 100; ++i) {
    const prev_pool = itemPool()
    const created_item = op(addItem, createForm({ title: ' hello' }))
    created_items.push(created_item)

    {
      const info = diffItemPoolMapFast(itemPool(), first_pool)
      assert( info.dels.length === 0 )
      assert( info.changes.length === 0 )
      assert( info.adds.length === created_items.length )
      for (const created_item of created_items) {
        assert( info.adds.includes( created_item.id ) )
      }
    }

    {
      const info = diffItemPoolMapFast(itemPool(), prev_pool)
      assert( info.dels.length === 0 )
      assert( info.changes.length === 0 )
      assert( info.adds.length === 1 )
      assert( info.adds[0] === created_item.id )
    }
  }
})

test('diffItemPoolMapFast remove single item', () => {
  const first_pool = createItemPool(bigItems())
  for (let id = 1; id <= first_pool.latest_id; ++id) {
    const new_pool = deleteItem(first_pool, id)
    const {
      adds, dels, changes
    } = diffItemPoolMapFast(new_pool, first_pool)
    assert( adds.length === 0 )
    assert( changes.length === 0 )
    assert( dels.length === 1 )
    assert( dels.includes(itemID(id)) )
  }

  {
    const [itemPool, op] = PoolOperation(first_pool, () => {})
    const deleted_ids: ItemID[] = []
    for (let id = itemID(1); id <= first_pool.latest_id; ++id) {
      op(deleteItem, id)
      deleted_ids.push(id)
      const { adds, dels, changes } = diffItemPoolMapFast(itemPool(), first_pool)
      assert( adds.length === 0 )
      assert( changes.length === 0 )
      assert( dels.length === deleted_ids.length )
      for (const deleted_id of deleted_ids) {
        assert( dels.includes(deleted_id) )
      }
    }
  }

  {
    const [itemPool, op] = PoolOperation(first_pool, () => {})
    const deleted_ids: ItemID[] = []
    for (let id = itemID(1); id <= first_pool.latest_id; ++id) {
      const prev_pool = itemPool()
      op(deleteItem, id)
      deleted_ids.push(id)
      const { adds, dels, changes } = diffItemPoolMapFast(itemPool(), prev_pool)
      assert( adds.length === 0 )
      assert( changes.length === 0 )
      assert( dels.length === 1 )
      assert( id === dels[0] )
    }
  }
})

test('diffItemPoolMapFast remove multi item', () => {
  const [itemPool, op] = PoolOperation<ItemPool, Item>(createItemPool(bigItems()), () => {})
  const will_remove_items: Item[] = []
  for (let i = 0; i < 100; ++i) {
    will_remove_items.push(
      op(addItem, createForm({ title: ' hello' }))
    )
  }
  const first_pool = itemPool()
  const removed_items: Item[] = []
  for (const will_remove_item of will_remove_items) {
    const prev_pool = itemPool()
    op(deleteItem, will_remove_item.id)
    removed_items.push( will_remove_item )
    {
      const { adds, dels, changes } = diffItemPoolMapFast(itemPool(), first_pool)
      assert( adds.length === 0 )
      assert( changes.length === 0 )
      assert( dels.length === removed_items.length )
      for (const removed_item of removed_items) {
        assert( dels.includes(removed_item.id) )
      }
    }
    {
      const { adds, dels, changes } = diffItemPoolMapFast(itemPool(), prev_pool)
      assert( adds.length === 0 )
      assert( changes.length === 0 )
      assert( dels.length === 1 )
      assert( dels[0] === will_remove_item.id )
    }
  }
})

test('diffItemPoolMapFast change all items', () => {
  const first_pool = createItemPool(bigItems())
  const [itemPool, op] = PoolOperation(first_pool, () => {})
  const latest_id = itemPool()['latest_id']
  for (let id = 1; id <= latest_id; ++id) {
    op(updateItem, id, { title: 'test' })
    const {
      adds, dels, changes
    } = diffItemPoolMapFast(itemPool(), first_pool)
    assert( dels.length === 0 )
    assert( adds.length === 0 )
    assert( changes.length == id )
    for (let i = 1; i <= id; ++i) {
      assert( changes.includes(itemID(i)) )
    }
  }
  const {
    adds, dels, changes
  } = diffItemPoolMapFast(itemPool(), first_pool)
  assert( changes.length === latest_id )
  assert( dels.length === 0 )
  assert( adds.length === 0 )
  for (let id = 1; id <= itemPool()['latest_id']; ++id) {
    assert( changes.includes(itemID(id)) )
  }
})

test('diffItemPoolMapFast change first item', () => {
  const first_pool = createItemPool(bigItems())
  const [itemPool, op] = PoolOperation(first_pool, () => {})
  const new_pool = updateItem(first_pool, 1, { title: 'test' })
  const {
    adds, dels, changes
  } = diffItemPoolMapFast(new_pool, first_pool)
  assert( adds.length === 0 )
  assert( dels.length === 0 )
  assert( changes.length === 1 )
  assert( changes.includes(itemID(1)) )
})

test('diffItemPoolMapFast change latest item', () => {
  const first_pool = createItemPool(bigItems())
  const [itemPool, op] = PoolOperation(first_pool, () => {})
  const new_pool = updateItem(first_pool, 5, { title: 'test' })
  const {
    adds, dels, changes
  } = diffItemPoolMapFast(new_pool, first_pool)
  assert( adds.length === 0 )
  assert( dels.length === 0 )
  assert( changes.length === 1 )
  assert( changes.includes(itemID(5)) )
})

test('diffItemPoolMapFast change multi items', () => {
  const first_pool = createItemPool(bigItems())
  const new_pool = updateItem(
    updateItem(
      first_pool, 3, { title: 'test' }), 4, { title: 'test' })
  const {
    adds, dels, changes
  } = diffItemPoolMapFast(new_pool, first_pool)
  assert( adds.length === 0 )
  assert( dels.length === 0 )
  assert( changes.length === 2 )
  assert( changes.includes(itemID(3)) )
  assert( changes.includes(itemID(4)) )
})

test('diffItemPoolMapFast change item\' original', () =>   {
  const first_pool = createItemPool(bigItems())
  const latest_pool = updateItem(first_pool, 1, { title: 'test', original: [2, 3, 4, 5] as ItemID[] })
  {
    const {
      adds, dels, changes
    } = diffItemPoolMapFast(latest_pool, first_pool)

    assert( adds.length === 0 )
    assert( dels.length === 0 )
    assert( changes.length === 5 )
    for (let i = 1; i <= 5; ++i) {
      assert( changes.includes(itemID(i)) )
    }
  }

  {
    const new_pool = updateItem(latest_pool, 1, { original: null })
    const {
      adds, dels, changes
    } = diffItemPoolMapFast(new_pool, latest_pool)
    assert( adds.length === 0 )
    assert( dels.length === 0 )
    assert( changes.length === 5 )
    for (let i = 1; i <= 5; ++i) {
      assert( changes.includes(itemID(i)) )
    }
  }

  {
    const new_pool = updateItem(latest_pool, 1, { original: [ 2 ] as ItemID[] })
    const {
      adds, dels, changes
    } = diffItemPoolMapFast(new_pool, latest_pool)
    assert( adds.length === 0 )
    assert( dels.length === 0 )
    assert( changes.length === 5 )
    for (let i = 1; i <= 5; ++i) {
      assert( changes.includes(itemID(i)) )
    }
  }
})

test('diffItemPoolMapFast change single items', () =>   {
  const first_pool = createItemPool(bigItems())
  const [itemPool, op] = PoolOperation(first_pool, () => {})
  const new_pool = updateItem(first_pool, 3, { title: 'test' })
  const {
    adds, dels, changes
  } = diffItemPoolMapFast(new_pool, first_pool)
  assert( adds.length === 0 )
  assert( dels.length === 0 )
  assert( changes.length === 1 )
  assert( changes.includes(itemID(3)) )
})

test.skip('diffItemPoolMapFast performance', () => {
  const first_pool = createItemPool(bigItems())
  const [itemPool, op] = PoolOperation(first_pool, () => {})
  const [new_item, new_pool] = addItem(first_pool, createForm({ title: 'hehe' }))
  const {
    adds, dels, changes
  } = diffItemPoolMapFast(new_pool, first_pool)

  {
    const new_pool = deleteItem(first_pool, 4)
    const {
      adds, dels, changes
    } = diffItemPoolMapFast(new_pool, first_pool)

    {
      const { adds, dels, changes } = diffItemPoolMapFast(new_pool, new_pool)
      expect( adds.length ).toBe(0)
      expect( dels.length ).toBe(0)
      expect( changes.length ).toBe(0)
    }
    for (let i = 0; i < 4000; ++i) {
      op(addItem, createForm({ title: 'hehe' }))
    }

    {
      const prev_pool = itemPool()
      for (let i = 1000; i < 1500; ++i) {
        op(updateItem, i as ItemID, { title: 'edited' })
      }
      // console.time('update 500 items with newDiffItemPoolMap')
      diffItemPoolMapFast(itemPool(), prev_pool)
      // console.timeEnd('update 500 items with newDiffItemPoolMap')

      // console.time('update 500 items with diffItemPoolMap')
      // diffItemPoolMap(itemPool().map, first_pool.map)
      // console.timeEnd('update 500 items with diffItemPoolMap')
    }
  }
})

test('diffItemPoolMapFast', () => {
  const old_pool = createItemPool(parseRawItems(generateRawItems()))

  const [new_item, new_pool] = addItem(old_pool, createForm({ title: 'hehe' }))
  const {
    adds, dels, changes
  } = diffItemPoolMapFast(new_pool, old_pool)

  expect( adds.length ).toBe(1)
  expect( dels.length ).toBe(0)
  expect( changes.length ).toBe(0)

  {
    const { adds, dels, changes } = diffItemPoolMapFast(new_pool, new_pool)
    expect( adds.length ).toBe(0)
    expect( dels.length ).toBe(0)
    expect( changes.length ).toBe(0)
  }
  {
    const { adds, dels, changes } = diffItemPoolMapFast(old_pool, old_pool)
    expect( adds.length ).toBe(0)
    expect( dels.length ).toBe(0)
    expect( changes.length ).toBe(0)
  }

  {
    expect(
      diffItemPoolMapFast(
        updateItem(new_pool, new_item.id, { title: 'hehe' }),
        new_pool
      )['changes'].length
    ).toBe(1)
  }

  expect(
    diffItemPoolMapFast(
      deleteItem(new_pool, new_item.id),
      new_pool
    )['dels'].length
  ).toBe(1)
})

test('diffItemPoolMapFast（更复杂的情况）', () => {
  const [itemPool, op, setItemPool] = ItemOperation(createItemPool(parseRawItems(generateRawItems())))
  for (let i = 0; i < 100; ++i) {
    op(addItem, createForm({ title: `prepare-${i}` }))
  }

  let prev_pool = itemPool()

  const selects = [ 'add', 'del', 'change' ]

  const diff: {
    adds: Item[]
    dels: Item[]
    changes: Item[]
  } = {
    adds: [],
    dels: [],
    changes: []
  }
  let items: Item[] = [...prev_pool.map.values()]

  for (let i = 0; i < 4000; ++i) {
    const select = Math.floor(Math.random() * 3)
    const action = selects[select]
    // console.log(action)
    if (action === 'add') {
      const [new_item, current_pool] = addItem(prev_pool, createForm({ title: `adds-${i}` }))
      // diff.adds.push(new_item)
      items.push(new_item)

      const {
        adds, dels, changes
      } = diffItemPoolMapFast(current_pool, prev_pool)

      expect( adds.length ).toBe(1)
      expect( dels.length ).toBe(0)
      expect( changes.length ).toBe(0)
      prev_pool = current_pool
    } else if ((action === 'del')) {
      if (items.length > 0) {
        const idx = Math.floor(Math.random() * items.length)
        const deleted_item = items[idx]
        items = remove(idx, 1, items)

        const current_pool = deleteItem(prev_pool, deleted_item.id)
        const {
          adds, dels, changes
        } = diffItemPoolMapFast(current_pool, prev_pool)
        expect( adds.length ).toBe(0)
        expect( dels.length ).toBe(1)
        expect( changes.length ).toBe(0)
        prev_pool = current_pool
      }
    } else if (action === 'change') {
      if (items.length > 0) {
        const idx = Math.floor(Math.random() * items.length)
        const will_update_item = items[idx]
        // items = remove(idx, 1, items)

        const current_pool = updateItem(prev_pool, will_update_item.id, { title: `changes-${i}` })
        const updated_item = getItem(current_pool, will_update_item.id)
        items = update(idx, updated_item, items)

        const {
          adds, dels, changes
        } = diffItemPoolMapFast(current_pool, prev_pool)
        expect( adds.length ).toBe(0)
        expect( dels.length ).toBe(0)
        expect( changes.length ).toBe(1)
        expect([...changes.values()]).toStrictEqual([updated_item.id])
        prev_pool = current_pool
      }
    } else {
      throw new Error('failure')
    }
  }

  for (const item of items) {
    expect(
      getItem(prev_pool, item.id)
    ).toEqual(item)
  }
})
