import { myConfirm } from '../utils/cli'
import { LATEST_VERSION, VERSIONS, getStorageVersion } from '../repo/storage/init'
import { Config } from '../config'
import { createConfig } from '../my-config'

import { updater as v2Updater } from '../repo/storage/init/v2'
import { saveJSON } from '../utils/json'
import { fullPartPath } from '../repo/storage/init/io'

updateStorageCommand(createConfig())

const backup_descriptions: Record<VERSIONS, string[]> = {
  1: [
    '请复制存储库中"version.json"、"items.json"、"tags.json"文件到其他位置',
    '"files文件夹" 可以不动，本次更新不会处理这个文件夹',
    '如果你在本次更新中失败，想重试的话，请删除存储库中的',
    '"item-pool文件夹"、"tag-pool文件夹"，然后将先前备份的文件重新复制覆盖上去',
    '当然，如果你硬盘容量多、时间又多的话，可以整个存储库都复制出来，随便玩弄！'
  ],
  2: []
}

async function updateStorageCommand(
  config: Config
) {
  console.log(' ------------------------------------------------------------------------------')
  console.log('    🆕\tMyRepository 存储库更新程序')

  const current_version = await getStorageVersion(config.storage_path)

  console.log('    📁\t存储库位置：', config.storage_path)
  console.log(`    📖\t目前的存储库是v${current_version}版本，本程序将更新存储库至v${LATEST_VERSION}`)

  if (current_version === LATEST_VERSION ) {
    console.log(' ------------------------------------------------------------------------------')
    console.log(`    ⭕\t你的存储库已经是v${LATEST_VERSION}了，无需更新`)
    process.exit(0)
  } else if (current_version > LATEST_VERSION) {
    console.log(' ------------------------------------------------------------------------------')
    console.log('    🚫\t无法更新，这是程序所不支持的存储库版本，请更新 MyRepository')
    process.exit(0)
  }

  if ((LATEST_VERSION - 1) !== current_version) {
    console.log(`    🔁\t你需要多次运行本程序才能更新到v${LATEST_VERSION}版本，请严格按照程序说明进行`)
  } else {
    console.log(`    🚧\t接下来将使存储库更新到v${LATEST_VERSION}版本`)
  }
  console.log('    ⚠️\t在这之前，强烈建议你备份存储库，💸数据无价')

  console.log(' ------------------------------------------------------------------------------')
  console.log(`💡 更新v${current_version}到v${current_version + 1}，你需要做以下备份操作：`)
  console.log(
    backup_descriptions[current_version]
      .map(line => `   | ${line}`)
      .join('\n')
  )
  console.log(' ------------------------------------------------------------------------------')

  myConfirm('❓ 你确定要执行更新操作吗？', {
    no() {},
    async yes() {
      try {
        switch (current_version) {
          case 1:
            await v2Updater(config.storage_path)
            await saveJSON<VERSIONS>(fullPartPath(config.storage_path, 'version'), 2)
            console.log('✅ 可喜可贺，已成功更新最新版本v2的存储库')
            process.exit(0)
            break

          default:
            console.error(`❌ 暂不支持v${current_version}的更新`)
        }
      } catch (err: any) {
        console.log(' ------------------------------------------------------------------------------')
        console.error('❌ Oh No! 本次更新失败！')
        console.error(`📔 错误原因：${err.message}`)
        console.error(`🥞 堆栈：${err.stack}`)
      }
    },
  })
}
