// eslint-disable-next-line @typescript-eslint/no-var-requires
const assert = require('power-assert')

import { insert } from 'ramda'
import { bisection, bisectionCallback } from '../src/server/utils/bisection'

function range(start: number, end: number) {
  const list: number[] = []
  for (let i = start; i < end; ++i) {
    list.push(i)
  }
  return list
}

test('bisectionCallback', () => {
  const list = ['1', '2', '3', '4']
  const idx = bisectionCallback(list, () => 2, ch => Number(ch))
  expect(idx).toBe(1)

  {
    const list = '000000000'.split('')
    const idx = bisectionCallback(list, () => 0, ch => 0)
    expect(
      bisection(list.map(ch => Number(ch)), 0)
    ).toBe( idx )
  }
})

test('bisection', () => {
  const list = range(0, 100)
  for (let i = 0; i < list.length; ++i) {
    expect( bisection(list, list[i]) ).toBe(i)
  }

  expect( bisection(list, -999) ).toBe( -1 )

  {
    const list = [2, 4, 6, 8, 10, 12]
    for (let idx = 0; idx < list.length; ++idx) {
      const val = list[idx]
      expect( bisection(list, val) ).toBe( idx )
    }
  }

  {
    const list = [2, 4, 4, 4, 4, 4, 4, 6, 8, 10]
    expect( bisection(list, 4) ).toBe(6)
    expect( bisection(list, 422112214) ).toBe(list.length - 1)

    {
      const list = [4, 4, 4, 4, 4, 4, 4]
      expect( bisection(list, 4) ).toBe(6)
    }
    {
      const list = [1, 2, 3, 4, 4, 4, 4, 4, 4, 4]
      expect( bisection(list, 4) ).toBe(9)
    }
    {
      const list = [1, 2, 3, 4, 4, 4, 4, 4, 4, 4]
      expect( bisection(list, 2) ).toBe(1)
    }
    {
      const list = [1, 2, 3, 4, 4, 4, 4, 4, 4, 4, 5, 6, 7, 7, 7]
      expect( bisection(list, 7) ).toBe(list.length - 1)
    }
  }

  {
    expect( bisection([], 9) ).toBe(-1)

    expect( bisection([1], 9) ).toBe(0)
    expect( bisection([1], -9) ).toBe(-1)
  }
})
