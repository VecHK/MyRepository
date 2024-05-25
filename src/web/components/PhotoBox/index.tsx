import { forwardRef, useState, useEffect, useRef, CSSProperties, useCallback, FunctionComponent, useMemo } from 'react'
import heartIMG from 'web/assets/heart.png'
import heartHighlightIMG from 'web/assets/heart-highlight.png'
import './index.scss'

import { global_cache, useQueueload } from 'web/utils/queue-load'
import useMeasure from 'web/hooks/useMeasure'

export type DimensionUnknown = Dimension | null
export type Dimension = readonly [number, number]
export const postDimesions = (
  width: null | number,
  height: null | number,
  default_width: number,
  default_height: number,
): Dimension => [
  width ?? default_width,
  height ?? default_height,
] as const

type PhotoBoxImage = {
  width: number
  height: number
  thumb: string
  src: string
}

export type CoverClickEvent = {
  from: {
    height: number
    width: number
    top: number
    left: number
  },
  thumbBlobUrl: string
}

export type Props = {
  id: string | number

  type: 'normal' | 'compact'
  vertial_gutter: number
  box_width: number

  style?: Partial<CSSProperties>

  hideMember: boolean
  show_vote_button: boolean

  vote_button_status: BackBottomProps['vote_button_status']
  handleClickVote: BackBottomProps['handleClickVote']

  name: string | null
  photo: PhotoBoxImage
  avatar: PhotoBoxImage | null
  desc: string

  onClickCover(clickInfo: CoverClickEvent): void
}

const PhotoBox = forwardRef<() => Dimension, Props>((props, ref) => {
  const { type, vertial_gutter, box_width, photo, hideMember,
         avatar, desc, style, vote_button_status } = props

  const [thumb_loaded, thumb] = useQueueload(photo.thumb)
  const [avatar_loaded, avatarThumb] = useQueueload(avatar?.thumb)

  const coverFrameEl = useRef<HTMLDivElement>(null)

  const ratio = (photo.height / photo.width).toFixed(4)

  const cover_frame_height = `calc((${box_width}px) * ${ratio})`

  const show_desc = Boolean(desc.trim().length)
  const show_bottom_block = !hideMember || show_desc
  const none_bottom_block = !show_bottom_block

  const dim_ref = useRef<Dimension | null>(null)
  const el_ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (el_ref.current) {
      const el = el_ref.current
      const getDim = () => {
        const dim = el.getBoundingClientRect()
        return [dim.width, dim.height] as const
      }
      if (typeof ref === 'function') {
        dim_ref.current = getDim()
        ref(getDim)
      }
    } else {
      console.warn('NONE :(', el_ref.current)
    }
  }, [ref])

  if (el_ref.current) {
    const el = el_ref.current
    const getDim = () => {
      const dim = el.getBoundingClientRect()
      return [dim.width, dim.height] as const
    }
    const [ width, height ] = getDim()
    if (dim_ref.current === null) {
      dim_ref.current = getDim()
      if (typeof ref === 'function') { ref(getDim) }
    } else if (
      (width !== dim_ref.current[0]) ||
      (height !== dim_ref.current[1])
    ) {
      dim_ref.current = getDim()
      if (typeof ref === 'function') { ref(getDim) }
    }
  } else {
    console.warn('NONE :(', el_ref.current)
  }

  return (
    <div
      ref={el_ref}
      id={`photo-${props.id}`}
      className={`image-box-wrapper ${(type === 'compact') && 'compact'} ${none_bottom_block ? 'none-bottom-block' : 'has-bottom-block'}`}
      style={{
        '--vertical-gutter': `${vertial_gutter}px`,
        width: `calc(${box_width}px)`,
        ...(style ?? {})
      } as React.CSSProperties}
    >
      <div className="image-box">
        <div
          className="cover-area"
          ref={coverFrameEl}
          style={{ height: cover_frame_height }}
          onClick={(e) => {
            e.preventDefault()
            if (coverFrameEl.current) {
              const {
                height, width, top, left
              } = coverFrameEl.current.getBoundingClientRect()

              props.onClickCover({
                from: {
                  height, width, top, left,
                },
                thumbBlobUrl: thumb
              })
            }
          }}
        >
          <img
            className="cover"
            alt="img"
            src={thumb}
            style={{ opacity: thumb_loaded ? 100 : 0 }}
          />

          {/* <div className="highlight"></div> */}
        </div>

        <div className="bottom-area">
          {
            show_bottom_block && (
              <div className="bottom-block">
                {hideMember || (
                  <div className="member-info">
                    <div className="avatar-wrapper">
                      <div className="avatar">
                        <div className="avatar-inner" style={{ transform: avatar_loaded ? 'translateY(0px)' : 'translateY(-100%)', backgroundImage: `url(${avatarThumb})` }}></div>
                      </div>
                    </div>

                    <div className="member-name">
                      <div className="avatar-float"></div>
                      <span className="name-label">{props.name}</span>
                    </div>
                  </div>
                )}
                {show_desc && (
                  <pre className="desc-block">
                    {desc}
                  </pre>
                )}
              </div>
            )
          }

          {
            props.show_vote_button && <BackBottom vote_button_status={vote_button_status} handleClickVote={props.handleClickVote} />
          }
        </div>
      </div>
    </div>
  )
})
export default PhotoBox

type BackBottomProps = {
  handleClickVote(): void
  vote_button_status: 'selected' | 'un-selected' | 'cannot-select'
}
function BackBottom({
   handleClickVote,
   vote_button_status,
}: BackBottomProps) {
  const [cannot_select_animation_playing, setSelectAnimation] = useState(false)
  useEffect(() => {
    if (cannot_select_animation_playing) {
      const h = setTimeout(() => {
        setSelectAnimation(false)
      }, 1500)
      return () => clearTimeout(h)
    }
  }, [cannot_select_animation_playing])

  const vote_button_is_highlight = vote_button_status === 'selected'

  return useMemo(() => (
    <div className="back-bottom-wrapper">
      <div className="back-bottom">
        <div className="block-wrapper" onClick={e => {
          e.preventDefault()
          e.stopPropagation()

          handleClickVote()
        }}>
          <div
            className='block'
            onClick={() => {
              setSelectAnimation(true)
            }}
          >
            <div className="heart" style={{ backgroundImage: `url(${heartIMG})` }} />
          </div>
          <div
            className={`block ${cannot_select_animation_playing ? 'cannot-select' : 'highlight'}`}
            style={{
              opacity: (
                vote_button_is_highlight || cannot_select_animation_playing
              ) ? 1 : 0
            }}
            onClick={() => {
              if (vote_button_status === 'cannot-select') {
                setSelectAnimation(true)
              }
            }}
          >
            <div className="heart" style={{ backgroundImage: `url(${heartHighlightIMG})` }} />
          </div>
        </div>
      </div>
    </div>
  ), [cannot_select_animation_playing, handleClickVote, vote_button_is_highlight, vote_button_status])
}
