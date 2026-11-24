import { useEffect, useRef, useState } from 'react'
import { music } from '@/game/audio'

const SCREWS = ['#ff2d9b', '#38ffd0', '#ffd12e', '#7b5cff', '#ff7a1a', '#4a8fe8']
const ROUNDS = 5

const makeSeq = (round: number) => Array.from({ length: round + 2 }, () => Math.floor(Math.random() * SCREWS.length))

export function RepairGame({ onDone }: { onDone: (ratio: number, note: string) => void }) {
  const [round, setRound] = useState(1)
  const [seq, setSeq] = useState(() => makeSeq(1))
  const [lit, setLit] = useState<number | null>(null)
  const [input, setInput] = useState<number[]>([])
  const [showing, setShowing] = useState(true)
  const [lives, setLives] = useState(2)
  const [cleared, setCleared] = useState(0)
  const [replay, setReplay] = useState(0)
  const done = useRef(false)

  // Flash the sequence whenever a new one starts or a replay is requested.
  useEffect(() => {
    let i = 0
    let off = 0
    const t = window.setInterval(() => {
      if (i >= seq.length) {
        window.clearInterval(t)
        setLit(null)
        setShowing(false)
        return
      }
      setLit(seq[i])
      music.sfx('tap')
      off = window.setTimeout(() => setLit(null), 380)
      i++
    }, 650)
    return () => {
      window.clearInterval(t)
      window.clearTimeout(off)
    }
  }, [seq, replay])

  const finish = (c: number) => {
    if (done.current) return
    done.current = true
    onDone(c / ROUNDS, `${c} of ${ROUNDS} repairs completed`)
  }

  const tap = (i: number) => {
    if (showing) return
    if (seq[input.length] !== i) {
      music.sfx('bad')
      const l = lives - 1
      setLives(l)
      if (l <= 0) return finish(cleared)
      setInput([])
      setShowing(true)
      setReplay((r) => r + 1)
      return
    }
    music.sfx('ok')
    const next = [...input, i]
    setInput(next)
    if (next.length === seq.length) {
      const c = cleared + 1
      setCleared(c)
      if (round >= ROUNDS) return finish(c)
      setRound(round + 1)
      setSeq(makeSeq(round + 1))
      setInput([])
      setShowing(true)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm font-bold">
        <span className="tnum">Repair {round} of {ROUNDS}</span>
        <span className="tnum text-white/70">Tries left {lives}</span>
      </div>
      <p className="text-sm text-white/70">{showing ? 'Watch the screw order...' : 'Now unscrew them in the same order'}</p>
      <div className="relative w-56 rounded-[2rem] border-4 border-white/20 bg-[#1b1830] p-4">
        <div className="grid grid-cols-2 gap-4">
          {SCREWS.map((c, i) => (
            <button
              key={c}
              aria-label={`Screw ${i + 1}`}
              onClick={() => tap(i)}
              disabled={showing}
              className="aspect-square rounded-full border-4 transition active:scale-90"
              style={{ borderColor: c, background: lit === i ? c : 'rgba(255,255,255,0.06)', boxShadow: lit === i ? `0 0 24px ${c}` : 'none' }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-1.5">
        {seq.map((_, i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full" style={{ background: i < input.length ? '#38ffd0' : 'rgba(255,255,255,0.2)' }} />
        ))}
      </div>
    </div>
  )
}
