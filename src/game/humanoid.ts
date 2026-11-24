/**
 * Procedural rigged humanoid. Used two ways:
 *  - scripts/generate-models.ts exports it to the placeholder .glb files in public/models/
 *  - the game falls back to it at runtime if a .glb cannot be loaded.
 * Pure three.js (no DOM), so it also runs under Bun.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export type HumanKind = 'player' | 'female' | 'male' | 'child'

/** Bone name, parent, world rest position of the +x side (mirrored for the other side). */
const BONES: [string, string | null, number, number, number][] = [
  ['Hips', null, 0, 0.95, 0],
  ['Spine', 'Hips', 0, 1.05, 0],
  ['Chest', 'Spine', 0, 1.25, 0],
  ['Neck', 'Chest', 0, 1.46, 0],
  ['Head', 'Neck', 0, 1.55, 0],
  ['UpperArm_L', 'Chest', 0.2, 1.4, 0],
  ['Forearm_L', 'UpperArm_L', 0.2, 1.12, 0],
  ['Hand_L', 'Forearm_L', 0.2, 0.86, 0],
  ['UpperArm_R', 'Chest', -0.2, 1.4, 0],
  ['Forearm_R', 'UpperArm_R', -0.2, 1.12, 0],
  ['Hand_R', 'Forearm_R', -0.2, 0.86, 0],
  ['UpLeg_L', 'Hips', 0.09, 0.9, 0],
  ['LowLeg_L', 'UpLeg_L', 0.09, 0.48, 0],
  ['Foot_L', 'LowLeg_L', 0.09, 0.08, 0],
  ['UpLeg_R', 'Hips', -0.09, 0.9, 0],
  ['LowLeg_R', 'UpLeg_R', -0.09, 0.48, 0],
  ['Foot_R', 'LowLeg_R', -0.09, 0.08, 0],
]

export const CLIP_NAMES = ['Idle', 'Walk', 'Run', 'Jump', 'Sit', 'Talk', 'Drive'] as const

const MATS: Record<string, { color: string; rough: number; metal?: number }> = {
  skin: { color: '#b4713f', rough: 0.55 },
  hair: { color: '#0b0b10', rough: 0.28 },
  top: { color: '#ff2d9b', rough: 0.78 },
  bottom: { color: '#1a1a22', rough: 0.85 },
  shoes: { color: '#f4f4f8', rough: 0.5 },
  accent: { color: '#111111', rough: 0.7 },
  eyes: { color: '#1b1210', rough: 0.2 },
  lips: { color: '#8a4a3a', rough: 0.25 },
  brow: { color: '#150e0c', rough: 0.6 },
  frame: { color: '#0a0a0a', rough: 0.3 },
  metal: { color: '#e3e8f0', rough: 0.18, metal: 1 },
  gold: { color: '#ffcc33', rough: 0.25, metal: 1 },
  zipper: { color: '#0a0a0a', rough: 0.4 },
  face: { color: '#ffffff', rough: 0.35 },
}

