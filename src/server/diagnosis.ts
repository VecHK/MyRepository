import { RepositoryInstance } from './init'
import { deleteFiles } from './repo/file-pool'
import myConfirm from './utils/my-confirm'

export default async function diagnosis(
  repo: RepositoryInstance,
  continueCallback: () => void
) {
  const {
    itempool_op: [ itemPool ],
    tagpool_op: [ tagPool ]
  } = repo
  let searching_count = 0
  const UnReferencedFiles = await repo.file_pool.collectUnReferencedFiles(
    itemPool(),
    (file, found) => {
      searching_count += 1
      process.stdout.write(`\rseareaching file(${searching_count})`)
      if (found) {
        process.stdout.write('\n')
        console.log(`found Unreferenced File: ${file}`)
      }
    }
  )
  process.stdout.write('\n')

  console.log('---------- repository info ----------')
  console.log('storage path:', repo.config.storage_path)
  console.log('filepool path:', repo.config.filepool_path)
  console.log('Items count:', itemPool().map.size)
  console.log('Tags count:', tagPool().map.size)
  console.log('UnReferencedFiles:', UnReferencedFiles.length)

  process.stdout.write('\n')

  if (UnReferencedFiles.length) {
    myConfirm('has Unreferenced files, clean?', {
      no: continueCallback,
      async yes() {
        process.stdout.write('\n')

        let count = 0
        await deleteFiles(UnReferencedFiles, () => {
          count += 1
          process.stdout.write(`\r${count} files is deleted`)
        })

        process.stdout.write('\n')

        diagnosis(repo, continueCallback)
      },
    })
  } else {
    continueCallback()
  }
}
