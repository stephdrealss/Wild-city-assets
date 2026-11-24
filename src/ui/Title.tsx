import { ConnectKitButton } from 'connectkit'
import { motion } from 'framer-motion'
import { Play, RotateCcw, Wallet } from 'lucide-react'
import { useAccount } from 'wagmi'
import { music } from '@/game/audio'
import { getState, resetSave, setState } from '@/game/store'
import { short } from '@/chain/contracts'
import { Avatar } from './Avatar'
import { Btn } from './kit'

export function Title() {
  const { address, isConnected } = useAccount()
  const saved = getState().jobsDone > 0 || getState().rep > 0 || getState().cash !== 120

  const play = () => {
    music.start()
    setState({ started: true })
  }

  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[#120f24]/55 p-5 backdrop-blur-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 py-6 text-center">
        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 20 }} className="w-40 overflow-hidden rounded-[28px] shadow-[0_20px_60px_-10px_#ff2d9b]">
          <Avatar wearing={getState().wearing} size={160} />
        </motion.div>
        <div>
          <h1 aria-label="Wild City PH" className="font-display font-bold leading-[0.9] tracking-[-0.03em]">
            <span className="flex justify-center text-[3.6rem] sm:text-7xl" style={{ textShadow: '0 5px 0 #1b0f3a, 0 12px 36px #00000066' }}>
              {'WILD'.split('').map((ch, i) => (
                <span key={i} style={{ color: ['#ffe14d', '#ff4fb0', '#38ffd0', '#ff9f1c'][i % 4] }}>
                  {ch}
                </span>
              ))}
              <span className="w-4" />
              {'CITY'.split('').map((ch, i) => (
                <span key={i} style={{ color: ['#38ffd0', '#ffe14d', '#ff4fb0', '#7be0ff'][i % 4] }}>
                  {ch}
                </span>
              ))}
            </span>
            <span className="mt-2 inline-block -rotate-2 rounded-xl bg-[#ff2d9b] px-4 py-1 text-3xl text-white shadow-[0_6px_0_#1b0f3a]">PH</span>
          </h1>
          <p className="mt-3 text-lg text-white/85 text-balance">Start with nothing. Hustle the streets of Wild City. Own the block.</p>
        </div>

        <div className="flex w-full flex-col gap-2.5">
          <Btn onClick={play}>
            <Play size={18} /> {saved ? 'Continue' : 'Play as guest'}
          </Btn>
          {saved && (
            <Btn
              variant="ghost"
              onClick={() => {
                resetSave()
                music.start()
              }}
            >
              <RotateCcw size={16} /> New game
            </Btn>
          )}
          <ConnectKitButton.Custom>
            {({ show }) => (
              <Btn
                variant="ghost"
                onClick={() => {
                  music.start()
                  show?.()
                }}
              >
                <Wallet size={17} /> {isConnected ? `Wallet ${short(address)}` : 'Connect wallet (Arc Testnet)'}
              </Btn>
            )}
          </ConnectKitButton.Custom>
          <p className="text-xs text-white/60 text-pretty">Guests play with in-game cash. A wallet adds NFT ownership, trading and the weekly leaderboard.</p>
        </div>

        <div className="glass-light grid w-full grid-cols-3 gap-2 rounded-2xl p-3 text-xs text-white/75">
          <div>
            <p className="font-bold text-white">Move</p>WASD or joystick
          </div>
          <div>
            <p className="font-bold text-white">Interact</p>E or tap
          </div>
          <div>
            <p className="font-bold text-white">Look</p>Drag the screen
          </div>
        </div>
      </div>
    </motion.div>
  )
}
