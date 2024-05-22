import { sort, toLower } from 'ramda'
import ID, { Id, maxId } from './ID'
import { CreateTagForm, Tag, TagAttributes, TagID, constructTag, tagID } from './Tag'

type LowercaseTagName = ID<string, 'LowercaseTagName'>

type TagNames = Map<LowercaseTagName, Tag['id']>

export type TagPool = {
  latest_id: TagID
  index: Record<'name', TagID[]>
  names: TagNames
  map: Map<TagID, Tag>
}

function toLowerTagname(n: string) {
  return toLower(n) as LowercaseTagName
}

function findNameTable(names: TagNames, find_name: string) {
  return names.get(toLowerTagname(find_name))
}
function updateNameTable(names: TagNames, set_name: string, tag_id: TagID) {
  return names.set(toLowerTagname(set_name), tag_id)
}
function deleteNameTable(names: TagNames, name: string) {
  return names.delete(toLowerTagname(name))
}

function addTagToPool(
  map: TagPool['map'],
  names: TagPool['names'],
  tag: Tag
) {
  if (map.has(tag.id)) {
    throw new Error(`addTagToPool failure: duplicate tag.id(tag={ id:${tag.id}, tagname:${tag.name} })`)
  } else if (findNameTable(names, tag.name)) {
    throw new Error(`addTagToPool failure: duplicate tag.name(tag={ id:${tag.id}, tagname:${tag.name} })`)
  } else {
    map.set(tag.id, tag)
    updateNameTable(names, tag.name, tag.id)
  }
}

export function createTagPool(tags: Tag[]): TagPool {
  const names: TagPool['names'] = new Map()
  const map: TagPool['map'] = new Map()
  for (let i = 0; i < tags.length; ++i) {
    addTagToPool(map, names, tags[i])
  }

  return {
    latest_id: tagID(maxId(tags)),
    index: {
      name: sort((a, b) => {
        return a.name.localeCompare(b.name, 'zh-u-kn-true')
      }, tags).map(tag => tag.id)
    },
    names,
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
  return findNameTable(pool.names, tag_name)
}

export function newTag(pool: TagPool, { name, attributes }: CreateTagForm) {
  if (name.length === 0) {
    throw new Error('can\'t set empty tagname')
  } else if (tagnameHasDuplicate(pool, name)) {
    throw new Error(`duplicate tag name: ${name}`)
  } else {
    const new_id = (pool.latest_id + 1) as TagID
    const new_tag = constructTag(new_id, { name, attributes })
    addTagToPool(pool.map, pool.names, new_tag)
    pool.latest_id = new_id
    return new_tag
  }
}

export function deleteTag(pool: TagPool, id: TagID) {
  const found_tag = getTag(pool, id)
  pool.map.delete(found_tag.id)
  deleteNameTable(pool.names, found_tag.name)
}

function listingTag() {}

export type UpdateTagForm = Partial<CreateTagForm>

export function updateTag(
  pool: TagPool,
  id: TagID,
  update: UpdateTagForm
): Tag {
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
    if (need_update_name) {
      deleteNameTable(pool.names, source_tag.name)
      updateNameTable(pool.names, new_name, source_tag.id)
    }

    const updated_tag = {
      ...source_tag,
      ...update,
    }

    pool.map.set(source_tag.id, updated_tag)

    return updated_tag
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
  for (const tag_name of tag_pool.names.keys()) {
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
