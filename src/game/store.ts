import { useRef, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { music } from './audio'
import { MISSIONS } from './missions'
import {
  FOODS,
  HOME_NAMES,
  JOBS,
  OUTFITS,
  PROPERTIES,
  SECONDS_PER_HOUR,
  VEHICLES,
  levelFromRep,
  MARKET_GOODS,
  type FoodDef,
  type GoodsId,
  type StallTheme,
  type JobId,
} from './data'

export type PoiKind =
  | 'food'
  | 'delivery'
  | 'bus'
  | 'stall'
  | 'repair'
  | 'dj'
  | 'home'
  | 'agent'
  | 'dealer'
  | 'boutique'
  | 'broker'
  | 'trade'
  | 'leaderboard'
  | 'business'
  | 'bench'

export interface PortraitLook {
  skin: string
  hair: string
  hairStyle: string
  top: string
  accent: string
  kind: 'female' | 'male' | 'child'
  elder: boolean
}

export interface NpcMemory {
  met: number
  lastDay: number
  flags: string[]
}

export type PhoneTab = 'jobs' | 'map' | 'inventory' | 'wallet'

export type Modal =
  | { kind: 'phone'; tab: PhoneTab }
  | { kind: 'npc'; npcId: string; name: string; persona: string; look: PortraitLook; canHelp: boolean; goods?: StallTheme }
  | { kind: 'poi'; poiId: string; poiKind: PoiKind; label: string; extra?: number }
  | { kind: 'job'; job: JobId }
  | null

export interface DeliveryState {
  from: string
  to: string
  phase: 'pickup' | 'dropoff'
  timeLeft: number
  reward: number
  dist: number
}

export interface Wearing {
  outfit: number
  hair: number
  acc: number
}

export interface GameState {
  started: boolean
  cash: number
  energy: number
  hunger: number
  rep: number
  /** hour of day 0..24 */
  time: number
  day: number
  homeLocal: number
  vehiclesLocal: number[]
  activeVehicle: number
  businessesLocal: number[]
  till: Record<number, number>
  outfitsLocal: number[]
  wearing: Wearing
  helped: Record<string, number>
  jobsDone: number
  muted: boolean
  volume: number
  voiceOn: boolean
  npcMemory: Record<string, NpcMemory>
  missions: Record<string, 'active' | 'done'>
  /** market goods she has bought, by id */
  bag: Partial<Record<GoodsId, number>>
  discount: { pct: number; day: number } | null
  guide: { label: string; x: number; z: number } | null
  chain: { properties: number[]; vehicles: number[]; outfits: number[] }
  modal: Modal
  delivery: DeliveryState | null
  prompt: string | null
  district: string
  lockedMsg: string | null
}

const SAVE_KEY = 'wildcityph.save.v1'
const OLD_SAVE_KEY = 'vyrox.save.v1'
const PERSIST: (keyof GameState)[] = [
  'cash',
  'energy',
  'hunger',
  'rep',
  'time',
  'day',
  'homeLocal',
  'vehiclesLocal',
  'activeVehicle',
  'businessesLocal',
  'till',
  'outfitsLocal',
  'wearing',
  'helped',
  'jobsDone',
  'muted',
  'volume',
  'voiceOn',
  'npcMemory',
  'missions',
  'bag',
  'discount',
]

const initial: GameState = {
  started: false,
  cash: 120,
  energy: 90,
  hunger: 70,
  rep: 0,
  time: realHour(),
  day: 1,
  homeLocal: 0,
  vehiclesLocal: [],
  activeVehicle: -1,
  businessesLocal: [],
  till: {},
  outfitsLocal: [],
  wearing: { outfit: -1, hair: -1, acc: -1 },
  helped: {},
  jobsDone: 0,
  muted: false,
  volume: 0.8,
  voiceOn: true,
  npcMemory: {},
  missions: {},
  bag: {},
  discount: null,
  guide: null,
  chain: { properties: [], vehicles: [], outfits: [] },
  modal: null,
  delivery: null,
  prompt: null,
  district: 'Market District',
  lockedMsg: null,
}

function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? localStorage.getItem(OLD_SAVE_KEY)
    if (raw) return { ...initial, ...(JSON.parse(raw) as Partial<GameState>) }
  } catch {
    /* ignore corrupt save */
  }
  return initial
}

let state: GameState = load()
const listeners = new Set<() => void>()
let saveTimer = 0

export const getState = () => state
export const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function setState(p: Partial<GameState> | ((s: GameState) => Partial<GameState>)) {
  const patch = typeof p === 'function' ? p(state) : p
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
  if (!saveTimer) {
    saveTimer = window.setTimeout(() => {
      saveTimer = 0
      const out: Record<string, unknown> = {}
      for (const k of PERSIST) out[k] = state[k]
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(out))
      } catch {
        /* storage full */
      }
    }, 1500)
  }
}

export function resetSave() {
  localStorage.removeItem(SAVE_KEY)
  localStorage.removeItem(OLD_SAVE_KEY)
  state = { ...initial, started: true }
  listeners.forEach((l) => l())
}

