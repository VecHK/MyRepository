import fs from 'fs'
import { partial, pathEq } from 'ramda'
// import { fileId } from '../app/core/File'
import { initFilePool, splitPoint } from '../../src/server/repo/file-pool'
import { FileID, constructFileID, parseFileID } from '../../src/server/core/File'

import cfg from './config'
import { timeout } from 'vait'
import { addItem, createItemPool } from '../../src/server/core/ItemPool'
import { createForm } from '../common'
import path from 'path'
import pathExists from '../../src/server/utils/directory'
import { Item } from '../../src/server/core/Item'

beforeEach(() => {
  fs.rmSync(cfg.filepool_path, { recursive: true, force: true })
})

test('splitPoint', () => {
  const __FILE_POOL_SPLIT_INTERVAL__ = 1000

  const sp = partial(splitPoint, [__FILE_POOL_SPLIT_INTERVAL__])
  expect(sp(0)).toBe(0)
  expect(sp(500)).toBe(0)
  expect(sp(__FILE_POOL_SPLIT_INTERVAL__ - 1)).toBe(0)

  expect(
    sp(__FILE_POOL_SPLIT_INTERVAL__)
  ).toBe(__FILE_POOL_SPLIT_INTERVAL__)

  expect(
    sp(2 * __FILE_POOL_SPLIT_INTERVAL__)
  ).toBe(2 * __FILE_POOL_SPLIT_INTERVAL__)

  for (let i = 3; i < 100; ++i) {
    expect(
      sp(i * __FILE_POOL_SPLIT_INTERVAL__)
    ).toBe(i * __FILE_POOL_SPLIT_INTERVAL__)
  }
})

test('constructFileID', () => {
  expect(
    constructFileID(0, 'avif')
  ).toBe('0.avif')

  expect(
    constructFileID(1, 'avif')
  ).toBe('1.avif')

  expect(
    constructFileID(2, '')
  ).toBe('2')

  expect(
    constructFileID(23)
  ).toBe('23')
})

test('parseFileID', () => {
  {
    const [ n, f ] = parseFileID('233.avif' as any)
    expect(n).toBe(233)
    expect(f).toBe('avif')
  }
  {
    const [ n, f ] = parseFileID('233' as any)
    expect(n).toBe(233)
    expect(f).toBe(null)
  }
  {
    const [ n, f ] = parseFileID('002333' as any)
    expect(n).toBe(2333)
  }

  {
    expect(() => {
      parseFileID('' as any)
    }).toThrow()
    expect(() => {
      parseFileID(null as any)
    }).toThrow()
    expect(() => {
      parseFileID('-1' as any)
    }).toThrow()
    expect(() => {
      parseFileID('jioajgiajsgi' as any)
    }).toThrow()
    expect(() => {
      parseFileID('jioajgiajsgi.&*@$#^*&' as any)
    }).toThrow()
    expect(() => {
      parseFileID('jioajgiajsgi.abc@' as any)
    }).toThrow()
    expect(() => {
      parseFileID('jioajgiajsgi.a2bc!' as any)
    }).toThrow()

    // expect(() => {
    //   console.log(
    //     parseFileID('../2' as any)
    //   )
    // }).toThrow()
  }
})

async function createFile(
  filepool: Awaited<ReturnType<typeof initFilePool>>,
  data: Buffer | string
) {
  const f_num = await filepool.requestFileNumber()
  const f_id = `${f_num}` as FileID
  await filepool.saveFile(f_id, Buffer.from(data))
  return f_id
}

test('collectUnReferencedFiles', async () => {
  const filepool = await initFilePool(cfg.filepool_path, 10)

  const item_pool = createItemPool([])

  expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(0)

  {
    await createFile(filepool, 'hejhiojaipsfa')

    const files = await filepool.collectUnReferencedFiles(item_pool)

    expect(files.length).toBe(1)
  }

  {
    await createFile(filepool, 'hejhiojaipsfa')
    await createFile(filepool, 'hejhiojaipsfa')
    expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(3)
  }

  {
    const f_id = await createFile(filepool, 'hejhiojaipsfa')

    expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(4)

    addItem(item_pool, createForm({ cover: f_id }))

    expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(3)

    const files = await filepool.collectUnReferencedFiles(item_pool)
    const unref_file_id = path.basename(files[0]) as FileID
    addItem(item_pool, createForm({ original: unref_file_id }))

    expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(2)
  }
})

test('cleanUnReferencedFiles', async () => {
  const filepool = await initFilePool(cfg.filepool_path, 10)

  const item_pool = createItemPool([])

  await createFile(filepool, 'hejhiojaipsfa')
  expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(1)
  await filepool.cleanUnReferencedFiles(item_pool)
  expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(0)

  for (let i = 0; i < 10; ++i) {
    await createFile(filepool, 'hejhiojaipsfa')
  }
  expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(10)

  await filepool.cleanUnReferencedFiles(item_pool)
  expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(0)

  {
    for (let i = 0; i < 10; ++i) {
      await createFile(filepool, 'abcdefg')
    }
    expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(10)

    const referenced_items: Item[] = []
    for (let i = 0; i < 30; ++i) {
      const item = addItem(item_pool, createForm({
        original: await createFile(filepool, 'abcdefg')
      }))
      referenced_items.push(item)
    }

    expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(10)

    await filepool.cleanUnReferencedFiles(item_pool)
    expect((await filepool.collectUnReferencedFiles(item_pool)).length).toBe(0)
    for (const item of referenced_items) {
      expect(
        await pathExists(filepool.getFilePath(item.original as FileID))
      ).toBe(true)
    }
  }
})

test('getFilePath', async () => {
  const filepool = await initFilePool(cfg.filepool_path, 10)

  const increment_count = 1000
  for (let i = 0; i < increment_count; ++i) {
    expect(await filepool.requestFileNumber()).toBe(i)
  }

  {
    const filepool = await initFilePool(cfg.filepool_path, 10)
    for (let i = 0; i < increment_count; ++i) {
      expect(await filepool.requestFileNumber()).toBe(increment_count + i)
    }
  }
})

test('atomic requestFileNumber', async () => {
  const filepool = await initFilePool(cfg.filepool_path, 100)
  const list: number[] = []
  const operating: Promise<number>[] = []

  const increment_count = 1000

  for (let i = 0; i < increment_count; ++i) {
    const op = filepool.requestFileNumber()
    operating.push(op)
    op.then(num => {
      list.push(num)
    })
  }

  await Promise.all(operating)
  await timeout(100)

  expect(list.length).toBe(increment_count)

  for (let i = 0; i < list.length; ++i) {
    expect(list[i]).toBe(i)
  }
})
