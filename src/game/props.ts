import * as THREE from 'three'
import { districtAt, type DistrictId, type FoodId, type StallTheme } from './data'
import type { PoiKind } from './store'
import { POI_COLORS, type Ctx } from './worldTypes'

const PALETTE = ['#ff4d6d', '#ffb703', '#2ec4b6', '#8338ec', '#fb5607', '#3a86ff', '#06d6a0', '#ef476f', '#ffd166']
const THEMES: StallTheme[] = ['foodstuff', 'foodstuff', 'veg', 'veg', 'tuber', 'fruit']
type B = Ctx['solid']

/* ---------------- real Nigerian market goods, laid out on the table (y = 1.0 is the table top) ---------------- */
const Y = 1.0
/** enamel basin or raffia basket with a heap inside */
function basin(b: B, x: number, z: number, rim: string) {
  b.cyl(0.27, 0.2, 0.14, rim, x, Y + 0.07, z, 12)
}
function heap(b: B, x: number, z: number, color: string, h = 0.16) {
  b.sphere(0.24, color, x, Y + 0.12, z, { sy: h / 0.24 }, 9)
}
function pile(b: B, x: number, z: number, r: number, color: string, alt?: string) {
  // a small pyramid of round things: 4 at the bottom, 1 on top
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.sphere(r, alt && (dx + dz) % 4 === 0 ? alt : color, x + dx * r * 0.95, Y + 0.12 + r, z + dz * r * 0.95, {}, 7)
  b.sphere(r, color, x, Y + 0.12 + r * 2.5, z, {}, 7)
}
/** "paint rubber" measuring bucket */
function paintRubber(b: B, x: number, z: number, fill: string) {
  b.cyl(0.13, 0.11, 0.22, '#d62828', x, Y + 0.11, z, 10)
  b.cyl(0.125, 0.125, 0.03, fill, x, Y + 0.215, z, 10)
}
function garri(b: B, x: number, z: number) {
  basin(b, x, z, '#2f6fd6')
  heap(b, x, z, '#f1e6c8')
  paintRubber(b, x + 0.36, z + 0.25, '#f1e6c8')
}
function grains(b: B, x: number, z: number, color: string) {
  // open sack with a heap on top, mudu bowl in front
  b.cyl(0.24, 0.26, 0.3, '#d8c7a0', x, Y + 0.15, z, 10)
  b.sphere(0.23, color, x, Y + 0.3, z, { sy: 0.45 }, 9)
  b.cyl(0.09, 0.07, 0.08, '#9aa3ad', x + 0.3, Y + 0.04, z + 0.25, 10)
}
function palmOil(b: B, x: number, z: number) {
  for (let i = 0; i < 3; i++) {
    b.cyl(0.055, 0.055, 0.26, '#c0391b', x - 0.13 + i * 0.13, Y + 0.13, z, 8)
    b.cyl(0.025, 0.025, 0.05, '#f2c14e', x - 0.13 + i * 0.13, Y + 0.285, z, 6)
  }
}
function yams(b: B, x: number, z: number) {
  for (let i = 0; i < 3; i++) b.cyl(0.075, 0.06, 0.62, i === 1 ? '#5e4126' : '#6b4a2b', x, Y + 0.08 + (i === 1 ? 0.12 : 0), z - 0.14 + i * 0.14 - (i === 1 ? 0.14 : 0), 7, { rz: Math.PI / 2, ry: 0.15 * (i - 1) })
}
function plantain(b: B, x: number, z: number, ripe: boolean) {
  for (let i = 0; i < 5; i++) b.cyl(0.04, 0.03, 0.34, ripe ? '#f2c230' : '#7fae3a', x - 0.12 + i * 0.06, Y + 0.08 + Math.abs(i - 2) * 0.01, z, 6, { rz: Math.PI / 2 - 0.35, ry: -0.5 + i * 0.25 })
  b.cyl(0.045, 0.045, 0.1, '#5b4325', x - 0.2, Y + 0.08, z, 6, { rz: Math.PI / 2 })
}
/** one real-looking fruit: squashed body, colour variation, and a stem, calyx or leaf on top */
function fruit(b: B, kind: 'tomato' | 'orange' | 'onion', x: number, y: number, z: number, r: number, i: number) {
  if (kind === 'tomato') {
    const col = ['#e3271b', '#d41e14', '#ee3a22', '#c91a12'][i % 4]
    b.sphere(r, col, x, y, z, { sy: 0.82, ry: i }, 10)
    // green star-shaped calyx and stem
    for (let k = 0; k < 5; k++) {
      const t = (k / 5) * Math.PI * 2 + i
      b.box(r * 0.55, r * 0.06, r * 0.16, '#2f7d2a', x + Math.cos(t) * r * 0.25, y + r * 0.8, z + Math.sin(t) * r * 0.25, { ry: -t })
    }
    b.cyl(r * 0.07, r * 0.09, r * 0.25, '#3c6e28', x, y + r * 0.92, z, 5)
  } else if (kind === 'orange') {
    const col = ['#f39c12', '#f08a0c', '#f7a823', '#e8860e'][i % 4]
    b.sphere(r, col, x, y, z, { sy: 0.96 }, 12)
    b.sphere(r * 0.1, '#5a6b1e', x, y + r * 0.95, z, {}, 5)
    if (i % 3 === 0) b.sphere(r * 0.45, '#2e7a2e', x + r * 0.35, y + r * 1.0, z, { sy: 0.15, sz: 0.5, ry: i }, 6)
  } else {
    const col = ['#8b3a62', '#a14d73', '#7e3157'][i % 3]
    b.sphere(r, col, x, y, z, { sy: 0.9 }, 10)
    b.cyl(r * 0.05, r * 0.15, r * 0.4, '#c9b38a', x, y + r * 1.05, z, 5)
  }
}
function fruitPile(b: B, x: number, z: number, r: number, kind: 'tomato' | 'orange' | 'onion') {
  let i = 0
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1.4], [0, 1.4]]) fruit(b, kind, x + dx * r * 0.98, Y + 0.12 + r, z + dz * r * 0.98, r, i++)
  fruit(b, kind, x, Y + 0.12 + r * 2.6, z, r, i++)
  fruit(b, kind, x + r * 0.5, Y + 0.12 + r * 2.5, z - r * 0.6, r * 0.95, i++)
}
function tomatoes(b: B, x: number, z: number) {
  basin(b, x, z, '#c9a26b')
  fruitPile(b, x, z, 0.075, 'tomato')
}
function pepper(b: B, x: number, z: number) {
  basin(b, x, z, '#e9ecef')
  // scotch bonnet: wrinkled little lanterns with green stems
  for (let i = 0; i < 9; i++) {
    const px = x + ((i % 3) - 1) * 0.08
    const pz = z + (Math.floor(i / 3) - 1) * 0.08
    const py = Y + 0.17 + Math.floor(i / 3) * 0.03
    b.sphere(0.045, i % 3 === 0 ? '#ff8c00' : i % 4 === 0 ? '#f2c230' : '#d91e18', px, py, pz, { sy: 0.8, ry: i }, 7)
    b.cyl(0.006, 0.01, 0.03, '#2f6b22', px, py + 0.045, pz, 4)
  }
}
function onions(b: B, x: number, z: number) {
  basin(b, x, z, '#c9a26b')
  fruitPile(b, x, z, 0.07, 'onion')
}
function oranges(b: B, x: number, z: number) {
  basin(b, x, z, '#2f6fd6')
  fruitPile(b, x, z, 0.078, 'orange')
  // one already cut open, to show it's sweet
  b.sphere(0.078, '#f39c12', x + 0.3, Y + 0.05, z + 0.22, { sy: 0.5 }, 12)
  b.cyl(0.074, 0.074, 0.01, '#ffb54a', x + 0.3, Y + 0.09, z + 0.22, 14)
}

