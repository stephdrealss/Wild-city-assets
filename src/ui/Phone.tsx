import { ConnectKitButton } from 'connectkit'
import { Briefcase, ExternalLink, Lock, Map as MapIcon, Package, Wallet } from 'lucide-react'
import { useAccount, useReadContract } from 'wagmi'
import { BOARD, CHAIN_ID, COLLECTIONS, MARKET, short } from '@/chain/contracts'
import { useOwned, useUsdcBalance } from '@/chain/hooks'
import { refetchOwned } from '@/chain/sync'
import { useRunTx, useTxLog } from '@/chain/tx'
import { DISTRICTS, JOBS, MARKET_GOODS, OUTFITS, PROPERTIES, REP_LEVELS, VEHICLES, levelFromRep, type GoodsId } from '@/game/data'
import { engineRef } from '@/game/ref'
import {
  eatFromBag,
  closeModal,
  collectTill,
  fmtCash,
  fmtPayRange,
  homeTier,
  netWorth,
  openModal,
  ownedOutfits,
  ownedProperties,
  ownedVehicles,
  setActiveVehicle,
  useGame,
  wear,
  type PhoneTab,
} from '@/game/store'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '@/onchain-facts'
import { formatUsdc } from '@/onchain-money'
import { Avatar } from './Avatar'
import { Btn, Row, Sheet, Tag } from './kit'
import { Minimap } from './Minimap'

const TABS: { id: PhoneTab; label: string; icon: typeof Briefcase }[] = [
  { id: 'jobs', label: 'Jobs', icon: Briefcase },
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'inventory', label: 'Items', icon: Package },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
]

const WHERE: Record<string, string> = {
  delivery: 'Dispatch Office, Market District',
  stall: 'Stall Counter, Market District',
  bus: 'Bus Depot, Wild City Plaza',
  repair: 'Phone Repair Kiosk, Market District',
  dj: 'Neon Lounge, Beachfront (night only)',
}

