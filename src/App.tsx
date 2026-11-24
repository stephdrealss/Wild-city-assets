import { AnimatePresence } from 'framer-motion'
import { Component, useEffect, type ReactNode } from 'react'
import { useAccount } from 'wagmi'
import { useChainSync } from '@/chain/hooks'
import { useLoad } from '@/game/progress'
import { music } from '@/game/audio'
import { getState, useGame } from '@/game/store'
import { GameCanvas } from '@/ui/GameCanvas'
import { Hud } from '@/ui/Hud'
import { JobOverlay } from '@/ui/JobOverlay'
import { LoadingScreen } from '@/ui/LoadingScreen'
import { NpcDialog } from '@/ui/NpcDialog'
import { MarketPayBridge } from '@/chain/MarketPayBridge'
import { Phone } from '@/ui/Phone'
import { PoiPanel } from '@/ui/PoiPanel'
import { Title } from '@/ui/Title'

class Boundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : 'Unexpected error' }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="grid h-dvh place-items-center bg-[#120f24] p-6 text-center">
        <div className="max-w-sm">
          <p className="font-display text-2xl font-bold">Something went wrong</p>
          <p className="mt-2 text-white/70 text-pretty">{this.state.error}</p>
          <button onClick={() => window.location.reload()} className="mt-4 min-h-12 rounded-2xl bg-[#ff2d9b] px-6 font-bold">
            Reload
          </button>
        </div>
      </div>
    )
  }
}

function Game() {
  useChainSync()
  const { isConnected } = useAccount()

  // restore saved sound settings
  useEffect(() => {
    music.setVolume(getState().volume)
    music.setMuted(getState().muted)
  }, [])

  // a wallet connect is a click, so audio may start; also resume after any later gesture
  useEffect(() => {
    if (isConnected) music.start()
  }, [isConnected])
  useEffect(() => {
    const resume = () => music.unlock()
    window.addEventListener('pointerdown', resume, { once: true })
    window.addEventListener('keydown', resume, { once: true })
    // soft click on every button, except inside mini-games that make their own sounds
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('button, a, [role="button"]') && !t.closest('[data-nosound]')) music.sfx('click')
    }
    document.addEventListener('click', click, true)
    return () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
      document.removeEventListener('click', click, true)
    }
  }, [])
  const started = useGame((s) => s.started)
  const modal = useGame((s) => s.modal)
  const load = useLoad()
  const playing = started && load.ready

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#120f24]">
      <GameCanvas />
      <MarketPayBridge />
      {playing && <Hud />}
      <AnimatePresence>{!started && load.ready && <Title key="title" />}</AnimatePresence>
      <AnimatePresence>
        {playing && modal?.kind === 'phone' && <Phone key="phone" tab={modal.tab} />}
        {playing && modal?.kind === 'npc' && <NpcDialog key={`npc-${modal.npcId}`} m={modal} />}
        {playing && modal?.kind === 'poi' && <PoiPanel key={`poi-${modal.poiId}`} m={modal} />}
        {playing && modal?.kind === 'job' && <JobOverlay key={`job-${modal.job}`} job={modal.job} />}
      </AnimatePresence>
      <AnimatePresence>{!load.ready && <LoadingScreen key="loading" />}</AnimatePresence>
    </div>
  )
}

export default function App() {
  return (
    <Boundary>
      <Game />
    </Boundary>
  )
}
