import { ConnectKitButton } from 'connectkit'
import { marketPay, usdcFor } from '@/chain/pay'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  CATEGORY_NAMES,
  FOODS,
  JOBS,
  OUTFITS,
  PROPERTIES,
  VEHICLES,
  levelFromRep,
  type JobId,
} from '@/game/data'
import { engineRef } from '@/game/ref'
import {
  buyLocal,
  clockText,
  closeModal,
  collectTill,
  fmtCash,
  fmtPayRange,
  getState,
  homeTier,
  isNight,
  openModal,
  ownedOutfits,
  ownedProperties,
  ownedVehicles,
  setActiveVehicle,
  setState,
  sleepHome,
  useGame,
  wear,
  type Modal,
} from '@/game/store'
import { AssetList, type AssetRow } from './Assets'
import { BoardPanel } from './BoardPanel'
import { MarketPanel } from './MarketPanel'
import { Btn, Row, Sheet, Tag } from './kit'

type PoiModal = Extract<Modal, { kind: 'poi' }>

export function PoiPanel({ m }: { m: PoiModal }) {
  switch (m.poiKind) {
    case 'food':
      return <FoodPanel m={m} />
    case 'delivery':
      return <DeliveryPanel m={m} />
    case 'bus':
    case 'stall':
    case 'repair':
    case 'dj':
      return <JobGate m={m} />
    case 'home':
      return <HomePanel m={m} />
    case 'agent':
      return <PropertyPanel m={m} />
    case 'business':
      return <BusinessPanel m={m} />
    case 'dealer':
      return <DealerPanel m={m} />
    case 'boutique':
      return <BoutiquePanel m={m} />
    case 'trade':
      return <MarketPanel title={m.label} />
    case 'leaderboard':
      return <BoardPanel />
    case 'bench':
      return <BenchPanel m={m} />
    default:
      return null
  }
}

/** what a plate costs in USDC (the menu is priced in VX; about ₦50 each) */
const foodUsdc = (vx: number) => usdcFor(vx * 50)

function FoodPanel({ m }: { m: PoiModal }) {
  const discount = useGame((s) => (s.discount && s.discount.day === s.day ? s.discount.pct : 0))
  const [busy, setBusy] = useState<string | null>(null)
  const order = async (f: (typeof FOODS)[number]) => {
    const usdc = foodUsdc(Math.max(1, Math.round(f.cost * (1 - discount / 100))))
    setBusy(f.id)
    const ok = await marketPay.pay(usdc, `Pay ${m.label} ${usdc.toFixed(2)} USDC for ${f.name.toLowerCase()}`)
    setBusy(null)
    if (!ok) return
    setState((s) => ({ hunger: Math.min(100, s.hunger + f.hunger), energy: Math.min(100, s.energy + f.energy) }))
    toast(`Ate ${f.name}`, { description: `Hunger +${f.hunger}` })
  }
  return (
    <Sheet title={m.label} subtitle={discount ? `Fresh and hot. Your ${discount}% bargain discount applies today. Pay in USDC.` : 'Fresh and hot. Pay in USDC from your wallet.'} accent="#ff9f1c">
      <div className="flex flex-col gap-2 pt-2">
        {!marketPay.connected && (
          <ConnectKitButton.Custom>{({ show }) => <Btn onClick={show}>Connect wallet to pay in USDC</Btn>}</ConnectKitButton.Custom>
        )}
        {FOODS.map((f) => (
          <Row key={f.id} className="justify-between">
            <div className="min-w-0">
              <p className="font-bold leading-tight">{f.name}</p>
              <p className="text-sm text-white/65">
                Hunger +{f.hunger}
                {f.energy ? `, energy +${f.energy}` : ''}
              </p>
            </div>
            <Btn small variant="gold" disabled={!marketPay.active || !!busy} onClick={() => void order(f)}>
              {busy === f.id ? 'Paying…' : `${foodUsdc(Math.max(1, Math.round(f.cost * (1 - discount / 100)))).toFixed(2)} USDC`}
            </Btn>
          </Row>
        ))}
      </div>
    </Sheet>
  )
}

