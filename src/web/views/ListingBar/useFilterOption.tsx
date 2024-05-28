import { Tag, TagID } from '../../../server/core/Tag'
import { FilterGroup, FilterRule, FilterRuleLogic } from '../../../server/core/ItemPool'
import { ReactNode, useCallback, useMemo, useState } from 'react'
import { TagOption } from '../sidebar'
import { ListingOptionModal, OptionNode, optionNode } from '.'

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

export type ClientFilterRule =
  DefineClientFilterRule<'has_tag', TagOption[]> |
  DefineClientFilterRule<'title', string> |
  DefineClientFilterRule<'top_parent', null> |
  DefineClientFilterRule<'empty_release_date', null>

type ClientFilterRuleType = ClientFilterRule['type']
type ClientFilterValues = ClientFilterValue<keyof ClientFilterValueMap>
type ClientFilterValue<K extends ClientFilterRuleType> =
  Extract<ClientFilterRule, { type: K }>['init_value'] extends infer V ? V : never
type ClientFilterValueInput<K extends ClientFilterRuleType> =
  Extract<ClientFilterRule, { type: K }>['init_value']['input'] extends infer V ? V : never

type ClientFilterValueMap = {
  [K in ClientFilterRuleType]: ClientFilterValue<K>
}

export type ClientFilterValueTable = {
  [id: number]: ClientFilterValueMap[keyof ClientFilterValueMap]
}

function getValue<
  T extends ClientFilterRuleType,
  I extends ClientFilterValueInput<T>,
>(
  value_table: ClientFilterValueTable,
  rule: DefineClientFilterRule<T, I>
) {
  if (Reflect.has(value_table, rule.id)) {
    return value_table[rule.id] as DefineClientFilterValue<I>
  } else {
    return rule.init_value
  }
}

