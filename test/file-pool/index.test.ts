import fs from 'fs'
import { partial } from 'ramda'
// import { fileId } from '../app/core/File'
import { initFilePool, splitPoint } from '../../src/server/repo/file-pool'
import { constructFileID, parseFileID } from '../../src/server/core/File'

import cfg from './config'
import { timeout } from 'vait'

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

test.skip('getFilePath', async () => {
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

test.skip('atomic requestFileNumber', async () => {
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
