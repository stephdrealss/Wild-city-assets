import { Banknote, Bike, ChevronsUp, Hand, Moon, Smartphone, Star, Sun, Utensils, Volume2, VolumeX, Zap, Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { levelFromRep, repForNext, REP_LEVELS } from '@/game/data'
import { music } from '@/game/audio'
import { engineRef } from '@/game/ref'
import { clockText, fmtCash, isNight, openModal, ownedVehicles, setState, useGame, USDC_PER_CASH } from '@/game/store'
import { ConnectKitButton } from 'connectkit'
import { toast } from 'sonner'
import { useAccount } from 'wagmi'
import { CHAIN_ID } from '@/chain/contracts'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { Bar } from './kit'
import { Minimap } from './Minimap'
import { Radio } from './Radio'

/** what she has earned, in USDC, and a button to get it paid into her wallet */
function Earnings({ cash }: { cash: number }) {
  const { address, isConnected } = useAccount()
  const [busy, setBusy] = useState(false)
  const claim = async () => {
    if (!address) return
    setBusy(true)
    const id = toast.loading(`Sending ${fmtCash(cash)} to your wallet…`)
    try {
      const r = await fetch('/api/payout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to: address, amount: Math.floor(cash) }) })
      const j = (await r.json()) as { hash?: string; usdc?: number; paidUnits?: number; error?: string; waitMs?: number }
      if (r.ok && j.hash) {
        setState((st) => ({ cash: Math.max(0, st.cash - (j.paidUnits ?? cash)) }))
        toast.success(`${j.usdc?.toFixed(2)} USDC paid to your wallet`, { id, action: { label: 'View', onClick: () => window.open(buildTxExplorerUrl(CHAIN_ID, j.hash as `0x${string}`), '_blank', 'noopener,noreferrer') } })
      } else {
        const why =
          j.error === 'payouts-off' ? 'Payouts are not switched on yet.' :
          j.error === 'too-soon' ? `You can claim again in ${Math.ceil((j.waitMs ?? 0) / 60000)} min.` :
          j.error === 'wallet-empty' ? 'The game payout wallet is empty right now. Try later.' :
          'Payout did not go through. Try again.'
        toast.error(why, { id })
      }
    } catch {
      toast.error('Payout did not go through. Try again.', { id })
    }
    setBusy(false)
  }
  return (
    <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
      <Banknote size={18} className="text-[#2775ca]" />
      <span className="font-display tnum text-lg font-bold leading-none">{fmtCash(cash)}</span>
      {cash * USDC_PER_CASH >= 0.05 &&
        (isConnected ? (
          <button disabled={busy} onClick={() => void claim()} className="rounded-xl bg-[#2775ca] px-2.5 py-1 text-xs font-bold disabled:opacity-50">
            {busy ? '…' : 'Claim'}
          </button>
        ) : (
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button onClick={show} className="rounded-xl bg-[#2775ca] px-2.5 py-1 text-xs font-bold">
                Connect to claim
              </button>
            )}
          </ConnectKitButton.Custom>
        ))}
    </div>
  )
}

function Stat({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass flex items-center gap-2 rounded-2xl px-3 py-2">
      {icon}
      {children}
    </div>
  )
}

export function Hud() {
  const s = useGame((g) => ({
    cash: g.cash,
    energy: g.energy,
    hunger: g.hunger,
    rep: g.rep,
    time: g.time,
    day: g.day,
    district: g.district,
    muted: g.muted,
    volume: g.volume,
    prompt: g.prompt,
    modal: g.modal !== null,
    hasVehicle: ownedVehicles(g).length > 0,
    delivery: g.delivery,
  }))
  const level = levelFromRep(s.rep)
  const next = repForNext(s.rep)
  const prev = REP_LEVELS[level - 1] ?? 0
  const pct = level >= REP_LEVELS.length ? 100 : ((s.rep - prev) / (next - prev)) * 100
  const night = isNight(s.time)

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto flex flex-col gap-2">
          <Earnings cash={s.cash} />
          <div className="glass flex flex-col gap-1.5 rounded-2xl px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-[#38ffd0]" />
              <Bar value={s.energy} color="#38ffd0" label="Energy" />
            </div>
            <div className="flex items-center gap-2">
              <Utensils size={15} className="text-[#ff9f1c]" />
              <Bar value={s.hunger} color="#ff9f1c" label="Hunger" />
            </div>
            <div className="flex items-center gap-2">
              <Star size={15} className="text-[#ff2d9b]" />
              <div className="flex items-center gap-2">
                <span className="font-display tnum text-xs font-bold">Lv {level}</span>
                <div className="h-2.5 w-16 overflow-hidden rounded-full bg-white/15 sm:w-24">
                  <div className="h-full rounded-full bg-[#ff2d9b] transition-[width]" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Stat icon={night ? <Moon size={16} className="text-[#b8c4ff]" /> : <Sun size={16} className="text-[#ffd12e]" />}>
              <span className="font-display tnum text-sm font-bold leading-none">
                {clockText(s.time)} <span className="text-white/55">Day {s.day}</span>
              </span>
            </Stat>
            <Radio />
            <VolumeControl muted={s.muted} volume={s.volume} />
            <button aria-label="Open phone" onClick={() => openModal({ kind: 'phone', tab: 'jobs' })} className="grid h-11 w-11 place-items-center rounded-2xl bg-[#ff2d9b] shadow-[0_6px_20px_-6px_#ff2d9b]">
              <Smartphone size={19} />
            </button>
          </div>
          <div className="relative">
            <Minimap size={116} />
          </div>
          <div className="glass max-w-[180px] rounded-full px-3 py-1 text-xs font-bold text-white/85">{s.district}</div>
        </div>
      </div>

      {s.delivery && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-24 sm:px-0">
          <div className="pointer-events-auto glass flex items-center gap-3 rounded-2xl px-3.5 py-2">
            <Bike size={18} className="text-[#ff2d9b]" />
            <div className="min-w-0 text-sm leading-tight">
              <p className="truncate font-bold">{s.delivery.phase === 'pickup' ? `Pick up at ${s.delivery.from}` : `Deliver to ${s.delivery.to}`}</p>
              <p className="tnum text-white/70">
                <Timer size={12} className="mr-1 inline" />
                {Math.max(0, Math.ceil(s.delivery.timeLeft))}s left · {fmtCash(s.delivery.reward)}
              </p>
            </div>
            <button onClick={() => engineRef.current?.cancelDelivery()} className="min-h-9 rounded-xl px-2 text-xs font-bold text-white/70 hover:text-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {s.prompt && !s.modal && (
        <div className="absolute inset-x-0 bottom-44 z-20 flex justify-center px-4 sm:bottom-10">
          <button
            onClick={() => engineRef.current?.interact()}
            className="glass flex min-h-12 items-center gap-3 rounded-2xl px-4 text-left shadow-xl transition active:scale-[0.97]"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#ff2d9b] font-display text-sm font-bold">E</span>
            <span className="text-[15px] font-bold">{s.prompt}</span>
          </button>
        </div>
      )}

      <Controls hasVehicle={s.hasVehicle} disabled={s.modal} />
    </>
  )
}

