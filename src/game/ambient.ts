import * as THREE from 'three'
import { FEMALE_NAMES, MALE_NAMES, NPC_LINES, blockCenter, isFood, type StallTheme } from './data'
import { bubbles } from './bubbles'
import { PERSONAS } from './dialogue'
import type { PortraitLook } from './store'
import { Human, makeImpostor, type HairStyle, type Look } from './human'
import type { Templates } from './loader'
import { ankaraTexture } from './textures'
import { makeBus, makeCar, makeKeke, makeOkada } from './vehicles'
import { mulberry, type Spot } from './worldTypes'

export interface Npc {
  id: string
  name: string
  line: string
  /** personality id from dialogue.ts PERSONAS */
  persona: string
  /** what their stall sells, for vendors at a market stall */
  goods?: StallTheme
  portrait: PortraitLook
  /** standing height in metres, for speech bubbles */
  h: number
  human: Human
  imp: THREE.Mesh
  role: 'walker' | 'vendor' | 'chatter' | 'sitter'
  mode: 'loop' | 'still'
  x: number
  z: number
  heading: number
  bx: number
  bz: number
  s: number
  dir: number
  speed: number
  pause: number
  canHelp: boolean
  /** 0 full, 1 reduced animation rate, 2 distant stand-in, 3 hidden */
  tier: number
  visible: boolean
  cool: number
  talkT: number
  beat: number
  speaking: boolean
  talkingToPlayer: boolean
}

export interface PlayerCtx {
  x: number
  z: number
  speed: number
  riding: boolean
  talkId: string | null
}
export interface Budget {
  full: number
  mid: number
}

const HALF_LOOP = 18.4
const PERIM = HALF_LOOP * 8

function loopPos(bx: number, bz: number, s: number) {
  const side = HALF_LOOP * 2
  const u = ((s % PERIM) + PERIM) % PERIM
  const e = Math.floor(u / side)
  const f = u - e * side
  const h = HALF_LOOP
  if (e === 0) return { x: bx - h + f, z: bz - h }
  if (e === 1) return { x: bx + h, z: bz - h + f }
  if (e === 2) return { x: bx + h - f, z: bz + h }
  return { x: bx - h, z: bz + h - f }
}

const SKINS = ['#5a3a29', '#6f4630', '#7d4e33', '#8a5a3b', '#a56b43', '#b9825a', '#c89468']
const BRIGHT = ['#ffcf2e', '#27c1a8', '#ff6b4a', '#4a8fe8', '#e8478b', '#8ad14b', '#ff9f1c', '#b04fe8', '#f4f1ea']
const JEANS = ['#2b3a67', '#3a4a7a', '#1f1f2a', '#6b5a43', '#254d3b']
const WRAPS = ['#ff4d6d', '#ffb703', '#2ec4b6', '#8338ec', '#f77f00']

const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length)]

type Kind = 'female' | 'male' | 'child'
interface Person {
  kind: Kind
  look: Look
  /** walking pace multiplier */
  pace: number
  desc: string
}

