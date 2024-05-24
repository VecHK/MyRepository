import path from 'path'
import { fileURLToPath } from 'url'
import { Config } from './config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function createConfig(): Config {
  const storage_path = path.join(__dirname, '../../storage')
  return {
    http_api_port: 44998,
    internal_fileserver_http_port: 44999,
    storage_path,
    filepool_path: path.join(storage_path, './files')
  }
}
