import path from 'path'
import http from 'http'
import serveHandler from 'serve-handler'
import readline from 'readline'

import { Config } from './config'
import { RepositoryInstance, initRepositoryInstance } from './init'
import { Wait } from 'vait'
import { fileURLToPath } from 'url'
import { createApi } from './api'
import pkg from '../../package.json' assert { type: 'json' }
import diagnosis from './diagnosis'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

serverStart(createConfig())

function createConfig(): Config {
  const storage_path = path.join(__dirname, '../../storage')
  return {
    http_api_port: 44998,
    internal_fileserver_http_port: 44999,
    storage_path,
    filepool_path: path.join(storage_path, './files')
  }
}

async function serverStart(config: Config) {
  console.log(`MyRepository ver${pkg.version}`)

  const repo = await initRepositoryInstance(config)

  diagnosis(repo, async () => {
    console.log('server api creating')
    await createServerApi(config, repo)
    console.log('server api created')
  })
}

async function createServerApi(config: Config, repo: RepositoryInstance) {
  const app = createApi(config, repo)

  const fileServer = http.createServer((req, res) => {
    serveHandler(req, res, {
      public: repo.file_pool.filepool_path,
      directoryListing: true,
    })
  })

  const [fileserver_wait, fileserver_done] = Wait()

  fileServer.listen(config.internal_fileserver_http_port, fileserver_done)

  const [wait, done] = Wait()
  const result = Object.freeze({
    repo,
    app,
    // server:
    api_server: app.listen(config.http_api_port, done),
  })

  await wait
  await fileserver_wait
}