function marketGoods(c: Ctx, b: B, theme: StallTheme) {
  const z = 0.3
  if (theme === 'foodstuff') {
    garri(b, -1.15, z)
    grains(b, -0.35, z, '#fbfbf7')
    grains(b, 0.45, z, '#9b6a45')
    palmOil(b, 1.15, z)
  } else if (theme === 'veg') {
    tomatoes(b, -1.05, z)
    tomatoes(b, -0.4, z + 0.05)
    pepper(b, 0.3, z)
    onions(b, 1.0, z)
  } else if (theme === 'tuber') {
    yams(b, -0.8, z)
    yams(b, 0.0, z + 0.05)
    plantain(b, 0.85, z, c.rand() < 0.5)
  } else {
    oranges(b, -0.9, z)
    oranges(b, -0.2, z)
    plantain(b, 0.7, z, true)
  }
}
export const pickc = (c: Ctx, a: string[] = PALETTE) => a[Math.floor(c.rand() * a.length)]

const quarter = (ry: number) => Math.abs(Math.round(ry / (Math.PI / 2))) % 2 === 1

export function addCollider(c: Ctx, x: number, z: number, w: number, d: number, ry = 0) {
  const [ww, dd] = quarter(ry) ? [d, w] : [w, d]
  c.cols.push({ x0: x - ww / 2, x1: x + ww / 2, z0: z - dd / 2, z1: z + dd / 2 })
}

export function addPoi(
  c: Ctx,
  id: string,
  kind: PoiKind,
  label: string,
  x: number,
  z: number,
  extra?: number,
  music = false,
  r = 3.2,
) {
  c.pois.push({ id, kind, label, x, z, r, district: districtAt(x, z), color: POI_COLORS[kind], music, extra })
}

/** local forward (+z) point rotated by ry */
export const front = (x: number, z: number, ry: number, dist: number) => ({ x: x + Math.sin(ry) * dist, z: z + Math.cos(ry) * dist })

/** wooden table, poles, striped awning, ankara cloth */
function stallFrame(c: Ctx, b: B, colA: string, colB: string) {
  b.box(3.2, 0.9, 1.3, '#a9743f', 0, 0.45, 0.3)
  b.box(3.3, 0.08, 1.4, '#d9a066', 0, 0.94, 0.3)
  for (const px of [-1.5, 1.5]) for (const pz of [-0.45, 1.05]) b.box(0.08, 2.5, 0.08, '#5b3b1d', px, 1.25, pz)
  for (let i = 0; i < 6; i++) b.box(0.58, 0.07, 2.0, i % 2 ? colB : colA, -1.45 + i * 0.58, 2.6, 0.35, { rx: 0.18 })
  b.box(3.3, 0.05, 0.05, '#4a2f16', 0, 2.52, 1.35)
  c.fabric.box(3.34, 0.03, 1.42, pickc(c, ['#ffffff', '#fff0d9', '#ffd9e6', '#d9fff3']), 0, 0.99, 0.3)
  c.fabric.box(3.1, 0.55, 0.03, pickc(c, ['#ffffff', '#ffe8cc', '#e6fff7', '#ffe0f0']), 0, 2.2, 1.34, { rx: -0.08 })
}

