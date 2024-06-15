import { TagPool, getTag } from '../../core/TagPool'
import { Item } from '../../core/Item'
import { ItemPool, getItem } from '../../core/ItemPool'
import { PoolOperation, diffItemPoolMapFast, diffTagPoolMap } from '../../core/Pool'
import { Tag } from '../../core/Tag'
import { PoolStorage } from './init/v2'

let has_failure: Error | null = null

const ConsolePrinter = (slient: boolean, printer: (...args: any[]) => void) => (
  (...args: any[]) => {
    if (!slient) {
      printer(...args)
    }
  }
)

export function ApplyItemStorage({
  item_pool,
  slient,
  storageQueue
}: {
  item_pool: ItemPool,
  slient: boolean,
  storageQueue: ReturnType<typeof PoolStorage>['item']['queue'],
}) {
  const log = ConsolePrinter(slient, console.log)
  const error = ConsolePrinter(slient, console.error)

  storageQueue.queuePool.signal.ERROR.receive(({
    id, payload: type, error: cause
  }) => {
    has_failure = new Error(`item storage ${type} failure(id=${id})`, { cause })
  })

  const [itemPool, tagOp, setItemPool] = PoolOperation<ItemPool, Item>(
    item_pool,
    (opfn, prev) => {
      if (has_failure) {
        console.error(has_failure)
        throw new Error('has failure')
      }

      slient || console.time('diffItemPoolMapFast')
      const diff = diffItemPoolMapFast(itemPool(), prev)
      slient || console.timeEnd('diffItemPoolMapFast')

      const adds_key = diff.adds.join('|')
      const dels_key = diff.dels.join('|')
      const changes_key = diff.changes.join('|')

      diff.adds.length && log('adds count:', diff.adds.length)
      diff.dels.length && log('dels count:', diff.dels.length)
      diff.changes.length && log('changes count:', diff.changes.length)

      if (diff.adds.length) {
        // console.time(`items(${adds_key}) added.`)
        diff.adds.map(id => getItem(itemPool(), id)).forEach(
          storageQueue.create
        )
      }

      if (diff.dels.length) {
        // console.time(`item(${dels_key}) deleted.`)
        diff.dels.forEach(
          storageQueue.delete
        )
      }

      if (diff.changes.length) {
        // console.time(`item(${changes_key}) updated.`)
        diff.changes.map(id => getItem(itemPool(), id)).forEach(
          storageQueue.update
        )
      }
    }
  )
  return [itemPool, tagOp, setItemPool] as const
}

export function ApplyTagStorage({
  tag_pool,
  slient,
  storageQueue
}: {
  tag_pool: TagPool,
  slient: boolean,
  storageQueue: ReturnType<typeof PoolStorage>['tag']['queue']
}) {
  const log = ConsolePrinter(slient, console.log)
  const error = ConsolePrinter(slient, console.error)

  storageQueue.queuePool.signal.ERROR.receive(({
    id, payload: type, error: cause
  }) => {
    has_failure = new Error(`tag storage ${type} failure(id=${id})`, { cause })
  })

  const [tagPool, tagOp, setTagPool] = PoolOperation<TagPool, Tag>(
    tag_pool,
    (opfn, prev) => {
      if (has_failure) {
        console.error(has_failure)
        throw new Error('has failure')
      }

      const diff = diffTagPoolMap(tagPool().map, prev.map)
      for (const tag_id of diff.adds.keys()) {
        const new_tag = getTag(tagPool(), tag_id)
        storageQueue.create(new_tag)
      }
      for (const tag_id of diff.dels.keys()) {
        storageQueue.delete(tag_id)
      }
      for (const tag_id of diff.changes.keys()) {
        storageQueue.update(getTag(tagPool(), tag_id))
      }
    }
  )
  return [tagPool, tagOp, setTagPool] as const
}
