import { RepositoryInstance } from './init/repository'
import { deleteFiles } from './repo/file-pool'
import { myConfirm } from './utils/cli'

export default async function diagnosis(
  repo: RepositoryInstance,
  continueCallback: () => void
) {
  const {
    itempool_op: [ itemPool ],
    tagpool_op: [ tagPool ]
  } = repo

  process.stdout.write('\n')

  console.log('---------- repository info ----------')
  console.log('storage path:', repo.config.storage_path)
  console.log('filepool path:', repo.config.filepool_path)
  console.log('Items count:', itemPool().map.size)
  console.log('Tags count:', tagPool().map.size)

  process.stdout.write('\n')

  continueCallback()
}