export function stall(c: Ctx, x: number, z: number, ry: number, colA = pickc(c), colB = '#ffffff', speaker = false) {
  const theme = THEMES[Math.floor(c.rand() * THEMES.length)]
  c.solid.at(x, z, ry, () => {
    const b = c.solid
    stallFrame(c, b, colA, colB)
    marketGoods(c, b, theme)
    b.cyl(0.28, 0.22, 0.32, '#b8863f', -1.9, 0.16, 0.6, 10)
    b.sphere(0.2, '#ff9f1c', -1.9, 0.42, 0.6, {}, 7)
    b.box(0.6, 0.5, 0.6, '#8a5a2b', 1.9, 0.25, -0.2)
    b.box(0.55, 0.45, 0.55, '#9b6a35', 1.95, 0.72, -0.15, { ry: 0.3 })
    b.box(0.5, 0.7, 0.4, '#d9c9a0', 1.8, 0.35, 0.6, { ry: 0.2 })
    b.box(0.3, 0.1, 0.25, '#ffffff', 0, 0.88, 0.95)
    if (speaker) b.box(0.4, 0.55, 0.3, '#111', -1.9, 0.28, 0.2)
  })
  addCollider(c, x, z, 3.4, 2.4, ry)
  const f = front(x, z, ry, -0.5)
  c.spots.push({ x: f.x, z: f.z, ry: ry, kind: 'vendor', goods: theme })
}

