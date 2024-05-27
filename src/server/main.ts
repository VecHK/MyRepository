import http from 'http'
import serveHandler from 'serve-handler'
import { Wait } from 'vait'

import { Config } from './config'
import { RepositoryInstance } from './init/repository'
import programStart from './init/program-start'
import { createApi } from './api'
import diagnosis from './diagnosis'

serverStart()

async function serverStart() {
  const { repo, config } = await programStart()

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