interface Params {
  chest: number
  waist: number
  hip: number
  shoulder: number
  head: number
  lipsCol: string
}
const PARAMS: Record<HumanKind, Params> = {
  player: { chest: 0.15, waist: 0.118, hip: 0.165, shoulder: 0.19, head: 1, lipsCol: '#8a4a3a' },
  female: { chest: 0.15, waist: 0.12, hip: 0.17, shoulder: 0.18, head: 1, lipsCol: '#7a3f35' },
  male: { chest: 0.175, waist: 0.15, hip: 0.155, shoulder: 0.21, head: 1.02, lipsCol: '#7a4a38' },
  child: { chest: 0.15, waist: 0.14, hip: 0.15, shoulder: 0.19, head: 1.22, lipsCol: '#7a4a38' },
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

export interface HumanTemplate {
  scene: THREE.Group
  clips: THREE.AnimationClip[]
}

export function buildHumanoid(kind: HumanKind): HumanTemplate {
  const P = PARAMS[kind]
  const hero = kind === 'player'

  /* ---------- skeleton ---------- */
  const bones: Record<string, THREE.Bone> = {}
  const world: Record<string, THREE.Vector3> = {}
  const list: THREE.Bone[] = []
  for (const [name, parent, x, y, z] of BONES) {
    const b = new THREE.Bone()
    b.name = name
    world[name] = V(x, y, z)
    const pw = parent ? world[parent] : V(0, 0, 0)
    b.position.copy(world[name]).sub(pw)
    if (parent) bones[parent].add(b)
    bones[name] = b
    list.push(b)
  }
  const idx = (n: string) => list.findIndex((b) => b.name === n)

  /* ---------- geometry buckets ---------- */
  const buckets = new Map<string, { mat: string; geos: THREE.BufferGeometry[] }>()
  const put = (meshName: string, matIn: string, g: THREE.BufferGeometry, bone: string) => {
    let mat = matIn
    const n = g.attributes.position.count
    const si = new Uint16Array(n * 4)
    const sw = new Float32Array(n * 4)
    const bi = idx(bone)
    for (let i = 0; i < n; i++) {
      si[i * 4] = bi
      sw[i * 4] = 1
    }
    if (mat === 'eyes' || mat === 'lips' || mat === 'brow') {
      const c = new THREE.Color(mat === 'lips' ? P.lipsCol : MATS[mat].color)
      const col = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3)
      g.setAttribute('color', new THREE.BufferAttribute(col, 3))
      mat = 'face'
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4))
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4))
    const key = `${meshName}|${mat}`
    const e = buckets.get(key) ?? { mat, geos: [] }
    e.geos.push(g)
    buckets.set(key, e)
  }
  const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz))
    g.applyMatrix4(m)
    return g
  }
  const ell = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, seg = 12) => place(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 3)), x, y, z, sx, sy, sz)
  const cyl = (rt: number, rb: number, y0: number, y1: number, x = 0, z = 0, seg = 12, sz = 1) =>
    place(new THREE.CylinderGeometry(rt, rb, Math.abs(y1 - y0), seg, 1), x, (y0 + y1) / 2, z, 1, 1, sz)
  const lathe = (pts: [number, number][], seg = 16, sz = 1, phi0 = 0, phiLen = Math.PI * 2) => place(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg, phi0, phiLen), 0, 0, 0, 1, 1, sz)
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => place(new THREE.BoxGeometry(w, h, d), x, y, z, 1, 1, 1, rx, ry, rz)
  const torus = (r: number, tube: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
    place(new THREE.TorusGeometry(r, tube, 8, 20), x, y, z, sx, sy, sz, rx, ry, rz)

  const sleeves = true
  /* torso: top material */
  put('Body_top', 'top', lathe([[P.hip * 0.95, 0.88], [P.waist, 1.08], [P.chest, 1.3], [P.shoulder * 0.86, 1.41], [0.075, 1.48]], 18, 0.62), 'Chest')
  put('Body_top', 'top', ell(0.062, 0.2, 1.4, 0, 1, 1, 1, 10), 'UpperArm_L')
  put('Body_top', 'top', ell(0.062, -0.2, 1.4, 0, 1, 1, 1, 10), 'UpperArm_R')
  for (const [s, side] of [[1, 'L'], [-1, 'R']] as const) {
    put('Body_top', 'top', cyl(0.056, 0.047, 1.4, 1.13, s * 0.2, 0, 10), `UpperArm_${side}`)
    put('Body_top', 'top', cyl(0.047, 0.04, 1.13, 0.95, s * 0.2, 0, 10), `Forearm_${side}`)
    put('Body_skin', 'skin', cyl(0.04, 0.032, 0.95, 0.88, s * 0.2, 0, 10), `Forearm_${side}`)
    put('Body_skin', 'skin', ell(0.034, s * 0.2, 0.82, 0.005, 1, 1.5, 0.75, 8), `Hand_${side}`)
    put('Body_accent', 'accent', cyl(0.043, 0.043, 0.97, 0.935, s * 0.2, 0, 10), `Forearm_${side}`)
    /* legs */
    put('Body_bottom', 'bottom', cyl(0.088, 0.064, 0.92, 0.49, s * 0.09, 0, 12), `UpLeg_${side}`)
    put('Body_bottom', 'bottom', ell(0.066, s * 0.09, 0.48, 0.0, 1, 1, 1, 8), `LowLeg_${side}`)
    put('Body_bottom', 'bottom', cyl(0.064, 0.044, 0.48, 0.1, s * 0.09, 0, 12), `LowLeg_${side}`)
    put('Body_skin', 'skin', cyl(0.044, 0.04, 0.1, 0.07, s * 0.09, 0, 8), `LowLeg_${side}`)
    put('Body_shoes', 'shoes', ell(0.05, s * 0.09, 0.05, 0.05, 1, 0.85, 2.5, 10), `Foot_${side}`)
    put('Body_accent', 'accent', box(0.1, 0.012, 0.27, s * 0.09, 0.006, 0.05), `Foot_${side}`)
  }
  void sleeves
  put('Body_bottom', 'bottom', lathe([[P.hip * 0.9, 0.76], [P.hip, 0.88], [P.hip * 0.95, 0.96]], 16, 0.68), 'Hips')
  /* neck + head */
  put('Body_skin', 'skin', cyl(0.05, 0.056, 1.42, 1.54, 0, 0, 10), 'Neck')
  const H = P.head
  put('Body_skin', 'skin', ell(0.1, 0, 1.66, 0, H, 1.17 * H, 1.04 * H, 18), 'Head')
  put('Body_skin', 'skin', ell(0.075, 0, 1.6, 0.02, H, 1.0 * H, 1 * H, 14), 'Head')
  put('Body_skin', 'skin', ell(0.019, 0, 1.64, 0.1 * H, 1, 1.3, 1, 8), 'Head')
  put('Body_skin', 'skin', ell(0.021, 0.098 * H, 1.66, -0.005, 0.5, 1.2, 0.9, 8), 'Head')
  put('Body_skin', 'skin', ell(0.021, -0.098 * H, 1.66, -0.005, 0.5, 1.2, 0.9, 8), 'Head')
  /* face */
  const faceZ = 0.088 * H
  put('Face', 'eyes', ell(0.0125, 0.037 * H, 1.675, faceZ + 0.003, 1, 0.8, 0.6, 8), 'Head')
  put('Face', 'eyes', ell(0.0125, -0.037 * H, 1.675, faceZ + 0.003, 1, 0.8, 0.6, 8), 'Head')
  put('Face', 'lips', box(0.05, 0.011, 0.012, 0, 1.605, 0.092 * H), 'Head')
  put('Face', 'brow', box(0.034, 0.007, 0.008, 0.037 * H, 1.712, 0.093 * H, 0, 0, hero ? 0.2 : 0.05), 'Head')
  put('Face', 'brow', box(0.034, 0.007, 0.008, -0.037 * H, 1.712, 0.093 * H, 0, 0, hero ? -0.2 : -0.05), 'Head')

  /* hair variants (named so the game can toggle them) */
  const cap = (r = 0.108, y = 1.69, thetaLen = 1.6, name = 'Hair_short') => {
    const g = new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, thetaLen)
    put(name, 'hair', place(g, 0, y, -0.012, H * 0.99, 1.14 * H, 1.06 * H), 'Head')
  }
  cap(0.106, 1.69, 1.25, 'Hair_short')
  // sleek bob: bell that stops at the shoulders, open at the front, with a centre part
  const bell: [number, number][] = [[0.001, 1.8], [0.06, 1.79], [0.1, 1.76], [0.118, 1.7], [0.124, 1.62], [0.13, 1.54], [0.132, 1.46]]
  put('Hair_bob', 'hair', lathe(bell, 20, 1.06, 1.0, Math.PI * 2 - 2.0), 'Head')
  cap(0.108, 1.69, 1.3, 'Hair_bob')
  put('Hair_bob', 'hair', place(new THREE.SphereGeometry(0.111, 14, 8, Math.PI / 2 + 0.06, 1.0, 0.3, 1.0), 0, 1.69, -0.012, H, 1.14 * H, 1.06 * H, 0, -0.05, 0), 'Head')
  put('Hair_bob', 'hair', place(new THREE.SphereGeometry(0.111, 14, 8, Math.PI / 2 - 1.06, 1.0, 0.3, 1.0), 0, 1.69, -0.012, H, 1.14 * H, 1.06 * H, 0, 0.05, 0), 'Head')
  cap(0.108, 1.69, 1.35, 'Hair_puffs')
  put('Hair_puffs', 'hair', ell(0.07, 0.1, 1.82, -0.02, 1, 1, 1, 10), 'Head')
  put('Hair_puffs', 'hair', ell(0.07, -0.1, 1.82, -0.02, 1, 1, 1, 10), 'Head')
  cap(0.108, 1.69, 1.35, 'Hair_braids')
  for (let i = 0; i < 11; i++) {
    const a = Math.PI * 0.35 + (i / 10) * (Math.PI * 1.3)
    put('Hair_braids', 'hair', cyl(0.009, 0.007, 1.68, 1.1, Math.sin(a) * 0.115, -Math.cos(a) * 0.1 - 0.02, 5), 'Head')
  }
  cap(0.112, 1.7, 1.3, 'Hair_curls')
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    put('Hair_curls', 'hair', ell(0.032, Math.cos(a) * 0.115, 1.74 + (i % 3) * 0.03, Math.sin(a) * 0.105 - 0.02, 1, 1, 1, 6), 'Head')
  }
  put('Hair_curls', 'hair', ell(0.06, 0, 1.84, -0.02, 1, 0.9, 1, 8), 'Head')
  put('Hair_afro', 'hair', place(new THREE.SphereGeometry(0.17, 16, 12, Math.PI / 2 + 1.0, Math.PI * 2 - 2.0, 0, 2.2), 0, 1.72, -0.03, 1, 1, 1), 'Head')
  cap(0.108, 1.69, 1.3, 'Hair_wrap')
  put('Hair_wrap', 'accent', cyl(0.112, 0.118, 1.76, 1.85, 0, -0.012, 14), 'Head')
  put('Hair_wrap', 'accent', ell(0.075, 0, 1.9, -0.045, 1, 0.75, 1, 10), 'Head')

  /* garments and accessories */
  put('Skirt', 'top', lathe([[P.waist * 1.02, 1.0], [P.hip * 1.35, 0.8], [0.25, 0.4], [0.27, 0.34]], 18, 0.8), 'Hips')
  put('Apron', 'accent', box(0.3, 0.46, 0.03, 0, 1.0, P.chest * 0.62 + 0.02), 'Chest')
  put('Apron', 'accent', box(0.34, 0.05, 0.03, 0, 1.3, P.chest * 0.62 + 0.01), 'Chest')
  put('Collar', 'top', cyl(0.082, 0.092, 1.46, 1.54, 0, 0, 14, 0.9), 'Neck')
  put('Zipper', 'zipper', box(0.012, 0.42, 0.008, 0, 1.17, P.chest * 0.62 + 0.012), 'Chest')
  put('Zipper', 'metal', box(0.024, 0.04, 0.012, 0, 1.4, P.chest * 0.62 + 0.016), 'Chest')
  put('Zipper', 'zipper', box(0.07, 0.01, 0.008, 0.1, 1.0, P.chest * 0.62 + 0.006, 0, 0, 0.15), 'Chest')
  put('Zipper', 'zipper', box(0.07, 0.01, 0.008, -0.1, 1.0, P.chest * 0.62 + 0.006, 0, 0, -0.15), 'Chest')
  put('Trim', 'accent', cyl(P.hip * 0.92, P.hip * 0.95, 0.9, 0.87, 0, 0, 18, 0.62), 'Hips')
  put('Acc_chain', 'gold', torus(0.095, 0.006, 0, 1.42, 0.04, 1, 1, 1, Math.PI / 2 - 0.45), 'Chest')
  put('Acc_hat', 'accent', cyl(0.105, 0.12, 1.8, 1.9, 0, -0.01, 16), 'Head')
  put('Acc_hat', 'accent', cyl(0.18, 0.18, 1.78, 1.8, 0, 0, 18), 'Head')
  put('Acc_backpack', 'accent', box(0.26, 0.34, 0.11, 0, 1.2, -0.14), 'Chest')

  if (hero) {
    for (const s of [1, -1]) {
      put('Glasses', 'frame', torus(0.031, 0.0045, s * 0.038 * H, 1.675, 0.099 * H, 1, 0.9, 0.6), 'Head')
      put('Glasses', 'frame', box(0.036, 0.009, 0.007, s * 0.066 * H, 1.708, 0.096 * H, 0, 0, s * 0.5), 'Head')
      put('Glasses', 'frame', box(0.005, 0.005, 0.1, s * 0.098 * H, 1.69, 0.045), 'Head')
    }
    put('Glasses', 'frame', box(0.02, 0.005, 0.006, 0, 1.682, 0.103 * H), 'Head')
    for (const s of [1, -1]) put('Hoops', 'metal', torus(0.027, 0.0042, s * 0.106 * H, 1.595, 0.018, 1, 1, 1, 0, Math.PI / 2 - 0.2), 'Head')
  }

  /* ---------- skinned meshes ---------- */
  const scene = new THREE.Group()
  scene.name = `Human_${kind}`
  scene.add(bones.Hips)
  scene.updateMatrixWorld(true)
  const skeleton = new THREE.Skeleton(list)
  const mats: Record<string, THREE.MeshStandardMaterial> = {}
  const matFor = (k: string) => {
    if (!mats[k]) {
      const d = MATS[k]
      mats[k] = new THREE.MeshStandardMaterial({ name: k, color: d.color, roughness: d.rough, metalness: d.metal ?? 0, vertexColors: k === 'face' })
    }
    return mats[k]
  }
  for (const [key, b] of buckets) {
    const name = key.split('|')[0]
    const g = mergeGeometries(b.geos, false)
    b.geos.forEach((x) => x.dispose())
    const mesh = new THREE.SkinnedMesh(g, matFor(b.mat))
    mesh.name = name
    mesh.frustumCulled = false
    scene.add(mesh)
    mesh.bind(skeleton)
  }
  return { scene, clips: buildClips() }
}

