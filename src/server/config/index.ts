export type Config = {
  http_api_port: number
  internal_fileserver_http_port: number
  storage_path: string
  filepool_path: string
}

export function checkConfigObject(json_obj: any): Config {
  try {
    const read = ReadObjectProperty(json_obj)
    return {
      http_api_port: read.number('http_api_port'),
      internal_fileserver_http_port: read.number('internal_fileserver_http_port'),
      storage_path: read.nonEmptyString('storage_path'),
      filepool_path: read.nonEmptyString('filepool_path'),
    }
  } catch (err: any) {
    throw new Error(`check config fail: ${err.message}`)
  }
}

function ReadObjectProperty<
  P extends string,
  V,
  O extends Record<P, V>
>(obj: O) {
  function string(prop: P): string {
    const val = obj[prop]
    if (typeof val !== 'string') {
      throw new Error(`'${prop}'并不是一个字符串`)
    } else {
      return val
    }
  }

  function nonEmptyString(prop: P): string {
    const val = string(prop)
    if (val.length === 0) {
      throw new Error(`'${prop}'并不是一个非空字符串`)
    } else {
      return val
    }
  }

  function number(prop: P): number {
    const val = obj[prop]
    if (typeof val !== 'number') {
      throw new Error(`'${prop}'并不是一个数字`)
    } else {
      return val
    }
  }

  return { string, nonEmptyString, number }
}
