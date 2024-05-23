import { last, remove, update } from 'ramda'
import { Item, parseRawItems } from '../src/server/core/Item'
import { addItem, createItemPool, deleteItem, getItem, updateItem } from '../src/server/core/ItemPool'
import { diffItemPoolMap } from '../src/server/core/Pool'
import { ItemOperation, createForm, generateRawItems } from './common'

test('diffItemPoolMap', () => {
  const old_pool = createItemPool(parseRawItems(generateRawItems()))

  const [new_item, new_pool] = addItem(old_pool, createForm({ title: 'hehe' }))
  const {
    adds, dels, changes
  } = diffItemPoolMap(new_pool['map'], old_pool['map'])
  expect( adds.size ).toBe(1)
  expect( dels.size ).toBe(0)
  expect( changes.size ).toBe(0)

  expect( adds.toList().toArray()[0].id ).toBe(new_item.id)

  {
    expect(
      diffItemPoolMap(
        updateItem(new_pool, new_item.id, { title: 'hehe' })['map'],
        new_pool['map']
      )['changes'].size
    ).toBe(1)
  }

  expect(
    diffItemPoolMap(
      deleteItem(new_pool, new_item.id)['map'],
      new_pool['map']
    )['dels'].size
  ).toBe(1)
})

test('diffItemPoolMap（更复杂的情况）', () => {
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
      } = diffItemPoolMap(current_pool['map'], prev_pool['map'])

      expect( adds.size ).toBe(1)
      expect( dels.size ).toBe(0)
      expect( changes.size ).toBe(0)
      prev_pool = current_pool
    } else if ((action === 'del')) {
      if (items.length > 0) {
        const idx = Math.floor(Math.random() * items.length)
        const deleted_item = items[idx]
        items = remove(idx, 1, items)

        const current_pool = deleteItem(prev_pool, deleted_item.id)
        const {
          adds, dels, changes
        } = diffItemPoolMap(current_pool['map'], prev_pool['map'])
        expect( adds.size ).toBe(0)
        expect( dels.size ).toBe(1)
        expect( changes.size ).toBe(0)
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
        } = diffItemPoolMap(current_pool['map'], prev_pool['map'])
        expect( adds.size ).toBe(0)
        expect( dels.size ).toBe(0)
        expect( changes.size ).toBe(1)
        expect(last([...changes.values()])).toStrictEqual(updated_item)
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
