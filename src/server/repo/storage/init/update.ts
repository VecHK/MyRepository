import { readJSON, saveJSON } from '../../../utils/json'
import { VERSIONS } from '.'
import { updater as v2Updater } from './v2'
import { fullPartPath } from './io'
// import { updater as v3Updater } from './v3'
// import { updater as v4Updater } from './v4'
// import { updater as v5Updater } from './v5'

// -------- 每次添加新的版本后，都得修改这块地方 --------
// -------- 隔壁 index.ts 也要更新               --------
export async function update(
  storage_path: string,
  current_version: VERSIONS
): Promise<void> {
  switch (current_version) {
    case 1:
      await v2Updater(storage_path)
      await saveJSON<VERSIONS>(fullPartPath(storage_path, 'version'), 2)
      return update(storage_path, 2)
    // case 2: return update(v3Updater(p))
    // case 3: return update(v4Updater(p))
    // case 4: return update(v5Updater(p))
  }
  // return s
}
