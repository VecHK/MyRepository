import { sort } from 'ramda'
import { maxId } from './ID'
import { CreateTagForm, Tag, TagAttributes, TagID, createTag, tagID } from './Tag'

export type TagPool = {
  latest_id: TagID
  index: Record<'name', TagID[]>
  names: Map<Tag['name'], Tag['id']>
  map: Map<TagID, Tag>
}

function addTagToPool(
  map: TagPool['map'],
  names: TagPool['names'],
  tag: Tag
) {
  map.set(tag.id, tag)
  names.set(tag.name, tag.id)
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
  return getTagByName(pool, tag_name) !== undefined
}

export function getTagByName(pool: TagPool, tag_name: string) {
  return pool.names.get(tag_name)
}

export function newTag(pool: TagPool, { name, attributes }: CreateTagForm) {
  if (tagnameHasDuplicate(pool, name)) {
    throw new Error(`duplicate tag name: ${name}`)
  } else {
    const new_id = (pool.latest_id + 1) as TagID
    const new_tag = createTag(new_id, { name, attributes })
    addTagToPool(pool.map, pool.names, new_tag)
    pool.latest_id = new_id
    return new_tag
  }
}

export function deleteTag(pool: TagPool, id: TagID) {
  const found_tag = getTag(pool, id)
  pool.map.delete(found_tag.id)
  pool.names.delete(found_tag.name)
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

  const need_update_name =
    (typeof new_name === 'string') &&
    (new_name !== source_tag.name)

  if (
    need_update_name &&
    tagnameHasDuplicate(pool, new_name)
  ) {
    throw new Error(`duplicate tag name: ${new_name}`)
  } else {
    if (need_update_name) {
      pool.names.delete(source_tag.name)
      pool.names.set(new_name, source_tag.id)
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
  const found_tags: TagID[] = []
  for (const tag_name of tag_pool.names.keys()) {
    if (found < limit) {
      console.log('tag', find_tag_name, tag_name)
      if (tag_name.indexOf(find_tag_name) !== -1) {
        found += 1
        const tag = getTagByName(tag_pool, tag_name) as unknown as TagID // 不可能是 undefined
        found_tags.push(tag)
      }
    } else {
      return found_tags
    }
  }
  console.log(tag_pool.map)
  console.log(tag_pool.names)
  console.log('found_tags', found_tags)
  return found_tags
}
