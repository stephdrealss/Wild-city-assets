import { useEffect, useRef, useState } from 'react'
import { Engine } from '@/game/engine'
import { setLoad } from '@/game/progress'
import { engineRef } from '@/game/ref'

function webglAvailable() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

// One engine per canvas, shared across React StrictMode's mount, unmount, mount cycle.
const shared: { canvas: HTMLCanvasElement | null; promise: Promise<Engine> | null; users: number } = { canvas: null, promise: null, users: 0 }

export function GameCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const [supported] = useState(webglAvailable)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (!supported) {
      setLoad({ error: 'This browser does not support WebGL. Enable hardware acceleration or try another browser.' })
      return
    }
    if (shared.canvas !== canvas || !shared.promise) {
      shared.canvas = canvas
      shared.promise = Engine.create(canvas)
    }
    shared.users++
    const promise = shared.promise
    promise
      .then((e) => {
        engineRef.current = e
      })
      .catch((e) => {
        console.error('Wild City PH could not start the renderer', e)
        setLoad({ error: e instanceof Error ? e.message : 'Unknown error' })
      })
    return () => {
      shared.users--
      window.setTimeout(() => {
        if (shared.users > 0 || shared.promise !== promise) return
        shared.promise = null
        shared.canvas = null
        void promise.then((e) => {
          e.dispose()
          if (engineRef.current === e) engineRef.current = null
        }, () => undefined)
      }, 60)
    }
  }, [supported])

  return (
    <div className="absolute inset-0">
      <canvas ref={ref} className="block h-full w-full touch-none" />
    </div>
  )
}
