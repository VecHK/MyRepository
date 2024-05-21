import { CreateItemForm } from '../src/server/core/Item'

export function createForm(append: Partial<CreateItemForm> = {}): CreateItemForm {
  return {
    title: '',
    tags: [],
    attributes: {},
    cover: null,
    original: null,
    cover_width: 0,
    cover_height: 0,
    parent: null,
    release_date: null,
    ...append
  }
}