function makePerson(r: () => number, role: Npc['role']): Person {
  const roll = r()
  // the people selling are grown-ups
  const kind: Kind = roll < 0.09 && role !== 'vendor' ? 'child' : r() < 0.52 ? 'female' : 'male'
  const elder = kind !== 'child' && r() < 0.14
  const skin = pick(SKINS, r)
  const look: Look = {
    skin,
    hair: elder ? '#cfcfcf' : '#0b0b10',
    hairStyle: 'short',
    top: pick(BRIGHT, r),
    bottom: pick(JEANS, r),
    shoes: pick(['#2a2a2e', '#f4f4f8', '#6b4423', '#c0392b'], r),
    accent: pick(BRIGHT, r),
    width: 0.9 + r() * 0.3,
    height: kind === 'child' ? 1.1 + r() * 0.2 : kind === 'female' ? 1.58 + r() * 0.14 : 1.7 + r() * 0.16,
    trim: false,
  }
  if (elder) look.height! -= 0.04
  if (kind === 'child') look.width = 0.92 + r() * 0.12
  // outfits: ankara, casual, work uniform, market trader
  const outfit = role === 'vendor' ? 'trader' : pick(['ankara', 'ankara', 'casual', 'casual', 'uniform'] as const, r)
  let desc = 'casual'
  if (outfit === 'ankara' && kind !== 'child') {
    look.topMap = ankaraTexture(Math.floor(r() * 6))
    look.long = kind === 'female'
    if (kind === 'male') look.bottom = '#1f1f2a'
    desc = 'ankara'
  } else if (outfit === 'uniform' && kind !== 'child') {
    look.top = pick(['#f4f1ea', '#8fb4e8', '#1f3a6b'], r)
    look.bottom = '#1f1f2a'
    look.shoes = '#1a1a1a'
    look.apron = r() < 0.5
    look.accent = '#ff7a00'
    desc = 'uniform'
  } else if (outfit === 'trader') {
    look.apron = true
    look.accent = pick(['#ffffff', '#ffd12e', '#ff4d6d', '#2ec4b6'], r)
    look.topMap = r() < 0.4 ? ankaraTexture(Math.floor(r() * 6)) : null
    look.long = kind === 'female' && r() < 0.6
    desc = 'trader'
  }
  const styles: HairStyle[] =
    kind === 'child' ? ['puffs', 'short', 'short', 'braids'] : kind === 'female' ? ['wrap', 'braids', 'puffs', 'curls', 'short', 'bob', 'wrap'] : ['short', 'afro', 'short', 'bald', 'short']
  look.hairStyle = elder && r() < 0.4 ? 'bald' : pick(styles, r)
  if (look.hairStyle === 'wrap') look.accent = pick(WRAPS, r)
  if (look.hairStyle === 'wrap' && look.apron) look.apron = true
  const pace = elder ? 0.55 : kind === 'child' ? 1.25 : 0.85 + r() * 0.3
  return { kind, look, pace, desc }
}

const ROLE_PERSONAS: Record<Npc['role'], string[]> = {
  vendor: ['marketwoman', 'marketwoman', 'mamaput', 'repairer', 'shopowner'],
  walker: ['okadarider', 'student', 'areaboy', 'pastor', 'shopowner'],
  chatter: ['areaboy', 'marketwoman', 'student', 'okadarider', 'mamaput'],
  sitter: ['pastor', 'student', 'areaboy', 'okadarider'],
}

function personaFor(role: Npc['role'], kind: Kind, r: () => number) {
  if (kind === 'child') return 'student'
  return pick(ROLE_PERSONAS[role], r)
}

/** One short line for a speech bubble, from this person's personality. */
export function streetLine(n: Npc) {
  const p = PERSONAS[n.persona]
  const list = p?.street?.length ? p.street : NPC_LINES
  return list[Math.floor(Math.random() * list.length)]
}

