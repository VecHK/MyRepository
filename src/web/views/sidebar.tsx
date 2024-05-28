import { Tag, TagID, tagID } from 'server/core/Tag'
import { Item, ItemID } from '../../server/core/Item'
import { KeyboardEventHandler, useCallback, useEffect, useState } from 'react'
import { requestAction } from 'web/api/action'
import Select from 'react-select'
import { Serial } from 'new-vait'

export default function SideBarView(props: {
  selected_items: Item[]

  // items: Item[]
  onItemsUpdate(items: Item[]): void
  onClickDelete(): void
  onClickAllSelect(): void
  onSubmitTags(): void
  onDeleteTags(): void
  onUpdateTag(): void
}) {
  return (
    <aside className="sidebar-view" style={{ display: 'flex', width: '300px', height: '100vh' }}>
      <div className='sidebar-float' style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          width: '300px',
          background: 'white',
        }}>
          <MultiSelectSideBar
            selected_items={props.selected_items}
            onClickAllSelect={props.onClickAllSelect}
            onDelete={props.onClickDelete}
            onItemsUpdate={props.onItemsUpdate}
          />
      </div>
    </aside>
  )
}

const searching = Serial()

export type TagOption = Readonly< {
  value: TagID
  label: string
  color: string
  isCommon?: boolean
  isFixed?: boolean
  isDisabled?: boolean
}>

function tagIsCommon(tag_id: TagID, items: Item[]): boolean {
  return items.every(item => {
    return item.tags.includes(tag_id)
  })
}

function MultiSelectSideBar({ /*items, selected_id_list*/selected_items, onItemsUpdate, onDelete, onClickAllSelect }: {
  selected_items: Item[], onItemsUpdate(items: Item[]): void, onDelete: () => void, onClickAllSelect(): void
}) {
  const [selected_options, setSelectedOptions] = useState<TagOption[]>([])
  const [options, setOptions] = useState<TagOption[]>([])
  const [input_value, setInputValue] = useState('')
  const [sugest_options, setSugestOptions] = useState<TagOption[]>([])

  const refreshTag = useCallback(function refreshTag() {
    const will_request_tag_id = new Set<number>()
    // const selected_items = selected_id_list.map(item_id => {
    //   return items[
    //     items.map(item => item.id).indexOf(item_id)
    //   ]
    // })

    selected_items.forEach(item => {
      item.tags.forEach(tag_id => {
        will_request_tag_id.add(tag_id)
      })
    })

    const tag_id_list = [...will_request_tag_id]

    ;(async () => {
      const tags: Tag[] = []
      for (const tag_id of tag_id_list) {
        tags.push(
          await requestAction('getTag', { tag_id: tagID(tag_id) })
        )
      }

      const selected = tags.map(tag => {
        return {
          value: tag.id,
          label: tag.name,
          color: '#36B37E',
          isDisabled: false,
          isCommon: tagIsCommon(tag.id, selected_items),
        }
      })
      setSelectedOptions(() => selected)
      setOptions(() => selected)
      setSugestOptions(() => [])
      setInputValue('')
    })()
  }, [selected_items])

  useEffect(() => {
    refreshTag()
  }, [refreshTag])

  const handleKeyDown: KeyboardEventHandler = (event) => {
    if (input_value.length === 0) return
    else if (sugest_options.length) {
      return
    } else {
      switch (event.key) {
        case 'Enter':
        // case 'Tab':
          setInputValue('')
          requestAction('getTagIfNoexistsWillCreateIt', input_value).then((tag) => {
            console.log('getTagIfNoexistsWillCreateIt', tag.name)
            const new_opt = {
              value: tag.id,
              label: tag.name,
              color: '#36B37E',
              isDisabled: false,
              isCommon: true,
            }
            setOptions(opts => [...opts, new_opt])
            setSelectedOptions(opts => [...opts, new_opt])
          })
          event.preventDefault()
      }
    }
  }

  return (
    <div style={{}}>
          <Select
      // defaultValue={selected_options}
      maxMenuHeight={400}
      isDisabled={selected_items.length === 0}
      value={selected_options}
      inputValue={input_value}
      onChange={(new_val, meta) => {
        console.log('onChange', meta)
        setInputValue('')
        if (meta.action === 'remove-value') {
          setOptions(opts => {
            console.log(opts.filter(opt => {
              return opt.value !== meta.removedValue.value
            }).map(opt => opt.value))
            return opts.filter(opt => {
              return opt.value !== meta.removedValue.value
            })
          })
          setSelectedOptions([
            ...new_val
          ])
        } else {
          setSelectedOptions([
            ...new_val
          ])
        }
      }}
      // onInputChange={(newValue) => setInputValue(newValue)}
      onKeyDown={handleKeyDown}
      styles={{
        container: (base) => {
          return { ...base }
        },
        dropdownIndicator: (base) => {
          return { ...base, display: 'none' }
        },
        control: (base) => {
          return { ...base, maxHeight: '500px', overflow: 'auto' }
        },
        multiValueRemove: base => {
          return { ...base, paddingLeft: '0', paddingRight: '3px' }
        },
        valueContainer: (base) => {
          return { ...base }
        },
        multiValueLabel: base => {
          return { ...base, fontSize: '10px' }
        },
        indicatorsContainer: (base) => {
          return { ...base, height: '100%' }
        },
        menuList: (base) => {
          return { ...base, }
        },
        multiValue: (base, option) => {
          const data = option.data
          // const a = option.selectOption
          // const val = option
          if (data.isCommon) {
            return base
          } else {
            return {
              ...base,
              border: `2px dotted ${data.color}`,
            }
          }
        },

      }}
      onInputChange={(new_val, action_meta) => {
        console.log(new_val, action_meta)
        if (action_meta.action === 'input-change') {
          setInputValue(new_val)
          if (new_val.length === 0) {
            setSugestOptions([])
          } else {
            searching(async () => {
              const tags = await requestAction('searchTag', new_val)
              console.log(tags)
              setSugestOptions(() => {
                return tags.map(tag => {
                  return {
                    value: tag.id,
                    label: tag.name,
                    color: '#36B37E',
                    isDisabled: false,
                    isCommon: true
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
      isClearable = {true}
      name="colors"
      options={[...options, ...sugest_options]}
      className="basic-multi-select"
      classNamePrefix="select"
    />
    <button onClick={() => {
      // const selected_items = selected_items.map(item_id => {
      //   return items[
      //     items.map(item => item.id).indexOf(item_id)
      //   ]
      // })

      const common_tagid_list = selected_options.filter(opt => opt.isCommon).map(opt => opt.value)
      const no_common_tagid_list = selected_options.filter(opt => !opt.isCommon).map(opt => opt.value)

      const new_items = selected_items.map(item => {
        // const new_tags = union([...item.tags, ...common_tagid_list])
        // [...item.tags]

        const private_tagid_list = no_common_tagid_list.filter(nc_tag_id => {
          return item.tags.includes(nc_tag_id)
        })

        return {
          ...item,
          tags: [...new Set([
            ...common_tagid_list,
            ...private_tagid_list
          ])]
        }
      })

      onItemsUpdate(new_items)

      // console.warn('aaaaaaa', common_tagid_list, no_common_tagid_list)
      // console.warn('new_items', new_items)
    }}>apply</button>
    <button onClick={() => {
      onDelete()
    }}>delete</button>
    <button onClick={() => {
      onClickAllSelect()
    }}>全选</button>
    selected_ids: {selected_items.map(i => i.id).join(', ')}
    </div>
  )
}
