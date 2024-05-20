import { readFile, writeFile } from 'node:fs/promises'

export type JSONObject =
  null | number | string | boolean |
  Array<JSONObject> |
  { [k: string]: JSONObject }

export async function readJSON<D extends unknown>(json_path: string) {
  try {
    const json_string = await readFile(json_path, { encoding: 'utf-8' })

    try {
      const js_object = JSON.parse(json_string) as JSONObject
      return js_object as D
    } catch (err) {
      throw new Error(`${json_path}解析失败`)
    }
  } catch (err) {
    throw new Error(`${json_path}读取失败`)
  }
}

export async function saveJSON<D extends any>(
  json_path: string,
  json_object: D
) {
  try {
    await writeFile(json_path, JSON.stringify(json_object))
  } catch (err) {
    throw new Error(`${json_path}写入失败`)
  }
}
