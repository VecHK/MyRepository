import fs from 'fs'
import path from 'path'
import { FileID, name2number, parseFileID } from '../core/File'
import { curry, partial, pipe } from 'ramda'
import pathExists, { initDirectory, initDirectorySync, prepareWriteDirectory } from '../utils/directory'
import { Memo, Serial } from 'vait'
import ID, { Id } from '../core/ID'
import { Signal } from 'new-vait'

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

const saving = Serial()
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

    const callSetFileNumber = async function (new_num: number) {
      setLatest(new_num)
      await saveLatestFileNumber(latest_num_path, new_num)
    }

    return async function requestFileNumber() {
      const latest_num = getLatest()
      await callSetFileNumber(latest_num + 1)
      return latest_num
    }
  }
}

async function saveToFileUsingStream() {}
async function loadFileStreamUsingStream() {}

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
