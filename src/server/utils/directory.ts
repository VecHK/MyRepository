import fs from 'fs'
import path from 'path'

import { access, stat, mkdir } from 'node:fs/promises'

export default async function pathExists(filepath: string) {
  try {
    await access(filepath)
    return true
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return false
    } else {
      throw err
    }
  }
}

export async function checkDirectory(
  dir_path: string
): Promise<'notfound' | 'dir' | 'is_not_dir'> {
  if (await pathExists(dir_path)) {
    if ((await stat(dir_path)).isDirectory()) {
      return 'dir'
    } else {
      return 'is_not_dir'
    }
  } else {
    return 'notfound'
  }
}

export async function initDirectory(dir_path: string) {
  switch (await checkDirectory(dir_path)) {
    case 'dir':
      break
    case 'notfound':
      await mkdir(dir_path, { recursive: true })
      break
    case 'is_not_dir':
      throw Error(`路径[${dir_path}]不是一个目录`)
      break
  }
}

export function prepareWriteDirectory(write_path: string) {
  const dir = path.dirname(write_path)
  return initDirectory(dir)
}

export function initDirectorySync(dir_path: string): void {
  if (!fs.existsSync(dir_path)) {
    fs.mkdirSync(dir_path, { recursive: true })
  } else {
    const s = fs.statSync(dir_path)
    if (!s.isDirectory()) {
      throw Error(`路径[${dir_path}]不是一个目录`)
    }
  }
}
