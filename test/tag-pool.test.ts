import assert from 'assert'
import { parseRawItems } from '../src/server/core/Item'
import { addItem, createItemPool, getItem, updateItem } from '../src/server/core/ItemPool'
import { tagID } from '../src/server/core/Tag'
import { createTagPool, deleteTag, getTag, newTag, searchTag, updateTag } from '../src/server/core/TagPool'
import { createForm, generateRawItems, ItemOperation, TagOperation } from './common'

test('newTag', () => {
  const [itemPool, itemOp] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )
  const [tagPool, tagOp] = TagOperation(
    createTagPool([
      { id: tagID(1), name: 'name', attributes: {} }
    ])
  )

  {
    const old_latest_id = tagPool().latest_id
    const new_tag = tagOp(newTag, { name: 'new_name', attributes: {} })
    assert(tagPool().latest_id !== old_latest_id)

    const found_tag = getTag(tagPool(), new_tag.id)
    expect(found_tag.name).toBe(new_tag.name)
    expect(found_tag.id).toBe(new_tag.id)

    {
      const new_item = itemOp(addItem, {
        ...createForm(),
        tags: [ new_tag.id ]
      })

      const found_item = getItem(itemPool(), new_item.id)
      expect(found_item.tags.length).toBe(1)
      assert(found_item.tags.includes(new_tag.id))
    }

    {
      const new_item = itemOp(addItem, createForm())
      itemOp(updateItem, new_item.id, {
        tags: [ new_tag.id ]
      })

      const found_item = getItem(itemPool(), new_item.id)
      expect(found_item.tags.length).toBe(1)
      assert(found_item.tags.includes(new_tag.id))
    }
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
    const [tagPool, op] = TagOperation(
      createTagPool([ { id: tagID(1), name: 'name', attributes: {} } ])
    )
    expect(() => {
      op(newTag, { name: 'name', attributes: {} })
    }).toThrow()
  }

  {
    const [tagPool, op] = TagOperation(createTagPool([]))
    const tag = op(newTag, { name: 'ajsiof', attributes: {} })

    expect(() => {
      op(newTag, { ...tag })
    }).toThrow()

    op(updateTag, tag.id, { name: 'othername' })

    const new_tag = op(newTag, { ...tag })
    assert(new_tag.id !== tag.id)
  }
})

test('ignore uppercase/lowercase', () => {
  const [tagPool, op] = TagOperation(createTagPool([]))

  const samples = [
    'UPpERNAME',
    'UppERNAMe',
    'UPPERNAME',
    'uppErnAme',
    'uPpErnAme',
    'uppername',
  ]

  for (const name of samples) {
    const tag = op(newTag, { name: 'UPPERNAME', attributes: {} })

    assert(tag.name === getTag(tagPool(), tag.id).name)

    expect(searchTag(tagPool(), name)).toStrictEqual([tag.id])

    expect(() => {
      op(newTag, { name, attributes: {} })
    }).toThrow()

    expect(() => {
      op(updateTag, tagID(tag.id), { name })
    }).toThrow()

    op(deleteTag, tag.id)
  }
})

test('deleteTag', () => {
  const [ getPool, op ] = TagOperation(
    createTagPool([
      { id: tagID(1), name: 'name', attributes: {} }
    ])
  )

  op(deleteTag, tagID(1))

  expect(getPool().map.size).toBe(0)

  const newtag = op(newTag, { name: 'name', attributes: {} })
  assert(newtag.id !== 1)
})

test('updateTag', async () => {
  const item_pool = createItemPool(parseRawItems(generateRawItems()))
  const [tagPool, tagOp] = TagOperation(
    createTagPool([
      { id: tagID(1), name: 'name', attributes: {} }
    ])
  )

  {
    const non_exists_id = tagID(214214)
    expect(() => {
      tagOp(updateTag, non_exists_id, { name: 'hwioapieotjwsjiogdaj' })
    }).toThrow()
  }

  {
    tagOp(updateTag, tagID(1), { name: 'newname' })
    const updated_tag = getTag(tagPool(), tagID(1))
    assert(updated_tag.name === 'newname')
    assert(updated_tag.id === 1)

    const found_tag = getTag(tagPool(), tagID(1))
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
  const [itemPool, itemOp] = ItemOperation(
    createItemPool(parseRawItems(generateRawItems()))
  )
  const [tagPool, tagOp] = TagOperation(
    createTagPool([
      { id: tagID(1), name: 'name', attributes: {} }
    ])
  )
  {
    const new_item = itemOp(addItem, createForm({
      tags: [tagID(1), tagID(1)]
    }))
    expect(new_item.tags.length).toBe(1)
    expect(new_item.tags[0]).toBe(tagID(1))
  }
  {
    const item = itemOp(addItem, createForm({
      tags: []
    }))
    expect(item.tags.length).toBe(0)

    itemOp(updateItem, item.id, {
      tags: [tagID(1), tagID(1)]
    })

    const updated_item = getItem(itemPool(), item.id)
    expect(updated_item.tags.length).toBe(1)
    expect(updated_item.tags[0]).toBe(tagID(1))
  }
})
