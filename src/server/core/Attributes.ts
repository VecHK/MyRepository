import { DefineValidator, v_isObject } from '../utils/my-validator'

export type AttributeFieldName = string
type AttributeValueBaseType = string | number | boolean
export type AttributeValueType = AttributeValueBaseType | Array<AttributeValueBaseType>
export type Attributes = Record<AttributeFieldName, AttributeValueType>

const isAttributeBaseValue = (attr_value: AttributeValueType) => (
  (typeof attr_value === 'string') ||
  (typeof attr_value === 'number') ||
  (typeof attr_value === 'boolean')
)

const isAttributeValue = (attr_value: AttributeValueType) => (
  Array.isArray(attr_value) ?
  attr_value.every(isAttributeBaseValue) :
  isAttributeBaseValue(attr_value)
)

export const v_isAttributes = DefineValidator<Attributes>('Attributes', [
  v_isObject,
  DefineValidator<Attributes>('Attributes', (attributes) => {
    return Object.keys(attributes).every(attr_name => {
      return isAttributeValue(attributes[attr_name])
    })
  })
])
