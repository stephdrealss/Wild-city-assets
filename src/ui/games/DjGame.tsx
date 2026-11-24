import { useEffect, useRef, useState } from 'react'
import { music } from '@/game/audio'

const LANES = ['#ff2d9b', '#38ffd0', '#ffd12e', '#7b5cff']
const KEYS = ['d', 'f', 'j', 'k']
const FALL = 1.6
const NOTES = 40
const DURATION = 32
const H = 320
const HIT_Y = H - 44

interface Note {
  t: number
  lane: number
  done: boolean
}
interface Frame {
  now: number
  items: { id: number; lane: number; y: number }[]
}

export function DjGame({ onDone }: { onDone: (ratio: number, note: string) => void }) {
  const [frame, setFrame] = useState<Frame>({ now: 0, items: [] })
  const [combo, setCombo] = useState(0)
  const [flash, setFlash] = useState<number | null>(null)
  const press = useRef<(lane: number) => void>(() => undefined)

  useEffect(() => {
    const notes: Note[] = Array.from({ length: NOTES }, (_, i) => ({ t: 2 + (i * (DURATION - 4)) / NOTES + (i % 3 === 0 ? 0 : 0.12), lane: (i * 7 + (i % 5)) % 4, done: false }))
    const t0 = performance.now()
    let hits = 0
    let perfect = 0
    const ctl = { raf: 0, over: false }

    press.current = (lane: number) => {
      const now = (performance.now() - t0) / 1000
      setFlash(lane)
      window.setTimeout(() => setFlash(null), 120)
      let best: Note | undefined
      for (const n of notes) if (n.lane === lane && !n.done && Math.abs(n.t - now) < 0.3 && (!best || Math.abs(n.t - now) < Math.abs(best.t - now))) best = n
      if (!best) {
        setCombo(0)
        music.sfx('bad')
        return
      }
      best.done = true
      hits++
      if (Math.abs(best.t - now) < 0.12) perfect++
      setCombo((c) => c + 1)
      music.sfx('ok')
    }

    const loop = () => {
      const now = (performance.now() - t0) / 1000
      for (const n of notes)
        if (!n.done && now - n.t > 0.3) {
          n.done = true
          setCombo(0)
        }
      const items = notes
        .map((n, id) => ({ id, lane: n.lane, y: ((now - (n.t - FALL)) / FALL) * HIT_Y, done: n.done }))
        .filter((n) => !n.done && n.y > -30 && n.y < H + 20)
      setFrame({ now, items })
      if (now > DURATION && !ctl.over) {
        ctl.over = true
        onDone(Math.min(1, (hits + perfect * 0.4) / (NOTES * 1.4)), `${hits} of ${NOTES} notes hit, ${perfect} perfect`)
        return
      }
      ctl.raf = requestAnimationFrame(loop)
    }
    ctl.raf = requestAnimationFrame(loop)

    const kd = (e: KeyboardEvent) => {
      const i = KEYS.indexOf(e.key.toLowerCase())
      if (i >= 0) press.current(i)
    }
    window.addEventListener('keydown', kd)
    return () => {
      cancelAnimationFrame(ctl.raf)
      window.removeEventListener('keydown', kd)
    }
  }, [onDone])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="tnum">Combo {combo}</span>
        <span className="tnum rounded-full bg-white/10 px-3 py-1">{Math.max(0, Math.ceil(DURATION - frame.now))}s</span>
        <span className="text-white/60">Keys D F J K</span>
      </div>
      <div className="relative overflow-hidden rounded-3xl bg-[#0d0a1f]" style={{ height: H }}>
        <div className="absolute inset-0 grid grid-cols-4">
          {LANES.map((c, i) => (
            <div key={c} className="border-x border-white/5" style={{ background: flash === i ? `${c}33` : 'transparent' }} />
          ))}
        </div>
        <div className="absolute inset-x-0 h-0.5 bg-white/50" style={{ top: HIT_Y }} />
        {frame.items.map((n) => (
          <div key={n.id} className="absolute h-6 w-[22%] rounded-lg" style={{ left: `${n.lane * 25 + 1.5}%`, top: n.y - 12, background: LANES[n.lane], boxShadow: `0 0 14px ${LANES[n.lane]}` }} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {LANES.map((c, i) => (
          <button key={c} aria-label={`Lane ${i + 1}`} onPointerDown={() => press.current(i)} className="min-h-16 rounded-2xl font-display text-lg font-bold text-black active:scale-95" style={{ background: c }}>
            {KEYS[i].toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  )
}