/* ---------------- food spots: the food itself, being cooked right there ---------------- */
const AKARA = ['#b8651e', '#a2561a', '#c97a2a', '#9c4f17']
function stove(c: Ctx, b: B, x: number, z: number) {
  b.box(0.52, 0.12, 0.52, '#2b2b2b', x, Y + 0.06, z)
  b.cyl(0.05, 0.05, 0.03, '#555', x + 0.2, Y + 0.08, z + 0.27, 8, { rx: Math.PI / 2 })
  // blue gas flame under the pot
  for (let k = 0; k < 8; k++) {
    const t = (k / 8) * Math.PI * 2
    c.glow.box(0.03, 0.05, 0.03, '#3d8bff', x + Math.cos(t) * 0.12, Y + 0.14, z + Math.sin(t) * 0.12)
  }
}
function akaraBall(b: B, x: number, y: number, z: number, i: number, r = 0.045) {
  // lumpy, not a perfect ball
  b.sphere(r, AKARA[i % 4], x, y, z, { sy: 0.8, ry: i }, 7)
  b.sphere(r * 0.5, AKARA[(i + 1) % 4], x + r * 0.5, y + r * 0.2, z - r * 0.3, {}, 5)
}
function trayOf(b: B, x: number, z: number, item: (x: number, y: number, z: number, i: number) => void, n = 12) {
  b.cyl(0.3, 0.27, 0.04, '#c0c4c8', x, Y + 0.02, z, 14)
  for (let i = 0; i < n; i++) {
    const ring = i < 7 ? 0.17 : i < 11 ? 0.08 : 0
    const t = i * 0.9
    item(x + Math.cos(t) * ring, Y + 0.08 + (i >= 7 ? 0.04 : 0) + (i >= 11 ? 0.04 : 0), z + Math.sin(t) * ring, i)
  }
}
function cookGoods(c: Ctx, b: B, food: FoodId) {
  const z = 0.25
  if (food === 'akara') {
    // a deep black pot of hot oil with akara frying in it, bean paste ready to scoop, a tray of fried ones
    stove(c, b, -0.8, z)
    b.cyl(0.36, 0.26, 0.2, '#1d1d1f', -0.8, Y + 0.24, z, 14)
    b.cyl(0.33, 0.33, 0.01, '#d39a2a', -0.8, Y + 0.33, z, 14)
    for (let i = 0; i < 7; i++) akaraBall(b, -0.8 + Math.cos(i * 0.9) * 0.18, Y + 0.34, z + Math.sin(i * 0.9) * 0.18, i)
    b.box(0.03, 0.02, 0.5, '#8a8f96', -0.5, Y + 0.42, z - 0.05, { ry: 0.6, rx: -0.4 })
    trayOf(b, 0.25, z, (x, y, zz, i) => akaraBall(b, x, y, zz, i))
    basin(b, 1.05, z, '#2f6fd6')
    heap(b, 1.05, z, '#efe2c4', 0.12)
    b.box(0.35, 0.05, 0.25, '#f4f1e8', 1.05, Y + 0.02, z + 0.45)
  } else if (food === 'suya') {
    // the long charcoal grill with sticks of spicy beef
    for (const lx of [-1.0, 0.4]) for (const lz of [z - 0.2, z + 0.2]) b.box(0.04, 0.2, 0.04, '#333', lx, Y + 0.1, lz)
    b.box(1.5, 0.08, 0.5, '#3a3a3a', -0.3, Y + 0.22, z)
    c.glow.box(1.4, 0.02, 0.42, '#ff4a1a', -0.3, Y + 0.27, z)
    for (let i = 0; i < 9; i++) {
      const sx = -0.95 + i * 0.16
      b.box(0.012, 0.012, 0.5, '#d9b27a', sx, Y + 0.31, z)
      for (let k = 0; k < 5; k++) b.box(0.07, 0.04, 0.06, k % 2 ? '#6b2e14' : '#7f3a1a', sx, Y + 0.32, z - 0.16 + k * 0.08)
    }
    b.sphere(0.16, '#9ccc65', 0.85, Y + 0.14, z, { sy: 0.85 }, 9)
    fruitPile(b, 1.2, z + 0.1, 0.06, 'onion')
    basin(b, 0.75, z + 0.4, '#e9ecef')
    heap(b, 0.75, z + 0.4, '#b5541c', 0.08)
  } else if (food === 'jollof') {
    // big pots of party jollof and fried chicken, a cooler, takeaway packs
    b.cyl(0.28, 0.26, 0.36, '#9aa3ad', -0.95, Y + 0.18, z, 14)
    b.sphere(0.26, '#e0601f', -0.95, Y + 0.36, z, { sy: 0.3 }, 12)
    b.cyl(0.26, 0.24, 0.3, '#9aa3ad', -0.3, Y + 0.15, z, 14)
    for (let i = 0; i < 8; i++) b.sphere(0.06, i % 2 ? '#8b4513' : '#a0521b', -0.3 + Math.cos(i) * 0.13, Y + 0.32, z + Math.sin(i) * 0.13, { sy: 0.7, ry: i }, 7)
    b.cyl(0.22, 0.2, 0.34, '#1f78d1', 0.4, Y + 0.17, z, 12)
    b.cyl(0.23, 0.23, 0.05, '#f2f2f2', 0.4, Y + 0.36, z, 12)
    for (let i = 0; i < 4; i++) b.box(0.22, 0.06, 0.16, '#f6f6f6', 1.05, Y + 0.03 + i * 0.065, z)
  } else if (food === 'dodo') {
    // a wide frying pan of plantain slices going golden, and ripe plantain waiting
    stove(c, b, -0.8, z)
    b.cyl(0.34, 0.28, 0.07, '#222', -0.8, Y + 0.18, z, 14)
    b.cyl(0.31, 0.31, 0.01, '#d39a2a', -0.8, Y + 0.22, z, 14)
    for (let i = 0; i < 12; i++) b.sphere(0.045, i % 3 ? '#e08a1f' : '#c96a12', -0.8 + Math.cos(i * 1.7) * (0.08 + (i % 3) * 0.07), Y + 0.225, z + Math.sin(i * 1.7) * (0.08 + (i % 3) * 0.07), { sy: 0.25, sz: 0.65, ry: i }, 8)
    plantain(b, 0.25, z, true)
    trayOf(b, 1.05, z, (x, y, zz, i) => b.sphere(0.045, i % 2 ? '#e08a1f' : '#cf7416', x, y - 0.03, zz, { sy: 0.3, sz: 0.65, ry: i }, 8))
  } else if (food === 'peppersoup') {
    // a big pot of pepper soup on the fire and bowls ready
    stove(c, b, -0.7, z)
    b.cyl(0.3, 0.27, 0.42, '#3a3a3a', -0.7, Y + 0.33, z, 14)
    b.cyl(0.28, 0.28, 0.01, '#7a2e12', -0.7, Y + 0.53, z, 14)
    for (let i = 0; i < 6; i++) b.box(0.07, 0.04, 0.06, '#5a2a14', -0.7 + Math.cos(i) * 0.14, Y + 0.54, z + Math.sin(i) * 0.14, { ry: i })
    for (let i = 0; i < 4; i++) b.cyl(0.11, 0.07, 0.07, '#f4f4f4', 0.3 + (i % 2) * 0.28, Y + 0.035 + Math.floor(i / 2) * 0.07, z, 12)
    pepper(b, 1.05, z)
  } else {
    // glass jars of chin chin and small packs
    for (let i = 0; i < 4; i++) {
      const jx = -1.05 + i * 0.42
      b.cyl(0.14, 0.14, 0.34, '#e6eef2', jx, Y + 0.17, z, 12)
      b.cyl(0.13, 0.13, 0.26, '#d9a15a', jx, Y + 0.15, z, 12)
      b.cyl(0.145, 0.145, 0.05, '#d62828', jx, Y + 0.36, z, 12)
    }
    for (let i = 0; i < 6; i++) b.box(0.12, 0.04, 0.16, '#e0b06b', 0.8 + (i % 3) * 0.14, Y + 0.02 + Math.floor(i / 3) * 0.045, z + 0.3)
  }
}
const FOOD_SIGN: Record<FoodId, string> = {
  akara: 'HOT AKARA',
  suya: 'SUYA SPOT',
  jollof: 'JOLLOF CORNER',
  dodo: 'DODO & PLANTAIN',
  peppersoup: 'PEPPER SOUP',
  chinchin: 'CHIN CHIN',
}
/** A food spot: the food on its sign is the food being cooked and sold there, by a cook standing at the fire. */
export function cookStall(c: Ctx, x: number, z: number, ry: number, food: FoodId) {
  c.solid.at(x, z, ry, () => {
    const b = c.solid
    stallFrame(c, b, '#e63946', '#ffe3a3')
    cookGoods(c, b, food)
    b.box(0.4, 0.4, 0.4, '#2b6cb0', 1.9, 0.2, -0.2)
  })
  addCollider(c, x, z, 3.4, 2.4, ry)
  ;(c.signs ??= []).push({ x: x + Math.sin(ry) * 1.36, y: 2.2, z: z + Math.cos(ry) * 1.36, ry, w: 2.6, h: 0.42, text: FOOD_SIGN[food], bg: '#ffe3a3', fg: '#b3261e' })
  // the cook stands right behind the pot
  const lx = food === 'jollof' || food === 'chinchin' ? 0 : -0.7
  c.spots.push({ x: x + Math.cos(ry) * lx + Math.sin(ry) * -0.55, z: z - Math.sin(ry) * lx + Math.cos(ry) * -0.55, ry, kind: 'vendor', goods: food })
}

