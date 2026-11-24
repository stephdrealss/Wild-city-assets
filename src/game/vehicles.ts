import * as THREE from 'three'
import { Batch, GLASS_MAT, GLOW, LIT, METAL, PAINT } from './batch'

const TYRE = '#16161a'
const GLASS = '#9fc4e6'

interface Set {
  paint: Batch
  trim: Batch
  metal: Batch
  glass: Batch
  glow: Batch
}
const newSet = (): Set => ({ paint: new Batch(), trim: new Batch(), metal: new Batch(), glass: new Batch(), glow: new Batch() })

function wheel(s: Set, x: number, z: number, r = 0.34, w = 0.16) {
  // tyre with a rounded shoulder, steel rim, hub and lug nuts
  s.trim.cyl(r, r, w, TYRE, x, r, z, 18, { rz: Math.PI / 2 })
  s.trim.torus(r * 0.86, w * 0.42, TYRE, x, r, z, { ry: Math.PI / 2 })
  const side = x >= 0 ? 1 : -1
  s.metal.cyl(r * 0.6, r * 0.6, w + 0.02, '#c7ccd4', x, r, z, 16, { rz: Math.PI / 2 })
  s.trim.cyl(r * 0.42, r * 0.42, w + 0.03, '#8d939c', x, r, z, 16, { rz: Math.PI / 2 })
  s.metal.cyl(r * 0.16, r * 0.16, w + 0.05, '#e5e8ee', x, r, z, 10, { rz: Math.PI / 2 })
  for (let k = 0; k < 5; k++) {
    const t = (k / 5) * Math.PI * 2
    s.metal.cyl(r * 0.04, r * 0.04, 0.02, '#f2f4f7', x + side * (w / 2 + 0.03), r + Math.cos(t) * r * 0.27, z + Math.sin(t) * r * 0.27, 6, { rz: Math.PI / 2 })
  }
}

/** Nigerian-style number plate: white with green "WILD CITY" band. Fictional state code. */
function plate(s: Set, y: number, z: number, back = false) {
  const dz = back ? -0.01 : 0.01
  s.trim.box(0.52, 0.14, 0.02, '#f4f6f2', 0, y, z)
  s.trim.box(0.52, 0.03, 0.022, '#1f8a4c', 0, y + 0.045, z + dz)
  s.trim.box(0.3, 0.035, 0.022, '#1c2a5a', 0, y - 0.01, z + dz)
}

function mirror(s: Set, x: number, y: number, z: number, color: string) {
  s.paint.rbox(0.05, 0.12, 0.16, 0.02, color, x, y, z)
  s.glass.box(0.012, 0.1, 0.13, '#cfe6ff', x + (x > 0 ? 0.03 : -0.03), y, z)
  s.trim.box(0.14, 0.02, 0.02, '#1a1a1a', x - (x > 0 ? 0.07 : -0.07), y - 0.03, z)
}

function finish(s: Set) {
  const g = new THREE.Group()
  const add = (b: Batch, m: THREE.Material, shadow = true) => {
    const mesh = b.mesh(m)
    if (mesh) {
      mesh.castShadow = shadow
      mesh.receiveShadow = true
      g.add(mesh)
    }
  }
  add(s.paint, PAINT)
  add(s.trim, LIT)
  add(s.metal, METAL)
  add(s.glass, GLASS_MAT, false)
  add(s.glow, GLOW, false)
  return g
}