const shallowEq = (a: unknown, b: unknown) => {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

export function useGame<T>(sel: (s: GameState) => T): T {
  const cache = useRef<T | undefined>(undefined)
  return useSyncExternalStore(subscribe, () => {
    const v = sel(state)
    if (cache.current !== undefined && shallowEq(v, cache.current)) return cache.current
    cache.current = v
    return v
  })
}

/* ---------- derived ---------- */
const union = (a: number[], b: number[]) => Array.from(new Set([...a, ...b]))
export const ownedVehicles = (s: GameState) => union(s.vehiclesLocal, s.chain.vehicles)
export const ownedOutfits = (s: GameState) => union(s.outfitsLocal, s.chain.outfits)
export const ownedProperties = (s: GameState) => union(s.businessesLocal, s.chain.properties)
export const homeTier = (s: GameState) => {
  let t = s.homeLocal
  for (const id of s.chain.properties) {
    const p = PROPERTIES[id]
    if (p && p.kind === 'home') t = Math.max(t, p.tier)
  }
  return t
}
export const businessIds = (s: GameState) =>
  ownedProperties(s).filter((id) => PROPERTIES[id] && PROPERTIES[id].kind !== 'home')
export const level = (s: GameState) => levelFromRep(s.rep)
export function netWorth(s: GameState) {
  let w = s.cash
  for (const id of ownedProperties(s)) w += PROPERTIES[id]?.cash ?? 0
  if (homeTier(s) > 0) w += PROPERTIES.find((p) => p.kind === 'home' && p.tier === homeTier(s))?.cash ?? 0
  for (const id of ownedVehicles(s)) w += VEHICLES[id]?.cash ?? 0
  for (const id of ownedOutfits(s)) w += OUTFITS[id]?.cash ?? 0
  return Math.floor(w)
}
/** what she earns is paid out in USDC: game amounts convert at 200 per USDC */
export const USDC_PER_CASH = 0.005
export const cashUsdc = (n: number) => Math.floor(n) * USDC_PER_CASH
export const fmtCash = (n: number) => `${cashUsdc(n).toFixed(2)} USDC`
/** "60 to 160" in game amounts, as USDC */
export const fmtPayRange = (r: string | number) => String(r).replace(/\d+/g, (d) => (Number(d) * USDC_PER_CASH).toFixed(2)) + ' USDC'
export const clockText = (t: number) => {
  const h = Math.floor(t) % 24
  const m = Math.floor((t % 1) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
export const isNight = (t: number) => t >= 19.5 || t < 5.5

/* ---------- actions ---------- */
export const openModal = (m: Modal) => setState({ modal: m })
export const closeModal = () => setState({ modal: null })

export function earn(cash: number, rep: number, msg?: string) {
  setState((s) => ({ cash: s.cash + cash, rep: s.rep + rep }))
  music.sfx('coin')
  const before = levelFromRep(getState().rep - rep)
  const after = levelFromRep(getState().rep)
  toast.success(msg ?? `Earned ${fmtCash(cash)}`, { description: rep ? `+${rep} reputation` : undefined })
  if (after > before) toast(`Reputation level ${after}`, { description: 'New jobs and districts unlocked.' })
}

export function spend(cost: number): boolean {
  if (getState().cash < cost) {
    toast.error('Not enough cash', { description: `You need ${fmtCash(cost)}.` })
    return false
  }
  setState((s) => ({ cash: s.cash - cost }))
  return true
}

/** Food price after any bargaining discount earned today. */
export function foodCost(s: GameState, food: FoodDef) {
  const d = s.discount && s.discount.day === s.day ? s.discount.pct : 0
  return Math.max(1, Math.round(food.cost * (1 - d / 100)))
}

export function eat(food: FoodDef) {
  if (!spend(foodCost(getState(), food))) return
  setState((s) => ({
    hunger: Math.min(100, s.hunger + food.hunger),
    energy: Math.min(100, s.energy + food.energy),
  }))
  toast(`Ate ${food.name}`, { description: `Hunger +${food.hunger}` })
}

export function sleepHome(): boolean {
  const s = getState()
  const tier = homeTier(s)
  if (tier === 0) {
    toast.error('You have no home yet', { description: 'Rent a room at the Homes Agent in the plaza, or from Mama Ngozi.' })
    return false
  }
  const restore = [0, 70, 90, 100][tier]
  setState((st) => ({
    energy: Math.min(100, Math.max(st.energy, 0) + restore),
    hunger: Math.max(10, st.hunger - 18),
    day: st.day + 1,
    modal: null,
  }))
  toast.success(`Slept at your ${HOME_NAMES[tier]}`, { description: 'Energy restored.' })
  return true
}

export function buyLocal(kind: 'vehicle' | 'property' | 'outfit', id: number): boolean {
  const s = getState()
  if (kind === 'vehicle') {
    const v = VEHICLES[id]
    if (ownedVehicles(s).includes(id)) return false
    if (!spend(v.cash)) return false
    setState((st) => ({ vehiclesLocal: [...st.vehiclesLocal, id], activeVehicle: id }))
    toast.success(`${v.name} is yours`, { description: 'Press V or tap the ride button to hop on.' })
    return true
  }
  if (kind === 'property') {
    const p = PROPERTIES[id]
    if (ownedProperties(s).includes(id) || (p.kind === 'home' && homeTier(s) >= p.tier)) return false
    if (!spend(p.cash)) return false
    if (p.kind === 'home') setState({ homeLocal: p.tier })
    else setState((st) => ({ businessesLocal: [...st.businessesLocal, id] }))
    toast.success(`${p.name} acquired`)
    return true
  }
  const o = OUTFITS[id]
  if (ownedOutfits(s).includes(id)) return false
  if (!spend(o.cash)) return false
  setState((st) => ({ outfitsLocal: [...st.outfitsLocal, id] }))
  toast.success(`${o.name} added to your wardrobe`)
  return true
}

export function wear(slot: keyof Wearing, id: number) {
  setState((s) => ({ wearing: { ...s.wearing, [slot]: id } }))
}

export function collectTill() {
  const s = getState()
  const total = Math.floor(Object.values(s.till).reduce((a, b) => a + b, 0))
  if (total <= 0) {
    toast('Nothing to collect yet')
    return
  }
  setState((st) => ({ cash: st.cash + total, till: {} }))
  toast.success(`Collected ${fmtCash(total)} from your businesses`)
}

export function setActiveVehicle(id: number) {
  setState({ activeVehicle: id })
}

export function jobUnlocked(job: JobId, rep: number) {
  const def = JOBS.find((j) => j.id === job)
  return !!def && levelFromRep(rep) >= def.level
}

/* ---------- clock + needs (called by engine every frame) ---------- */
let acc = 0
/** the clock on the phone: morning in the game when it is morning where she is playing */
export function realHour() {
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}
/** play time still counts days (needs, rent, business takings run faster than real time) */
let dayAcc = 0
const pend = { hours: 0, hunger: 0, energy: 0, till: {} as Record<number, number> }
export function tickClock(dt: number, riding: boolean) {
  acc += dt
  const hours = dt / SECONDS_PER_HOUR
  const hungry = state.hunger < 15
  pend.hours += hours
  pend.hunger -= 4 * hours
  pend.energy -= (3 + (hungry ? 3 : 0) + (riding ? 0.5 : 0)) * hours
  for (const id of businessIds(state)) {
    const p = PROPERTIES[id]
    pend.till[id] = (pend.till[id] ?? 0) + p.hourly * hours
  }
  if (acc < 0.25) return
  acc = 0
  const d = { ...pend, till: { ...pend.till } }
  pend.hours = 0
  pend.hunger = 0
  pend.energy = 0
  pend.till = {}
  setState((s) => {
    dayAcc += d.hours
    const days = Math.floor(dayAcc / 24)
    dayAcc -= days * 24
    const till = { ...s.till }
    for (const k of Object.keys(d.till)) {
      const id = Number(k)
      till[id] = Math.min(PROPERTIES[id].hourly * 24, (till[id] ?? 0) + d.till[id])
    }
    return {
      time: realHour(),
      day: s.day + days,
      hunger: Math.min(100, Math.max(0, s.hunger + d.hunger)),
      energy: Math.min(100, Math.max(0, s.energy + d.energy)),
      till,
    }
  })
}
export const FOOD_LIST = FOODS

/* ---------- missions unlocked in conversation ---------- */
export function startMission(id: string) {
  const m = MISSIONS[id]
  if (!m || getState().missions[id]) return
  setState((s) => ({ missions: { ...s.missions, [id]: 'active' } }))
  toast('New mission', { description: m.title })
}

export function completeMission(id: string) {
  const m = MISSIONS[id]
  if (!m || getState().missions[id] !== 'active') return
  setState((s) => ({ missions: { ...s.missions, [id]: 'done' } }))
  earn(m.cash, m.rep, `Mission complete: ${m.title}`)
}

/* ---------- market goods in her bag ---------- */
export function addToBag(id: GoodsId, n = 1) {
  setState((s) => ({ bag: { ...s.bag, [id]: (s.bag[id] ?? 0) + n } }))
  toast.success(`${MARKET_GOODS[id].name} added to your bag`, { description: 'Open your phone → Items to use it.' })
}

export function eatFromBag(id: GoodsId) {
  const s = getState()
  if (!s.bag[id]) return
  const g = MARKET_GOODS[id]
  setState((st) => ({
    bag: { ...st.bag, [id]: Math.max(0, (st.bag[id] ?? 0) - 1) },
    hunger: Math.min(100, st.hunger + g.hunger),
    energy: Math.min(100, st.energy + g.energy),
  }))
  toast.success(g.use, { description: `Hunger +${g.hunger}${g.energy ? ` · Energy +${g.energy}` : ''}` })
}
