import { blockCenter, districtOfBlock } from './data'
import {
  addCollider,
  addPoi,
  awningRow,
  bin,
  busStop,
  hydrant,
  powerPole,
  barberPole,
  bench,
  billboard,
  building,
  fountain,
  front,
  house,
  kiosk,
  lampPost,
  palm,
  pickc,
  speakerBox,
  stall,
  tower,
  tree,
  umbrella,
  zincShed,
  groundMat,
  marketUmbrella,
  wheelbarrow,
  plasticChairs,
  generatorSet,
  sackPile,
  marketArch,
  cookStall,
} from './props'
import type { FoodId } from './data'
import type { Ctx } from './worldTypes'

const GLASS = ['#8fb3ff', '#6fd3c8', '#d7a6ff', '#ffd1a6', '#f2f6ff', '#9fe0ff']
const NEON = ['#ff2d9b', '#38ffd0', '#ffd12e', '#7b5cff', '#ff7a1a']
const PASTEL = ['#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#a0c4ff', '#ffc6ff', '#ffadad', '#f8edeb']
const ROOFS = ['#d62828', '#f77f00', '#6a4c93', '#1982c4', '#8ac926']

const cell = (n: number) => n * 12

/** the food a spot is named for is the food cooked and sold there */
const FOOD_OF: Record<string, FoodId> = {
  'Jollof Corner': 'jollof',
  'Suya Spot': 'suya',
  'Plantain Queen': 'dodo',
  'Akara Hut': 'akara',
  'Pepper Soup Stand': 'peppersoup',
  'Chin Chin Cart': 'chinchin',
}

function foodStall(c: Ctx, id: string, x: number, z: number, ry: number, label: string) {
  cookStall(c, x, z, ry, FOOD_OF[label] ?? 'jollof')
  c.glow.box(1.4, 0.3, 0.06, '#ff9f1c', x, 3.1, z + 1.2)
  const f = front(x, z, ry, 2.2)
  addPoi(c, id, 'food', label, f.x, f.z, undefined, true)
}

