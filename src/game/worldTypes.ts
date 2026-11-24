import type { StallTheme } from './data'
import * as THREE from 'three'
import type { Batch } from './batch'
import type { DistrictId } from './data'
import type { PoiKind } from './store'

export interface Collider {
  x0: number
  x1: number
  z0: number
  z1: number
}

export interface Poi {
  id: string
  kind: PoiKind
  label: string
  x: number
  z: number
  r: number
  district: DistrictId
  color: string
  music?: boolean
  extra?: number
  marker?: THREE.Group
  diamond?: THREE.Mesh
}

export interface Spot {
  x: number
  z: number
  ry: number
  kind: 'vendor' | 'chatter' | 'sitter'
  /** what the stall behind a vendor sells */
  goods?: StallTheme
}

export interface Ctx {
  solid: Batch
  glow: Batch
  towers: Batch
  fabric: Batch
  lamp: Batch
  cols: Collider[]
  pois: Poi[]
  drops: { x: number; z: number; district: DistrictId; label: string }[]
  spots: Spot[]
  /** painted signboards with text (market arch etc.) */
  signs?: { x: number; y: number; z: number; ry: number; w: number; h: number; text: string; bg: string; fg: string }[]
  rand: () => number
}

export const POI_COLORS: Record<PoiKind, string> = {
  food: '#ff9f1c',
  delivery: '#ff2d9b',
  bus: '#ffc61a',
  stall: '#27c1a8',
  repair: '#4a8fe8',
  dj: '#b04fe8',
  home: '#ff6b4a',
  agent: '#7be0ff',
  dealer: '#ff2d78',
  boutique: '#e8478b',
  broker: '#ffd12e',
  trade: '#38ffd0',
  leaderboard: '#ffd12e',
  business: '#8ad14b',
  bench: '#c9ced6',
}

export function mulberry(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
