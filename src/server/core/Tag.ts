import ID, { Id } from './ID'

export type TagID = ID<number, 'TagID'>
export const tagID = Id<number, 'TagID'>()

type AttributeField = string
type AttributeValueType = string | number
export type TagAttributes = Record<AttributeField, AttributeValueType>

export type CreateTagForm = Omit<Tag, 'id'>

export type Tag = {
  id: TagID
  name: string
  attributes: TagAttributes
}

export function createTag(
  id: number,
  form: CreateTagForm
): Tag {
  return {
    id: tagID(id),
    name: form.name,
    attributes: form.attributes,
  }
}