export function spawnNpcs(scene: THREE.Group, spots: Spot[], tpl: Templates): Npc[] {
  const r = mulberry(99)
  const npcs: Npc[] = []
  const used = new Set<string>()
  const name = (female: boolean) => {
    const list = female ? FEMALE_NAMES : MALE_NAMES
    for (let k = 0; k < 20; k++) {
      const n = list[Math.floor(r() * list.length)]
      if (!used.has(n)) {
        used.add(n)
        return n
      }
    }
    return list[Math.floor(r() * list.length)]
  }
  const add = (role: Npc['role'], x: number, z: number, heading: number, extra: Partial<Npc> = {}) => {
    const person = makePerson(r, role)
    // mostly realistic townspeople when those models are available, with some of the classic ones mixed in
    const real = person.kind === 'child' ? [] : tpl.variants[person.kind]
    const useReal = real.length > 0 && r() < 0.92
    if (useReal) person.look.width = 0.97 + r() * 0.06
    const human = new Human(useReal ? real[Math.floor(r() * real.length)] : tpl[person.kind], person.look)
    const imp = makeImpostor(person.look.top, person.look.height)
    imp.visible = false
    human.group.visible = false
    scene.add(human.group, imp)
    const npc: Npc = {
      id: `npc-${npcs.length}`,
      name: name(person.kind === 'female' || (person.kind === 'child' && r() < 0.5)),
      line: NPC_LINES[Math.floor(r() * NPC_LINES.length)],
      persona: personaFor(role, person.kind, r),
      portrait: {
        skin: person.look.skin,
        hair: person.look.hair,
        hairStyle: person.look.hairStyle,
        top: person.look.top,
        accent: person.look.accent,
        kind: person.kind,
        elder: person.look.hair === '#cfcfcf',
      },
      h: person.look.height ?? 1.7,
      human,
      imp,
      role,
      mode: 'still',
      x,
      z,
      heading,
      bx: 0,
      bz: 0,
      s: 0,
      dir: 1,
      speed: 0,
      pause: 0,
      canHelp: r() < 0.7,
      tier: 3,
      visible: false,
      cool: r() * 10,
      talkT: 0,
      beat: r() * 6,
      speaking: r() < 0.5,
      talkingToPlayer: false,
      ...extra,
    }
    human.group.position.set(x, 0, z)
    human.group.rotation.y = heading
    imp.position.set(x, 0, z)
    npcs.push(npc)
    return { npc, person }
  }

  for (let k = 0; k < 28; k++) {
    const i = Math.floor(r() * 7)
    const j = Math.floor(r() * 6)
    const { x, z } = blockCenter(i, j)
    const s = r() * PERIM
    const p = loopPos(x, z, s)
    const { npc, person: pp } = add('walker', p.x, p.z, 0, { mode: 'loop', bx: x, bz: z, s, dir: r() < 0.5 ? 1 : -1 })
    npc.speed = (pp.kind === 'child' ? 1.9 : 1.35) * pp.pace + r() * 0.3
  }
  let vendors = 0
  let sitters = 0
  for (const sp of spots) {
    if (sp.kind === 'vendor') {
      // every food spot has its cook; ordinary stalls are filled now and then
      const food = !!sp.goods && isFood(sp.goods)
      if (!food && (vendors >= 34 || r() < 0.45)) continue
      vendors++
      const v = add('vendor', sp.x, sp.z, sp.ry, sp.goods ? { goods: sp.goods } : {})
      if (sp.goods) v.npc.persona = food ? 'mamaput' : r() < 0.85 ? 'marketwoman' : 'mamaput'
    } else if (sp.kind === 'chatter') {
      add('chatter', sp.x, sp.z, sp.ry)
    } else if (sp.kind === 'sitter') {
      if (sitters >= 10 || r() < 0.4) continue
      sitters++
      add('sitter', sp.x, sp.z, sp.ry)
    }
  }
  return npcs
}

const turn = (cur: number, want: number, k: number) => {
  let d = want - cur
  d = Math.atan2(Math.sin(d), Math.cos(d))
  return cur + d * Math.min(1, k)
}

