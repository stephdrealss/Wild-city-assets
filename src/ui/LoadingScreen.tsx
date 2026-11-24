import { motion } from 'framer-motion'
import { RotateCcw } from 'lucide-react'
import { useLoad } from '@/game/progress'
import { Btn } from './kit'

export function LoadingScreen() {
  const l = useLoad()
  return (
    <motion.div className="absolute inset-0 z-50 grid place-items-center bg-[#120f24] p-6" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
        <h1 aria-label="Wild City PH" className="font-display text-5xl font-bold leading-[0.95] tracking-[-0.03em]">
          <span className="text-[#ffe14d]">WILD</span> <span className="text-[#38ffd0]">CITY</span>
          <span className="mt-2 block">
            <span className="inline-block -rotate-2 rounded-xl bg-[#ff2d9b] px-3 py-0.5 text-2xl">PH</span>
          </span>
        </h1>
        {l.error ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-white/85 text-pretty">The game could not start. {l.error}</p>
            <Btn onClick={() => window.location.reload()}>
              <RotateCcw size={16} /> Try again
            </Btn>
          </div>
        ) : (
          <>
            <div className="h-3 w-full overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(l.pct)} aria-label="Loading">
              <div className="h-full rounded-full bg-gradient-to-r from-[#ff2d9b] via-[#ffe14d] to-[#38ffd0] transition-[width] duration-300" style={{ width: `${l.pct}%` }} />
            </div>
            <p className="tnum text-sm font-bold text-white/80">
              {l.label} · {Math.round(l.pct)}%
            </p>
            {l.fallbacks.length > 0 && <p className="text-xs text-white/55 text-pretty">Some character models were not found, so simple placeholder people are used instead.</p>}
          </>
        )}
      </div>
    </motion.div>
  )
}
