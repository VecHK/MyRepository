type ErrorInfo = { has_error: boolean; error: any }

export default function concurrentMap<T, NT>(
  __CONCURRENT_LIMIT: number,
  list: T[],
  asyncIterator: (item: T, idx: number, total: T[]) => Promise<NT>,
): Promise<NT[]> {
  if (list.length === 0) {
    return Promise.resolve([])
  }
  let current_concurrent = 0
  let __idx = 0
  let successes = 0
  let error_info: ErrorInfo = { has_error: false, error: undefined }
  const new_list: NT[] = []
  let done
  const waiting = new Promise(res => { done = res })

  iterate()
  function iterate() {
    for (; current_concurrent < __CONCURRENT_LIMIT; ++current_concurrent) {
      if (error_info.has_error === false) {
        if (__idx < list.length) {
          (async (current_idx: number) => {
            try {
              new_list[current_idx] = await asyncIterator(
                list[current_idx], current_idx, list
              )
              if (error_info.has_error === false) {
                successes += 1
                current_concurrent -= 1
                if (successes === list.length) {
                  done()
                } else {
                  iterate()
                }
              }
            } catch (error) {
              if (!error_info.has_error) {
                error_info = { has_error: true, error }
                done()
              }
            }
          })(__idx)
          __idx += 1
        }
      }
    }
  }
  return waiting.then(() => {
    if (error_info.has_error) {
      throw error_info.error
    } else {
      return new_list
    }
  })
}
