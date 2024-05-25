import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Item, ItemID, itemID } from '../server/core/Item'
import { FilterRule, FilterRuleLogic, ItemIndexedField } from '../server/core/ItemPool'
import { fileId2Url, requestAction } from './api/action'
import moment from 'moment'
import SideBarView from './views/sidebar'
import { TagID } from 'server/core/Tag'
import { useFilterRules } from './views/FilterManager'
import Masonry from './views/ViewItemsByMasonry'
import { remove } from 'ramda'

function ViewItemsByTable({ items, selected, onSelect }: ItemsViewProps) {
  return (
    <>
      <table className="items-view-table">
        <thead>
          <tr>
            <th scope="col">预览</th>
            <th scope="col">文件名</th>
            <th scope="col">发布时间</th>
            <th scope="col">创建时间</th>
            <th scope="col">更新时间</th>
          </tr>
        </thead>
        <tbody>
          {
            items.map(item => {
              const is_selected = selected.includes(item.id)
              return (
                <tr
                  className="item"
                  key={item.id}
                  onClick={() => {
                    const set = new Set([...selected, item.id])
                    if (is_selected) {
                      set.delete(item.id)
                      onSelect([...set])
                    } else {
                      onSelect([...set])
                    }
                  }}
                  style={{
                    background: is_selected ? 'rgba(0, 0, 0, 0.15)' : ''
                  }}
                >
                  <th>
                    <img src={item.cover ? fileId2Url(item.cover) : undefined} style={{ width: '24px' }} />
                  </th>
                  <td>{ item.title }</td>
                  <td>{ item.release_date ? moment(new Date(item.release_date)).format('YY/DD/MM hh:mm:ss') : 'N/A' }</td>
                  <td>{ moment(new Date(item.create_date)).format('YYYY/MM/DD hh:mm:ss') }</td>
                  <td>{ moment(new Date(item.update_date)).format('YYYY/MM/DD hh:mm:ss') }</td>
                </tr>
              )
            })
          }
        </tbody>
      </table>
    </>
  )
}

type ItemsViewProps = {
  items: Item[]
  selected: ItemID[]
  onSelect(ids: ItemID[]): void
  onDrag(): void
  onDragIn(): void
  onOpen(): void
  onRightClick(): void
  onViewChildrens(): void
  onViewParent(): void
}

function MainView({ items, ...remain_props }: ItemsViewProps & {
  topbar: ReactNode
}) {
  const [show_type, setShowType] = useState<'table' | 'masonry' | 'grid' | 'coverflow'>('masonry')

  const items_view_node = useMemo(() => {
    if (show_type === 'table') {
      return <ViewItemsByTable items={items} {...remain_props} />
    } else if (show_type === 'masonry') {
      return <ViewItemsByMasonry items={items} {...remain_props} />
    } else {
      return <>unsupport showtype</>
    }
  }, [items, remain_props, show_type])

  return (
    <main className="main-view">
      <section className="main-top-bar" style={{ position: 'sticky', top: 0, zIndex: 1 }}>
        { remain_props.topbar }
        {/* <FilterManager
          client_filter_rules={client_filter_rules}
        /> */}
      </section>
      <div className="items-view">{items_view_node}</div>
    </main>
  )
}

function ViewItemsByMasonry(props: ItemsViewProps) {
  return (
    <Masonry
      cannot_select_vote={false}
      show_vote_button={true}
      list={props.items}
      selected_id_list={props.selected}
      onClickCover={(info, item_id) => {
        // item.
        // props.onOpen
        console.log('onClickCover')
      }}
      onClickVote={(item_id) => {
        const idx = props.selected.indexOf(itemID(item_id))
        if (idx !== -1) {
          props.onSelect(remove(idx, 1, props.selected))
        } else {
          props.onSelect([ ...props.selected, itemID(item_id) ])
        }
        // console.log('onClickVote')
      }}
    />
  )
}

function useMyFetching<Data>(
  refreshkeys: unknown[],
  appendkeys: unknown[],
  init_data: Data,
  task: (type: 'refresh' | 'append') => Promise<Data>,
) {
  const [data, setData] = useState<Data>(init_data)
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    task('refresh')
      .then(data => {
        setData(data)
      })
      .catch(setError)
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...refreshkeys])

  useEffect(() => {
    setLoading(true)
    task('append')
      .then(data => {
        setData(data)
      })
      .catch(setError)
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...appendkeys])

  return [data, error, loading, setData] as const
}

