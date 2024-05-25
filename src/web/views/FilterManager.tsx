import { TagID } from '../../server/core/Tag'
import { FilterRule, FilterRuleLogic } from '../../server/core/ItemPool'
import { ReactNode, useMemo, useState } from 'react'
import { TagOption } from './sidebar'

type DefineClientFilterValue<Input> = {
  invert: boolean
  logic: FilterRuleLogic
  input: Input
}

type DefineClientFilterRule<Type, Input> = {
  id: number
  type: Type
  init_value: DefineClientFilterValue<Input>
}

type ClientFilterRule =
  DefineClientFilterRule<'has_tag', TagID[]> |
  DefineClientFilterRule<'title', string>

type ClientFilterRuleType = ClientFilterRule['type']
type ClientFilterValues = ClientFilterValue<keyof ClientFilterValueMap>
type ClientFilterValue<K extends ClientFilterRuleType> =
  Extract<ClientFilterRule, { type: K }>['init_value'] extends infer V ? V : never
type ClientFilterValueInput<K extends ClientFilterRuleType> =
  Extract<ClientFilterRule, { type: K }>['init_value']['input'] extends infer V ? V : never

type ClientFilterValueMap = {
  [K in ClientFilterRuleType]: ClientFilterValue<K>
}

type ClientFilterValueTable = {
  [id: number]: ClientFilterValueMap[keyof ClientFilterValueMap]
}

function getValue<
  T extends ClientFilterRuleType,
  I extends ClientFilterValueInput<T>,
>(
  value_table: ClientFilterValueTable,
  rule: DefineClientFilterRule<T, I>
) {
  // type a= V
  if (Reflect.has(value_table, rule.id)) {
    return value_table[rule.id] as DefineClientFilterValue<I>
  } else {
    return rule.init_value
  }
}

export function useFilterRules(init: {
  init_value_table: ClientFilterValueTable,
  init_client_filter_rules: ClientFilterRule[]
}) {
  const [value_table, setValueTable] = useState(init.init_value_table)
  const [client_filter_rules, setClientFilterRules] = useState(init.init_client_filter_rules)

  const server_filter_rules = useMemo<FilterRule[]>(() => {
    return client_filter_rules
      .map<FilterRule[]>(rule => {
        // console.log('rule', rule)
        if (rule.type === 'title') {
          const val = getValue(value_table, rule)
          if (val.input.length === 0) {
            return []
          } else {
            return [ {
              name: 'title',
              ...val,
              // input: val,
              // invert: false,
              // logic: 'and',
              use_regexp: false
            } ]
          }
        } else if (rule.type === 'has_tag') {
          const val = getValue(value_table, rule)
          return val.input.map(tagid => {
            return { ...val, name: 'has_tag', input: tagid }
          })
        } else {
          return []
        }
      })
      .flat()
    // return []
  }, [client_filter_rules, value_table])

  const node = useMemo(() => {
    return (
      <FilterManager
        client_filter_rules={client_filter_rules}
        value_table={value_table}
        onValueTableChange={(new_value_table) => {
          setValueTable((tab) => ({ ...tab, ...new_value_table }))
        }}
      />
    )
  }, [client_filter_rules, value_table])

  return [server_filter_rules, node] as const
}

