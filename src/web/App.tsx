import React, { Component, createContext, useEffect, useState } from 'react'
import { Signal } from 'new-vait'

// import BgImageUrl from 'src/assets/bg.png'
import { useFailureLayout } from './components/FailureLayout'

import './App.css'
import Frame from './Frame'

const err_sig = Signal<string>()

export const AppCriticalError = err_sig.trigger

const scroll_to_bottom_signal = Signal()

const contextValue = () => ({
  scroll_to_bottom_signal,
})

export const AppContext = createContext(contextValue())

export default function App() {
  const [ showFailure, , failure_layout ] = useFailureLayout(<AppInner />)

  useEffect(() => {
    err_sig.receive(showFailure)
    return () => err_sig.cancelReceive(showFailure)
  }, [showFailure])

  useEffect(() => {
    const handler = () => {
      const is_bottom = (
        ((window.innerHeight + window.scrollY) + window.innerHeight) >=
        (document.body.offsetHeight)
      )
      // console.log('trigger', is_bottom, document.body.offsetHeight, window.innerHeight,  window.scrollY)
      if (is_bottom) {
        scroll_to_bottom_signal.trigger()
      }
    }
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <AppContext.Provider value={contextValue()}>
      {failure_layout}
    </AppContext.Provider>
  )
}

function AppInner() {
  return (
    <div className="app">
    {
      process.env.REACT_APP_BUILD_DESCRIPTION && process.env.REACT_APP_BUILD_DESCRIPTION.length && (
        <pre className="build-description">
          <code>{ process.env.REACT_APP_BUILD_DESCRIPTION }</code>
        </pre>
      )
    }

    <Frame />

    {/* <GalleryHome /> */}

    <style>{`
      .app {
        background-repeat: repeat;
      }
      .build-description {
        position: fixed;
        top: 0;
        right: 0;
        color: grey;
        font-size: 12px;
        padding: 0;
        margin: 0;
        line-height: 1em;
        max-width: 100vw;
        word-break: break-all;
        display: inline-block;
        white-space: break-spaces;
      }
    `}</style>
  </div>
  )
}