export function Phone({ tab }: { tab: PhoneTab }) {
  return (
    <Sheet
      title="Phone"
      accent="#ff2d9b"
      footer={
        <div className="grid grid-cols-4 gap-1.5">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => openModal({ kind: 'phone', tab: t.id })} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-bold ${tab === t.id ? 'bg-[#ff2d9b]' : 'glass-light text-white/75'}`}>
              <t.icon size={17} />
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'jobs' && <JobsTab />}
      {tab === 'map' && <MapTab />}
      {tab === 'inventory' && <InventoryTab />}
      {tab === 'wallet' && <WalletTab />}
    </Sheet>
  )
}

function JobsTab() {
  const s = useGame((g) => ({ rep: g.rep, done: g.jobsDone, nw: netWorth(g), wearing: g.wearing }))
  const lvl = levelFromRep(s.rep)
  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="glass-light flex items-center gap-4 rounded-2xl p-3">
        <div className="w-16 shrink-0 overflow-hidden rounded-2xl">
          <Avatar wearing={s.wearing} size={64} />
        </div>
        <div className="text-sm">
          <p className="font-display text-lg font-bold">Reputation level {lvl}</p>
          <p className="tnum text-white/70">
            {s.rep} rep · {s.done} jobs done · net worth {fmtCash(s.nw)}
          </p>
          {lvl < REP_LEVELS.length && <p className="text-white/55">Next level at {REP_LEVELS[lvl]} rep</p>}
        </div>
      </div>
      {JOBS.map((j) => {
        const locked = lvl < j.level
        return (
          <Row key={j.id} className="items-start">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-display font-bold">{j.name}</p>
                {locked ? (
                  <Tag color="#ffffff22">
                    <Lock size={10} className="mr-1 inline" />
                    Level {j.level}
                  </Tag>
                ) : (
                  <Tag color="#27c1a844">Open</Tag>
                )}
              </div>
              <p className="text-sm text-white/65">{j.blurb}</p>
              <p className="mt-0.5 text-xs text-white/55">Find it: {WHERE[j.id]}</p>
            </div>
            <span className="tnum shrink-0 text-sm font-bold text-[#ffd12e]">{fmtPayRange(j.pay)}</span>
          </Row>
        )
      })}
      <p className="pt-1 text-xs font-bold uppercase tracking-wider text-white/50">Districts</p>
      {Object.values(DISTRICTS).map((d) => (
        <div key={d.name} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ background: d.tint }} />
            {d.name}
          </span>
          <span className={lvl >= d.level ? 'text-[#38ffd0]' : 'text-white/50'}>{lvl >= d.level ? 'Open' : `Level ${d.level}`}</span>
        </div>
      ))}
    </div>
  )
}

function MapTab() {
  return (
    <div className="flex flex-col items-center gap-3 pt-2">
      <Minimap size={Math.min(420, window.innerWidth - 72)} full />
      <p className="text-center text-xs text-white/60">Shaded blocks are locked districts. Pink marker is your delivery target.</p>
    </div>
  )
}

function InventoryTab() {
  const s = useGame((g) => ({
    vehicles: ownedVehicles(g),
    active: g.activeVehicle,
    outfits: ownedOutfits(g),
    wearing: g.wearing,
    props: ownedProperties(g),
    home: homeTier(g),
    till: Math.floor(Object.values(g.till).reduce((a, b) => a + b, 0)),
    bag: g.bag,
  }))
  const slot = (c: number) => (['outfit', 'hair', 'acc'] as const)[c]
  const bagItems = (Object.entries(s.bag) as [GoodsId, number][]).filter(([, n]) => n > 0)
  return (
    <div className="flex flex-col gap-3 pt-1">
      <p className="text-xs font-bold uppercase tracking-wider text-white/50">Market bag</p>
      {bagItems.length === 0 && <p className="text-sm text-white/60">Empty. Buy garri, tomatoes, yam and more from the market women.</p>}
      {bagItems.map(([id, n]) => (
        <Row key={id} className="justify-between">
          <span className="min-w-0">
            <span className="block font-bold">
              {MARKET_GOODS[id].name} <span className="tnum text-white/60">×{n}</span>
            </span>
            <span className="block text-xs text-white/55">Hunger +{MARKET_GOODS[id].hunger}</span>
          </span>
          <Btn small variant="teal" onClick={() => eatFromBag(id)}>
            {MARKET_GOODS[id].use}
          </Btn>
        </Row>
      ))}
      <p className="text-xs font-bold uppercase tracking-wider text-white/50">Vehicles</p>
      {s.vehicles.length === 0 && <p className="text-sm text-white/60">No vehicle yet. Zoom Motors in Wild City Plaza sells them.</p>}
      {s.vehicles.map((id) => (
        <Row key={id} className="justify-between">
          <span className="font-bold">{VEHICLES[id].name}</span>
          <Btn
            small
            variant={s.active === id ? 'primary' : 'ghost'}
            onClick={() => {
              setActiveVehicle(id)
              closeModal()
              const e = engineRef.current
              if (e?.riding) e.toggleVehicle()
              e?.toggleVehicle()
            }}
          >
            {s.active === id ? 'Ride' : 'Select and ride'}
          </Btn>
        </Row>
      ))}
      <p className="text-xs font-bold uppercase tracking-wider text-white/50">Wardrobe</p>
      <Row className="justify-between">
        <span className="font-bold">Signature pink track jacket</span>
        <Btn small variant="ghost" onClick={() => wear('outfit', -1)}>
          {s.wearing.outfit === -1 ? 'Worn' : 'Wear'}
        </Btn>
      </Row>
      {s.outfits.map((id) => {
        const o = OUTFITS[id]
        const sl = slot(o.category)
        return (
          <Row key={id} className="justify-between">
            <span className="font-bold">{o.name}</span>
            <Btn small variant="ghost" onClick={() => wear(sl, s.wearing[sl] === id ? -1 : id)}>
              {s.wearing[sl] === id ? 'Take off' : 'Wear'}
            </Btn>
          </Row>
        )
      })}
      <p className="text-xs font-bold uppercase tracking-wider text-white/50">Properties</p>
      <Row className="justify-between">
        <span className="font-bold">Home</span>
        <span className="text-sm text-white/70">{s.home ? PROPERTIES[s.home - 1].name : 'None yet'}</span>
      </Row>
      {s.props
        .filter((id) => PROPERTIES[id].kind !== 'home')
        .map((id) => (
          <Row key={id} className="justify-between">
            <span className="font-bold">{PROPERTIES[id].name}</span>
            <span className="tnum text-sm text-white/70">{fmtCash(PROPERTIES[id].hourly)}/hr</span>
          </Row>
        ))}
      {s.till > 0 && (
        <Btn variant="gold" onClick={() => collectTill()}>
          Collect {fmtCash(s.till)} from your businesses
        </Btn>
      )}
    </div>
  )
}

function WalletTab() {
  const { address, isConnected } = useAccount()
  const { balance } = useUsdcBalance()
  const run = useRunTx()
  const log = useTxLog()
  const props = useOwned('property')
  const pending = useReadContract({
    address: COLLECTIONS.property.address,
    abi: COLLECTIONS.property.abi,
    functionName: 'pendingYield',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address && !!COLLECTIONS.property.address, refetchInterval: 10_000 },
  })
  const yielding = props.tokenIds.filter((_, i) => (props.typeIds[i] ?? 0) >= 3).slice(0, 50)
  const pend = (pending.data as bigint | undefined) ?? 0n

  return (
    <div className="flex flex-col gap-3 pt-1">
      <ConnectKitButton.Custom>
        {({ show }) => (
          <div className="glass-light rounded-2xl p-4">
            {isConnected && address ? (
              <>
                <p className="text-xs font-bold uppercase tracking-wider text-white/50">Connected on Arc Testnet</p>
                <a className="mt-1 flex items-center gap-1.5 font-mono text-sm text-[#7be0ff]" target="_blank" rel="noopener noreferrer" href={buildAddressExplorerUrl(CHAIN_ID, address)}>
                  {short(address)} <ExternalLink size={13} />
                </a>
                <p className="mt-3 text-sm text-white/65">USDC balance</p>
                <p className="tnum font-display text-3xl font-bold">{balance !== undefined ? formatUsdc(balance) : '...'} USDC</p>
                <p className="mt-1 text-xs text-white/55">USDC is also the gas token on Arc. Need more? Use Get test USDC in the Arc Studio sidebar.</p>
                <Btn small variant="ghost" className="mt-3" onClick={show}>
                  Wallet options
                </Btn>
              </>
            ) : (
              <>
                <p className="font-display text-lg font-bold">You are playing as a guest</p>
                <p className="mt-1 text-sm text-white/70">Guest mode keeps in-game cash only. Connect a wallet to own properties, vehicles and outfits, trade, and join the leaderboard.</p>
                <Btn className="mt-3" onClick={show}>
                  Connect wallet
                </Btn>
              </>
            )}
          </div>
        )}
      </ConnectKitButton.Custom>

      {isConnected && COLLECTIONS.property.address && (
        <Row className="justify-between">
          <div>
            <p className="text-sm text-white/65">Yield from your properties</p>
            <p className="tnum font-display text-xl font-bold text-[#38ffd0]">{formatUsdc(pend)} USDC</p>
          </div>
          <Btn
            small
            variant="teal"
            disabled={pend === 0n}
            onClick={async () => {
              if (await run([{ label: 'Claim yield', address: COLLECTIONS.property.address!, abi: COLLECTIONS.property.abi, functionName: 'claimYield', args: [yielding] }])) {
                void pending.refetch()
                refetchOwned()
              }
            }}
          >
            Claim
          </Btn>
        </Row>
      )}
      <div className="flex flex-wrap gap-2 text-xs text-white/60">
        {(
          [
            ['Properties', COLLECTIONS.property.address],
            ['Vehicles', COLLECTIONS.vehicle.address],
            ['Outfits', COLLECTIONS.outfit.address],
            ['Marketplace', MARKET.address],
            ['Leaderboard', BOARD.address],
          ] as const
        ).map(([n, a]) =>
          a ? (
            <a key={n} href={buildAddressExplorerUrl(CHAIN_ID, a)} target="_blank" rel="noopener noreferrer" className="glass-light inline-flex min-h-9 items-center gap-1 rounded-full px-3">
              {n} <ExternalLink size={11} />
            </a>
          ) : (
            <span key={n} className="inline-flex min-h-9 items-center rounded-full border border-dashed border-white/20 px-3">
              {n}: not deployed
            </span>
          ),
        )}
      </div>
      <p className="text-xs font-bold uppercase tracking-wider text-white/50">Recent transactions</p>
      {log.length === 0 && <p className="text-sm text-white/55">Your onchain actions will show up here with explorer links.</p>}
      {log.map((t) => (
        <a key={t.hash} href={buildTxExplorerUrl(CHAIN_ID, t.hash)} target="_blank" rel="noopener noreferrer" className="glass-light flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-sm">
          <span className="truncate font-bold">{t.label}</span>
          <span className="flex items-center gap-1.5 text-xs text-white/65">
            {t.status === 'pending' ? 'Confirming' : t.status === 'success' ? 'Confirmed' : 'Failed'} <ExternalLink size={12} />
          </span>
        </a>
      ))}
    </div>
  )
}
