import { loadProperty, v_isNoneEmptyString } from '../utils/my-validator'
import ID, { Id } from './ID'
import { Attributes, v_isAttributes } from './Attributes'

export type TagID = ID<number, 'TagID'>
export const tagID = Id<number, 'TagID'>()

export type TagForm = Omit<Tag, 'id'>

export type Tag = {
  id: TagID
  name: string
  attributes: Attributes
}

export function constructTag(
  id: number,
  create_form: TagForm
): Tag {
  return {
    id: tagID(id),
    name: loadProperty(create_form, 'name', v_isNoneEmptyString),
    attributes: loadProperty(create_form, 'attributes', v_isAttributes),
  }
}