/* ---------------- animation ---------------- */
type Pose = Record<string, [number, number, number]>

function clip(name: string, duration: number, samples: number, fn: (t: number) => { pose: Pose; hipsY: number }) {
  const times: number[] = []
  const rot: Record<string, number[]> = {}
  const hips: number[] = []
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    times.push(t * duration)
    const { pose, hipsY } = fn(t)
    hips.push(0, hipsY, 0)
    for (const b of BONES.map((x) => x[0])) {
      const r = pose[b] ?? [0, 0, 0]
      q.setFromEuler(e.set(r[0], r[1], r[2]))
      ;(rot[b] ??= []).push(q.x, q.y, q.z, q.w)
    }
  }
  const tracks: THREE.KeyframeTrack[] = Object.entries(rot).map(([b, v]) => new THREE.QuaternionKeyframeTrack(`${b}.quaternion`, times, v))
  tracks.push(new THREE.VectorKeyframeTrack('Hips.position', times, hips))
  return new THREE.AnimationClip(name, duration, tracks)
}

const TAU = Math.PI * 2

function buildClips(): THREE.AnimationClip[] {
  const arms = (ls: number, rs: number, le: number, re: number, out = 0.1): Pose => ({
    UpperArm_L: [ls, 0, out],
    UpperArm_R: [rs, 0, -out],
    Forearm_L: [le, 0, 0],
    Forearm_R: [re, 0, 0],
  })
  const idle = clip('Idle', 3, 24, (t) => {
    const s = Math.sin(t * TAU)
    return {
      hipsY: 0.95 + 0.004 * s,
      pose: { ...arms(0.03 * s, -0.03 * s, -0.12, -0.12, 0.09), Spine: [0.015 * s, 0, 0], Chest: [0.012 * s, 0, 0], Head: [-0.01 * s, 0.05 * Math.sin(t * TAU * 0.5), 0], UpLeg_L: [0, 0, 0.02], UpLeg_R: [0, 0, -0.02] },
    }
  })
  const gait = (name: string, dur: number, legAmp: number, kneeAmp: number, armAmp: number, elbow: number, lean: number, bob: number) =>
    clip(name, dur, 16, (t) => {
      const p = t * TAU
      const s = Math.sin(p)
      const c = Math.cos(p)
      return {
        hipsY: 0.95 + bob * Math.cos(2 * p),
        pose: {
          Hips: [0.03 + lean * 0.4, 0.1 * s * (legAmp / 0.55), 0],
          Spine: [lean * 0.6, -0.12 * s * (legAmp / 0.55), 0],
          Chest: [lean * 0.4, -0.06 * s, 0],
          Head: [-lean, 0.05 * s, 0],
          UpLeg_L: [-legAmp * s, 0, 0.03],
          UpLeg_R: [legAmp * s, 0, -0.03],
          LowLeg_L: [0.1 + kneeAmp * Math.max(0, c), 0, 0],
          LowLeg_R: [0.1 + kneeAmp * Math.max(0, -c), 0, 0],
          Foot_L: [0.15 * s, 0, 0],
          Foot_R: [-0.15 * s, 0, 0],
          ...arms(armAmp * s, -armAmp * s, -elbow - 0.2 * Math.max(0, -s), -elbow - 0.2 * Math.max(0, s), 0.08),
        },
      }
    })
  const walk = gait('Walk', 1.0, 0.5, 0.6, 0.45, 0.25, 0.02, 0.018)
  const run = gait('Run', 0.6, 0.85, 1.05, 0.85, 1.3, 0.16, 0.05)
  const jump = clip('Jump', 1, 20, (t) => {
    const e = Math.sin(Math.PI * t)
    const land = t > 0.85 || t < 0.12 ? 1 : 0
    return {
      hipsY: 0.95 - 0.12 * land + 0.02 * e,
      pose: {
        UpLeg_L: [-0.3 - 0.9 * e - 0.4 * land, 0, 0.05],
        UpLeg_R: [-0.2 - 0.6 * e - 0.4 * land, 0, -0.05],
        LowLeg_L: [0.4 + 1.0 * e + 0.5 * land, 0, 0],
        LowLeg_R: [0.4 + 0.7 * e + 0.5 * land, 0, 0],
        Spine: [0.1 + 0.15 * land, 0, 0],
        ...arms(-2.4 * e - 0.3 * land, -2.4 * e - 0.3 * land, -0.3, -0.3, 0.25),
      },
    }
  })
  const sit = clip('Sit', 4, 16, (t) => {
    const s = Math.sin(t * TAU)
    return {
      hipsY: 0.52 + 0.003 * s,
      pose: {
        UpLeg_L: [-1.5, 0, 0.06],
        UpLeg_R: [-1.5, 0, -0.06],
        LowLeg_L: [1.45, 0, 0],
        LowLeg_R: [1.45, 0, 0],
        Foot_L: [-0.1, 0, 0],
        Foot_R: [-0.1, 0, 0],
        Spine: [-0.03 + 0.01 * s, 0, 0],
        Head: [0, 0.2 * Math.sin(t * TAU * 0.5), 0],
        ...arms(-0.45, -0.45, -0.9, -0.9, 0.12),
      },
    }
  })
  const talk = clip('Talk', 3, 24, (t) => {
    const p = t * TAU
    return {
      hipsY: 0.95 + 0.004 * Math.sin(p),
      pose: {
        Spine: [0.02, 0.08 * Math.sin(p), 0],
        Head: [0.05 * Math.sin(2 * p), 0.14 * Math.sin(p), 0],
        UpLeg_L: [0, 0, 0.03],
        UpLeg_R: [0, 0, -0.03],
        UpperArm_R: [-0.7 + 0.3 * Math.sin(2 * p), 0, -0.25],
        Forearm_R: [-1.3 + 0.4 * Math.sin(4 * p), 0, 0],
        Hand_R: [0.2 * Math.sin(4 * p), 0, 0],
        UpperArm_L: [-0.15, 0, 0.12],
        Forearm_L: [-0.55 + 0.1 * Math.sin(2 * p), 0, 0],
      },
    }
  })
  const drive = clip('Drive', 2, 16, (t) => {
    const s = Math.sin(t * TAU * 4)
    return {
      hipsY: 0.52 + 0.003 * s,
      pose: {
        UpLeg_L: [-1.15, 0, 0.14],
        UpLeg_R: [-1.15, 0, -0.14],
        LowLeg_L: [1.35, 0, 0],
        LowLeg_R: [1.35, 0, 0],
        Foot_L: [-0.3, 0, 0],
        Foot_R: [-0.3, 0, 0],
        Spine: [0.16, 0, 0],
        Head: [-0.14, 0.03 * s, 0],
        ...arms(-1.1, -1.1, -0.45, -0.45, 0.22),
      },
    }
  })
  return [idle, walk, run, jump, sit, talk, drive]
}
