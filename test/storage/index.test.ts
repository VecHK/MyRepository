import fs from 'fs'
import path from 'path'
import { PoolStorage } from '../../src/server/repo/storage/init/v2'
import { ItemStorage } from '../../src/server/repo/storage'
import { addItem, createItemPool, getItem, updateItem } from '../../src/server/core/ItemPool'
import { createForm } from '../common'
import { Item_raw } from '../../src/server/core/Item'

const test_path = path.join(__dirname, './test-path')

beforeEach(() => {
  fs.rmSync(test_path, { recursive: true, force: true })
})

test('写入是原子操作', async () => {
  const item_pool = createItemPool([])
  const { readAll } = PoolStorage(test_path)
  const [itemPool, itemOp] = ItemStorage(item_pool, test_path, true)
  for (let i = 0; i < 10; ++i) {
    const new_item = itemOp(addItem, createForm({ title: '' }))
    for (let i = 0; i < 100; ++i) {
      itemOp(updateItem, new_item.id, { title: `${i}` })
    }
  }

  const items_raw = await readAll<Item_raw>('item')
  expect(items_raw.length).toBe(itemPool().map.size)

  for (const raw_item of items_raw) {
    expect( itemPool().map.has(raw_item.id) ).toBe(true)
    const item = getItem(itemPool(), raw_item.id)
    expect(raw_item.id).toBe(item.id)
    expect(raw_item.title).toBe('99')
  }
})
