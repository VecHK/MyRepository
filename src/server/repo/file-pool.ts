import fs from 'fs'
import path from 'path'
import { FileID, name2number, parseFileID } from '../core/File'
import { curry, partial, pipe } from 'ramda'
import pathExists, { checkDirectory, initDirectory, initDirectorySync, prepareWriteDirectory } from '../utils/directory'
import { Memo, Sequence, concurrentMap } from 'vait'
import { ItemPool, collectReferencedFileIds } from '../core/ItemPool'

export const __FILE_POOL_SPLIT_INTERVAL__ = 2_000

export function splitPoint(
  interval: number,
  file_number: number
) {
  return Math.floor(file_number / interval) * interval
}

function getFileBasePath(interval: number, f_id: FileID) {
  const [f_num] = parseFileID(f_id)
  return path.join(
    `${splitPoint(interval, f_num)}`,
    f_id
  )
}

function getFilePath(
  filepool_path: string,
  interval: number,
  f_id: FileID
): string {
  return path.join(
    filepool_path,
    getFileBasePath(interval, f_id)
  )
}

const saving = Sequence()
function saveLatestFileNumber(
  latest_num_path: string,
  file_number: number
) {
  // 保存操作应该是原子性的
  return saving(() => {
    return fs.promises.writeFile(
      latest_num_path,
      `${file_number}`,
      { encoding: 'utf-8' }
    )
  })
}

const __LATEST_FILENUMBER_SAVE_PATH = 'latest.json'
const __INIT_FILE_NUMBER = 0
async function LatestFileNumber(filepool_path: string) {
  const latest_num_path = path.join(filepool_path, __LATEST_FILENUMBER_SAVE_PATH)

  const [getLatest, setLatest] = Memo(__INIT_FILE_NUMBER)

  if (false === (await pathExists(latest_num_path))) {
    await saveLatestFileNumber(latest_num_path, __INIT_FILE_NUMBER)
    return LatestFileNumber(filepool_path)
  } else {
    setLatest(
      name2number(
        await fs.promises.readFile(latest_num_path, 'utf-8')
      )
    )

    return async function requestFileNumber() {
      const latest_num = getLatest()
      const new_num = latest_num + 1
      setLatest(new_num)
      await saveLatestFileNumber(latest_num_path, new_num)
      return latest_num
    }
  }
}

async function saveToFileUsingStream() {}
async function loadFileStreamUsingStream() {}

export async function getDirectoryFileRecursive(dir: string): Promise<string[]> {
  const res = await checkDirectory(dir)
  if (res === 'dir') {
    const files = await fs.promises.readdir(dir)
    let file_list: string[] = []
    for (const file of files) {
      file_list = [
        ...file_list,
        ...await getDirectoryFileRecursive(
          path.join(dir, file)
        )
      ]
    }
    return file_list
  } else if (res === 'is_not_dir') {
    return [ dir ]
  } else {
    // 这里的 res 为 nofound
    // 很奇怪，明明都是 readdir 返回的，为什么会 nofound 呢？
    // 可能是读着读着文件被删了什么的吧
    return [  ]
  }
}

async function collectUnReferencedFiles(
  filepool_path: string,
  pool: ItemPool,
  foundCallback: (file: string, found: boolean) => void
): Promise<string[]> {
  const refs = collectReferencedFileIds(pool)
  const splits = await fs.promises.readdir(filepool_path)

  const unrefs_ = await concurrentMap(10, splits, async (split) => {
    const split_path = path.join(filepool_path, split)
    if ('dir' === (await checkDirectory(split_path))) {
      const file_path_list = await getDirectoryFileRecursive(split_path)
      return file_path_list.filter(p => {
        const file_id = path.basename(p) as FileID
        const found = !refs.includes(file_id)
        foundCallback(p, found)
        return found
      })
    } else {
      return []
    }
  })

  return unrefs_.flat()
}

export async function deleteFiles(
  unref_files: string[],
  deletedCallback: (file: string) => void
) {
  for (const file of unref_files) {
    await fs.promises.unlink(file)
    deletedCallback(file)
  }
}

export async function initFilePool(
  filepool_path: string,
  interval: number = __FILE_POOL_SPLIT_INTERVAL__
) {
  await initDirectory(filepool_path)

  const filePath = partial(getFilePath, [filepool_path, interval])
  const fileBasePath = partial(getFileBasePath, [interval])

  return {
    requestFileNumber: await LatestFileNumber(filepool_path),
    filepool_path,
    interval,
    fileBasePath,
    getFilePath: filePath,
    collectUnReferencedFiles: partial(collectUnReferencedFiles, [filepool_path]),
    async cleanUnReferencedFiles(pool: ItemPool) {
      deleteFiles(
        await collectUnReferencedFiles(filepool_path, pool, () => {}),
        () => {}
      )
    },
    async saveFile(f_id: FileID, buf: Buffer) {
      const write_path = filePath(f_id)
      await prepareWriteDirectory(write_path)
      await fs.promises.writeFile(write_path, buf)
    },
    fileExists: pipe(filePath, pathExists),
    loadFile(f_id: FileID) {
      return fs.promises.readFile(filePath(f_id))
    },
  } as const
}
