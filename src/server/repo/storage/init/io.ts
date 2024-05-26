import path from 'path'
import { readJSON, saveJSON } from '../../../utils/json'

export type StorageErrorType = 'NOT_FOUND'

export class StorageError extends Error {
  constructor(public errorType: StorageErrorType, msg: string) {
    super(msg)
  }
}

export function fullPartPath<P extends string>(storage_path: string, part: P): string {
  return path.join(storage_path, `${part}.json`)
}

export function IOloadPart<P extends string, JSONDataType>(storage_path: string, part: P) {
  return readJSON<JSONDataType>(
    fullPartPath<P>(storage_path, part)
  )
}

export function IOsavePart<P extends string, JSONDataType>(
  storage_path: string,
  part: P,
  json_object: JSONDataType
) {
  return saveJSON<JSONDataType>(
    fullPartPath<P>(storage_path, part),
    json_object
  )
}
