import { Item_raw } from 'server/core/Item'
import { Tag } from 'server/core/Tag'

export type PartFields = keyof Storage
type Storage = Readonly<{
  items: Item_raw[]
  tags: Tag[]
}>
export default Storage