function marketBlock(c: Ctx, i: number, j: number, cx: number, cz: number) {
  const skip = new Set<string>()
  const put = (cxl: number, czl: number) => skip.add(`${cxl},${czl}`)
  const id = `${i}-${j}`
  const P = (n: number) => cell(n)
  if (i === 1 && j === 2) {
    building(c, cx, cz + P(-1) - 2, 10, 7, 7, 0, '#ffd6a5', '#d62828', '#ff6b4a')
    const f = front(cx, cz + P(-1) - 2, 0, 6)
    addPoi(c, 'room', 'home', "Mama Ngozi's Rooms", f.x, f.z, 1)
    building(c, cx + P(1), cz + P(1), 6, 5, 4, 0, '#ffb3d9', '#ff2d9b', '#ff2d9b')
    addPoi(c, 'dispatch', 'delivery', 'Dispatch Office', cx + P(1), cz + P(1) + 5, undefined, true)
    put(-1, -1); put(0, -1); put(1, -1); put(1, 1)
  }
  if (i === 2 && j === 2) {
    building(c, cx, cz + P(-1) - 2, 13, 7, 6, 0, '#e8dcff', '#8338ec', '#e8478b')
    const f = front(cx, cz + P(-1) - 2, 0, 6)
    addPoi(c, 'boutique', 'boutique', 'Wild City Boutique', f.x, f.z)
    put(-1, -1); put(0, -1); put(1, -1)
  }
  if (i === 0 && j === 3) {
    foodStall(c, 'food-a', cx + P(-1), cz, 0, 'Jollof Corner')
    foodStall(c, 'food-b', cx, cz, 0, 'Suya Spot')
    foodStall(c, 'food-c', cx + P(1), cz, 0, 'Plantain Queen')
    put(-1, 0); put(0, 0); put(1, 0)
  }
  if (i === 1 && j === 3) {
    stall(c, cx, cz, 0, '#27c1a8', '#ffffff', true)
    c.glow.box(3, 0.35, 0.06, '#27c1a8', cx, 3.2, cz + 1.3)
    const f = front(cx, cz, 0, 2.4)
    addPoi(c, 'stallwork', 'stall', 'Stall Counter (Job)', f.x, f.z, undefined, true)
    foodStall(c, 'food-d', cx + P(1), cz + P(-1), 0, 'Akara Hut')
    kiosk(c, cx + P(-1), cz + P(1), 0, '#ffe08a', '#4a8fe8')
    addPoi(c, 'repair-kiosk', 'repair', 'Phone Repair Kiosk', cx + P(-1), cz + P(1) + 3.6)
    put(0, 0); put(1, -1); put(-1, 1)
  }
  if (i === 2 && j === 3) {
    building(c, cx, cz + P(-1) - 2, 11, 7, 5.5, 0, '#fff1c9', '#e63946', '#e63946')
    barberPole(c, cx + 6.4, cz + P(-1) + 3)
    const f = front(cx, cz + P(-1) - 2, 0, 6)
    addPoi(c, 'barber', 'business', 'Barbershop', f.x, f.z, 4, true)
    foodStall(c, 'food-e', cx + P(1), cz + P(1), 0, 'Pepper Soup Stand')
    put(-1, -1); put(0, -1); put(1, -1); put(1, 1)
  }
  if (i === 0 && j === 2) {
    stall(c, cx, cz, 0, '#8ad14b', '#ffffff')
    const f = front(cx, cz, 0, 2.6)
    addPoi(c, 'stall-biz', 'business', 'Market Stall', f.x, f.z, 3)
    put(0, 0)
  }
  if (i === 2 && j === 4) {
    building(c, cx, cz + P(-1) - 2, 11, 7, 6, 0, '#cfe3ff', '#1982c4', '#4a8fe8')
    const f = front(cx, cz + P(-1) - 2, 0, 6)
    addPoi(c, 'repair-shop', 'business', 'Phone Repair Shop', f.x, f.z, 5)
    put(-1, -1); put(0, -1); put(1, -1)
  }
  if (i === 0 && j === 4) {
    foodStall(c, 'food-f', cx, cz + P(1), 0, 'Chin Chin Cart')
    put(0, 1)
  }
  // an open Nigerian market: zinc-roof sheds, stalls under big umbrellas, women selling from mats on the ground
  for (let gx = -1; gx <= 1; gx++)
    for (let gz = -1; gz <= 1; gz++) {
      if (skip.has(`${gx},${gz}`)) continue
      const x = cx + cell(gx) + (c.rand() - 0.5) * 1.5
      const z = cz + cell(gz) + 1
      const roll = c.rand()
      if (roll < 0.34) {
        zincShed(c, x, z, c.rand() < 0.5 ? 0 : Math.PI, 9)
      } else if (roll < 0.62) {
        const ry = c.rand() < 0.5 ? 0 : Math.PI
        stall(c, x, z, ry, pickc(c), '#ffffff', c.rand() < 0.15)
        marketUmbrella(c, x + 2.6, z + 2.2)
      } else {
        groundMat(c, x - 1.4, z, 0)
        groundMat(c, x + 1.6, z + 0.6, Math.PI)
        marketUmbrella(c, x + 0.1, z + 0.3)
      }
      // everyday market clutter
      const k = c.rand()
      if (k < 0.25) wheelbarrow(c, x + 4.2, z - 3.5, c.rand() * 3)
      else if (k < 0.45) sackPile(c, x - 4.3, z - 3.6)
      else if (k < 0.6) plasticChairs(c, x + 4.5, z + 4.2)
      else if (k < 0.7) generatorSet(c, x - 4.6, z + 4.4)
    }
  if (i === 1 && j === 2) marketArch(c, cx, cz + 17.8, 0, 'MILE ONE MARKET')
  if (c.rand() < 0.7) {
    c.spots.push({ x: cx + 6, z: cz + 6.5 + (id.length % 2), ry: Math.PI / 2, kind: 'chatter' })
    c.spots.push({ x: cx + 7.3, z: cz + 6.5 + (id.length % 2), ry: -Math.PI / 2, kind: 'chatter' })
  }
  awningRow(c, cx - 16, cz - 18.5, 4)
}