function DeliveryPanel({ m }: { m: PoiModal }) {
  const s = useGame((g) => ({ rep: g.rep, energy: g.energy, active: !!g.delivery }))
  const def = JOBS.find((j) => j.id === 'delivery')!
  return (
    <Sheet title={m.label} subtitle={def.blurb} accent="#ff2d9b">
      <div className="flex flex-col gap-3 pt-2">
        <div className="glass-light rounded-2xl p-3 text-sm">
          <p>
            Pay: <b>{fmtPayRange(def.pay)}</b> plus a tip for speed.
          </p>
          <p className="mt-1">
            Walk or ride. A bike makes it much easier. Costs <b>{def.energy} energy</b>.
          </p>
        </div>
        {s.active && <p className="text-sm text-[#ffd12e]">You already have an active order. Follow the pink beacon.</p>}
        {s.energy < def.energy && <p className="text-sm text-[#ff9f9f]">You are too tired. Eat or sleep first.</p>}
        <Btn
          disabled={s.active || s.energy < def.energy}
          onClick={() => {
            closeModal()
            if (!engineRef.current?.startDelivery()) toast.error('No orders available right now')
            else toast('New order', { description: 'Head to the pink beacon to pick it up.' })
          }}
        >
          Take an order
        </Btn>
      </div>
    </Sheet>
  )
}

function JobGate({ m }: { m: PoiModal }) {
  const job = (m.poiKind === 'bus' ? 'bus' : m.poiKind) as JobId
  const def = JOBS.find((j) => j.id === job)!
  const s = useGame((g) => ({ rep: g.rep, time: g.time, energy: g.energy }))
  const lvl = levelFromRep(s.rep)
  const lockedLevel = lvl < def.level
  const dayBlock = job === 'dj' && !isNight(s.time)
  return (
    <Sheet title={m.label} subtitle={def.blurb} accent="#38ffd0">
      <div className="flex flex-col gap-3 pt-2">
        <div className="glass-light rounded-2xl p-3 text-sm">
          <p>
            Pay: <b>{fmtPayRange(def.pay)}</b>
          </p>
          <p className="mt-1">
            Needs reputation level <b>{def.level}</b>. Costs <b>{def.energy} energy</b>.
          </p>
        </div>
        {lockedLevel && <p className="text-sm text-[#ffd12e]">Reach reputation level {def.level} to unlock this job. Keep doing deliveries and helping people.</p>}
        {dayBlock && <p className="text-sm text-[#b8c4ff]">The lounge only books DJs at night. It is {clockText(s.time)} now. Come back after 19:30.</p>}
        <Btn disabled={lockedLevel || dayBlock || s.energy < def.energy} onClick={() => openModal({ kind: 'job', job })}>
          Start working
        </Btn>
      </div>
    </Sheet>
  )
}

function HomePanel({ m }: { m: PoiModal }) {
  const tier = m.extra ?? 1
  const have = useGame((g) => homeTier(g))
  const prop = PROPERTIES[tier - 1]
  return (
    <Sheet title={m.label} subtitle={prop.blurb} accent="#ff6b4a">
      {have >= tier ? (
        <div className="flex flex-col gap-3 pt-2">
          <p className="text-sm text-white/75">Sleeping skips to 7:00 the next morning and restores energy. Your best home sets how much.</p>
          <Btn onClick={() => {
              sleepHome()
            }}>Sleep until morning</Btn>
        </div>
      ) : (
        <PropertyList only={[tier - 1]} />
      )}
    </Sheet>
  )
}

function PropertyList({ only }: { only?: number[] }) {
  const s = useGame((g) => ({ local: g.businessesLocal, home: g.homeLocal, chain: g.chain.properties }))
  const rows: AssetRow[] = PROPERTIES.filter((p) => !only || only.includes(p.id)).map((p) => ({
    id: p.id,
    name: p.name,
    blurb: p.blurb,
    cash: p.cash,
    swatch: p.kind === 'home' ? '#ff6b4a' : p.kind === 'stall' ? '#8ad14b' : '#7b5cff',
    ownedLocal: p.kind === 'home' ? s.home >= p.tier : s.local.includes(p.id),
    ownedChain: s.chain.includes(p.id),
    tag: p.kind === 'home' ? `Home tier ${p.tier}` : p.kind === 'stall' ? 'Stall' : 'Shop',
    yieldText: p.hourly ? `Earns ${fmtCash(p.hourly)} per game hour while you play` : undefined,
  }))
  return <AssetList kind="property" rows={rows} onCash={(id) => buyLocal('property', id)} />
}

function PropertyPanel({ m }: { m: PoiModal }) {
  return (
    <Sheet title={m.label} subtitle="Rent rooms, buy homes and open your own business. Pay with in-game cash, or mint the deed as an NFT with testnet USDC." accent="#7be0ff">
      <PropertyList />
    </Sheet>
  )
}

