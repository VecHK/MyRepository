import { timeout } from 'new-vait'
import concurrentMap from '../src/server/utils/concurrent-map'
import { map } from 'ramda'

test('concurrentMap', async () => {
  const data = 'abcdefghi'.split('')

  const new_data = await concurrentMap(
    data,
    async (item, idx) => {
      expect(item).toBe(data[idx])
      await timeout(Math.floor(Math.random() * 1000))
      return idx
    },
    3
  )

  for (let i = 0; i < new_data.length; ++ i) {
    expect(new_data[i]).toBe(i)
  }
})

test('concurrentMap(empty list)', async () => {
  const new_data = await concurrentMap([], async () => {}, 100)
  expect(new_data.length).toBe(0)
})

test('concurrentMap(big list length)', async () => {
  async function test(data_length: number, concurrent_count: number) {
    const data = Array.from(Array(data_length))
    const new_data = await concurrentMap(data, async (item, idx) => {
      return idx
    }, concurrent_count)
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
      data,
      async (item, idx) => {
        if (idx === 2) {
          await timeout(1000)
          throw preset_error
        } else {
          revoke_count += 1
        }
      },
      3
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