function plazaBlock(c: Ctx, i: number, j: number, cx: number, cz: number) {
  void i
  if (j === 2) {
    building(c, cx - 8, cz - 10, 11, 7, 6, 0, '#cdeae6', '#2fb6a3', '#7be0ff')
    const f = front(cx - 8, cz - 10, 0, 6)
    addPoi(c, 'agent', 'agent', 'Wild City Homes', f.x, f.z)
    building(c, cx + 8, cz + 8, 12, 8, 5, 0, '#ffe0ec', '#ff2d78', '#ff2d78')
    c.solid.box(3.8, 1.1, 1.8, '#ff2d78', cx + 5, 0.7, cz + 15, { ry: 0.2 })
    c.solid.box(2.2, 0.7, 1.5, '#2a3b55', cx + 5, 1.5, cz + 15, { ry: 0.2 })
    const g = front(cx + 8, cz + 8, 0, 6)
    addPoi(c, 'dealer', 'dealer', 'Zoom Motors', g.x, g.z)
    tree(c, cx - 14, cz + 12)
    tree(c, cx + 15, cz - 12)
  } else if (j === 3) {
    fountain(c, cx, cz)
    building(c, cx, cz - 15, 12, 6, 14, 0, '#f0d9c0', '#6a4c93', '#ffd12e')
    const f = front(cx, cz - 15, 0, 5)
    addPoi(c, 'apartment', 'home', 'Plaza Apartments', f.x, f.z, 2)
    kiosk(c, cx + 14, cz + 6, -Math.PI / 2, '#d4fff2', '#38ffd0')
    addPoi(c, 'trade', 'trade', 'Trade Square', cx + 10.5, cz + 6)
    for (const a of [0, 1, 2, 3]) bench(c, cx + Math.cos(a * 1.57) * 8, cz + Math.sin(a * 1.57) * 8, a * 1.57)
    palm(c, cx - 14, cz + 12)
    palm(c, cx + 14, cz + 14)
    c.spots.push({ x: cx - 6, z: cz + 9, ry: 0.8, kind: 'chatter' })
    c.spots.push({ x: cx - 4.8, z: cz + 9.8, ry: -2.3, kind: 'chatter' })
  } else {
    // bus depot
    c.solid.box(16, 0.4, 5, '#c9ced6', cx - 6, 0.2, cz + 12)
    c.solid.box(16.4, 0.3, 5.4, '#ffc61a', cx - 6, 3.6, cz + 12)
    for (const x of [-13.5, -4, 1.5]) c.solid.box(0.3, 3.4, 0.3, '#444a55', cx + x, 1.9, cz + 14.2)
    c.glow.box(4, 0.5, 0.1, '#ffc61a', cx - 6, 3.0, cz + 14.4)
    addCollider(c, cx - 6, cz + 12, 16, 5)
    addPoi(c, 'bus-depot', 'bus', 'Bus Depot (Conductor)', cx - 6, cz + 8.8)
    billboard(c, cx + 6, cz - 14, 0, '#ff2d9b')
    addPoi(c, 'leaderboard', 'leaderboard', 'Season Leaderboard', cx + 6, cz - 9)
    tree(c, cx + 15, cz + 12)
  }
}

