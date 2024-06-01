// eslint-disable-next-line @typescript-eslint/no-var-requires
const assert = require('power-assert')
import { timeout } from 'new-vait'
import concurrentMap from '../src/server/utils/concurrent-map'
import { map } from 'ramda'

test('concurrentMap', async () => {
  const data = 'abcdefghi'.split('')

  const new_data = await concurrentMap(
    3,
    data,
    async (item, idx) => {
      expect(item).toBe(data[idx])
      await timeout(Math.floor(Math.random() * 1000))
      return idx
    }
  )

  for (let i = 0; i < new_data.length; ++ i) {
    expect(new_data[i]).toBe(i)
  }
})

test('concurrentMap(empty list)', async () => {
  const new_data = await concurrentMap(100, [], async () => {})
  expect(new_data.length).toBe(0)
})

test('concurrentMap(single item list)', async () => {
  const new_data = await concurrentMap(1, [1], async (item) => item * 2)
  expect(new_data.length).toBe(1)
  expect(new_data).toStrictEqual([2])
})

test('concurrentMap(big list length)', async () => {
  async function test(data_length: number, concurrent_count: number) {
    const data = Array.from(Array(data_length))
    const new_data = await concurrentMap(concurrent_count, data, async (item, idx) => {
      return idx
    })
    for (let i = 0; i < new_data.length; ++ i) {
      expect(new_data[i]).toBe(i)
    }
  }

  await Promise.all([
    test(5000, 5000),
    test(100, 5000),
    test(5000, 1000)
  ])
})

test('concurrentMap(error handling)', async () => {
  const data = 'abcde'.split('')
  let has_err = false
  let catch_err: any
  const preset_error = new Error('failure')
  let revoke_count = 0
  try {
    await concurrentMap(
      3,
      data,
      async (item, idx) => {
        if (idx === 2) {
          await timeout(1000)
          throw preset_error
        } else {
          revoke_count += 1
        }
      },
    )
  } catch (err) {
    catch_err = err
    has_err = true
  }

  expect(has_err).toBe(true)

  expect(revoke_count).toBe(data.length - 1)
  expect(catch_err).toBe(preset_error)

  await timeout(1000)
})

test('should process all items with a limit of 1', async () => {
  const items = [1, 2, 3, 4, 5]
  const results = await concurrentMap(1, items, async (item) => item * 2)
  expect(results).toEqual([2, 4, 6, 8, 10])
})

test('should process all items with a higher limit', async () => {
  const items = [1, 2, 3, 4, 5]
  const results = await concurrentMap(3, items, async (item) => item * 2)
  expect(results).toEqual([2, 4, 6, 8, 10])
})

test('should handle an empty list', async () => {
  const items: number[] = []
  const results = await concurrentMap(3, items, async (item) => item * 2)
  expect(results).toEqual([])
})

test('should stop processing on the first error', async () => {
  const items = [1, 2, 3, 4, 5]
  const errorMessage = 'Test error'

  const asyncIterator = jest.fn(async (item, idx) => {
    if (item === 3) {
      throw new Error(errorMessage)
    }
    await new Promise(res => setTimeout(res, idx * 10)) // Simulate delay
    return item * 2
  })

  await expect(concurrentMap(3, items, asyncIterator)).rejects.toThrow(errorMessage)

  const calls = asyncIterator.mock.calls.length
  // Check that at most 4 items were processed, considering concurrent limit and error
  expect(calls).toBeLessThanOrEqual(4)
})

test('should respect the concurrency limit', async () => {
  const items = [1, 2, 3, 4, 5]
  const startTimes: number[] = []
  const endTimes: number[] = []

  const asyncIterator = async (item: number) => {
    startTimes.push(Date.now())
    await new Promise(res => setTimeout(res, 100))
    endTimes.push(Date.now())
    return item * 2
  }

  await concurrentMap(2, items, asyncIterator)

  expect(startTimes.length).toBe(5)
  expect(endTimes.length).toBe(5)

  // Verify concurrency limit of 2
  for (let i = 0; i < endTimes.length - 2; i++) {
    expect(endTimes[i + 2] - startTimes[i]).toBeGreaterThanOrEqual(100)
  }
})
