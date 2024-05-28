import { FileID } from 'server/core/File'
import { Item, ItemID, itemID } from 'server/core/Item'
import './style.scss'
import { fileId2Url, requestAction } from 'web/api/action'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type MangaViewerDetail = {
  direction: 'rtl' | 'ltr'
  item_id: ItemID
  // items: ItemID[]
}

type Props = {
  detail: MangaViewerDetail,
  onCancel: () => void
}

export default function MangaViewer(p: {
  detail: MangaViewerDetail | null,
  onCancel: () => void
 }) {
  if (p.detail === null) {
    return <></>
  } else {
    return <MangaViewerFrame {...{ ...p, detail: p.detail }} />
  }
}

type ViewerImage = {
  id: ItemID
  failure: string | null
  src: string
  width: number
  height: number
}
const failureImage = (id: ItemID, failure: string | null): ViewerImage => ({
  id, failure, src: '', width: 0, height: 0
})

function MangaViewerFrame({ onCancel, detail }: Props) {
  const [show_menu, showMenu] = useState(true)
  const [items, setItems] = useState<Item[]>([])
  const [loaded, setLoaded] = useState(false)
  const [total_number, setTotalNumber] = useState(window.innerWidth)
  const [scroll_number, setScrollNumber] = useState(0)
  const [images, setImages] = useState<ViewerImage[]>([])
  // const [offset_top_table, setOffsetTopTable] = useState<Record<ItemID, number>>({})

  const offset_table = useRef<Record<ItemID, number>>({})

  const fetchImages = useCallback(async function fetchImages(ids: ItemID[]) {
    const collected: ViewerImage[] = []
    const items = await requestAction('getItems', ids)
    let has_update = false
    for (const item of items) {
      // const item = await requestAction('getItem', { item_id })
      if (Array.isArray(item.original)) {
        alert('项目中含有多项目的item')
        onCancel()
      } else {
        if (item.original !== null) {
          const { width, height } = item.attributes
          const attribute_has_dim = Boolean(width && height)

          if (!attribute_has_dim) {
            const dim = await requestAction('imageDimession', item.original)
            if (dim.width && dim.height) {
              collected.push({
                id: item.id,
                failure: null,
                src: fileId2Url(item.original),
                width: dim.width,
                height: dim.height,
              })
              await requestAction('updateItem', {
                id: item.id,
                data: {
                  attributes: {
                    ...item.attributes,
                    orientation: (dim.orientation === undefined) ? -1 : dim.orientation,
                    width: dim.width,
                    height: dim.height,
                  }
                }
              })
              has_update = true
            } else {
              collected.push(failureImage(item.id, `图像尺寸有误(width=${dim.width})(height=${dim.height})`))
            }
          } else {
            collected.push({
              id: item.id,
              failure: null,
              src: fileId2Url(item.original),
              width: Number(width),
              height: Number(height),
            })
          }
        } else {
          collected.push(failureImage(item.id, '这个item的文件好像被删除了'))
        }
      }
    }
    if (has_update) {
      // await requestAction('save')
    }
    setImages(collected)
  }, [onCancel])

  useEffect(() => {
    requestAction('getItem', { item_id: detail.item_id }).then(item => {
      if (!Array.isArray(item.original)) {
        alert('这似乎并不是一个多项目的item')
        onCancel()
      } else {
        fetchImages(item.original).then(() => {
          setLoaded(true)
        })
      }
    })
  }, [detail.item_id, fetchImages, onCancel])

  const viewer_ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loaded) { return }

    const viewer_el = viewer_ref.current
    if (viewer_el) {
      // viewer_el.scrollLeft = scroll_number
    }
    // console.log('ref', ref)
    // console.log('eff', total_number, scroll_number, offset_table.current)
  }, [loaded, scroll_number, total_number])

  const refreshSrcTable = useCallback(() => {
    if (!loaded) { return {} }
    else {
      const tab: Record<ItemID, string> = {}
      const scroll_top = scroll_number
      const scroll_bottom_point = scroll_top + window.innerWidth

      for (const image_id_str in offset_table.current) {
        const image_last_offset = offset_table.current[image_id_str]

        const idx = images.map(i => i.id).indexOf(itemID(Number(image_id_str)))

        const image_el_width = scaleHeight(innerHeight, images[idx].width, images[idx].height)

        // 如果不设置余量，那么图片要刚能被看到的瞬间才加载，会有点卡顿感
        // 所以设置了一些余量，通常是页面宽度的两三倍，这样在边看的时候
        // 就会提前加载图片了（不要全部加载，会占用很多的内存）
        const over = innerWidth * 2

        if (image_el_width < innerWidth) {
          if (
            (image_last_offset < 0) &&
            ((image_last_offset + image_el_width) >= (0 - over))
          ) {
            tab[image_id_str] = images[idx].src
          } else if (
            (image_last_offset >= 0) &&
            (image_last_offset < (innerWidth + over))
          ) {
            tab[image_id_str] = images[idx].src
          }
        } else {
          if (
            (image_last_offset < 0) &&
            ((image_last_offset + innerWidth) <= (image_el_width + over))
          ) {
            tab[image_id_str] = images[idx].src
          }
          else if (
            (image_last_offset >= 0) &&
            (image_last_offset < (innerWidth + over))
          ) {
            tab[image_id_str] = images[idx].src
          }
        }
      }
      return tab
    }
  }, [images, loaded, scroll_number])

  const [src_table, setSrcTable] = useState<Record<ItemID, string>>({})

  useEffect(() => {
    if (loaded) {
      setSrcTable(refreshSrcTable())
    }
  }, [loaded, refreshSrcTable])

  return (
    <div
      className="manga-viewer"
      ref={viewer_ref}
      onClick={() => {

      }}
      onScroll={ev => {
        // console.log(ev.currentTarget.scrollWidth)
        setTotalNumber(ev.currentTarget.scrollWidth)
        setScrollNumber(ev.currentTarget.scrollLeft)
      }}
    >
      {images.map(image => {
        return (
          <img
            key={image.id}
            ref={el => {
              if (el) {
                // 从 offsetLeft 取值好像不太对劲，用
                // getBoundingClientRect好了，里面的x还算符合语意
                offset_table.current[image.id] =
                  el.getBoundingClientRect().x

                // el.setAttribute('x', `${el.getBoundingClientRect().x}`)
                // el.setAttribute('xi', `${Math.abs(el.getBoundingClientRect().x) + innerWidth}`)
              } else {
                delete offset_table.current[image.id]
              }
            }}
            className="manga-page"
            src={src_table[image.id] || ''}
            style={{
              display: 'block',
              width: `${scaleHeight(window.innerHeight, image.width, image.height)}px`,
              // 其实要写成 ${window.innerHeight}px 才是正确的
              // 写成 100vh 是要对付 iPad 在 PWA 的显示问题，呵呵
              height: '100vh',
            }}
          />
        )
      })}
      <Menu show={show_menu} />
    </div>
  )
}

function scaleHeight(scale_height: number, width: number, height: number) {
  return scale_height * (width / height)
}

function Menu({ show }: { show: boolean }) {
  return (
    <div className='manga-viewer-menu'>

    </div>
  )
}