function beachBlock(c: Ctx, i: number, cx: number, cz: number) {
  if (i === 3) {
    building(c, cx, cz - 8, 11, 8, 4.5, 0, '#ffffff', '#2fb6a3', '#17b6c9')
    const f = front(cx, cz - 8, 0, 6)
    addPoi(c, 'beach-house', 'home', 'Beach House', f.x, f.z, 3)
    bench(c, cx + 8, cz + 6, 0)
    addPoi(c, 'bench', 'bench', 'Beach Bench (rest)', cx + 8, cz + 8)
  } else if (i === 4) {
    building(c, cx, cz - 8, 16, 9, 6, 0, '#2b1f4a', '#7b5cff', '#b04fe8', '#ff2d9b')
    c.glow.box(10, 0.5, 0.1, '#ff2d9b', cx, 5.4, cz - 3.2)
    c.glow.box(10, 0.3, 0.1, '#38ffd0', cx, 4.6, cz - 3.2)
    speakerBox(c, cx - 7, cz - 2)
    speakerBox(c, cx + 7, cz - 2)
    const f = front(cx, cz - 8, 0, 6.5)
    addPoi(c, 'lounge-dj', 'dj', 'Neon Lounge DJ Booth', f.x, f.z, undefined, true)
    addPoi(c, 'lounge', 'business', 'Neon Lounge', f.x + 8, f.z + 1, 6, true)
  } else if (i === 2 || i === 5) {
    foodStall(c, `beach-food-${i}`, cx - 6, cz - 6, 0, 'Grilled Fish Shack')
    foodStall(c, `beach-food2-${i}`, cx + 6, cz - 6, 0, 'Coconut Bar')
  }
  for (let k = 0; k < 3; k++) umbrella(c, cx - 12 + k * 12 + (c.rand() - 0.5) * 3, cz + 8 + c.rand() * 6)
  for (let k = 0; k < 4; k++) palm(c, cx - 17 + k * 11 + c.rand() * 2, cz + 16.5)
}

function residentialBlock(c: Ctx, cx: number, cz: number) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const ry = sz < 0 ? 0 : Math.PI
      house(c, cx + sx * 10.5, cz + sz * 10.5, ry, pickc(c, PASTEL), pickc(c, ROOFS))
    }
  tree(c, cx, cz - 1)
  tree(c, cx + 1, cz + 3)
  if (c.rand() < 0.5) bench(c, cx - 2, cz + 1, 0)
  if (c.rand() < 0.5) {
    c.spots.push({ x: cx + 3, z: cz, ry: 1.2, kind: 'chatter' })
    c.spots.push({ x: cx + 4.2, z: cz + 0.4, ry: -1.9, kind: 'chatter' })
  }
}

function downtownBlock(c: Ctx, i: number, j: number, cx: number, cz: number) {
  if (i === 3 && j === 1) {
    tower(c, cx, cz - 6, 20, 18, 110, '#9fe0ff', '#ff2d9b')
    c.glow.box(14, 2.4, 0.2, '#ff2d9b', cx, 9, cz + 3.2)
    c.glow.box(11, 0.7, 0.22, '#ffffff', cx, 9, cz + 3.25)
    tree(c, cx - 15, cz + 14)
    tree(c, cx + 15, cz + 14)
    return
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      if (c.rand() < 0.15) {
        tree(c, cx + sx * 10, cz + sz * 10)
        continue
      }
      const w = 12 + c.rand() * 4
      const d = 12 + c.rand() * 4
      const h = (j === 1 ? 20 : 30) + c.rand() * 45
      tower(c, cx + sx * 10, cz + sz * 10, w, d, h, pickc(c, GLASS), pickc(c, NEON))
    }
}

export function buildBlocks(c: Ctx) {
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 6; j++) {
      const { x: cx, z: cz } = blockCenter(i, j)
      const d = districtOfBlock(i, j)
      if (d === 'market') marketBlock(c, i, j, cx, cz)
      else if (d === 'plaza') plazaBlock(c, i, j, cx, cz)
      else if (d === 'beach') beachBlock(c, i, cx, cz)
      else if (d === 'residential') residentialBlock(c, cx, cz)
      else downtownBlock(c, i, j, cx, cz)
      // lamps at block corners
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) lampPost(c, cx + sx * 19, cz + sz * 19)
      // street furniture
      if (d !== 'downtown' || c.rand() < 0.5) bin(c, cx - 19.3, cz + 5 + c.rand() * 8)
      if (c.rand() < 0.4) hydrant(c, cx + 19.4, cz - 6 - c.rand() * 8)
      if (d === 'residential' && c.rand() < 0.7) powerPole(c, cx + 19.5, cz + 2)
      if ((d === 'plaza' || d === 'market') && c.rand() < 0.3) busStop(c, cx + 8, cz - 19.2, Math.PI)
      // delivery drop-off on the sidewalk
      const dx = cx + (c.rand() - 0.5) * 24
      c.drops.push({ x: dx, z: cz + 18.2, district: d, label: 'Customer' })
    }
}
