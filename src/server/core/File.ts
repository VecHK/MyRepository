import ID, { Id } from './ID'
import path from 'path'

export type FileID = ID<string, 'FileID'>
const _fileId = Id<string, 'FileID'>()

function validFileNumber(file_number: number) {
  if (!Number.isSafeInteger(file_number)) {
    return 'file_number 需要是合法的整数'
  } else if (file_number < 0) {
    return 'file_number 不能小于0'
  } else {
    return null
  }
}

export function name2number(name: string): number {
  if (typeof name !== 'string') {
    throw Error('name2number: 输入的并不是字符串')
  } else {
    const num = Number.parseInt(name)
    const valid = validFileNumber(num)
    if (valid !== null) {
      throw Error(valid)
    } else {
      return num
    }
  }
}

function isValidFileFormat(f: string) {
  if (f.length === 0) {
    return true
  } else {
    return /^[a-zA-Z0-9]+$/.test(f)
  }
}

// FileID Struct:
// [number].[format]
// [number]
export function constructFileID(num: number, format: string = '') {
  const num_valid = validFileNumber(num)
  if (num_valid !== null) {
    throw Error(num_valid)
  } else if (!isValidFileFormat(format)) {
    throw Error(`并不接受你所提供的format: ${format}`)
  } else {
    if (format.length) {
      return _fileId(`${num}.${format}`)
    } else {
      return _fileId(`${num}`)
    }
  }
}

export function parseFileID(fid: FileID) {
  const { ext, name } = path.parse(fid)
  const file_number = name2number(name)
  const format = ext.replace('.', '')
  if (format.length) {
    return [file_number, format] as const
  } else {
    return [file_number, null] as const
  }
}
