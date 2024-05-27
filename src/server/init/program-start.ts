import { createConfig } from '../my-config'
import pkg from '../../../package.json' assert { type: 'json' }
import { initRepositoryInstance } from './repository'

export default async function programStart() {
  console.log(`MyRepository ver${pkg.version}`)
  const config = createConfig()
  const repo = await initRepositoryInstance(config, false)
  return { repo, config }
}