/** Danfo: the yellow commuter bus with two black stripes, sliding door, roof rack and a load on top. */
export function makeBus() {
  const s = newSet()
  const p = s.paint
  const Y = '#f5c400'
  const L = 4.8
  // body and rounded roof
  p.rbox(1.9, 1.5, L, 0.18, Y, 0, 1.2, 0)
  p.rbox(1.86, 0.35, L - 0.25, 0.16, Y, 0, 2.02, -0.05)
  // short sloped nose
  p.rbox(1.88, 0.75, 0.5, 0.2, Y, 0, 0.95, L / 2 + 0.05)
  // two black stripes along both sides and across the front
  for (const sy of [0.98, 1.24]) {
    s.trim.box(1.92, 0.07, L - 0.3, '#111', 0, sy, -0.05)
    s.trim.box(1.7, 0.07, 0.02, '#111', 0, sy - 0.1, L / 2 + 0.31)
  }
  // windows: windscreen, side windows with black pillars, rear window
  s.paint.rbox(1.72, 0.66, 0.05, 0.05, '#1b242c', 0, 1.62, L / 2 + 0.03, { rx: -0.12 })
  for (let i = 0; i < 4; i++) {
    for (const x of [-0.962, 0.962]) s.paint.box(0.03, 0.55, 0.88, '#1b242c', x, 1.62, 1.55 - i * 1.02)
  }
  for (let i = 0; i < 5; i++) for (const x of [-0.968, 0.968]) s.trim.box(0.025, 0.6, 0.1, '#151515', x, 1.62, 2.02 - i * 1.02)
  s.paint.box(1.6, 0.55, 0.03, '#1b242c', 0, 1.62, -L / 2 - 0.02)
  // sliding door seam and handle (right side)
  s.trim.box(0.02, 1.1, 0.02, '#1a1a1a', 0.958, 1.25, 0.95)
  s.trim.box(0.02, 1.1, 0.02, '#1a1a1a', 0.958, 1.25, -0.2)
  s.metal.box(0.03, 0.04, 0.2, '#d7dbe2', 0.97, 1.2, 0.15)
  // bumpers, grille, round headlights, indicators
  s.trim.rbox(1.96, 0.18, 0.18, 0.06, '#1b1b1b', 0, 0.5, L / 2 + 0.33)
  s.trim.rbox(1.96, 0.18, 0.18, 0.06, '#1b1b1b', 0, 0.5, -L / 2 - 0.05)
  s.trim.box(0.9, 0.18, 0.03, '#222', 0, 0.82, L / 2 + 0.31)
  for (const x of [-0.68, 0.68]) {
    s.metal.cyl(0.11, 0.11, 0.04, '#d9dde3', x, 0.84, L / 2 + 0.31, 16, { rx: Math.PI / 2 })
    s.glow.cyl(0.085, 0.085, 0.045, '#fff6c8', x, 0.84, L / 2 + 0.315, 16, { rx: Math.PI / 2 })
    s.glow.box(0.12, 0.06, 0.03, '#ffae00', x * 1.25, 0.68, L / 2 + 0.31)
    s.glow.box(0.12, 0.26, 0.04, '#ff2a2a', x * 1.15, 0.95, -L / 2 - 0.02)
    mirror(s, x * 1.48, 1.55, L / 2 - 0.15, Y)
  }
  plate(s, 0.5, L / 2 + 0.43)
  plate(s, 0.7, -L / 2 - 0.03, true)
  // roof rack with bags and a bag of garri on top
  for (const x of [-0.8, 0.8]) s.metal.box(0.04, 0.04, 2.8, '#b8bec6', x, 2.25, -0.3)
  for (let i = 0; i < 4; i++) s.metal.box(1.64, 0.03, 0.03, '#b8bec6', 0, 2.25, 0.9 - i * 0.8)
  s.trim.rbox(0.8, 0.35, 0.6, 0.1, '#3a6ea5', -0.3, 2.43, 0.2)
  s.trim.rbox(0.6, 0.3, 0.5, 0.12, '#d8c7a0', 0.4, 2.4, -0.7)
  s.trim.rbox(0.5, 0.25, 0.7, 0.08, '#b0322a', -0.25, 2.38, -1.3)
  // wheels in arches
  for (const x of [-0.86, 0.86]) {
    s.trim.cyl(0.42, 0.42, 0.04, '#121212', x * 1.08, 0.42, 1.5, 16, { rz: Math.PI / 2 })
    s.trim.cyl(0.42, 0.42, 0.04, '#121212', x * 1.08, 0.42, -1.55, 16, { rz: Math.PI / 2 })
    wheel(s, x * 1.02, 1.5, 0.38, 0.24)
    wheel(s, x * 1.02, -1.55, 0.38, 0.24)
  }
  return finish(s)
}

