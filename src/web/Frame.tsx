import { ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Item, ItemID, Item_raw, itemID, parseRawItems } from '../server/core/Item'
import { FilterRule, FilterRuleLogic, ItemIndexedField } from '../server/core/ItemPool'
import { fileId2Url, requestAction } from './api/action'
import moment from 'moment'
import SideBarView from './views/sidebar'
import Masonry from './views/ViewItemsByMasonry'
import { remove } from 'ramda'
import { useListing } from './views/ListingBar'
import { AppContext } from './App'
import Loading from './components/Loading'

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

function MainView({ items, loading, error, ...remain_props }: ItemsViewProps & {
  topbar: ReactNode
  loading: boolean
  error: any
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
      {
        loading ? <Loading /> : (
          <div className="items-view">{items_view_node}</div>
        )
      }
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
  const { scroll_to_bottom_signal } = useContext(AppContext)

  const [selected_ids, setSelectedID] = useState<ItemID[]>([])

  const [limit] = useState(50)

  const [ { sort_by, desc, filter_rules }, listing_bar ] = useListing()

  useEffect(() => {
    setSelectedID([])
  }, [filter_rules, sort_by, desc, limit])

  const [listing_mode, setListingMode] = useState<'refresh' | 'append'>('refresh')

  const error = false
  const [is_loading, setLoading] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const loading_ref = useRef(false)
  const refreshItems = useCallback(() => {
    if (loading_ref.current) {
      return
    }

    loading_ref.current = true
    setLoading(true)
    return requestAction('listing', {
      after_id: undefined,
      filter_rules,
      sort_by,
      desc,
      limit,
    }).then((new_raw_items) => {
      setItems(() => {
        setLoading(false)
        loading_ref.current = false
        return parseRawItems(new_raw_items as any as Item_raw[])
      })
    })
  }, [desc, filter_rules, limit, sort_by])

  const [is_appending, setAppending] = useState(false)

  useEffect(() => {
    const id = Date.now()
    const handler = () => {
      // console.log('bottom append', id, loading_ref.current)
      if (loading_ref.current) {
        return
      }

      loading_ref.current = true
      setAppending(true)

      const last_item = items[items.length - 1]

      requestAction('listing', {
        after_id: last_item.id,
        filter_rules,
        sort_by,
        desc,
        limit,
      }).then((new_raw_items) => {
        setItems((prev_items) => {
          setTimeout(() => {
            loading_ref.current = false
            setAppending(false)
          }, 300)
          const items = parseRawItems(new_raw_items as any as Item_raw[])
          return [...prev_items, ...items]
        })
      })
    }
    scroll_to_bottom_signal.receive(handler)
    return () => {
      console.log('cancelReceive', id)
      scroll_to_bottom_signal.cancelReceive(handler)
    }
  }, [desc, filter_rules, items, limit, scroll_to_bottom_signal, sort_by])

  useEffect(() => {
    refreshItems()
  }, [refreshItems])

  const selected_items = useMemo(() => {
    return items.filter(item => {
      return selected_ids.includes(item.id)
    })
  }, [items, selected_ids])

  return (
    <div className="frame" style={{ display: 'flex' }}>
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
        topbar={listing_bar}
        loading={is_loading}
        error={error}
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
