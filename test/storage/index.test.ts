import fs from 'fs'
import path from 'path'
import { itemPoolStorage } from '../../src/server/repo/storage/init/v2'
import { ApplyItemStorage } from '../../src/server/repo/storage'
import { addItem, createItemPool, getItem, updateItem } from '../../src/server/core/ItemPool'
import { createForm } from '../common'
import { Item, ItemID, Item_raw, itemID } from '../../src/server/core/Item'
import { Signal, timeout } from 'vait'
import { Driver, StorageQueue } from '../../src/server/repo/storage/storage-queue'

const test_path = path.join(__dirname, './test-path')

beforeEach(() => {
  fs.rmSync(test_path, { recursive: true, force: true })
  fs.mkdirSync(test_path)
})

jest.setTimeout(30000)

test('写入是原子操作', async () => {
  const item_pool = createItemPool([])
  const itemStorage = itemPoolStorage(test_path)
  const [itemPool, itemOp] = ApplyItemStorage({
    item_pool,
    slient: true,
    storageQueue: itemStorage.queue
  })

  for (let i = 0; i < 10; ++i) {
    const new_item = itemOp(addItem, createForm({ title: '' }))
    for (let i = 0; i < 100; ++i) {
      itemOp(updateItem, new_item.id, { title: `${i}` })
    }
  }

  const items_raw = await itemStorage.readAll()
  expect(items_raw.length).toBe(itemPool().map.size)

  for (const raw_item of items_raw) {
    expect( itemPool().map.has(raw_item.id) ).toBe(true)
    const item = getItem(itemPool(), raw_item.id)
    expect(raw_item.id).toBe(item.id)
    expect(raw_item.title).toBe('99')
  }
})

function virtualDriver(): Driver<ItemID, Item> {
  function processing() {
    return timeout( Math.floor(Math.random() * 10) )
  }

  const map = new Map<ItemID, Item>()

  return {
    async readRaw(id) {
      await processing()
      const item = map.get(id)
      if (item !== undefined) {
        return JSON.stringify(item)
      } else {
        throw Error('item notfound')
      }
    },
    async create(item) {
      await processing()
      if (map.has(item.id)) {
        throw Error('item exists')
      } else {
        map.set(item.id, item)
      }
    },
    async delete(id) {
      await processing()
      if (!map.has(id)) {
        throw Error('item notfound')
      } else {
        map.delete(id)
      }
    },
    async update(item) {
      await processing()
      if (!map.has(item.id)) {
        throw Error('item notfound')
      } else {
        map.set(item.id, item)
      }
    },
  }
}

test('随机写入', async () => {
  const item_pool = createItemPool([])
  const itemStorageQueue = StorageQueue(virtualDriver())

  const [ itemPool, itemOp ] = ApplyItemStorage({
    item_pool,
    slient: true,
    storageQueue: itemStorageQueue,
  })
  for (let i = 0; i < 500; ++i) {
    const item = itemOp(addItem, createForm({ title: `${i}` }))
    for (let j = 0; j < 100; ++j) {
      itemOp(updateItem, item.id, { title: `${i}-${j}` })
    }
  }

  await Signal.wait(itemStorageQueue.queuePool.signal.ALL_DONE)

  expect(itemPool().latest_id).toBe(500)

  for (const item of itemPool().map.values()) {
    // const id = i + 1
    const raw = await itemStorageQueue.driver.readRaw(item.id)
    const raw_item = JSON.parse(raw) as Item_raw
    expect( raw_item.id ).toBe(item.id)
    expect( raw_item.title ).toBe(item.title)
  }
})
