import { Item_raw } from '../../../core/Item'
import { Tag } from '../../../core/Tag'

export type PartFields = keyof Storage
type Storage = Readonly<{
  items: Item_raw[]
  tags: Tag[]
}>
export default Storage