/** Okada: a commuter motorcycle (Boxer style) with a long seat, rear carrier and crash bars. */
export function makeOkada(color = '#ff7a1a') {
  const s = newSet()
  wheel(s, 0, 0.72, 0.33, 0.1)
  wheel(s, 0, -0.68, 0.33, 0.12)
  // frame, engine and exhaust
  s.trim.box(0.05, 0.05, 1.1, '#1d1d1f', 0, 0.62, 0.05, { rx: -0.15 })
  s.metal.rbox(0.24, 0.26, 0.34, 0.06, '#6f7680', 0, 0.42, 0.08)
  s.metal.cyl(0.035, 0.035, 0.9, '#c4c9d0', 0.13, 0.33, -0.25, 10, { rx: Math.PI / 2 + 0.08 })
  s.metal.cyl(0.05, 0.045, 0.3, '#8d939c', 0.14, 0.38, -0.65, 10, { rx: Math.PI / 2 })
  // fuel tank, side panels, seat
  s.paint.rbox(0.3, 0.22, 0.48, 0.1, color, 0, 0.86, 0.22)
  s.trim.box(0.05, 0.03, 0.44, '#ffffff', 0.15, 0.88, 0.22)
  s.trim.box(0.05, 0.03, 0.44, '#ffffff', -0.15, 0.88, 0.22)
  s.paint.rbox(0.26, 0.18, 0.36, 0.06, color, 0, 0.66, -0.25)
  s.trim.rbox(0.3, 0.1, 0.82, 0.05, '#141416', 0, 0.86, -0.28)
  // rear carrier and mudguard
  s.metal.box(0.32, 0.03, 0.34, '#bfc5cd', 0, 0.88, -0.78)
  s.paint.rbox(0.14, 0.04, 0.5, 0.02, color, 0, 0.72, -0.72, { rx: 0.2 })
  // front fork, headlight, handlebar with mirrors
  for (const x of [-0.07, 0.07]) s.metal.cyl(0.022, 0.022, 0.7, '#c9ced6', x, 0.7, 0.66, 8, { rx: -0.32 })
  s.paint.rbox(0.2, 0.14, 0.12, 0.05, color, 0, 1.0, 0.82)
  s.glow.cyl(0.07, 0.07, 0.03, '#fff3b0', 0, 1.0, 0.885, 14, { rx: Math.PI / 2 })
  s.metal.cyl(0.015, 0.015, 0.72, '#c9ced6', 0, 1.1, 0.7, 8, { rz: Math.PI / 2 })
  for (const x of [-0.36, 0.36]) {
    s.trim.cyl(0.022, 0.022, 0.12, '#141416', x, 1.1, 0.7, 8, { rz: Math.PI / 2 })
    s.metal.cyl(0.006, 0.006, 0.22, '#c9ced6', x * 0.8, 1.2, 0.68, 6)
    s.glass.cyl(0.04, 0.04, 0.01, '#cfe6ff', x * 0.8, 1.31, 0.68, 12, { rx: Math.PI / 2 })
  }
  // crash bars, tail light, plate
  for (const x of [-0.2, 0.2]) s.metal.cyl(0.015, 0.015, 0.32, '#c9ced6', x, 0.5, 0.36, 6)
  s.glow.box(0.12, 0.06, 0.04, '#ff3030', 0, 0.8, -0.96)
  s.trim.box(0.22, 0.12, 0.01, '#f4f6f2', 0, 0.7, -0.99)
  return { group: finish(s), seatX: 0, seatY: 0.88, seatZ: -0.35 }
}

