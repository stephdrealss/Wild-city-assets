import { useEffect, useRef, useState } from 'react'
import { music } from '@/game/audio'
import { Btn } from '../kit'

const COINS = [10, 20, 50, 100]
const TOTAL = 8
const PER = 11

function nextRound() {
  const fare = (6 + Math.floor(Math.random() * 12)) * 10
  const notes = [100, 200, 500].filter((n) => n > fare)
  const paid = notes[Math.floor(Math.random() * notes.length)]
  return { fare, paid }
}

export function BusGame({ onDone }: { onDone: (ratio: number, note: string) => void }) {
  const [round, setRound] = useState(0)
  const [r, setR] = useState(nextRound)
  const [sum, setSum] = useState(0)
  const [ok, setOk] = useState(0)
  const [left, setLeft] = useState(PER)
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const finished = useRef(false)
  const change = r.paid - r.fare

  const advance = (good: boolean) => {
    setFlash(good ? 'ok' : 'bad')
    music.sfx(good ? 'coin' : 'bad')
    const nr = round + 1
    if (good) setOk((o) => o + 1)
    window.setTimeout(() => {
      setFlash(null)
      setSum(0)
      setLeft(PER)
      setR(nextRound())
      setRound(nr)
    }, 350)
  }

  useEffect(() => {
    if (round >= TOTAL || flash) return
    const t = window.setInterval(() => setLeft((l) => l - 0.1), 100)
    return () => window.clearInterval(t)
  }, [round, flash])

  useEffect(() => {
    if (left <= 0 && !flash && round < TOTAL) advance(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left])

  useEffect(() => {
    if (round >= TOTAL && !finished.current) {
      finished.current = true
      onDone(ok / TOTAL, `${ok} of ${TOTAL} fares settled correctly`)
    }
  }, [round, ok, onDone])

  if (round >= TOTAL) return null
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm font-bold">
        <span className="tnum">Passenger {round + 1} of {TOTAL}</span>
        <span className="tnum rounded-full bg-white/10 px-3 py-1">{Math.max(0, Math.ceil(left))}s</span>
      </div>
      <div className={`rounded-3xl p-4 text-center transition ${flash === 'ok' ? 'bg-emerald-500/25' : flash === 'bad' ? 'bg-red-500/25' : 'glass-light'}`}>
        <p className="text-sm text-white/65">Fare VX {r.fare}, passenger paid VX {r.paid}</p>
        <p className="font-display mt-1 text-3xl font-bold">Give back VX {change}</p>
        <p className="tnum mt-2 text-lg font-bold text-[#ffd12e]">In hand: VX {sum}</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {COINS.map((c) => (
          <button
            key={c}
            disabled={!!flash}
            onClick={() => {
              music.sfx('tap')
              setSum((s) => s + c)
            }}
            className="grid min-h-16 place-items-center rounded-2xl bg-[#ffd12e] font-display text-lg font-bold text-[#2a1d00] active:scale-95 disabled:opacity-50"
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={() => setSum(0)} disabled={!!flash}>
          Clear
        </Btn>
        <Btn onClick={() => advance(sum === change)} disabled={!!flash || sum === 0}>
          Give change
        </Btn>
      </div>
    </div>
  )
}