export function building(
  c: Ctx,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  ry: number,
  wall: string,
  roof: string,
  sign: string,
  doorCol = '#2b2018',
) {
  c.solid.at(x, z, ry, () => {
    const b = c.solid
    b.box(w, h, d, wall, 0, h / 2, 0)
    b.box(w + 0.1, 0.5, d + 0.1, '#e9e4da', 0, 0.25, 0)
    b.box(w + 0.5, 0.35, d + 0.5, roof, 0, h + 0.17, 0)
    b.box(w + 0.7, 0.18, d + 0.7, '#ffffff', 0, h - 0.1, 0)
    b.box(1.5, 2.4, 0.12, doorCol, 0, 1.2, d / 2 + 0.03)
    b.box(1.7, 0.15, 0.2, '#e9e4da', 0, 2.5, d / 2 + 0.08)
    for (const wx of [-w / 3, w / 3]) {
      b.box(1.4, 1.2, 0.1, '#8fd3ff', wx, 1.7, d / 2 + 0.03)
      b.box(1.6, 0.1, 0.25, '#e9e4da', wx, 1.05, d / 2 + 0.1)
      b.box(0.06, 1.2, 0.12, '#e9e4da', wx, 1.7, d / 2 + 0.07)
    }
    for (const sx of [-1, 1]) for (const k of [-1, 1]) {
      b.box(0.1, 1.1, 1.3, '#8fd3ff', sx * (w / 2 + 0.02), h * 0.55, k * d * 0.22)
      b.box(0.2, 0.1, 1.5, '#e9e4da', sx * (w / 2 + 0.06), h * 0.55 - 0.6, k * d * 0.22)
    }
    b.box(w * 0.9, 0.5, 0.5, sign, 0, 3.0, d / 2 + 0.3, { rx: 0.35 })
    c.glow.box(w * 0.7, 0.3, 0.06, sign, 0, 3.0, d / 2 + 0.58, { rx: 0.35 })
    b.box(w * 0.95, 0.12, 1.2, '#ffffff', 0, 2.75, d / 2 + 0.5, { rx: 0.25 })
    // rooftop kit: water tank on legs and an AC unit
    const ty = h + 0.35
    for (const lx of [-0.4, 0.4]) for (const lz of [-0.4, 0.4]) b.box(0.08, 0.9, 0.08, '#6b6f78', w / 4 + lx, ty + 0.45, -d / 4 + lz)
    b.cyl(0.62, 0.62, 1.0, '#7d8aa0', w / 4, ty + 1.3, -d / 4, 12)
    b.box(0.9, 0.55, 0.6, '#cfd3da', -w / 4, ty + 0.28, d / 6)
    b.cyl(0.22, 0.22, 0.06, '#555', -w / 4, ty + 0.58, d / 6, 10)
  })
  addCollider(c, x, z, w + 0.5, d + 0.5, ry)
}

export function speakerBox(c: Ctx, x: number, z: number) {
  c.solid.box(0.5, 0.8, 0.4, '#0f0f14', x, 0.4, z)
  c.solid.cyl(0.14, 0.14, 0.05, '#555', x, 0.45, z + 0.22, 8, { rx: Math.PI / 2 })
}

export function barberPole(c: Ctx, x: number, z: number) {
  for (let i = 0; i < 6; i++) c.solid.cyl(0.12, 0.12, 0.16, i % 2 ? '#e63946' : '#ffffff', x, 1.0 + i * 0.16, z, 8)
  c.solid.cyl(0.15, 0.15, 0.06, '#222', x, 0.95, z, 8)
}

export function house(c: Ctx, x: number, z: number, ry: number, wall: string, roof: string) {
  const w = 7 + c.rand() * 2
  const d = 6 + c.rand() * 2
  c.solid.at(x, z, ry, () => {
    const b = c.solid
    b.box(w + 0.2, 0.5, d + 0.2, '#d9d2c5', 0, 0.25, 0)
    b.box(w, 3.4, d, wall, 0, 1.7, 0)
    b.cone(Math.max(w, d) * 0.78, 2.4, roof, 0, 4.6, 0, 4, { ry: Math.PI / 4, sx: w / Math.max(w, d), sz: d / Math.max(w, d) })
    b.box(1.2, 2.1, 0.1, '#5b3b1d', 0, 1.05, d / 2 + 0.03)
    for (const wx of [-w / 3, w / 3]) {
      b.box(1.1, 1.0, 0.1, '#8fd3ff', wx, 1.9, d / 2 + 0.03)
      b.box(0.5, 1.0, 0.06, '#3a8a7a', wx - 0.8, 1.9, d / 2 + 0.07)
      b.box(0.5, 1.0, 0.06, '#3a8a7a', wx + 0.8, 1.9, d / 2 + 0.07)
    }
    b.box(0.6, 1.4, 0.6, '#c9b9a5', w / 3, 4.4, -d / 4)
    // veranda with posts, low wall and steps
    b.box(w * 0.7, 0.12, 1.8, '#d9d2c5', 0, 0.3, d / 2 + 0.9)
    b.box(w * 0.7 + 0.3, 0.12, 2.0, roof, 0, 2.7, d / 2 + 1.0, { rx: 0.1 })
    for (const px of [-1, 1]) b.cyl(0.07, 0.07, 2.4, '#f4f1ea', px * w * 0.33, 1.5, d / 2 + 1.7, 8)
    b.box(w + 2, 0.15, 1.4, '#e8dcc8', 0, 0.08, d / 2 + 2.6)
    // little garden fence
    for (let k = -3; k <= 3; k++) b.box(0.08, 0.7, 0.08, '#f4f1ea', k * (w / 6.5), 0.4, d / 2 + 3.4)
    b.box(w, 0.06, 0.06, '#f4f1ea', 0, 0.62, d / 2 + 3.4)
  })
  addCollider(c, x, z, w + 0.4, d + 0.4, ry)
}

