function sameValueRangeCallback<T>(
  getValue: (v: T) => number,
  list: T[],
  idx: number,
  same_val: number,
  direction: -1 | 1
) {
  for (;getValue(list[idx]) === same_val; idx += direction) {
    if (idx <= 0) {
      return 0
    } else if (idx >= (list.length - 1)) {
      return list.length - 1
    }
  }
  return idx - (direction)
}

export function bisectionCallback<T>(
  list: T[],
  getInputValue: () => number,
  getValue: (v: T) => number,
  start: number = 0,
  end: number = list.length - 1,
): number {
  const val = getInputValue()
  const range = (end - start)

  if (list.length === 0) {
    return -1
  } else if (list.length === 1) {
    return (val >= getValue(list[0])) ? 0 : -1
  } else if ((end - start) <= 2) {
    const s = (
      (getValue(list[start]) === val) ?
        sameValueRangeCallback(getValue, list, start, val, -1) : start
    )
    const e = (
      (getValue(list[end]) === val) ?
        sameValueRangeCallback(getValue, list, end, val, 1) : end
    )
    for (let i = e; i >= s; --i) {
      if (val >= getValue(list[i])) {
        return i
      } else if (i === 0) {
        return -1
      }
    }
    return start
  } else {
    const mid_may_be_float = range / 2
    const mid = start + Math.floor(mid_may_be_float)

    if (getValue(list[mid]) < val) {
      return bisectionCallback(list, getInputValue, getValue, mid, end)
    } else {
      const new_end = start + Math.ceil(mid_may_be_float)
      return bisectionCallback(list, getInputValue, getValue, start, new_end)
    }
  }
}

export function bisection(
  list: number[],
  val: number,
  start: number = 0,
  end: number = list.length - 1,
): number {
  return bisectionCallback(list, () => val, (v) => v, start, end)
}