export function updateNpcs(npcs: Npc[], dt: number, pl: PlayerCtx, budget: Budget, tierTick: boolean) {
  if (tierTick) {
    const order = npcs
      .map((n) => ({ n, d: Math.hypot(n.x - pl.x, n.z - pl.z) }))
      .sort((a, b) => a.d - b.d)
    let full = 0
    let mid = 0
    for (const { n, d } of order) {
      let tier = 3
      if (d < 26 && full < budget.full) {
        tier = 0
        full++
      } else if (d < 50 && mid < budget.mid) {
        tier = 1
        mid++
      } else if (d < 100) tier = 2
      if (tier !== n.tier) {
        n.tier = tier
        n.human.group.visible = tier < 2
        n.imp.visible = tier === 2
        n.visible = tier < 3
        n.human.setCast(tier === 0)
      }
    }
  }

  for (const n of npcs) {
    const dx = pl.x - n.x
    const dz = pl.z - n.z
    const dist = Math.hypot(dx, dz)
    const toPlayer = Math.atan2(dx, dz)
    n.cool -= dt
    n.talkT -= dt
    let moving = false

    if (pl.talkId === n.id) {
      n.talkingToPlayer = true
      n.heading = turn(n.heading, toPlayer, dt * 6)
      n.talkT = 0.4
    } else n.talkingToPlayer = false

    if (n.mode === 'loop') {
      // react to the player: greet when close and slow, glance when a vehicle whooshes past
      if (n.pause <= 0 && n.cool <= 0 && !n.talkingToPlayer) {
        if (dist < 3.2 && pl.speed < 3.5) {
          n.pause = 2.4
          n.talkT = 1.8
          n.cool = 24
          if (n.tier === 0 && !pl.talkId) bubbles.show(n.human.group, n.h, streetLine(n), 2.6)
        } else if (dist < 6 && pl.speed > 7) {
          n.pause = 1.2
          n.cool = 12
        }
      }
      if (n.pause > 0) {
        n.pause -= dt
        if (dist < 9) n.heading = turn(n.heading, toPlayer, dt * 5)
      } else if (!n.talkingToPlayer) {
        n.s += n.dir * n.speed * dt
        const p = loopPos(n.bx, n.bz, n.s)
        const hx = p.x - n.x
        const hz = p.z - n.z
        if (hx * hx + hz * hz > 1e-6) n.heading = turn(n.heading, Math.atan2(hx, hz), dt * 7)
        n.x = p.x
        n.z = p.z
        moving = true
      }
    } else if (n.role === 'vendor') {
      if (dist < 6.5) {
        n.heading = turn(n.heading, toPlayer, dt * 4)
        n.talkT = Math.max(n.talkT, 0.3)
      }
    } else if (n.role === 'chatter') {
      n.beat -= dt
      if (n.beat <= 0) {
        n.speaking = !n.speaking
        n.beat = 3.5 + Math.random() * 4
        // groups of chatters take turns, so it reads as a real conversation
        if (n.speaking && n.tier === 0 && !pl.talkId && dist < 24 && !n.talkingToPlayer) bubbles.show(n.human.group, n.h, streetLine(n), 3.2)
      }
      if (n.speaking) n.talkT = Math.max(n.talkT, 0.2)
      if (dist < 4 && !n.talkingToPlayer) n.heading = turn(n.heading, toPlayer, dt * 2)
    }

    // visuals
    if (n.tier === 3) continue
    const g = n.human.group
    if (n.tier === 2) {
      n.imp.position.set(n.x, 0, n.z)
      n.imp.rotation.y = n.heading
      continue
    }
    g.position.set(n.x, 0, n.z)
    g.rotation.y = turn(g.rotation.y, n.heading, dt * 10)
    const h = n.human
    if (n.role === 'sitter') h.play('sit', 0.2)
    else if (moving) h.locomote(n.speed, 0.25)
    else if (n.talkT > 0 || (n.role === 'vendor' && n.speaking)) h.play(h.has('talk') ? 'talk' : 'idle', 0.3)
    else h.play('idle', 0.3)
    if (n.role === 'vendor') {
      n.beat -= dt
      if (n.beat <= 0) {
        n.speaking = !n.speaking
        n.beat = n.speaking ? 2 + Math.random() * 2 : 5 + Math.random() * 6
        if (n.speaking && n.tier === 0 && !pl.talkId && dist < 16 && !n.talkingToPlayer) bubbles.show(n.human.group, n.h, streetLine(n), 2.4)
      }
    }
    h.update(dt, n.tier === 1 ? 1 / 12 : 0)
  }
}

/* ---------------- traffic ---------------- */
export interface TrafficCar {
  group: THREE.Group
  path: THREE.Vector2[]
  lens: number[]
  total: number
  s: number
  speed: number
  cur: number
  x: number
  z: number
  /** the okada man or keke driver (and sometimes a passenger), holding the handlebar */
  riders: { h: Human; grips?: [THREE.Vector3, THREE.Vector3] }[]
  tick: number
}

/** handlebar grips, in the vehicle's own space: [left hand, right hand] (facing +z, left is +x) */
const GRIPS = {
  okada: [new THREE.Vector3(0.36, 1.1, 0.7), new THREE.Vector3(-0.36, 1.1, 0.7)] as [THREE.Vector3, THREE.Vector3],
  keke: [new THREE.Vector3(0.3, 1.15, 0.4), new THREE.Vector3(-0.3, 1.15, 0.4)] as [THREE.Vector3, THREE.Vector3],
}

const LOOPS: [number, number][][] = [
  [[-75, -100], [75, -100], [75, 50], [-75, 50]],
  [[-125, 0], [125, 0], [125, 100], [-125, 100]],
  [[-175, -50], [-25, -50], [-25, 100], [-175, 100]],
  [[25, -50], [175, -50], [175, 100], [25, 100]],
]