export default function Frame() {
  // const [items, setItems] = useState<Item[]>([])
  const [selected_ids, setSelectedID] = useState<ItemID[]>([])
  // const [filter_rules, setFilterRules] = useState<FilterRule[]>([])
  const [sort_by, setSortBy] = useState<ItemIndexedField>('id')
  const [desc, setDesc] = useState(false)
  const [limit] = useState(50)

  const [filter_rules, filter_node] = useFilterRules({
    init_client_filter_rules: [{
      id: 1,
      type: 'title',
      init_value: {
        logic: 'and', input: '', invert: false
      }
    }, {
      id: 2,
      type: 'has_tag',
      init_value: {
        logic: 'and', input: [], invert: false
      }
    }],
    init_value_table: {},
  })

  useEffect(() => {
    setSelectedID([])
  }, [filter_rules, sort_by, desc, limit])

  const [after_id, setAfterID] = useState<undefined | ItemID>(undefined)

  const items_ref = useRef<Item[]>([])

  useEffect(() => {
    items_ref.current = []
  }, [])

  const error = false
  const is_loading = false
  const [items, setItems] = useState<Item[]>([])
  const refreshItems = useCallback((type: 'refresh' | 'append') => {
    return requestAction('listing', {
      after_id,
      filter_rules,
      sort_by,
      desc,
      limit,
    }).then((new_items) => {
      if (type === 'refresh') {
        items_ref.current = new_items
      } else {
        items_ref.current = [...items_ref.current, ...new_items]
      }
      setItems(items_ref.current)
    })
  }, [after_id, desc, filter_rules, limit, sort_by])

  useEffect(() => {
    refreshItems('refresh')
  }, [refreshItems])

  const selected_items = useMemo(() => {
    return items.filter(item => {
      return selected_ids.includes(item.id)
    })
  }, [items, selected_ids])

  if (is_loading) {
    return <>loading</>
  } else if (error) {
    return <>failure!</>
  }

  return (
    <div className="frame" style={{ display: 'flex' }}>
      {/* <button onClick={() => {
        if (!is_loading && !error && (items.length !== 0)) {
          const last_item = items[items.length - 1]
          console.log('set')
          setAfterID(last_item.id)
        }
      }}>next</button> */}
      <SideBarView
        selected_items={selected_items}
        onItemsUpdate={(new_items) => {
          const will_update_ids = new_items.map(i => i.id)
          ;(async () => {
            for (const item of new_items) {
              const new_tags = [...new Set(item.tags)]
              console.log('updateItem tag', item.id, new_tags)
              await requestAction('updateItem', {
                id: item.id,
                data: { tags: new_tags }
              })
            }

            const filtered_items = await requestAction('filterList', {
              ids: will_update_ids,
              filter_rules
            })
            const filtered_item_ids = filtered_items.map(i => i.id)

            setItems(items => {
              return items
                .map(item => {
                  const idx = filtered_item_ids.indexOf(item.id)
                  if (idx !== -1) {
                    return filtered_items[idx]
                  } else {
                    return item
                  }
                })
                .filter((item) => {
                  if (will_update_ids.includes(item.id)) {
                    return filtered_item_ids.includes(item.id)
                  } else {
                    return true
                  }
                })
            })
          })()
        }}
        onClickDelete={async () => {
          for (const id of selected_ids) {
            await requestAction('deleteItem', id)
          }
          setItems(items => {
            setSelectedID(() => [])
            setAfterID(undefined)
            items_ref.current = []
            return items.filter(item => !selected_ids.includes(item.id))
          })
        }}
        onClickAllSelect={() => {
          setSelectedID(() => items.map(item => item.id))
        }}
        onSubmitTags={() => console.log('onSubmitTags')}
        onDeleteTags={() => console.log('onDeleteTags')}
        onUpdateTag={() => console.log('onUpdateTag')}
      />
      <MainView
        items={items}
        selected={selected_ids}
        onSelect={setSelectedID}
        topbar={filter_node}
        onDrag={() => {}}
        onDragIn={() => {}}
        onOpen={() => {}}
        onRightClick={() => {}}
        onViewChildrens={() => {}}
        onViewParent={() => {}}
      />
    </div>
  )
}
