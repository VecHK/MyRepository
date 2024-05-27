import React, { ReactNode, RefObject, forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import './index.scss'
import { ItemIndexedField } from 'server/core/ItemPool'
import useFilterOption, { ClientFilterRule, ClientFilterValueTable } from './useFilterOption';
import { Signal } from 'new-vait'

type ListingOptionProps = {
  ref?: RefObject<HTMLDivElement>,
  children: ReactNode;
  onClick: React.DOMAttributes<HTMLDivElement>['onClick']
}

const ListingOption = forwardRef<HTMLDivElement, ListingOptionProps>
(({ onClick, children }, ref) => {
  return (
    <div
      ref={ref}
      className="listing-option"
      onClick={onClick}
    >{ children }</div>
  )
})

type FloatModalProps = {
  open: boolean,
  x: number,
  y: number,
  children: ReactNode
  onClickOutter(): void
}
const click_another_area = Signal()
function FloatModal({ open, onClickOutter, x, y, children }: FloatModalProps) {
  useEffect(() => {
    if (open) {
      const handler = (ev: MouseEvent) => {
        console.log('click outter')
        click_another_area.trigger()
      }
      window.addEventListener('click', handler)
      return () => window.removeEventListener('click', handler)
    }
  }, [onClickOutter, open])

  useEffect(() => {
    if (open) {
      click_another_area.receive(onClickOutter)
      return () => click_another_area.cancelReceive(onClickOutter)
    }
  }, [onClickOutter, open])

  return (
    <div
      className="float-modal"
      style={{
        display: open ? 'block' : 'none',
        left: `${x}px`,
        top: `${y}px`
      }}
    >{children}</div>
  )
}

type ModalInfo = Omit<FloatModalProps, 'children' | 'onClickOutter'>
export function ListingOptionModal({
  children,
  renderModal
}: {
  children: ReactNode
  renderModal: (refreshModalInfo: (s: Partial<ModalInfo>) => void) => ReactNode
}) {
  const el_ref = useRef<HTMLDivElement>(null)
  const [modal_info, setModalInfo] = useState<ModalInfo>({
    open: false, x: 0, y: 0,
  })
  const refreshModalInfo = (new_info: Partial<ModalInfo>) => {
    setModalInfo((prev) => ({
      ...prev,
      ...new_info,
    }))
  }

  return (
    <ListingOption
      ref={el_ref}
      onClick={(ev) => {
        const el = el_ref.current
        console.log('ListingOptionModal onClick', el)
        if (el) {
          ev.stopPropagation()
          ev.preventDefault()
          if (!modal_info.open) {
            click_another_area.trigger()
            const rect = el.getBoundingClientRect()
            setModalInfo((prev) => ({
              ...prev,
              open: true,
              x: rect.x,
              y: rect.y + rect.height,
            }))
          }
        }
      }}
    >
      {children}
      <FloatModal
        {...modal_info}
        onClickOutter={() => refreshModalInfo({ open: false })}
      >
        {renderModal(refreshModalInfo)}
      </FloatModal>
    </ListingOption>
  )
}

type OptionNodeID = string | number
export type OptionNode = Readonly<[OptionNodeID, ReactNode]>

export function optionNode(id: OptionNodeID, node: ReactNode): OptionNode {
  return [ id, node ] as const
}

function ListingBar({
  option_nodes
}: {
  option_nodes: OptionNode[]
}) {
  return (
    <div className="listing-bar">
      {
        option_nodes.map(([id, option_node], idx) => (
          <React.Fragment key={idx}>{option_node}</React.Fragment>
        ))
      }
    </div>
  )
}

const __preset_sort_list: Array<{ text: string; sort: ItemIndexedField }> = [
  { text: 'id', sort: 'id' },
  { text: '发布时间', sort: 'release_date' },
  { text: '更新时间', sort: 'update_date' },
  { text: '创建时间', sort: 'create_date' },
]

function useSotyBy(init_sory_by: ItemIndexedField) {
  const [sort_by, setSortBy] = useState<ItemIndexedField>(init_sory_by)
  const current_selected = useMemo(() => {
    return __preset_sort_list.find(({ sort }) => {
      return sort_by === sort
    }) || { text: 'id', sort: 'id' }
  }, [sort_by])

  return [
    sort_by,
    setSortBy,
    optionNode(
      1,
      <ListingOptionModal
        renderModal={(setModal) => (
          <>
            {__preset_sort_list.map(({ text, sort }) => {
              return (
                <div
                  key={sort}
                  className="float-modal-select-item"
                  onClick={ev => {
                    ev.stopPropagation()
                    ev.preventDefault()
                    setSortBy(sort)
                    setModal({ open: false })
                  }}
                >{text}</div>
              )
            })}
          </>
        )}
        >按{current_selected.text}排序</ListingOptionModal>
    )
  ] as const
}

function useDesc(init_desc: boolean) {
  const [desc, setDesc] = useState(init_desc)

  return [
    desc,
    setDesc,
    optionNode(
      2,
      <ListingOption onClick={() => setDesc(!desc)}>
        { desc ? '⬇️倒序': '⬆️正序' }
      </ListingOption>,
    )
  ] as const
}

type ListingData = {
  desc: boolean,
  sort_by: ItemIndexedField,
  value_table: ClientFilterValueTable,
  client_filter_rules: ClientFilterRule[],
}

const __CURRENT_LISTING_DATA_VERSION = 2
const __LISTING_KEY = 'listing'
const __DEFAULT_LISTING_PREFERENCE: ListingData = {
  desc: true,
  sort_by: 'id',
  value_table: {},
  client_filter_rules: []
}

type ListingDataInStorage = {
  version: number,
  data: ListingData
}

function getListingPreference(): ListingData {
  const listing_raw = localStorage.getItem(__LISTING_KEY)
  if (listing_raw === null) {
    return __DEFAULT_LISTING_PREFERENCE
  } else {
    try {
      const listing_data = JSON.parse(listing_raw) as ListingDataInStorage
      if (listing_data.version !== __CURRENT_LISTING_DATA_VERSION) {
        return __DEFAULT_LISTING_PREFERENCE
      } else {
        return listing_data.data
      }
    } catch {
      return __DEFAULT_LISTING_PREFERENCE
    }
  }
}

function saveListingPreference(listing_data: ListingData) {
  const storage_data: ListingDataInStorage = {
    version: __CURRENT_LISTING_DATA_VERSION,
    data: listing_data,
  }
  localStorage.setItem(__LISTING_KEY, JSON.stringify(storage_data))
}

function useListingPreference() {
  return [
    useMemo(getListingPreference, []),
    saveListingPreference
  ] as const
}

export function useListing() {
  const [ init_listing_data, saveListingPreference ] = useListingPreference()

  const [desc, setDesc, desc_option_node] = useDesc(init_listing_data.desc)
  const [sort_by, setSortBy, sort_option_node] = useSotyBy(init_listing_data.sort_by)

  const {
    add_filter_node,
    server_filter_rules,
    filter_option_nodes,
    value_table,
    client_filter_rules,
  } = useFilterOption({
    init_value_table: init_listing_data.value_table,
    init_client_filter_rules: init_listing_data.client_filter_rules,
  })

  useEffect(() => {
    const cancel_handler = setTimeout(() => {
      saveListingPreference({
        desc,
        sort_by,
        value_table,
        client_filter_rules
      })
    }, 100)
    return () => clearTimeout(cancel_handler)
  }, [client_filter_rules, desc, saveListingPreference, sort_by, value_table])

  const listing_bar = (
    <ListingBar
      option_nodes={[
        desc_option_node,
        sort_option_node,
        ...filter_option_nodes,
        add_filter_node,
      ]}
    />
  )

  return [{ sort_by, desc, filter_rules: server_filter_rules } , listing_bar] as const
}
