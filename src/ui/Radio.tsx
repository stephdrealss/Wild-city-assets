import { Music, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { music, type Station } from '@/game/audio'

const STATIONS: { id: Station; name: string; desc: string }[] = [
  { id: 'mix', name: 'Wild City FM', desc: 'Amapiano and afrobeats, back to back' },
  { id: 'amapiano', name: 'Piano Republic', desc: 'Log drums and lazy piano all day' },
  { id: 'afrobeats', name: 'Lagos Groove', desc: 'Afrobeats, shakers and talking drum feel' },
  { id: 'highlife', name: 'Highlife Corner', desc: 'Old-school guitar highlife' },
]

const subscribe = (fn: () => void) => music.onChange(fn)
const snapshot = () => `${music.station}|${music.mineName}|${music.mineError}`

/** In-game radio: pick a station, play a song from your own phone, or turn the music off. */
export function Radio() {
  const [open, setOpen] = useState(false)
  useSyncExternalStore(subscribe, snapshot)
  const file = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  // a plain browser listener: some phones never let React see the file picker's change event
  useEffect(() => {
    const el = file.current
    if (!open || !el) return
    const picked = () => {
      const f = el.files?.[0]
      if (f) music.playOwnSong(f)
      el.value = ''
    }
    el.addEventListener('change', picked)
    el.addEventListener('input', picked)
    return () => {
      el.removeEventListener('change', picked)
      el.removeEventListener('input', picked)
    }
  }, [open])

  const st = music.station
  const playing = st === 'off' ? 'Radio off' : st === 'mine' ? music.mineName || 'Your song' : STATIONS.find((x) => x.id === st)?.name

  return (
    <div ref={box} className="relative">
      <button
        aria-label="Radio"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`grid h-11 w-11 place-items-center rounded-2xl glass ${st !== 'off' ? 'text-[#ffd12e]' : 'text-white/60'}`}
      >
        <Music size={18} />
      </button>
      {open && (
        <div className="glass absolute right-0 top-full z-30 mt-2 w-72 rounded-3xl p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="min-w-0">
              <p className="font-display text-base font-bold leading-tight">Radio</p>
              <p className="truncate text-xs text-white/60">Now playing: {playing}</p>
            </div>
            <button aria-label="Close radio" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full glass-light">
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-1.5">
            {STATIONS.map((x) => (
              <button
                key={x.id}
                onClick={() => {
                  music.unlock()
                  music.setStation(x.id)
                }}
                className={`min-h-11 rounded-2xl px-3 py-2 text-left ${st === x.id ? 'bg-[#ff2d9b] text-white' : 'bg-white/10 hover:bg-white/15'}`}
              >
                <p className="text-sm font-bold leading-tight">{x.name}</p>
                <p className={`text-xs ${st === x.id ? 'text-white/85' : 'text-white/55'}`}>{x.desc}</p>
              </button>
            ))}
            {/* the real file input sits on top of the button, so a tap opens the picker directly (works in in-app browsers too) */}
            <label
              onPointerDown={() => music.primeOwnSong()}
              className={`relative flex min-h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-2xl px-3 py-2 text-left ${st === 'mine' ? 'bg-[#ff2d9b] text-white' : 'bg-white/10 hover:bg-white/15'}`}
            >
              <Upload size={16} className="shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight">{music.mineError ? 'That file no fit play. Pick another one.' : st === 'mine' && music.mineName ? music.mineName : 'Play my own song'}</span>
                <span className={`block text-xs ${st === 'mine' ? 'text-white/85' : 'text-white/55'}`}>Pick any song saved on your phone. It plays only for you.</span>
              </span>
              <input
                ref={file}
                type="file"
                aria-label="Choose a song from your phone"
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <button
              onClick={() => music.setStation('off')}
              className={`min-h-11 rounded-2xl px-3 text-left text-sm font-semibold ${st === 'off' ? 'bg-white/25' : 'glass-light text-white/70 hover:bg-white/15'}`}
            >
              Music off
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
