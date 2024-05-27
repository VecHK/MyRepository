import { checkConfigObject } from '../config'

export function initConfig(obj: Record<string, unknown>) {
  return checkConfigObject(obj)
}