export default function useFilterOption(init: {
  init_value_table: ClientFilterValueTable,
  init_client_filter_rules: ClientFilterRule[]
}) {
  const [ value_table, setValueTable ] = useState(init.init_value_table)
  const [ client_filter_rules, setClientFilterRules ] = useState(init.init_client_filter_rules)

  const preset_filter_rules: Array<{
    text: string,
    init(): ClientFilterRule
  }> = [
    { text: '标题', init: () => ({
      id: Date.now(),
      type: 'title',
      init_value: {
        input: '',
        logic: 'and',
        invert: false,
      }
    }) },
    { text: '含有标签', init: () => ({
      id: Date.now(),
      type: 'has_tag',
      init_value: {
        input: [],
        logic: 'and',
        invert: false,
      }
    }) },
    { text: '是最上层项目', init: () => ({
      id: Date.now(),
      type: 'top_parent',
      init_value: {
        input: null,
        logic: 'and',
        invert: false,
      }
    }) },
    { text: '发布时间为空', init: () => ({
      id: Date.now(),
      type: 'empty_release_date',
      init_value: {
        input: null,
        logic: 'and',
        invert: false,
      }
    }) },
  ]

  const constructSimple = useCallback((rules: FilterRule[]) => {
    return { type: 'simple', rules } as const
  }, [])
  const constructGroup = useCallback((rules: FilterRule[]) => {
    return { type: 'group', rules } as const
  }, [])
  const client_filter_rules_middle = useMemo(() => {
    return client_filter_rules
      .map<{
        type: 'simple' | 'group',
        rules: FilterRule[]
      }>(rule => {
        // console.log('rule', rule)
        if (rule.type === 'title') {
          const val = getValue(value_table, rule)
          if (val.input.length === 0) {
            return constructSimple([])
          } else {
            return constructSimple([ {
              name: 'title',
              ...val,
              // input: val,
              // invert: false,
              // logic: 'and',
              use_regexp: false
            } ])
          }
        } else if (rule.type === 'has_tag') {
          const val = getValue(value_table, rule)
          return constructSimple(
            val.input.map(tag => {
              return { ...val, name: 'has_tag', input: tag.value }
            })
          )
        } else if (rule.type === 'top_parent') {
          const val = getValue(value_table, rule)
          if (val.invert) {
            return constructSimple([
              { ...val, name: 'is_child_item', invert: false }
            ])
          } else {
            return constructSimple([
              { ...val, name: 'has_multi_original' },
              { ...val, name: 'is_child_item', invert: true }
            ])
          }
        } else if (rule.type === 'empty_release_date') {
          const val = getValue(value_table, rule)
          return constructSimple([{ ...val, name: 'empty_release_date' }])
        } else {
          const r = rule as any
          throw new Error(`unknown rule.type: ${r.type}`)
          return constructSimple([])
        }
      })
      .flat()
    // return []
  }, [client_filter_rules, constructSimple, value_table])

  const server_filter_groups = useMemo<FilterGroup[]>(() => {
    const simepls = client_filter_rules_middle.filter(({ type }) => type === 'simple')
    const groups = client_filter_rules_middle.filter(({ type }) => type === 'group')

    return [
      {
        invert: false,
        logic: 'and',
        rules: simepls.map(({ rules }) => rules).flat()
      },
      ...groups.map<FilterGroup>(({ rules }) => {
        return {
          invert: false,
          logic: 'and',
          rules
        }
      })
    ]
  }, [client_filter_rules_middle])

  function updateValue<
    T extends ClientFilterRuleType,
    I extends ClientFilterValueInput<T>,
  >(
    rule: DefineClientFilterRule<T, I>,
    new_value: Partial<DefineClientFilterValue<I>>,
  ) {
    setValueTable({
      ...value_table,
      [rule.id]: {
        ...getValue(value_table, rule),
        ...new_value as ClientFilterValues,
      }
    })
  }

  const removeClientRule = useCallback((id: number) => {
    setClientFilterRules(rules => rules.filter(rule => {
      return rule.id !== id
    }))
  }, [])

  const filter_option_nodes: OptionNode[] = client_filter_rules.map((rule, idx) => {
    if (rule.type === 'title') {
      const { input, invert } = getValue(value_table, rule)
      return (
        optionNode(rule.id, (
          <ListingOptionModal
            children={`标题含有：${input}`}
            renderModal={(setModal) => (
              <FilterRuleModal
                invert={invert}
                onClickRemove={() => {
                  removeClientRule(rule.id)
                  setModal({ open: false })
                }}
                onInvertChange={invert => updateValue(rule, { invert })}
                node={
                  <TitleFilterInput
                    input={input}
                    onInputChange={(input) => {
                      updateValue(rule, { input })
                    }}
                  />
                }
              />
            )}
          />
        ))
      )
    } else if (rule.type === 'has_tag') {
      const { invert, input: selected_options } = getValue(value_table, rule)
      return optionNode(rule.id, (
        <ListingOptionModal
          children={`🏷️ ${invert ? '不' : '包'}含标签：${selected_options.map(tag => tag.label).join('、')}`}
          renderModal={(setModal) => (
            <FilterRuleModal
              invert={invert}
              onClickRemove={() => {
                removeClientRule(rule.id)
                setModal({ open: false })
              }}
              onInvertChange={invert => updateValue(rule, { invert })}
              node={
                <TagFilterInput
                  selected_options={selected_options}
                  // selected_tagids={tags.map(tag => tag.id)}
                  onSelectedChange={(input) => {
                    updateValue(rule, { input })
                  }}
                />
              }
            />
          )}
        />
      ))
    } else if (rule.type === 'top_parent') {
      const { invert, input: selected_options } = getValue(value_table, rule)
      return optionNode(rule.id, (
        <ListingOptionModal
          children={`${invert ? '不是' : '是'}最上层项目`}
          renderModal={(setModal) => (
            <FilterRuleModal
              invert={invert}
              onClickRemove={() => {
                removeClientRule(rule.id)
                setModal({ open: false })
              }}
              onInvertChange={invert => updateValue(rule, { invert })}
              node={
                <>筛选出“既有子项目，又没有父项目”的项目</>
              }
            />
          )}
        />
      ))
    } else if (rule.type === 'empty_release_date') {
      const { invert } = getValue(value_table, rule)
      return optionNode(rule.id, (
        <ListingOptionModal
          children={`发布时间${invert ? '不为空' : '为空'}`}
          renderModal={(setModal) => (
            <FilterRuleModal
              invert={invert}
              onClickRemove={() => {
                removeClientRule(rule.id)
                setModal({ open: false })
              }}
              onInvertChange={invert => updateValue(rule, { invert })}
              node={
                <>筛选未设置发布时间(release_date字段)的项目</>
              }
            />
          )}
        />
      ))
    } else {
      return optionNode(`unsupported-${idx}`, (
        <ListingOptionModal children={'unsuport rule.type'} renderModal={() => undefined}></ListingOptionModal>
      ))
    }
  })

  return {
    filter_option_nodes,
    add_filter_node: (
      optionNode(
        500,
        <ListingOptionModal
          renderModal={() => (
            <>
              {preset_filter_rules.map(({text, init}) => {
                return (
                  <div key={`preset-rule-${text}`} onClick={() => {
                    const new_rule = init()
                    setClientFilterRules(rules => [...rules, new_rule])
                  }}>{ text }</div>
                )
              })}
            </>
          )}
        >➕添加筛选</ListingOptionModal>
      )
    ),
    server_filter_groups,
    client_filter_rules,
    value_table,
  }
}

function FilterRuleModal({ invert, onInvertChange, onClickRemove, node }: {
  invert: boolean
  onInvertChange(v: boolean): void
  onClickRemove(): void
  node: ReactNode
}) {
  return (
    <div className="filter-rule-modal">
      <div className="filter-rule-modal-head">
        <label onClick={() => onInvertChange(!invert)}>
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

        <div onClick={onClickRemove}>🚮移除</div>
      </div>
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

function TagFilterInput({ selected_options, onSelectedChange }: {
  selected_options: TagOption[];
  onSelectedChange(selected_options: TagOption[]): void
}) {
  const [preset_tags, setPresetTags] = useState<Tag[]>([])
  const options = useMemo<TagOption[]>(() => {
    return preset_tags.map(tag => {
      return {
        value: tag.id,
        label: tag.name,
        color: '#36B37E',
        isDisabled: false,
      }
    })
  }, [preset_tags])

  console.log('selected_options', selected_options)

  return (
    <div className="tag-rule-row" style={{
      display: 'flex',
      width: '100%',
      alignItems: 'center',
      justifyContent: 'left',
    }}>
      <Select
        options={options}
        styles={{
          container: base => ({ ...base, flexGrow: 2 })
        }}
        value={selected_options}
        onChange={(new_selected) => {
          onSelectedChange([...new_selected])
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
              setPresetTags([])
            } else {
              searching(async () => {
                const tags = await requestAction('searchTag', new_val)
                console.log(tags)
                setPresetTags(tags)
              })
            }
          }
        }}
        isMulti
        name="colors"
        className="basic-multi-select"
        classNamePrefix="select"
      />
    </div>
  )
}