export function tower(c: Ctx, x: number, z: number, w: number, d: number, h: number, color: string, neon: string) {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.attributes.uv
  const faces: [number, number][] = [
    [d / 8, h / 8],
    [d / 8, h / 8],
    [0.01, 0.01],
    [0.01, 0.01],
    [w / 8, h / 8],
    [w / 8, h / 8],
  ]
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v
      uv.setXY(i, uv.getX(i) * faces[f][0], uv.getY(i) * faces[f][1])
    }
  c.towers.add(g, color, x, h / 2, z)
  // podium and entrance canopy
  c.solid.box(w + 2, 4, d + 2, '#b9bfcc', x, 2, z)
  c.solid.box(w * 0.5, 0.25, 2.4, '#ffffff', x, 3.3, z + d / 2 + 2.2)
  c.glow.box(w * 0.5, 0.14, 0.1, neon, x, 3.1, z + d / 2 + 3.3)
  for (const sx of [-1, 1]) c.solid.box(0.18, 3.2, 0.18, '#444a55', x + sx * w * 0.23, 1.6, z + d / 2 + 3.2)
  // roof plant: mechanical box, tank, antenna
  c.solid.box(w * 0.5, 2.5, d * 0.5, '#444a55', x, h + 1.25, z)
  c.solid.cyl(1.0, 1.0, 1.8, '#8a93a6', x - w * 0.28, h + 0.9, z + d * 0.2, 10)
  c.solid.box(1.8, 0.8, 1.4, '#cfd3da', x + w * 0.25, h + 0.4, z - d * 0.25)
  c.solid.cyl(0.1, 0.1, 6, '#c9ced6', x + w * 0.2, h + 5, z, 5)
  c.glow.box(w + 0.2, 0.5, d + 0.2, neon, x, h - 1.2, z)
  c.glow.box(w + 0.2, 0.3, d + 0.2, neon, x, h * 0.45, z)
  c.glow.box(0.3, 1.2, 0.3, '#ff3030', x + w * 0.2, h + 8, z)
  addCollider(c, x, z, w + 2, d + 2)
}

export function palm(c: Ctx, x: number, z: number) {
  const h = 4.5 + c.rand() * 2
  const lean = (c.rand() - 0.5) * 0.3
  c.solid.cyl(0.18, 0.28, h, '#9b6b3a', x, h / 2, z, 6, { rz: lean })
  const tx = x - Math.sin(lean) * (h / 2)
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    c.solid.box(0.35, 0.06, 2.8, i % 2 ? '#2f9e44' : '#3fbf5a', tx + Math.sin(a) * 1.2, h + 0.1, z + Math.cos(a) * 1.2, { ry: a, rx: 0.5 })
  }
  c.solid.sphere(0.22, '#6b4423', tx, h - 0.1, z, {}, 5)
  addCollider(c, x, z, 0.6, 0.6)
}

export function tree(c: Ctx, x: number, z: number) {
  const s = 0.8 + c.rand() * 0.6
  c.solid.cyl(0.2 * s, 0.28 * s, 2.2 * s, '#7a5230', x, 1.1 * s, z, 6)
  c.solid.sphere(1.5 * s, c.rand() < 0.5 ? '#3f9f3f' : '#58b947', x, 3.2 * s, z, { sy: 0.85 }, 7)
  c.solid.sphere(1.0 * s, '#4cae4c', x + 0.7 * s, 2.8 * s, z + 0.3, {}, 6)
  addCollider(c, x, z, 0.6, 0.6)
}

export function lampPost(c: Ctx, x: number, z: number) {
  c.solid.cyl(0.07, 0.1, 4.6, '#2e3340', x, 2.3, z, 6)
  c.solid.box(0.9, 0.08, 0.08, '#2e3340', x, 4.6, z)
  c.lamp.box(0.5, 0.14, 0.3, '#ffe9a8', x, 4.52, z)
}

export function umbrella(c: Ctx, x: number, z: number) {
  const col = pickc(c)
  c.solid.cyl(0.04, 0.04, 2.4, '#ddd', x, 1.2, z, 5)
  c.solid.cone(1.5, 0.7, col, x, 2.5, z, 8)
  c.solid.box(1.1, 0.12, 2.0, '#ffffff', x + 1.8, 0.25, z, { ry: 0.3 })
}

export function bench(c: Ctx, x: number, z: number, ry: number) {
  c.solid.at(x, z, ry, () => {
    c.solid.box(1.8, 0.1, 0.5, '#8a5a2b', 0, 0.5, 0)
    c.solid.box(1.8, 0.45, 0.08, '#8a5a2b', 0, 0.85, -0.25)
    c.solid.box(0.1, 0.5, 0.45, '#333', -0.8, 0.25, 0)
    c.solid.box(0.1, 0.5, 0.45, '#333', 0.8, 0.25, 0)
  })
  c.spots.push({ x, z, ry, kind: 'sitter' })
}

/** Large neon billboard with a poi in front. */
export function billboard(c: Ctx, x: number, z: number, ry: number, col: string) {
  c.solid.at(x, z, ry, () => {
    c.solid.box(0.4, 5, 0.4, '#2e3340', -3, 2.5, 0)
    c.solid.box(0.4, 5, 0.4, '#2e3340', 3, 2.5, 0)
    c.solid.box(8, 3.4, 0.4, '#15151c', 0, 5.4, 0)
    c.glow.box(7.4, 2.8, 0.1, col, 0, 5.4, 0.25)
    c.glow.box(5.4, 0.5, 0.12, '#ffffff', 0, 5.4, 0.3)
  })
  addCollider(c, x, z, 8, 0.6, ry)
}

export function fountain(c: Ctx, x: number, z: number) {
  c.solid.cyl(5.5, 5.8, 0.8, '#d9d2c3', x, 0.4, z, 16)
  c.solid.cyl(4.8, 4.8, 0.85, '#38c6d9', x, 0.45, z, 16)
  c.solid.cyl(0.7, 0.9, 2.4, '#d9d2c3', x, 1.6, z, 8)
  c.solid.cyl(2.0, 1.2, 0.4, '#d9d2c3', x, 2.7, z, 10)
  c.solid.sphere(0.5, '#a8e8ff', x, 3.2, z, {}, 6)
  addCollider(c, x, z, 11.4, 11.4)
}

