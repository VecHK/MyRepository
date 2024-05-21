import readline from 'readline'
import { RepositoryInstance } from './init'
import { deleteFiles } from './repo/file-pool'

function myConfirm(
  message: string,
  callbacks: {
    yes: () => void,
    no: () => void
  }
) {
  const inter = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  inter.question(`${message} (y/n)`, (ans) => {
    if (ans == 'y' || ans == 'yes') {
      inter.close()
      callbacks.yes()
    } else if (ans === 'n' || ans === 'no') {
      inter.close()
      callbacks.no()
    }
  })
}

export default async function diagnosis(
  repo: RepositoryInstance,
  continueCallback: () => void
) {
  process.stdout.write('\n')

  const UnReferencedFiles = await repo.file_pool.collectUnReferencedFiles(
    repo.item_pool,
    (file) => {
      console.log(`found Unreferenced File: ${file}`)
    }
  )

  console.log('---------- diagnosis info ----------')
  console.log('storage path:', repo.config.storage_path)
  console.log('filepool path:', repo.config.filepool_path)
  console.log('Items count:', repo.item_pool.map.size)
  console.log('Tags count:', repo.tag_pool.map.size)
  console.log('UnReferencedFiles:', UnReferencedFiles.length)

  process.stdout.write('\n')

  if (UnReferencedFiles.length) {
    myConfirm('has Unreferenced files, clean?', {
      no: continueCallback,
      async yes() {
        console.log('')

        let count = 0
        await deleteFiles(UnReferencedFiles, () => {
          count += 1
          process.stdout.write(`${count} files is deleted`)
        })

        diagnosis(repo, continueCallback)
      },
    })
  } else {
    continueCallback()
  }
}
