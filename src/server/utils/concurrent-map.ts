import { Wait } from 'new-vait'

type ErrorInfo = { has_error: boolean; error: any }

export default async function concurrentMap<T, NT>(
  list: T[],
  fn: (item: T, idx: number) => Promise<NT>,
  __CONCURRENT_LIMIT = 10
): Promise<NT[]> {
  if (list.length === 0) {
    return []
  }

  let current_concurrent = 0
  let idx = 0
  let successes = 0
  const new_list: NT[] = []

  const [wait, done] = Wait()

  let error_info: ErrorInfo = { has_error: false, error: undefined }

  iterate()
  function iterate() {
    for (; current_concurrent < __CONCURRENT_LIMIT; ++current_concurrent) {
      if (error_info.has_error === false) {
        if (idx < list.length) {
          (async (inner_idx: number) => {
            try {
              const new_item = await fn(list[idx], inner_idx)
              if (error_info.has_error === false) {
                successes += 1
                current_concurrent -= 1
                new_list[inner_idx] = new_item
                if (successes === list.length) {
                  done()
                } else {
                  iterate()
                }
              }
            } catch (error) {
              if (!error_info.has_error) {
                error_info = {
                  has_error: true,
                  error,
                }
                done()
              }
            }
          })(idx)
          idx += 1
        }
      }
    }
  }

  await wait

  if (error_info.has_error) {
    throw error_info.error
  } else {
    return new_list
  }
}