export function awningRow(c: Ctx, x: number, z: number, count: number) {
  for (let i = 0; i < count; i++) {
    c.solid.box(1.0, 0.1, 1.4, i % 2 ? '#ffffff' : pickc(c), x + i * 1.0, 2.6, z, { rx: 0.2 })
  }
}

export function kiosk(c: Ctx, x: number, z: number, ry: number, col: string, signCol: string) {
  c.solid.at(x, z, ry, () => {
    const b = c.solid
    b.box(3, 2.4, 2.4, col, 0, 1.2, 0)
    b.box(3.4, 0.2, 2.8, '#2b2b36', 0, 2.5, 0)
    b.box(2.2, 1.0, 0.1, '#8fd3ff', 0, 1.5, 1.23)
    b.box(2.4, 0.15, 0.7, '#ffffff', 0, 0.9, 1.5)
    c.glow.box(2.6, 0.5, 0.1, signCol, 0, 2.9, 1.2)
    // phone icon
    b.box(0.5, 0.9, 0.12, '#15151c', -1.8, 2.7, 0.2)
    c.glow.box(0.38, 0.7, 0.04, signCol, -1.8, 2.7, 0.27)
  })
  addCollider(c, x, z, 3.6, 3, ry)
}

export const inDistrict = (x: number, z: number, d: DistrictId) => districtAt(x, z) === d

export function bin(c: Ctx, x: number, z: number) {
  c.solid.cyl(0.28, 0.24, 0.8, '#2f7d4f', x, 0.4, z, 8)
  c.solid.cyl(0.3, 0.3, 0.06, '#245c3a', x, 0.82, z, 8)
}

export function hydrant(c: Ctx, x: number, z: number) {
  c.solid.cyl(0.14, 0.16, 0.7, '#d62828', x, 0.35, z, 8)
  c.solid.sphere(0.16, '#d62828', x, 0.74, z, {}, 6)
  c.solid.box(0.4, 0.1, 0.1, '#d62828', x, 0.5, z)
}

export function busStop(c: Ctx, x: number, z: number, ry: number) {
  c.solid.at(x, z, ry, () => {
    c.solid.box(3.4, 0.08, 1.4, '#2e3340', 0, 2.5, 0)
    for (const px of [-1.6, 1.6]) c.solid.box(0.08, 2.5, 0.08, '#2e3340', px, 1.25, -0.6)
    c.solid.box(3.2, 1.8, 0.05, '#bfe3ff', 0, 1.4, -0.65)
    c.solid.box(2.2, 0.08, 0.5, '#8a5a2b', 0, 0.5, -0.3)
    c.glow.box(1.0, 0.4, 0.05, '#ffc61a', 0, 2.2, 0.68)
  })
  addCollider(c, x, z, 3.4, 1.4, ry)
}

export function powerPole(c: Ctx, x: number, z: number) {
  c.solid.cyl(0.1, 0.14, 8, '#6b5a43', x, 4, z, 6)
  c.solid.box(2.2, 0.12, 0.12, '#4a3b2a', x, 7.6, z)
  c.solid.box(1.6, 0.1, 0.1, '#4a3b2a', x, 6.9, z)
  addCollider(c, x, z, 0.4, 0.4)
}


/* ---------------- Nigerian open market ---------------- */
const RUST = ['#9aa1a8', '#8b939b', '#a9afb5', '#7f6a55', '#8e5b3a']

/** Long shed with a corrugated zinc roof on wooden poles, tables of goods underneath, sellers behind. */
export function zincShed(c: Ctx, x: number, z: number, ry: number, len = 9) {
  const themes: StallTheme[] = ['foodstuff', 'veg', 'tuber', 'fruit']
  c.solid.at(x, z, ry, () => {
    const b = c.solid
    for (let k = 0; k <= Math.floor(len / 3); k++) {
      const px = -len / 2 + k * 3
      for (const pz of [-1.4, 1.4]) b.box(0.14, 2.7, 0.14, '#6b4a2b', px, 1.35, pz)
    }
    // corrugated zinc: thin sheets with alternating shine and a few rust patches, slightly sloped
    for (let k = 0; k < Math.ceil(len / 0.22); k++) {
      const col = c.rand() < 0.12 ? RUST[3 + Math.floor(c.rand() * 2)] : RUST[k % 3]
      b.box(0.2, 0.04, 3.6, col, -len / 2 + k * 0.22 + 0.1, 2.78 + (k % 2) * 0.025, 0, { rx: 0.08 })
    }
    b.box(len, 0.08, 0.08, '#5a3c22', 0, 2.68, 1.4)
    b.box(len, 0.08, 0.08, '#5a3c22', 0, 2.68, -1.4)
  })
  // tables of goods along the shed, each with its own seller
  const n = Math.max(2, Math.floor(len / 3))
  for (let k = 0; k < n; k++) {
    const off = -len / 2 + 1.5 + k * 3
    const tx = x + Math.cos(ry) * off
    const tz = z - Math.sin(ry) * off
    const theme = themes[Math.floor(c.rand() * themes.length)]
    c.solid.at(tx, tz, ry, () => {
      const b = c.solid
      b.box(2.6, 0.9, 1.1, '#a9743f', 0, 0.45, 0.3)
      b.box(2.7, 0.06, 1.2, '#d9a066', 0, 0.93, 0.3)
      marketGoods(c, b, theme)
    })
    addCollider(c, tx, tz, 2.8, 1.6, ry)
    const f = front(tx, tz, ry, -0.5)
    c.spots.push({ x: f.x, z: f.z, ry, kind: 'vendor', goods: theme })
  }
}