function BusinessPanel({ m }: { m: PoiModal }) {
  const id = m.extra ?? 3
  const p = PROPERTIES[id]
  const s = useGame((g) => ({ owned: ownedProperties(g).includes(id), till: Math.floor(g.till[id] ?? 0) }))
  return (
    <Sheet title={m.label} subtitle={p.blurb} accent="#8ad14b">
      {s.owned && (
        <div className="glass-light mb-2 mt-2 flex items-center justify-between gap-3 rounded-2xl p-3">
          <div>
            <p className="text-sm text-white/65">Till</p>
            <p className="tnum font-display text-xl font-bold">{fmtCash(s.till)}</p>
          </div>
          <Btn small variant="gold" disabled={s.till <= 0} onClick={() => collectTill()}>
            Collect
          </Btn>
        </div>
      )}
      <PropertyList only={[id]} />
    </Sheet>
  )
}

function DealerPanel({ m }: { m: PoiModal }) {
  const s = useGame((g) => ({ local: g.vehiclesLocal, chain: g.chain.vehicles, active: g.activeVehicle, all: ownedVehicles(g) }))
  const rows: AssetRow[] = VEHICLES.map((v) => ({
    id: v.id,
    name: v.name,
    blurb: v.blurb,
    cash: v.cash,
    swatch: v.color,
    ownedLocal: s.local.includes(v.id),
    ownedChain: s.chain.includes(v.id),
    tag: `${v.speed} m/s`,
    extra: s.all.includes(v.id) ? (
      <Btn
        small
        variant="ghost"
        onClick={() => {
          setActiveVehicle(v.id)
          closeModal()
          const e = engineRef.current
          if (e?.riding) e.toggleVehicle()
          e?.toggleVehicle()
        }}
      >
        {s.active === v.id ? 'Ride again' : 'Ride this'}
      </Btn>
    ) : undefined,
  }))
  return (
    <Sheet title={m.label} subtitle="Each ride is faster than the last. Buy with cash, or mint it as an NFT with testnet USDC." accent="#ff2d78">
      <AssetList kind="vehicle" rows={rows} onCash={(id) => buyLocal('vehicle', id)} />
    </Sheet>
  )
}

function BoutiquePanel({ m }: { m: PoiModal }) {
  const [cat, setCat] = useState<0 | 1 | 2>(0)
  const s = useGame((g) => ({ local: g.outfitsLocal, chain: g.chain.outfits, wearing: g.wearing, all: ownedOutfits(g) }))
  const slot = (['outfit', 'hair', 'acc'] as const)[cat]
  const rows: AssetRow[] = OUTFITS.filter((o) => o.category === cat).map((o) => ({
    id: o.id,
    name: o.name,
    blurb: cat === 0 ? 'Changes her clothes. Face, hair, glasses and hoops stay.' : cat === 1 ? 'A new look for her hair.' : 'An extra touch on top of the signature look.',
    cash: o.cash,
    swatch: o.top || o.accent,
    ownedLocal: s.local.includes(o.id),
    ownedChain: s.chain.includes(o.id),
    extra: s.all.includes(o.id) ? (
      <Btn small variant="ghost" onClick={() => wear(slot, s.wearing[slot] === o.id ? -1 : o.id)}>
        {s.wearing[slot] === o.id ? 'Take off' : 'Wear'}
      </Btn>
    ) : undefined,
  }))
  return (
    <Sheet title={m.label} subtitle="Wearables you can mint as NFTs and trade." accent="#e8478b">
      <div className="mb-1 mt-2 flex gap-2">
        {CATEGORY_NAMES.map((n, i) => (
          <button key={n} onClick={() => setCat(i as 0 | 1 | 2)} className={`min-h-11 flex-1 rounded-xl text-sm font-bold ${cat === i ? 'bg-[#e8478b]' : 'glass-light'}`}>
            {n}
          </button>
        ))}
      </div>
      <AssetList kind="outfit" rows={rows} onCash={(id) => buyLocal('outfit', id)} />
    </Sheet>
  )
}

function BenchPanel({ m }: { m: PoiModal }) {
  return (
    <Sheet title={m.label} subtitle="Catch your breath by the sea." accent="#c9ced6">
      <div className="flex flex-col gap-3 pt-2">
        <p className="text-sm text-white/75">One hour of rest gives a little energy back. A real bed is better.</p>
        <Btn
          onClick={() => {
            setState((s) => ({ energy: Math.min(100, s.energy + 8), hunger: Math.max(0, s.hunger - 3), time: (s.time + 1) % 24 }))
            toast('You rested for an hour', { description: 'Energy +8' })
          }}
        >
          Rest for 1 hour
        </Btn>
        <Tag>Time {clockText(getState().time)}</Tag>
      </div>
    </Sheet>
  )
}
