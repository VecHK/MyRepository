import assert from 'assert'
import { parseRawItems } from '../src/server/core/Item'
import { addItem, createItemPool, deleteTagAndUpdateItems, getItem, updateItem } from '../src/server/core/ItemPool'
import { TagID, tagID } from '../src/server/core/Tag'
import { createTagPool, deleteTag, getTag, newTag, searchTag, updateTag } from '../src/server/core/TagPool'
import { createForm, generateRawItems } from './common'

test('newTag', () => {
  const items_pool = createItemPool(parseRawItems(generateRawItems()))
  const tag_pool = createTagPool([
    { id: tagID(1), name: 'name', attributes: {} }
  ])

  const new_tag = newTag(tag_pool, { name: 'new_name', attributes: {} })

  const found_tag = getTag(tag_pool, new_tag.id)
  expect(found_tag.name).toBe(new_tag.name)
  expect(found_tag.id).toBe(new_tag.id)

  {
    const new_item = addItem(items_pool, {
      ...createForm(),
      tags: [ new_tag.id ]
    })

    const found_item = getItem(items_pool, new_item.id)
    expect(found_item.tags.length).toBe(1)
    assert(found_item.tags.includes(new_tag.id))
  }

  {
    const new_item = addItem(items_pool, createForm())
    updateItem(items_pool, new_item.id, {
      tags: [ new_tag.id ]
    })

    const found_item = getItem(items_pool, new_item.id)
    expect(found_item.tags.length).toBe(1)
    assert(found_item.tags.includes(new_tag.id))
  }
})

test('newTag(prevent empty name)', () => {
  const pool = createTagPool([ { id: tagID(1), name: 'name', attributes: {} } ])
  expect(() => {
    newTag(pool, { name: '', attributes: {} })
  }).toThrow()
})

test('newTag(prevent same name)', () => {
  {
    const pool = createTagPool([ { id: tagID(1), name: 'name', attributes: {} } ])
    expect(() => {
      newTag(pool, { name: 'name', attributes: {} })
    }).toThrow()
  }

  {
    const pool = createTagPool([])
    const tag = newTag(pool, { name: 'ajsiof', attributes: {} })
    expect(() => {
      newTag(pool, { ...tag })
    }).toThrow()

    updateTag(pool, tag.id, { name: 'other name' })
    newTag(pool, { ...tag })
  }
})

test('ignore uppercase/lowercase', () => {
  const pool = createTagPool([])

  const samples = [
    'UPpERNAME',
    'UppERNAMe',
    'UPPERNAME',
    'uppErnAme',
    'uPpErnAme',
    'uppername',
  ]

  for (const name of samples) {
    const tag = newTag(pool, { name: 'UPPERNAME', attributes: {} })

    assert(tag.name === getTag(pool, tag.id).name)

    expect(searchTag(pool, name)).toStrictEqual([tag.id])

    expect(() => {
      newTag(pool, { name, attributes: {} })
    }).toThrow()

    expect(() => {
      updateTag(pool, tagID(tag.id), { name })
    }).toThrow()

    deleteTag(pool, tag.id)
  }
})

test('deleteTag', () => {
  const tag_pool = createTagPool([
    { id: tagID(1), name: 'name', attributes: {} }
  ])

  deleteTag(tag_pool, tagID(1))

  expect(tag_pool.map.size).toBe(0)

  const newtag = newTag(tag_pool, { name: 'name', attributes: {} })
  assert(newtag.id !== 1)
})

test('updateTag', async () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  const tag_pool = createTagPool([
    { id: tagID(1), name: 'name', attributes: {} }
  ])

  {
    const non_exists_id = tagID(214214)
    expect(() => {
      updateTag(tag_pool, non_exists_id, { name: 'hwioapieotjwsjiogdaj' })
    }).toThrow()
  }

  {
    const updated_tag = updateTag(tag_pool, tagID(1), { name: 'newname' })
    assert(updated_tag.name === 'newname')
    assert(updated_tag.id === 1)

    const found_tag = getTag(tag_pool, tagID(1))
    assert(found_tag.name === 'newname')
    assert(found_tag.id === 1)
  }
})

test('updateTag(prevent empty name)', () => {
  const tag_pool = createTagPool([
    { id: tagID(1), name: 'name', attributes: {} }
  ])
  expect(() => {
    updateTag(tag_pool, tagID(1), { name: '' })
  }).toThrow()
})

test('unique tag_id', async () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  const tag_pool = createTagPool([
    { id: tagID(1), name: 'name', attributes: {} }
  ])
  {
    const new_item = addItem(item_pool, createForm({
      tags: [tagID(1), tagID(1)]
    }))
    expect(new_item.tags.length).toBe(1)
    expect(new_item.tags[0]).toBe(tagID(1))
  }
  {
    const item = addItem(item_pool, createForm({
      tags: []
    }))
    expect(item.tags.length).toBe(0)

    updateItem(item_pool, item.id, {
      tags: [tagID(1), tagID(1)]
    })

    const updated_item = getItem(item_pool, item.id)
    expect(updated_item.tags.length).toBe(1)
    expect(updated_item.tags[0]).toBe(tagID(1))
  }
})
