import { FileID } from './File'
import { Tag, TagID } from './Tag'

import ID, { Id } from './ID'
import { AnyValidator, DefineArrayItemValidator, DefineValidator, ValidatorInstance, loadProperty, runValidator, v_isDateString, v_isNoeEmptyString, v_isNoneZero, v_isNull, v_isNumber, v_isObject, v_isString } from '../utils/my-validator'
// import { MyValidator } from 'server/utils/my-validator'
export type ItemID = ID<number, 'ItemID'>
export const itemID = Id<number, 'ItemID'>()

type AttributeField = string
type AttributeValueType = string | number
type ItemAttributes = Record<AttributeField, AttributeValueType>

export type ItemDateFields<V> = {
  release_date: null | V
  create_date: V
  update_date: V
}

type Original = (null | FileID) | Array<ItemID>

export type Item = ItemDateFields<Date> & {
  id: ItemID
  tags: Array<TagID>
  attributes: ItemAttributes
  title: string
  cover: null | FileID
  cover_width: number
  cover_height: number
  original: Original
  parent: null | ItemID
}

type JSONDateString = string
export type Item_raw =
  Omit<Item, keyof ItemDateFields<Date>> & ItemDateFields<JSONDateString>

export function parseRawItems(raw_items: Item_raw[]): Item[] {
  return raw_items.map(raw_item => {
    const create_date = new Date(raw_item.create_date)

    const release_date = (
      raw_item.release_date === null
    ) ? null : new Date(raw_item.release_date)

    return {
      ...raw_item,
      release_date,
      create_date,
      update_date: create_date,
    }
  })
}

const v_isItemID = DefineValidator<ItemID>('itemID', [
  v_isNumber,
  v_isNoneZero
])

const v_isTagID = DefineValidator<TagID>('tagID', [
  v_isNumber,
  v_isNoneZero
])
const v_isTagIds = DefineArrayItemValidator<TagID>('TagID[]', v_isTagID)

const v_isParent = AnyValidator<CreateItemForm['parent']>('ItemID/null', [
  v_isItemID,
  v_isNull
])

const v_isItemAttributes = DefineValidator<ItemAttributes>('ItemAttributes', [
  v_isObject
])

const v_isFileID = DefineValidator<FileID>('ItemAttributes', [
  v_isString,
  v_isNoeEmptyString,
])

const v_IsNullAbleFileID = AnyValidator<null | FileID>('FileID/null', [
  v_isFileID,
  v_isNull
])

const v_isOriginal = AnyValidator<CreateItemForm['original']>('FileID/null/ItemID[]', [
  v_IsNullAbleFileID,
  DefineArrayItemValidator<ItemID>('ItemID[]', v_isItemID)
])

const v_isNullAbleDateString = AnyValidator<string | null>('null/Date', [
  v_isNull,
  v_isDateString,
])

export type CreateItemForm =
  Omit<Item, 'id' | 'update_date' | 'create_date' | 'release_date'> & {
    release_date: string | null
  }

const unique = <T>(list: T[]) => [...new Set(list)]

export function createItem(id: ItemID, create_form: CreateItemForm): Item {
  const release_date_string = loadProperty(create_form, 'release_date', v_isNullAbleDateString)
  return {
    id,
    attributes: loadProperty(create_form, 'attributes', v_isItemAttributes),
    cover: loadProperty(create_form, 'cover', v_IsNullAbleFileID),
    cover_width: loadProperty(create_form, 'cover_width', v_isNumber),
    cover_height: loadProperty(create_form, 'cover_height', v_isNumber),
    original: loadProperty(create_form, 'original', v_isOriginal),
    parent: loadProperty(create_form, 'parent', v_isParent),
    title: loadProperty(create_form, 'title', v_isString),
    release_date: release_date_string ? new Date(release_date_string) : null,
    tags: unique(loadProperty(create_form, 'tags', v_isTagIds)),
    create_date: new Date,
    update_date: new Date,
  }
}

export type Item_TagsFilled = Omit<Item, 'tags'> & {
  tags: Array<Tag>
}