function VolumeControl({ muted, volume }: { muted: boolean; volume: number }) {
  const [open, setOpen] = useState(false)
  const apply = (v: number, m: boolean) => {
    music.setVolume(v)
    music.setMuted(m)
    setState({ volume: v, muted: m })
  }
  return (
    <div className="relative">
      <button aria-label="Sound settings" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="glass grid h-11 w-11 place-items-center rounded-2xl">
        {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>
      {open && (
        <div className="glass absolute right-0 top-12 z-30 flex w-56 flex-col gap-3 rounded-2xl p-3">
          <div className="flex items-center gap-3">
            <button
              aria-label={muted ? 'Unmute' : 'Mute'}
              onClick={() => {
                music.start()
                apply(volume, !muted)
              }}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10"
            >
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(volume * 100)}
              aria-label="Volume"
              onChange={(e) => {
                const v = Number(e.target.value) / 100
                music.start()
                apply(v, v === 0)
              }}
              className="h-8 w-full accent-[#ff2d9b]"
            />
          </div>
          <p className="text-xs text-white/60">Music, street sounds and effects. {muted ? 'Muted' : `Volume ${Math.round(volume * 100)}%`}</p>
        </div>
      )}
    </div>
  )
}

function Controls({ hasVehicle, disabled }: { hasVehicle: boolean; disabled: boolean }) {
  const coarse = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const base = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const id = useRef<number | null>(null)

  useEffect(() => {
    if (disabled) engineRef.current?.setJoystick(0, 0)
  }, [disabled])

  const update = (e: React.PointerEvent) => {
    const r = base.current?.getBoundingClientRect()
    if (!r) return
    const R = r.width / 2
    let dx = e.clientX - (r.left + R)
    let dy = e.clientY - (r.top + R)
    const m = Math.hypot(dx, dy)
    if (m > R) {
      dx = (dx / m) * R
      dy = (dy / m) * R
    }
    setKnob({ x: dx, y: dy })
    engineRef.current?.setJoystick(dx / R, -dy / R)
  }
  const end = () => {
    id.current = null
    setKnob({ x: 0, y: 0 })
    engineRef.current?.setJoystick(0, 0)
  }

  return (
    <>
      {coarse && (
        <div
          ref={base}
          className="absolute bottom-6 left-5 z-20 h-32 w-32 touch-none rounded-full glass"
          onPointerDown={(e) => {
            if (id.current !== null) return
            id.current = e.pointerId
            e.currentTarget.setPointerCapture(e.pointerId)
            update(e)
            music.unlock()
          }}
          onPointerMove={(e) => id.current === e.pointerId && update(e)}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <div className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full bg-white/35 shadow-lg" style={{ transform: `translate(calc(-50% + ${disabled ? 0 : knob.x}px), calc(-50% + ${disabled ? 0 : knob.y}px))` }} />
        </div>
      )}
      <div className="absolute bottom-20 right-4 z-20 flex flex-col items-end gap-3 sm:bottom-6 sm:right-auto sm:left-5 sm:flex-row">
        {hasVehicle && (
          <button aria-label="Ride or dismount" onClick={() => engineRef.current?.toggleVehicle()} className="glass grid h-14 w-14 place-items-center rounded-full active:scale-95">
            <Bike size={22} />
          </button>
        )}
        {coarse && (
          <button aria-label="Jump" onClick={() => engineRef.current?.jump()} className="glass grid h-14 w-14 place-items-center rounded-full active:scale-95">
            <ChevronsUp size={22} />
          </button>
        )}
        {coarse && (
          <button aria-label="Interact" onClick={() => engineRef.current?.interact()} className="grid h-16 w-16 place-items-center rounded-full bg-[#ff2d9b] shadow-[0_8px_24px_-6px_#ff2d9b] active:scale-95">
            <Hand size={26} />
          </button>
        )}
      </div>
    </>
  )
}
