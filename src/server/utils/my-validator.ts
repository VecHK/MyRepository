// // import { ItemID } from "../../server/core/Item"

import moment from 'moment'
import { pipe } from 'ramda'

type ValidatorSchema = {
  type: 'object' | 'array'
}

export function MyValidator<T>(schema: ValidatorSchema) {

}

export const v_isObject = DefineValidator('object', (v: Record<string, unknown>) => {
  return v && !Array.isArray(v) && (typeof v === 'object')
})

export const v_isNoeEmptyString = DefineValidator<string>('null', (v) => v.length !== 0)

export const v_isNull = DefineValidator<null>('null', (v) => v === null)

export const v_isAny = DefineValidator('any', () => true)

export const v_isNumber = DefineValidator<number>('number', (v) => {
  return (typeof v === 'number') && !Number.isNaN(v)
})

export const v_isString = DefineValidator<string>('string', (v) => {
  return (typeof v === 'string')
})

export const v_isNoneZero = DefineValidator('none-zero', [
  v_isNumber,
  DefineValidator<number>('none-zero', (v) => {
    return v !== 0
  })
])

export const v_isDateString = DefineValidator('DateString', (v: string) => {
  return moment(new Date(v)).isValid()
})

type ValidateFunc<V> = (v: V) => boolean | void

export type ValidatorInstance<V> = Readonly<[string, ValidateFunc<V>]>

export function DefineValidator<V>(
  typedesc: string,
  validate_func: ValidateFunc<V> | Array<ValidatorInstance<any>>
): ValidatorInstance<V> {
  if (Array.isArray(validate_func)) {
    const [, composed_validate_func] = ComposeValidator(...validate_func)
    return [
      typedesc,
      composed_validate_func
    ]
  } else {
    return [
      typedesc,
      validate_func,
    ]
  }
}

export function runValidator<V>(
  inst: ValidatorInstance<V>,
  value: V,
): string | void {
  const [typedesc, validator] = inst
  if (true !== validator(value)) {
    return typedesc
  }
}

export function DefineArrayItemValidator<V>(
  typedesc: string,
  inst: ValidatorInstance<V>
): ValidatorInstance<V[]> {
  return DefineValidator<V[]>(typedesc, (array) => {
    if (!Array.isArray(array)) {
      return false
    } else {
      return array.every(item => {
        const result = runValidator(inst, item)
        return result === undefined
      })
    }
  })
}

export function AnyValidator<T>(
  typedesc: string,
  insts: ValidatorInstance<any>[]
) {
  return DefineValidator<T>(typedesc, value => {
    for (const inst of insts) {
      const validate_results = []
      const result = runValidator(inst, value)
      if (result === undefined) {
        return true
      }
    }
    return false
  })
}

function ComposeValidator<T>(
  ...validators: Array<ValidatorInstance<T>>
) {
  const typedesc_list = validators.map(([typedesc, validate]) => {
    return typedesc
  })

  return DefineValidator<any>(typedesc_list.join('、'), (val) => {
    return validators.every(([, validate]) => {
      return validate(val)
    })
  })
}

export function loadProperty<
  P extends string | number,
  V,
  O extends Record<P, V>
>(
  object: O,
  prop: P,
  validator: ValidatorInstance<V>
): V {
  const value: V = object[prop]

  if (!Reflect.has(object, prop)) {
    throw new Error(`属性[${String(prop)}]不存在`)
  } else {
    const result = runValidator<V>(validator, value)
    if (result === undefined) {
      return value
    } else {
      throw new Error(`属性[${prop}]校验失败:${result}`)
    }
  }
}

// // const v_isNumber = DefineValidator<number>('number', v => {
// //   return typeof v === 'number'
// // })

// // const v_isNoneZero = DefineValidator<number>('非0的数字', v => {
// //   return v !== 0
// // })

// // const v_ItemID = DefineValidator<ItemID>('itemID', [v_isNumber, v_isNoneZero])

// // const b = ComposeValidator(v_isNumber, v_isNoneZero)

// // const _FAILURE_VALUE_ = Symbol()


// // ComposeValidator([numChecker, NoneZeroChecker])