export function spawnTraffic(scene: THREE.Group, tpl?: Templates): TrafficCar[] {
  const out: TrafficCar[] = []
  const r = mulberry(404)
  /** a seated person on the vehicle: real townspeople models when loaded */
  const sitter = (female: boolean, group: THREE.Group, x: number, y: number, z: number) => {
    if (!tpl) return null
    let person = makePerson(r, 'walker')
    for (let k = 0; k < 12 && person.kind !== (female ? 'female' : 'male'); k++) person = makePerson(r, 'walker')
    if (person.kind === 'child') return null
    const real = tpl.variants[person.kind]
    const h = new Human(real.length ? real[Math.floor(r() * real.length)] : tpl[person.kind], person.look)
    h.group.position.set(x, y - 0.45, z)
    h.play('drive', 0)
    h.update(0.01)
    group.add(h.group)
    return h
  }
  const make = (kind: 'bus' | 'okada' | 'keke' | 'car', li: number, phase: number) => {
    const pts = LOOPS[li].map(([x, z]) => new THREE.Vector2(x, z))
    const lens = pts.map((p, i) => p.distanceTo(pts[(i + 1) % pts.length]))
    const total = lens.reduce((a, b) => a + b, 0)
    const CAR_COLS = ['#c9ccd2', '#1d1f24', '#f2f2f0', '#7a1f24', '#24406b', '#8a8f96']
    const group =
      kind === 'bus'
        ? makeBus()
        : kind === 'okada'
          ? makeOkada(r() < 0.5 ? '#ff7a1a' : '#c0392b').group
          : kind === 'car'
            ? makeCar(CAR_COLS[Math.floor(r() * CAR_COLS.length)]).group
            : makeKeke(r() < 0.6 ? '#ffd12e' : '#2ec4b6').group
    group.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true
    })
    scene.add(group)
    const riders: TrafficCar['riders'] = []
    if (kind === 'okada') {
      // okada men are men; half of them are carrying a passenger behind
      const d = sitter(false, group, 0, 0.88, -0.35)
      if (d) riders.push({ h: d, grips: GRIPS.okada })
      if (r() < 0.55) {
        const p = sitter(r() < 0.6, group, 0, 0.93, -0.72)
        if (p) riders.push({ h: p })
      }
    } else if (kind === 'keke') {
      const d = sitter(r() < 0.1, group, 0, 0.75, 0.15)
      if (d) riders.push({ h: d, grips: GRIPS.keke })
    }
    out.push({ group, path: pts, lens, total, s: phase * total, speed: kind === 'bus' ? 7 : kind === 'okada' ? 10 : kind === 'car' ? 9 : 8, cur: 0, x: 0, z: 0, riders, tick: r() })
  }
  for (let li = 0; li < 4; li++) {
    make('bus', li, 0.1)
    make('okada', li, 0.35 + r() * 0.1)
    make('keke', li, 0.6 + r() * 0.1)
    make('okada', li, 0.85)
    if (li % 2 === 0) make('bus', li, 0.55)
    make('car', li, 0.22 + r() * 0.05)
    make('car', li, 0.72 + r() * 0.05)
  }
  return out
}

export function updateTraffic(cars: TrafficCar[], dt: number, px: number, pz: number) {
  for (const c of cars) {
    let u = c.s % c.total
    let i = 0
    while (u > c.lens[i]) {
      u -= c.lens[i]
      i++
    }
    const a = c.path[i]
    const b = c.path[(i + 1) % c.path.length]
    const dx = (b.x - a.x) / c.lens[i]
    const dz = (b.y - a.y) / c.lens[i]
    const x = a.x + dx * u - dz * 2.4
    const z = a.y + dz * u + dx * 2.4
    const rx = px - x
    const rz = pz - z
    const ahead = rx * dx + rz * dz
    const side = Math.abs(rx * dz - rz * dx)
    const blocked = ahead > 0 && ahead < 9 && side < 2.6
    c.cur += ((blocked ? 0 : c.speed) - c.cur) * Math.min(1, dt * 3)
    c.s += c.cur * dt
    c.x = x
    c.z = z
    c.group.visible = (x - px) ** 2 + (z - pz) ** 2 < 150 * 150
    c.group.position.set(x, 0, z)
    c.group.rotation.y = Math.atan2(dx, dz)
    // riders only need posing when someone could see them up close
    const near = c.group.visible && (x - px) ** 2 + (z - pz) ** 2 < 70 * 70
    for (const rd of c.riders) rd.h.group.visible = c.group.visible
    if (near && c.riders.length) {
      c.tick += dt
      if (c.tick >= 1 / 15) {
        c.group.updateMatrixWorld(true)
        for (const rd of c.riders) {
          if (rd.grips) {
            const [lg, rg] = rd.grips
            rd.h.reachLeft = { target: c.group.localToWorld(lg.clone()), w: 1 }
            rd.h.reach = { target: c.group.localToWorld(rg.clone()), w: 1 }
          }
          rd.h.update(c.tick)
        }
        c.tick = 0
      }
    }
  }
}