/** Keke (tricycle): yellow with green trim, canvas roof, open sides and a little front cowl. */
export function makeKeke(color = '#ffd12e') {
  const s = newSet()
  const G = '#1f8a4c'
  wheel(s, 0, 1.15, 0.27, 0.12)
  wheel(s, -0.66, -0.72, 0.27, 0.14)
  wheel(s, 0.66, -0.72, 0.27, 0.14)
  // passenger tub and rear engine box
  s.paint.rbox(1.42, 0.58, 1.6, 0.18, color, 0, 0.66, -0.5)
  s.paint.rbox(1.3, 0.35, 0.4, 0.1, color, 0, 0.6, -1.32)
  s.trim.box(1.44, 0.06, 1.62, G, 0, 0.98, -0.5)
  // front cowl and windscreen frame
  s.paint.rbox(0.56, 0.6, 0.55, 0.2, color, 0, 0.75, 0.88)
  s.paint.rbox(1.25, 0.95, 0.12, 0.1, color, 0, 1.3, 0.48, { rx: -0.08 })
  s.paint.box(1.0, 0.62, 0.03, '#bcd9f0', 0, 1.45, 0.55, { rx: -0.08 })
  s.glow.cyl(0.08, 0.08, 0.04, '#fff3b0', 0, 0.95, 1.16, 14, { rx: Math.PI / 2 })
  // curved canvas roof on black poles
  s.trim.rbox(1.46, 0.08, 2.05, 0.04, '#121212', 0, 2.0, -0.42)
  s.paint.rbox(1.4, 0.12, 1.95, 0.06, G, 0, 2.07, -0.42)
  for (const x of [-0.66, 0.66]) {
    s.trim.cyl(0.035, 0.035, 1.05, '#141414', x, 1.48, -1.3, 8)
    s.trim.cyl(0.035, 0.035, 0.95, '#141414', x, 1.5, 0.45, 8)
    // rain flaps rolled up
    s.trim.cyl(0.05, 0.05, 0.9, '#2c2c2c', x, 1.92, -0.42, 8, { rx: Math.PI / 2 })
  }
  // bench seat and back rest
  s.trim.rbox(1.2, 0.12, 0.45, 0.05, '#232326', 0, 0.98, -0.75)
  s.trim.rbox(1.2, 0.5, 0.1, 0.05, '#232326', 0, 1.25, -1.0)
  // handlebar, mirrors, tail lights, plate
  s.metal.cyl(0.015, 0.015, 0.6, '#c9ced6', 0, 1.15, 0.4, 8, { rz: Math.PI / 2 })
  for (const x of [-0.62, 0.62]) mirror(s, x, 1.55, 0.58, color)
  for (const x of [-0.5, 0.5]) s.glow.box(0.12, 0.08, 0.04, '#ff3030', x, 0.75, -1.53)
  s.trim.box(0.4, 0.12, 0.01, '#f4f6f2', 0, 0.6, -1.53)
  return { group: finish(s), seatX: 0, seatY: 0.75, seatZ: 0.15 }
}

/** Saloon car: rounded body, proper cabin, chrome grille, mirrors, door lines and plates. */
export function makeCar(color = '#2fb6a3') {
  const s = newSet()
  const p = s.paint
  // lower body, bonnet and boot, cabin
  p.rbox(1.82, 0.5, 4.4, 0.2, color, 0, 0.72, 0)
  p.rbox(1.74, 0.14, 1.25, 0.08, color, 0, 0.99, 1.45, { rx: -0.05 })
  p.rbox(1.74, 0.14, 0.95, 0.08, color, 0, 1.0, -1.62, { rx: 0.04 })
  p.rbox(1.6, 0.5, 2.0, 0.2, color, 0, 1.25, -0.15)
  // dark wheel arches
  for (const x of [-0.915, 0.915]) for (const z of [1.35, -1.35]) s.trim.cyl(0.42, 0.42, 0.02, '#0e0e10', x, 0.52, z, 18, { rz: Math.PI / 2 })
  // glass: windscreen, rear, sides
  s.paint.rbox(1.46, 0.5, 0.05, 0.04, '#1b242c', 0, 1.27, 0.9, { rx: -0.55 })
  s.paint.rbox(1.46, 0.42, 0.05, 0.04, '#1b242c', 0, 1.27, -1.2, { rx: 0.6 })
  for (const x of [-0.81, 0.81]) {
    s.paint.box(0.02, 0.34, 1.72, '#1b242c', x * 1.006, 1.3, -0.15)
    s.trim.box(0.025, 0.4, 0.08, '#151515', x * 1.012, 1.3, -0.15)
    // door seams and handles
    s.trim.box(0.015, 0.42, 0.015, '#151515', x * 1.13, 0.8, 0.6)
    s.trim.box(0.015, 0.42, 0.015, '#151515', x * 1.13, 0.8, -0.25)
    s.metal.box(0.02, 0.03, 0.14, '#d7dbe2', x * 1.13, 0.92, 0.35)
    s.metal.box(0.02, 0.03, 0.14, '#d7dbe2', x * 1.13, 0.92, -0.5)
    mirror(s, x * 1.17, 1.1, 0.78, color)
  }
  // bumpers, chrome grille, lamps, plates
  s.trim.rbox(1.86, 0.2, 0.2, 0.08, '#1b1b1d', 0, 0.45, 2.17)
  s.trim.rbox(1.86, 0.2, 0.2, 0.08, '#1b1b1d', 0, 0.45, -2.17)
  s.metal.rbox(0.7, 0.16, 0.04, 0.03, '#dfe3e8', 0, 0.72, 2.2)
  for (let i = 0; i < 3; i++) s.trim.box(0.62, 0.015, 0.045, '#2a2a2a', 0, 0.67 + i * 0.05, 2.215)
  for (const x of [-0.62, 0.62]) {
    s.glow.rbox(0.36, 0.13, 0.06, 0.04, '#fff6d0', x, 0.74, 2.17)
    s.glow.rbox(0.38, 0.12, 0.06, 0.04, '#ff2626', x, 0.8, -2.17)
    s.glow.box(0.08, 0.05, 0.04, '#ffae00', x * 1.35, 0.62, 2.19)
  }
  plate(s, 0.46, 2.28)
  plate(s, 0.62, -2.21, true)
  for (const x of [-0.86, 0.86]) {
    wheel(s, x, 1.35, 0.35, 0.24)
    wheel(s, x, -1.35, 0.35, 0.24)
  }
  return { group: finish(s), seatX: -0.42, seatY: 0.55, seatZ: 0.0 }
}

