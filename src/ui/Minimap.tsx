import { useEffect, useRef } from 'react'
import { BLOCK, DISTRICTS, WORLD, blockCenter, districtOfBlock } from '@/game/data'
import { engineRef } from '@/game/ref'
import { getState } from '@/game/store'
import { levelFromRep } from '@/game/data'

const W = WORLD.maxX - WORLD.minX
const H = WORLD.maxZ - WORLD.minZ + 20
let cached: HTMLCanvasElement | null = null

function staticMap() {
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  g.fillStyle = '#25b8c9'
  g.fillRect(0, 0, W, H)
  const px = (x: number) => x - WORLD.minX
  const pz = (z: number) => z - WORLD.minZ
  g.fillStyle = '#f3e2ac'
  g.fillRect(0, pz(155), W, H)
  g.fillStyle = '#3b3f4a'
  g.fillRect(0, 0, W, pz(155))
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 6; j++) {
      const { x, z } = blockCenter(i, j)
      g.fillStyle = DISTRICTS[districtOfBlock(i, j)].tint
      g.fillRect(px(x - 20), pz(z - 20), 40, 40)
    }
  return (cached = c)
}

export function Minimap({ size = 120, full = false }: { size?: number; full?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const cw = full ? size : size
    const ch = full ? Math.round((size * H) / W) : size
    canvas.width = cw * dpr
    canvas.height = ch * dpr
    const g = canvas.getContext('2d')!
    const id = window.setInterval(() => {
      const e = engineRef.current
      if (!e) return
      const snap = e.snapshot()
      const map = staticMap()
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, cw, ch)
      const view = full ? W : 130
      const scale = cw / view
      let sx = 0
      let sy = 0
      let sw = W
      let sh = H
      if (!full) {
        sw = view
        sh = view
        sx = snap.x - WORLD.minX - view / 2
        sy = snap.z - WORLD.minZ - view / 2
      }
      g.save()
      if (!full) {
        g.beginPath()
        g.arc(cw / 2, ch / 2, cw / 2, 0, Math.PI * 2)
        g.clip()
      }
      g.fillStyle = '#120f24'
      g.fillRect(0, 0, cw, ch)
      g.drawImage(map, sx, sy, sw, sh, 0, 0, cw, full ? ch : cw)
      const lvl = levelFromRep(getState().rep)
      // darken locked districts
      g.fillStyle = 'rgba(10,8,24,0.55)'
      for (let i = 0; i < 7; i++)
        for (let j = 0; j < 6; j++) {
          if (DISTRICTS[districtOfBlock(i, j)].level <= lvl) continue
          const { x, z } = blockCenter(i, j)
          g.fillRect((x - 25 - WORLD.minX - sx) * scale, (z - 25 - WORLD.minZ - sy) * scale, 50 * scale, 50 * scale)
        }
      const to = (x: number, z: number) => [(x - WORLD.minX - sx) * scale, (z - WORLD.minZ - sy) * scale] as const
      for (const p of e.world.pois) {
        const [x, y] = to(p.x, p.z)
        if (x < 0 || y < 0 || x > cw || y > ch) continue
        g.fillStyle = p.color
        g.beginPath()
        g.arc(x, y, full ? 3 : 2.6, 0, Math.PI * 2)
        g.fill()
      }
      if (snap.target) {
        const [x, y] = to(snap.target.x, snap.target.z)
        g.strokeStyle = '#ffffff'
        g.fillStyle = '#ff2d9b'
        g.lineWidth = 2
        g.beginPath()
        g.arc(Math.min(cw - 6, Math.max(6, x)), Math.min(ch - 6, Math.max(6, y)), 6, 0, Math.PI * 2)
        g.fill()
        g.stroke()
      }
      const [px, py] = to(snap.x, snap.z)
      g.translate(px, py)
      g.rotate(-snap.yaw)
      g.fillStyle = '#ffffff'
      g.strokeStyle = '#ff2d9b'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(0, 7)
      g.lineTo(5, -5)
      g.lineTo(0, -2)
      g.lineTo(-5, -5)
      g.closePath()
      g.fill()
      g.stroke()
      g.restore()
    }, 100)
    return () => window.clearInterval(id)
  }, [size, full])
  return (
    <canvas
      ref={ref}
      style={{ width: size, height: full ? Math.round((size * H) / W) : size }}
      className={full ? 'rounded-2xl' : 'rounded-full border-2 border-white/30 shadow-lg'}
      aria-label="Minimap"
    />
  )
}

export const BLOCK_PX = BLOCK
