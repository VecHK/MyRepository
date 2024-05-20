import Storage, { PartFields } from './v1-type'
import { IOloadPart, IOsavePart } from './io'

export function LoadPart(storage_path: string) {
  return <P extends PartFields>(part: P) => {
    return IOloadPart<P, Storage[P]>(storage_path, part)
  }
}

export function SavePart(storage_path: string) {
  return <P extends PartFields>(part: P, obj: any) => {
    return IOsavePart<P, Storage[P]>(storage_path, part, obj)
  }
}
