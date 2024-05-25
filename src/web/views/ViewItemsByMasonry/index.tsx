import { useEffect, useMemo, useState } from 'react'

import './index.scss'

import Waterfall, {
  WaterfallLayoutConfigure,
  Props as WaterfallLayoutProps,
} from 'web/components/Waterfall'

import {
  CoverClickEvent,
  Props as PhotoBoxProps,
} from 'web/components/PhotoBox'
import useSafeState from 'web/hooks/useSafeState'
import { Item, ItemID } from 'server/core/Item'

function getViewportWidth() {
  const { innerWidth } = window
  return innerWidth
}

const normalLayout = ({
  column_count,
  gallery_width,
}: Pick<
  WaterfallLayoutConfigure,
  'column_count' | 'gallery_width'
>): WaterfallLayoutConfigure => {
  const column_gutter = 54
  const vertial_gutter = column_gutter / 2
  return {
    box_type: 'normal',
    column_count,
    gallery_width,
    column_gutter,
    vertial_gutter,
  }
}

const compactLayout = ({
  column_count,
  column_gutter,
  vote_event_vertial_gutter,
  gallery_width = getViewportWidth() - column_gutter * column_count,
}: Pick<WaterfallLayoutConfigure, 'column_count' | 'column_gutter'> & {
  vote_event_vertial_gutter: number
  gallery_width?: number
}): WaterfallLayoutConfigure => {
  const is_vote_date = false
  const vertial_gutter = column_gutter

  return {
    box_type: 'compact',
    column_count: column_count,
    gallery_width,
    column_gutter: column_gutter,
    vertial_gutter,
  }
}

function computeColumnCountByBoxWidth(
  gallery_width: number,
  box_width: number,
  column_gutter: number,
  count = 0,
) {
  const column_gutter_total = (count - 1) * column_gutter
  if (gallery_width < box_width + column_gutter_total) {
    return count
  } else {
    return computeColumnCountByBoxWidth(
      gallery_width - box_width,
      box_width,
      column_gutter,
      count + 1,
    )
  }
}

function computeGalleryWidthWithAutoColumnCount(
  max_gallery_width: number,
  column_gutter: number,
  box_width: number,
) {
  const column_count = computeColumnCountByBoxWidth(
    max_gallery_width,
    box_width,
    column_gutter,
  )
  return {
    gallery_width:
      box_width * column_count + (column_count - 1) * column_gutter,
    column_count,
  } as const
}

const getLayoutConfigure = (): WaterfallLayoutConfigure => {
  const viewport_width = getViewportWidth()
  return compactLayout({
    column_count: 4,
    column_gutter: 8,
    vote_event_vertial_gutter: 27,
    gallery_width: viewport_width - 300,
  })
}

export type Props = {
  cannot_select_vote?: boolean
  show_vote_button: boolean
  list: Item[]
  selected_id_list: WaterfallLayoutProps['selected_id_list']
  onClickVote?: (item_id: ItemID) => void
  onClickCover: (clickInfo: CoverClickEvent, item_id: Item['id']) => void
}
export default function Masonry({
  cannot_select_vote = false,
  show_vote_button,
  list,
  selected_id_list,
  onClickVote,
  onClickCover,
}: Props) {
  const layout = useWaterfallLayout(list)

  const waterfall_layout_node = useMemo(
    () => (
      <Waterfall
        layout_configure={layout}
        cannot_select_vote={cannot_select_vote}
        items={list}
        selected_id_list={selected_id_list}
        show_vote_button={show_vote_button}
        onClickCover={onClickCover}
        onClickVote={(photoId) => {
          onClickVote && onClickVote(photoId)
        }}
      />
    ),
    [cannot_select_vote, layout, list, onClickCover, onClickVote, selected_id_list, show_vote_button],
  )

  return (
    <div className="gallery">
      {/* { title_node } */}
      {waterfall_layout_node}
    </div>
  )
}

function useWaterfallLayout(gallery: Item[]) {
  const [layout, refreshLayout] = useSafeState(getLayoutConfigure())

  useEffect(() => {
    let latest_width: number | undefined
    updateState()

    function updateState() {
      const viewport_width = getViewportWidth()
      if (latest_width !== viewport_width) {
        latest_width = viewport_width
        refreshLayout(getLayoutConfigure())
      }
    }
    window.addEventListener('resize', updateState)
    return () => window.removeEventListener('resize', updateState)
  }, [gallery, refreshLayout])

  return layout
}
