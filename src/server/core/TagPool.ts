import Immutable from 'immutable'
import { sort, toLower } from 'ramda'
import ID, { Id, maxId } from './ID'
import { CreateTagForm, Tag, TagAttributes, TagID, constructTag, tagID } from './Tag'
import { Memo } from 'new-vait'
import { PoolOperation } from './Pool'

type LowercaseTagName = ID<string, 'LowercaseTagName'>

// type TagNames = Map<LowercaseTagName, Tag['id']>
type TagNameTable = Immutable.Map<LowercaseTagName, Tag['id']>
type TagMap = Immutable.Map<TagID, Tag>

export type TagPool = {
  latest_id: TagID
  index: Record<'name', TagID[]>
  name_table: TagNameTable
  // map: Map<TagID, Tag>
  map: TagMap
}

function toLowerTagname(n: string) {
  return toLower(n) as LowercaseTagName
}

function findNameTable(names: TagNameTable, find_name: string) {
  return names.get(toLowerTagname(find_name))
}

function updateNameTable(names: TagNameTable, set_name: string, tag_id: TagID) {
  return names.set(toLowerTagname(set_name), tag_id)
}

function deleteNameTable(names: TagNameTable, name: string) {
  return names.delete(toLowerTagname(name))
}

function constructTagIndex(tag_map: TagPool['map']) {
  const tags = [...tag_map.values()]
  return {
    name: sort((a, b) => {
      return a.name.localeCompare(b.name, 'zh-u-kn-true')
    }, tags).map(tag => tag.id)
  }
}

function setTagToPool(
  pool: TagPool,
  tag: Tag
): TagPool {
  if (pool.map.has(tag.id)) {
    throw new Error(`addTagToPool failure: duplicate tag.id(tag={ id:${tag.id}, tagname:${tag.name} })`)
  } else if (findNameTable(pool.name_table, tag.name)) {
    throw new Error(`addTagToPool failure: duplicate tag.name(tag={ id:${tag.id}, tagname:${tag.name} })`)
  } else {
    const new_map = pool.map.set(tag.id, tag)
    return {
      ...pool,
      map: pool.map.set(tag.id, tag),
      index: constructTagIndex(new_map),
      name_table: updateNameTable(pool.name_table, tag.name, tag.id)
    }
  }
}

export function createTagPool(tags: Tag[]): TagPool {
  let name_table: TagNameTable = Immutable.Map()
  let map: TagPool['map'] = Immutable.Map()

  for (let i = 0; i < tags.length; ++i) {
    map = map.set(tags[i].id, tags[i])
    name_table = updateNameTable(name_table, tags[i].name, tags[i].id)
  }

  return {
    latest_id: tagID(maxId(tags)),
    index: constructTagIndex(map),
    name_table,
    map
  }
}

export function getTag(pool: TagPool, id: TagID) {
  const found_tag = pool.map.get(id)
  if (found_tag === undefined) {
    throw new Error(`tag(id=${id}) not found`)
  } else {
    return found_tag
  }
}

export function tagnameHasDuplicate(pool: TagPool, tag_name: string) {
  return getTagIdByName(pool, tag_name) !== undefined
}

export function getTagIdByName(pool: TagPool, tag_name: string) {
  return findNameTable(pool.name_table, tag_name)
}

export function newTag(
  pool: TagPool, { name, attributes }: CreateTagForm
): readonly [Tag, TagPool] {
  if (name.length === 0) {
    throw new Error('can\'t set empty tagname')
  } else if (tagnameHasDuplicate(pool, name)) {
    throw new Error(`duplicate tag name: ${name}`)
  } else {
    const new_id = (pool.latest_id + 1) as TagID
    const new_tag = constructTag(new_id, { name, attributes })
    return [ new_tag, {
      ...setTagToPool(pool, new_tag),
      latest_id: new_id
    } ]
  }
}

export function deleteTag(pool: TagPool, id: TagID): TagPool {
  const found_tag = getTag(pool, id)
  return {
    ...pool,
    map: pool.map.delete(found_tag.id),
    name_table: deleteNameTable(pool.name_table, found_tag.name)
  }
}

export type UpdateTagForm = Partial<CreateTagForm>

export function updateTag(
  pool: TagPool,
  id: TagID,
  update: UpdateTagForm
): TagPool {
  const source_tag = getTag(pool, id)
  const new_name = update.name
  const need_update_name = (typeof new_name === 'string')

  if (need_update_name && (new_name.length) === 0) {
    throw new Error('can\'t set empty tagname')
  }
  else if (
    need_update_name &&
    tagnameHasDuplicate(pool, new_name)
  ) {
    throw new Error(`duplicate tag name: ${new_name}`)
  }
  else {
    const updated_tag = {
      ...source_tag,
      ...update,
    }

    const new_map = pool.map.set(source_tag.id, updated_tag)

    return {
      ...pool,
      map: new_map,
      index: constructTagIndex(new_map),

      name_table: !need_update_name ? pool.name_table : (
        updateNameTable(
          deleteNameTable(pool.name_table, source_tag.name),
          new_name, source_tag.id
        )
      ),
    }
  }
}

export function idList2Tags(tag_pool: TagPool, id_list: TagID[]): Tag[] {
  return id_list.map(id => {
    return getTag(tag_pool, id)
  })
}

export function searchTag(tag_pool: TagPool, find_tag_name: string) {
  const limit = 30
  let found = 0
  const found_ids: TagID[] = []
  for (const tag_name of tag_pool.name_table.keys()) {
    if (found < limit) {
      if (tag_name.indexOf(toLowerTagname(find_tag_name)) !== -1) {
        found += 1
        const tag = getTagIdByName(tag_pool, tag_name) as TagID // 不可能是 undefined
        found_ids.push(tag)
      }
    } else {
      return found_ids
    }
  }
  // console.log(tag_pool.map)
  // console.log(tag_pool.names)
  // console.log('found_ids', found_ids)
  return found_ids
}
