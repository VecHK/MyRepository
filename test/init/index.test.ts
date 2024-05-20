import fs from 'fs'
import path from 'path'
import assert from 'assert'
import request from 'supertest'
import { Wait } from 'vait'
import config_object from './config'
import { initConfig, initRepositoryInstance } from '../../src/server/init'
import { createApi } from '../../src/server/api'

beforeEach(() => {
  fs.rmSync(config_object.storage_path, { recursive: true, force: true })
  expect(
    fs.existsSync(config_object.storage_path)
  ).toEqual(false)
})

test('init storage(if storage_path not found)', async () => {
  await initRepositoryInstance(initConfig(config_object))
  expect(
    fs.existsSync(config_object.storage_path)
  ).toEqual(true)

  expect(
    fs.existsSync(
      path.join(config_object.storage_path, 'version.json')
    )
  ).toEqual(true)
})

test('init storage', async () => {
  const { config, storage } = await initRepositoryInstance(initConfig(config_object))
  assert(typeof config.storage_path === 'string')
  assert(typeof storage.storage_version === 'number')
})

test('init http api', async () => {
  const { config, storage } = await initRepositoryInstance(initConfig(config_object))
  const app = createApi(config, await initRepositoryInstance(config))

  await request(app.callback()).get('/')
})
