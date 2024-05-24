import myConfirm from '../utils/my-confirm'
import { RepositoryInstance } from '../init'
import { deleteFiles } from '../repo/file-pool'
import { programStart } from '../init'

const { repo } = await programStart()
cleanUnreferencedFilesCommand(repo)

async function cleanUnreferencedFilesCommand(
  repo: RepositoryInstance
) {
  console.log('🧹未引用文件清理程序')

  const {
    itempool_op: [ itemPool ],
    tagpool_op: [ tagPool ]
  } = repo
  let searching_count = 0
  const UnReferencedFiles = await repo.file_pool.collectUnReferencedFiles(
    itemPool(),
    (file, found) => {
      searching_count += 1
      process.stdout.write(`\r正在搜索文件(${searching_count})`)
      if (found) {
        process.stdout.write('\n')
        console.log(`发现未引用文件: ${file}`)
      }
    }
  )

  process.stdout.write('\n')

  if (UnReferencedFiles.length) {
    myConfirm(`存在未引用的文件${UnReferencedFiles.length}个，是否清理？`, {
      no() {},
      async yes() {
        process.stdout.write('\n')

        let count = 0
        await deleteFiles(UnReferencedFiles, () => {
          count += 1
          process.stdout.write(`\r${count} files is deleted`)
        })

        process.stdout.write('\n')

        console.log('✅已清理')
      },
    })
  } else {
    console.log('没有要清除的文件')
  }
}