/** Woven mat on the ground with basins and heaps, the way many market women sell. */
export function groundMat(c: Ctx, x: number, z: number, ry: number) {
  const theme: StallTheme = c.rand() < 0.5 ? 'veg' : 'fruit'
  c.solid.at(x, z, ry, () => {
    const b = c.solid
    c.fabric.box(2.2, 0.02, 1.4, pickc(c, ['#c9a56b', '#b8955c', '#d2b47a']), 0, 0.04, 0)
    for (let k = 0; k < 6; k++) c.fabric.box(2.2, 0.022, 0.03, '#8a6a3c', 0, 0.05, -0.6 + k * 0.24)
    // goods sit on the mat (table height 0)
    b.at(0, 0, 0, () => marketGoods(c, b, theme), -0.95)
    // a low stool for the seller
    b.cyl(0.18, 0.2, 0.32, '#1f6fd6', 0, 0.16, -1.05, 10)
  })
  c.spots.push({ ...front(x, z, ry, -1.05), ry, kind: 'vendor', goods: theme })
}

/** Big market umbrella with two-colour panels and white trim. */
export function marketUmbrella(c: Ctx, x: number, z: number) {
  const [a, bcol] = pickc(c, ['red', 'green', 'blue', 'yellow']) === 'red' ? ['#d62828', '#ffffff'] : c.rand() < 0.5 ? ['#1f8a4c', '#ffd12e'] : ['#1f6fd6', '#ffffff']
  const b = c.solid
  b.cyl(0.05, 0.05, 2.7, '#cfd3d8', x, 1.35, z, 6)
  b.cone(2.1, 0.8, a, x, 2.9, z, 12)
  for (let k = 0; k < 6; k++) {
    const t = (k / 6) * Math.PI * 2
    b.box(0.3, 0.02, 2.1, bcol, x + Math.cos(t) * 1.0, 2.83, z + Math.sin(t) * 1.0, { ry: -t + Math.PI / 2, rx: 0.36 })
  }
  b.cyl(2.1, 2.1, 0.12, bcol, x, 2.48, z, 12)
}

export function wheelbarrow(c: Ctx, x: number, z: number, ry: number) {
  c.solid.at(x, z, ry, () => {
    const b = c.solid
    b.box(0.7, 0.35, 0.95, '#3f7d4f', 0, 0.55, 0, { rx: -0.08 })
    b.cyl(0.2, 0.2, 0.08, '#1b1b1b', 0, 0.2, 0.62, 12, { rz: Math.PI / 2 })
    for (const s of [-0.3, 0.3]) {
      b.box(0.05, 0.05, 1.4, '#6b4a2b', s, 0.5, -0.3, { rx: 0.15 })
      b.box(0.05, 0.4, 0.05, '#6b4a2b', s, 0.2, -0.25)
    }
    // load of sacks
    b.cyl(0.18, 0.2, 0.4, '#d8c7a0', -0.12, 0.85, 0.05, 8, { rz: Math.PI / 2 })
    b.cyl(0.18, 0.2, 0.4, '#cdbb90', 0.15, 0.9, -0.15, 8, { rz: Math.PI / 2 })
  })
  addCollider(c, x, z, 1.0, 1.6, ry)
}

export function plasticChairs(c: Ctx, x: number, z: number) {
  const b = c.solid
  const col = pickc(c, ['#ffffff', '#d62828', '#1f6fd6'])
  for (let k = 0; k < 5; k++) {
    b.box(0.46, 0.05, 0.46, col, x, 0.45 + k * 0.09, z)
    b.box(0.46, 0.45, 0.05, col, x, 0.7 + k * 0.09, z - 0.21)
  }
  for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) b.box(0.04, 0.45, 0.04, col, x + dx, 0.22, z + dz)
}

export function generatorSet(c: Ctx, x: number, z: number) {
  const b = c.solid
  b.box(0.7, 0.5, 0.5, '#e2b100', x, 0.3, z)
  b.box(0.6, 0.15, 0.4, '#2b2b2b', x, 0.62, z)
  b.cyl(0.05, 0.05, 0.25, '#555', x + 0.25, 0.75, z, 6)
  b.box(0.8, 0.05, 0.6, '#1b1b1b', x, 0.03, z)
}

export function sackPile(c: Ctx, x: number, z: number) {
  const b = c.solid
  for (let k = 0; k < 6; k++) b.box(0.75, 0.22, 0.45, k % 2 ? '#e8dcc0' : '#d9c8a0', x + (k % 2) * 0.1, 0.12 + Math.floor(k / 2) * 0.22, z + (k % 2 ? 0.1 : -0.1), { ry: (k % 3) * 0.1 })
  addCollider(c, x, z, 0.9, 0.7, 0)
}

/** Entrance arch with a painted signboard. */
export function marketArch(c: Ctx, x: number, z: number, ry: number, text: string) {
  c.solid.at(x, z, ry, () => {
    const b = c.solid
    for (const s of [-4.2, 4.2]) b.box(0.4, 4.8, 0.4, '#1f8a4c', s, 2.4, 0)
    b.box(9.2, 1.2, 0.3, '#ffffff', 0, 5.0, 0)
    b.box(9.4, 0.12, 0.34, '#1f8a4c', 0, 5.62, 0)
    b.box(9.4, 0.12, 0.34, '#1f8a4c', 0, 4.38, 0)
  })
  for (const s of [-4.2, 4.2]) addCollider(c, x + Math.cos(ry) * s, z - Math.sin(ry) * s, 0.5, 0.5, ry)
  ;(c.signs ??= []).push({ x: x + Math.sin(ry) * 0.17, y: 5.0, z: z + Math.cos(ry) * 0.17, ry, w: 8.8, h: 1.05, text, bg: '#ffffff', fg: '#1f8a4c' })
  ;(c.signs ??= []).push({ x: x - Math.sin(ry) * 0.17, y: 5.0, z: z - Math.cos(ry) * 0.17, ry: ry + Math.PI, w: 8.8, h: 1.05, text, bg: '#ffffff', fg: '#1f8a4c' })
}
