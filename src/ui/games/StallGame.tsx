import { Apple, Banana, Carrot, Cherry, Citrus, Grape, User, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { music } from '@/game/audio'

const GOODS: { icon: LucideIcon; color: string; name: string }[] = [
  { icon: Citrus, color: '#ff9f1c', name: 'Orange' },
  { icon: Carrot, color: '#ff6b2b', name: 'Carrot' },
  { icon: Banana, color: '#ffd12e', name: 'Plantain' },
  { icon: Cherry, color: '#ff3b5c', name: 'Cherry tomato' },
  { icon: Apple, color: '#7bd14b', name: 'Apple' },
  { icon: Grape, color: '#a56bff', name: 'Grapes' },
]

interface Cust {
  id: number
  order: number[]
  patience: number
  max: number
}

const DURATION = 40

export function StallGame({ onDone }: { onDone: (ratio: number, note: string) => void }) {
  const [custs, setCusts] = useState<Cust[]>([])
  const [bag, setBag] = useState<number[]>([])
  const [served, setServed] = useState(0)
  const [lost, setLost] = useState(0)
  const [left, setLeft] = useState(DURATION)
  const [shake, setShake] = useState(false)
  const done = useRef(false)

  useEffect(() => {
    let live: Cust[] = []
    let nextId = 1
    const t = window.setInterval(() => {
      setLeft((l) => l - 0.1)
      const alive = live.map((c) => ({ ...c, patience: c.patience - 0.1 })).filter((c) => c.patience > 0)
      const missed = live.length - alive.length
      if (missed > 0) setLost((x) => x + missed)
      if (alive.length < 3 && Math.random() < 0.09) {
        const n = 1 + Math.floor(Math.random() * 3)
        const order = Array.from({ length: n }, () => Math.floor(Math.random() * GOODS.length)).sort()
        const max = 7 + n * 2
        alive.push({ id: nextId++, order, patience: max, max })
      }
      live = alive
      setCusts(alive)
    }, 100)
    return () => window.clearInterval(t)
  }, [])

  useEffect(() => {
    if (left <= 0 && !done.current) {
      done.current = true
      onDone(Math.min(1, served / 12), `${served} served, ${lost} walked away`)
    }
  }, [left, served, lost, onDone])

  const add = (g: number) => {
    music.sfx('tap')
    const nb = [...bag, g].sort()
    const match = custs.find((c) => c.order.length === nb.length && c.order.every((v, i) => v === nb[i]))
    if (match) {
      music.sfx('coin')
      setServed((s) => s + 1)
      setCusts((cs) => cs.filter((c) => c.id !== match.id))
      setBag([])
      return
    }
    const possible = custs.some((c) => nb.every((v) => c.order.includes(v)) && c.order.length >= nb.length)
    if (!possible) {
      music.sfx('bad')
      setShake(true)
      window.setTimeout(() => setShake(false), 250)
      setBag([])
      return
    }
    setBag(nb)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="tnum">Served {served}</span>
        <span className="tnum rounded-full bg-white/10 px-3 py-1">{Math.max(0, Math.ceil(left))}s</span>
        <span className="tnum text-white/60">Lost {lost}</span>
      </div>
      <div className="grid min-h-[132px] grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, i) => custs[i]).map((c, i) =>
          c ? (
            <div key={c.id} className="glass-light flex flex-col items-center gap-1.5 rounded-2xl p-2">
              <User size={22} className="text-white/70" />
              <div className="flex flex-wrap justify-center gap-1">
                {c.order.map((g, k) => {
                  const G = GOODS[g]
                  return <G.icon key={k} size={20} color={G.color} />
                })}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full" style={{ width: `${(c.patience / c.max) * 100}%`, background: c.patience / c.max < 0.35 ? '#ff4d4d' : '#38ffd0' }} />
              </div>
            </div>
          ) : (
            <div key={`e${i}`} className="rounded-2xl border border-dashed border-white/15" />
          ),
        )}
      </div>
      <div className={`glass-light flex min-h-12 items-center justify-center gap-2 rounded-2xl p-2 ${shake ? 'animate-pulse bg-red-500/30' : ''}`}>
        {bag.length === 0 ? <span className="text-sm text-white/50">Tap goods to fill the order</span> : bag.map((g, i) => {
          const G = GOODS[g]
          return <G.icon key={i} size={24} color={G.color} />
        })}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {GOODS.map((G, i) => (
          <button key={G.name} aria-label={G.name} onClick={() => add(i)} className="glass-light grid min-h-16 place-items-center rounded-2xl active:scale-95">
            <G.icon size={30} color={G.color} />
          </button>
        ))}
      </div>
    </div>
  )
}