function FilterManager({
  client_filter_rules,
  value_table,
  onValueTableChange
}: {
  client_filter_rules: ClientFilterRule[],
  value_table: ClientFilterValueTable,
  onValueTableChange(vtab: ClientFilterValueTable): void
}) {
  function backValue<
    T extends ClientFilterRuleType,
    I extends ClientFilterValueInput<T>,
  >(
    value_table: ClientFilterValueTable,
    rule: DefineClientFilterRule<T, I>
  ) {
    // type a= V
    if (Reflect.has(value_table, rule.id)) {
      return value_table[rule.id] as DefineClientFilterValue<I>
    } else {
      return rule.init_value
    }
  }

  function updateValue<
    T extends ClientFilterRuleType,
    I extends ClientFilterValueInput<T>,
  >(
    rule: DefineClientFilterRule<T, I>,
    new_value: Partial<DefineClientFilterValue<I>>,
  ) {
    onValueTableChange({
      ...value_table,
      [rule.id]: {
        ...getValue(value_table, rule),
        ...new_value as ClientFilterValues,
      }
    })
  }

  return (
    <>
      <div className="filter-manager" style={{ background: 'white', marginBottom: '16px' }}>
        <button>新增</button>
        {
          client_filter_rules.map(rule => {
            if (rule.type === 'title') {
              const { invert } = getValue(value_table, rule)
              return (
                <FilterRuleRow
                  key={rule.id}
                  invert={invert}
                  onInvertChange={invert => updateValue(rule, { invert })}
                  node={
                    <TitleFilterInput
                      input={getValue(value_table, rule)['input']}
                      onInputChange={(input) => {
                        updateValue(rule, { input })
                      }}
                    />
                  }
                />
              )
            } else if (rule.type === 'has_tag') {
              const { invert, input } = getValue(value_table, rule)
              return (
                <FilterRuleRow
                  key={rule.id}
                  invert={invert}
                  onInvertChange={invert => updateValue(rule, { invert })}
                  node={
                    <TagFilterInput
                      input={input}
                      onInputChange={(input) => {
                        updateValue(rule, { input })
                      }}
                    />
                  }
                />
              )
            } else {
              return <>unsupport rule.type</>
            }
          })
        }
      </div>
    </>
  )
}

function FilterRuleRow({ key, invert, onInvertChange, node }: {
  key: number,
  invert: boolean
  onInvertChange(v: boolean): void
  node: ReactNode
}) {
  return (
    <div key={key} className="filter-rule-row">
      <label>
        <input
          type="checkbox"
          checked={invert}
          value={invert ? 'on' : 'off'}
          onChange={() => {
            onInvertChange(!invert)
          }}
        />
        反转
      </label>
      { node }
    </div>
  )
}

function TitleFilterInput({
  input,
  onInputChange
}: { input: string; onInputChange(v: string): void }) {
  return (
    <>
      <input value={input} onChange={(ev) => {
        onInputChange(ev.currentTarget.value)
      }} />
    </>
  )
}

import Select from 'react-select'
import { requestAction } from 'web/api/action'
import { Serial } from 'new-vait'

const searching = Serial()

function TagFilterInput({ input, onInputChange }: {
  input: TagID[];
  onInputChange(input: TagID[]): void
}) {
  const [selected_options, setSelectedOptions] = useState<TagOption[]>([])
  const [options, setOptions] = useState<TagOption[]>([])
  console.log('TagRuleRow value', input)
  return <div className="tag-rule-row" style={{
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'left',
  }}>
    <span style={{ textWrap: 'nowrap' }}>🏷️</span>
    <Select
      defaultValue={selected_options}
      options={options}
      styles={{
        container: base => ({ ...base, flexGrow: 2 })
      }}
      onChange={(selected) => {
        setSelectedOptions([...selected])
        const tagids = [...selected].map(opt => {
          return opt.value
        })
        onInputChange(tagids)
      }}
      // styles={{
      //   multiValue: (base, option) => {
      //     const data = option.data
      //     // const a = option.selectOption
      //     // const val = option
      //     return {
      //       ...base,
      //       border: `2px dotted ${data.color}`,
      //     }
      //   },
      // }}
      onInputChange={(new_val, action_meta) => {
        console.log(new_val, action_meta)
        if (action_meta.action === 'input-change') {
          if (new_val.length === 0) {
            setOptions([])
          } else {
            searching(async () => {
              const tags = await requestAction('searchTag', new_val)
              console.log(tags)
              setOptions(() => {
                return tags.map(tag => {
                  return {
                    value: tag.id,
                    label: tag.name,
                    color: '#36B37E',
                    isDisabled: false,
                    // isFixed: true,
                  }
                })
                // return [{
                //   value: 'blue',
                //   label: 'Blue',
                //   color: '#0052CC',
                //   isDisabled: true
                // }, ...value]
              })
            })
          }
        }
      }}
      isMulti
      name="colors"
      className="basic-multi-select"
      classNamePrefix="select"
    />
    {/* <span style={{ textWrap: 'nowrap' }}>
      <label>
        <Checkbox
          value={value.invert ? 'on' : 'off'}
          onChange={() => {
            onChange({
              ...value,
              invert: !value.invert
            })
          }}
        ></Checkbox>
        反转
      </label>
    </span> */}
    {/* <span style={{ textWrap: 'nowrap' }}>
      逻辑
    </span> */}
  </div>
}
