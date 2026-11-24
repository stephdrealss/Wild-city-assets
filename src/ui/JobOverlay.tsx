import { useCallback, useState } from 'react'
import { JOBS, type JobId } from '@/game/data'
import { music } from '@/game/audio'
import { closeModal, earn, fmtCash, fmtPayRange, getState, setState } from '@/game/store'
import { Btn, Sheet } from './kit'
import { BusGame } from './games/BusGame'
import { DjGame } from './games/DjGame'
import { RepairGame } from './games/RepairGame'
import { StallGame } from './games/StallGame'

const PAY: Record<string, { min: number; max: number; rep: number }> = {
  stall: { min: 70, max: 200, rep: 5 },
  bus: { min: 110, max: 240, rep: 6 },
  repair: { min: 140, max: 320, rep: 7 },
  dj: { min: 200, max: 480, rep: 9 },
}

export function JobOverlay({ job }: { job: JobId }) {
  const def = JOBS.find((j) => j.id === job)!
  const pay = PAY[job]
  const [phase, setPhase] = useState<'intro' | 'play' | 'done'>('intro')
  const [result, setResult] = useState({ ratio: 0, note: '' })

  const finish = useCallback((ratio: number, note: string) => {
    setResult({ ratio, note })
    setPhase('done')
    music.sfx('jingle')
  }, [])

  const start = () => {
    const s = getState()
    if (s.energy < def.energy) return
    music.unlock()
    setState({ energy: s.energy - def.energy })
    setPhase('play')
  }
  const earned = Math.round(pay.min + (pay.max - pay.min) * result.ratio)
  const rep = Math.max(1, Math.round(pay.rep * (0.4 + 0.6 * result.ratio)))

  return (
    <Sheet title={def.name} subtitle={phase === 'intro' ? def.blurb : undefined} onClose={phase === 'play' ? () => undefined : closeModal} accent="#38ffd0">
      {phase === 'intro' && (
        <div className="flex flex-col gap-4 pt-2">
          <div className="glass-light rounded-2xl p-3 text-sm">
            <p>
              Pay: <b>{fmtPayRange(def.pay)}</b> depending on how well you do.
            </p>
            <p className="mt-1">
              Costs <b>{def.energy} energy</b> and earns reputation.
            </p>
          </div>
          {getState().energy < def.energy && <p className="text-sm text-[#ff9f9f]">You are too tired. Eat something or sleep first.</p>}
          <Btn onClick={start} disabled={getState().energy < def.energy}>
            Start shift
          </Btn>
        </div>
      )}
      {phase === 'play' && (
        <div className="pt-2" data-nosound>
          {job === 'stall' && <StallGame onDone={finish} />}
          {job === 'bus' && <BusGame onDone={finish} />}
          {job === 'repair' && <RepairGame onDone={finish} />}
          {job === 'dj' && <DjGame onDone={finish} />}
        </div>
      )}
      {phase === 'done' && (
        <div className="flex flex-col items-center gap-3 pt-3 text-center">
          <p className="font-display text-4xl font-bold text-[#ffd12e]">{fmtCash(earned)}</p>
          <p className="text-white/75">{result.note}</p>
          <p className="text-sm text-white/60">+{rep} reputation</p>
          <Btn
            className="mt-2 w-full"
            onClick={() => {
              earn(earned, rep, `${def.name} complete`)
              setState((s) => ({ jobsDone: s.jobsDone + 1 }))
              closeModal()
            }}
          >
            Collect pay
          </Btn>
        </div>
      )}
    </Sheet>
  )
}
