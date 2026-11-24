import { ConnectKitButton } from 'connectkit'
import { Crown, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { BOARD, CHAIN_ID, short } from '@/chain/contracts'
import { useRunTx } from '@/chain/tx'
import { fmtCash, getState, netWorth, useGame } from '@/game/store'
import { Btn, Row, Sheet } from './kit'

interface Entry {
  player: string
  value: bigint
}

const fmtLeft = (s: number) => {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`
}

export function BoardPanel() {
  const [tab, setTab] = useState<'rich' | 'rep'>('rich')
  if (!BOARD.address) {
    return (
      <Sheet title="Season Leaderboard" subtitle="Richest players and highest reputation each week." accent="#ffd12e">
        <p className="glass-light mt-3 rounded-2xl p-4 text-sm text-white/80">The leaderboard contract has not been deployed to Arc Testnet yet. Keep building your fortune. Your progress is saved on this device.</p>
      </Sheet>
    )
  }
  return <Live tab={tab} setTab={setTab} />
}

function Live({ tab, setTab }: { tab: 'rich' | 'rep'; setTab: (t: 'rich' | 'rep') => void }) {
  const { address, isConnected } = useAccount()
  const run = useRunTx()
  const me = useGame((g) => ({ nw: netWorth(g), rep: g.rep }))
  const season = useReadContract({ address: BOARD.address, abi: BOARD.abi, functionName: 'currentSeason', chainId: CHAIN_ID })
  const left = useReadContract({ address: BOARD.address, abi: BOARD.abi, functionName: 'secondsToSeasonEnd', chainId: CHAIN_ID })
  const boards = useReadContract({
    address: BOARD.address,
    abi: BOARD.abi,
    functionName: 'getBoards',
    args: season.data !== undefined ? [season.data as bigint] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: season.data !== undefined, refetchInterval: 20_000 },
  })
  const last = useReadContract({ address: BOARD.address, abi: BOARD.abi, functionName: 'lastSubmit', args: address ? [address] : undefined, chainId: CHAIN_ID, query: { enabled: !!address } })
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const t = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => window.clearInterval(t)
  }, [])
  const [richest, repBoard] = (boards.data as [Entry[], Entry[]] | undefined) ?? [[], []]
  const rows = tab === 'rich' ? richest : repBoard
  const wait = Math.max(0, Number((last.data as bigint | undefined) ?? 0n) + 3600 - now)

  return (
    <Sheet
      title="Season Leaderboard"
      subtitle={left.data !== undefined ? `Season ${String(season.data)} ends in ${fmtLeft(Number(left.data))}` : 'Weekly seasons'}
      accent="#ffd12e"
      footer={
        <ConnectKitButton.Custom>
          {({ show }) => (
            <div className="flex flex-col gap-1.5">
              <Btn
                variant="gold"
                disabled={isConnected && wait > 0}
                onClick={async () => {
                  if (!isConnected) return show?.()
                  const s = getState()
                  if (await run([{ label: 'Submit score', address: BOARD.address!, abi: BOARD.abi, functionName: 'submitScore', args: [BigInt(netWorth(s)), s.rep] }])) {
                    void boards.refetch()
                    void last.refetch()
                  }
                }}
              >
                {!isConnected ? 'Connect wallet to submit' : wait > 0 ? `Next update in ${Math.ceil(wait / 60)} min` : `Submit my score (${fmtCash(me.nw)} · ${me.rep} rep)`}
              </Btn>
              <p className="text-center text-xs text-white/55">One update per wallet per hour. Scores are self-reported on testnet.</p>
            </div>
          )}
        </ConnectKitButton.Custom>
      }
    >
      <div className="mb-2 mt-2 flex gap-2">
        <button onClick={() => setTab('rich')} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold ${tab === 'rich' ? 'bg-[#ffd12e] text-[#2a1d00]' : 'glass-light'}`}>
          <Crown size={15} /> Richest
        </button>
        <button onClick={() => setTab('rep')} className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold ${tab === 'rep' ? 'bg-[#ffd12e] text-[#2a1d00]' : 'glass-light'}`}>
          <Star size={15} /> Reputation
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {rows.length === 0 && <p className="py-6 text-center text-sm text-white/60">No scores yet this season. Submit yours to take the top spot.</p>}
        {rows.map((e, i) => (
          <Row key={e.player} className={e.player.toLowerCase() === address?.toLowerCase() ? 'ring-2 ring-[#ffd12e]' : ''}>
            <span className="font-display tnum w-6 text-center text-lg font-bold text-[#ffd12e]">{i + 1}</span>
            <span className="flex-1 font-mono text-sm">{short(e.player)}</span>
            <span className="tnum font-bold">{tab === 'rich' ? fmtCash(Number(e.value)) : `${e.value.toString()} rep`}</span>
          </Row>
        ))}
      </div>
    </Sheet>
  )
}
