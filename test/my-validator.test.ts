import { AnyValidator, DefineValidator, ValidatorInstance, loadProperty, runValidator, v_isAny, v_isNoneZero, v_isNull, v_isNumber, v_isString } from '../src/server/utils/my-validator'
import assert from 'assert'

function runValidatorTest(
  inst: ValidatorInstance<any>,
  success_tests: any[],
  failure_tests: any[],
) {
  for (const val of success_tests) {
    assert(
      runValidator(inst, val) === undefined
    )
  }

  for (const val of failure_tests) {
    assert(
      typeof runValidator(inst, val) === 'string'
    )
  }
}

test('内置校验器', () => {
  runValidatorTest(
    v_isNumber,
    [1, 2, -3, 2491, 214.44,2.12, Math.PI],
    [
      '1', 'asfsaf', {}, [], null,
      new Map,
      new Set,
      Symbol(),
      NaN
    ]
  )

  runValidatorTest(
    v_isString,
    ['string', '', 'hehe!', 'jioqjwiojiao-2'],
    [
      new Map,
      new Set,
      Symbol(),
      {},
      [],
      null
    ]
  )

  runValidatorTest(
    v_isNoneZero,
    [-1, 2, 3, 4],
    [
      0,
      '0',
      '1',
      '2',
      new Map,
      new Set,
      Symbol(),
      {},
      [],
      null
    ]
  )
})

test('AnyValidator', () => {
  runValidatorTest(
    AnyValidator('Original', [
      v_isNull,
      v_isString,
    ]),
    [
      null,
      'abcdefg'
    ],
    [
      new Map,
      {},
      new Set,
      Symbol(),
      [],
      () => {},
      class {}
    ]
  )
})

test('loadProperty', () => {
  const val = loadProperty({ prop: '2' }, 'prop', v_isString)
  expect(val).toBe('2')

  {
    expect(() => {
      loadProperty({ prop: 214124142 } as any, 'prop', v_isString)
    }).toThrow()
  }

  {
    expect(() => {
      loadProperty({ prop: 'string' } as any, 'prop', v_isNumber)
    }).toThrow()
  }

  {
    expect(() => {
      loadProperty({  } as any, 'nofound', v_isAny)
    }).toThrow()
  }
})
