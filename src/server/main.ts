import { Config } from './config'
import path from 'path'
import { initRepositoryInstance } from './init'
import { Wait } from 'vait'
import { fileURLToPath } from 'url'
import { createApi } from './api'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function createConfig(): Config {
  const storage_path = path.join(__dirname, '../../storage')
  return {
    http_api_port: 44998,
    internal_fileserver_http_port: 44999,
    storage_path,
    filepool_path: path.join(storage_path, './files')
  }
}

import http from 'http'

init(createConfig())

import serveHandler from 'serve-handler'

async function init(config: Config) {
  const repo = await initRepositoryInstance(config)
  const app = createApi(config, repo)

  const fileServer = http.createServer((req, res) => {
    serveHandler(req, res, {
      public: repo.file_pool.filepool_path,
      directoryListing: true,
    })
  })

  const [file_wait, file_done] = Wait()

  fileServer.listen(config.internal_fileserver_http_port, file_done)

  const [wait, done] = Wait()
  const result = Object.freeze({
    repo,
    app,
    // server:
    api_server: app.listen(config.http_api_port, done),
  })

  await wait
  await file_wait

  return result
}