/** Sports car: low, wide, smooth wedge with a glass bubble cabin and a rear wing. */
export function makeSports(color = '#ff2d78') {
  const s = newSet()
  const p = s.paint
  p.rbox(1.98, 0.42, 4.6, 0.2, color, 0, 0.5, 0)
  p.rbox(1.9, 0.16, 1.7, 0.12, color, 0, 0.72, 1.4, { rx: -0.1 })
  p.rbox(1.5, 0.36, 1.7, 0.2, color, 0, 0.9, -0.3)
  s.paint.rbox(1.4, 0.42, 0.05, 0.04, '#1b242c', 0, 0.95, 0.56, { rx: -0.85 })
  s.paint.rbox(1.36, 0.36, 0.05, 0.04, '#1b242c', 0, 0.95, -1.16, { rx: 0.75 })
  for (const x of [-0.755, 0.755]) {
    s.paint.box(0.02, 0.26, 1.4, '#1b242c', x * 1.005, 0.97, -0.3)
    mirror(s, x * 1.28, 0.88, 0.45, color)
    // side intake
    s.trim.box(0.03, 0.12, 0.5, '#111', x * 1.31, 0.5, -0.85)
  }
  s.trim.rbox(1.9, 0.06, 0.45, 0.02, '#141416', 0, 1.1, -2.1)
  for (const x of [-0.72, 0.72]) s.trim.box(0.06, 0.28, 0.1, '#141416', x, 0.95, -2.1)
  s.trim.rbox(1.6, 0.12, 0.12, 0.05, '#141416', 0, 0.36, 2.3)
  s.metal.box(0.12, 0.01, 4.4, '#ffffff', 0.32, 0.72, 0)
  s.metal.box(0.12, 0.01, 4.4, '#ffffff', -0.32, 0.72, 0)
  for (const x of [-0.66, 0.66]) {
    s.glow.rbox(0.42, 0.08, 0.06, 0.03, '#bff8ff', x, 0.58, 2.3)
    s.glow.rbox(0.5, 0.07, 0.06, 0.03, '#ff2020', x, 0.62, -2.31)
  }
  plate(s, 0.42, 2.37)
  for (const x of [-0.98, 0.98]) {
    wheel(s, x, 1.45, 0.35, 0.27)
    wheel(s, x, -1.4, 0.37, 0.3)
  }
  return { group: finish(s), seatX: -0.4, seatY: 0.27, seatZ: -0.1 }
}

export interface PlayerVehicle {
  group: THREE.Group
  seatX: number
  seatY: number
  seatZ: number
}

export function makePlayerVehicle(id: number): PlayerVehicle {
  if (id === 0) return makeOkada('#ff7a1a')
  if (id === 1) return makeKeke('#ffd12e')
  if (id === 2) return makeCar('#2fb6a3')
  return makeSports('#ff2d78')
}
