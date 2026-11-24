import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { DEFAULT_OUTFIT, OUTFITS } from './data'
import type { HumanTemplate } from './humanoid'
import type { Wearing } from './store'

export type HairStyle = 'bob' | 'short' | 'afro' | 'wrap' | 'bald' | 'puffs' | 'braids' | 'curls'

export interface Look {
  skin: string
  hair: string
  hairStyle: HairStyle
  top: string
  bottom: string
  shoes: string
  accent: string
  topMap?: THREE.Texture | null
  long?: boolean
  collar?: boolean
  zipper?: boolean
  trim?: boolean
  apron?: boolean
  acc?: number
  /** body type: width multiplier and overall height in metres */
  width?: number
  height?: number
}

/** Meshes the game can show or hide by name. Custom models without these names simply ignore them. */
const TOGGLES = new Set(['Hair_bob', 'Hair_short', 'Hair_afro', 'Hair_wrap', 'Hair_puffs', 'Hair_braids', 'Hair_curls', 'Skirt', 'Apron', 'Collar', 'Zipper', 'Trim', 'Acc_chain', 'Acc_hat', 'Acc_backpack'])
const baseName = (n: string) => n.replace(/_\d+$/, '')

const ALIASES: Record<string, string[]> = {
  idle: ['idle', 'stand', 'breath'],
  walk: ['walk'],
  run: ['run', 'jog', 'sprint'],
  jump: ['jump'],
  sit: ['sit', 'seated'],
  talk: ['talk', 'gesture', 'speak', 'wave'],
  drive: ['drive', 'ride', 'sit'],
}

export type Anim = 'idle' | 'walk' | 'run' | 'jump' | 'sit' | 'talk' | 'drive'

const measured = new WeakMap<THREE.Object3D, { height: number; minY: number }>()

export class Human {
  group = new THREE.Group()
  model: THREE.Object3D
  mixer: THREE.AnimationMixer
  private actions = new Map<Anim, THREE.AnimationAction>()
  current: Anim | '' = ''
  private owned: THREE.Material[] = []
  private meshes: THREE.Mesh[] = []
  private pending = 0
  private lookKey = ''

  constructor(tpl: HumanTemplate, look: Look) {
    this.model = cloneSkinned(tpl.scene)
    this.group.add(this.model)
    this.mixer = new THREE.AnimationMixer(this.model)
    for (const key of Object.keys(ALIASES) as Anim[]) {
      const clip = ALIASES[key].map((a) => tpl.clips.find((c) => c.name.toLowerCase().includes(a))).find(Boolean)
      if (!clip) continue
      const act = this.mixer.clipAction(clip)
      if (key === 'jump') {
        act.setLoop(THREE.LoopOnce, 1)
        act.clampWhenFinished = true
      }
      this.actions.set(key, act)
    }
    // own materials so each person can be tinted independently
    const cloned = new Map<THREE.Material, THREE.Material>()
    const own = (m: THREE.Material) => {
      let c = cloned.get(m)
      if (!c) {
        c = m.clone()
        cloned.set(m, c)
        this.owned.push(c)
      }
      return c
    }
    this.model.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.frustumCulled = false
      m.castShadow = true
      m.receiveShadow = true
      m.material = Array.isArray(m.material) ? m.material.map(own) : own(m.material)
      this.meshes.push(m)
    })
    if (!measured.has(tpl.scene)) {
      this.model.updateMatrixWorld(true)
      const box = new THREE.Box3()
      let any = false
      for (const m of this.meshes) {
        if (['Body_skin', 'Body_shoes'].includes(baseName(m.name))) {
          box.expandByObject(m)
          any = true
        }
      }
      if (!any) box.setFromObject(this.model)
      measured.set(tpl.scene, { height: Math.max(0.5, box.max.y - box.min.y), minY: box.min.y })
    }
    this.templateHeight = measured.get(tpl.scene)?.height ?? 1.8
    this.templateMinY = measured.get(tpl.scene)?.minY ?? 0
    this.applyLook(look)
    this.play('idle', 0)
    this.mixer.update(Math.random() * 3)
  }
  private templateHeight: number
  private templateMinY = 0

  applyLook(look: Look) {
    const key = JSON.stringify([look.skin, look.hair, look.hairStyle, look.top, look.bottom, look.shoes, look.accent, look.topMap?.uuid, look.long, look.collar, look.zipper, look.trim, look.apron, look.acc, look.width, look.height])
    if (key === this.lookKey) return
    this.lookKey = key
    const hairName = look.hairStyle === 'bald' ? '' : `Hair_${look.hairStyle}`
    const accName = look.acc === 9 ? 'Acc_chain' : look.acc === 10 ? 'Acc_hat' : look.acc === 11 ? 'Acc_backpack' : ''
    const on = new Set<string>([hairName, accName].filter(Boolean))
    if (look.long) on.add('Skirt')
    if (look.collar) on.add('Collar')
    if (look.zipper) on.add('Zipper')
    if (look.trim) on.add('Trim')
    if (look.apron) on.add('Apron')
    const colors: Record<string, string> = { skin: look.skin, hair: look.hair, top: look.top, bottom: look.bottom, shoes: look.shoes, accent: look.accent }
    this.model.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const b = baseName(m.name)
      if (TOGGLES.has(b)) m.visible = on.has(b)
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial
        const c = colors[std.name]
        if (c && std.color) std.color.set(c)
        if (std.name === 'top') {
          const wasMap = std.map
          std.map = look.topMap ?? null
          if (look.topMap) std.color.set('#ffffff')
          if (wasMap !== std.map) std.needsUpdate = true
        }
      }
    })
    const w = look.width ?? 1
    const s = (look.height ?? 1.72) / this.templateHeight
    this.model.scale.set(s * w, s, s * w)
    // keep the soles on the ground whatever the model's own origin is
    this.model.position.y = -this.templateMinY * s
  }

  setCast(on: boolean) {
    for (const m of this.meshes) m.castShadow = on
  }

  has(a: Anim) {
    return this.actions.has(a)
  }

  play(name: Anim, fade = 0.25, timeScale = 1) {
    const next = this.actions.get(name) ?? this.actions.get('idle')
    if (!next) return
    if (this.current === name) {
      next.timeScale = timeScale
      return
    }
    const prev = this.current ? this.actions.get(this.current) : undefined
    next.enabled = true
    next.timeScale = timeScale
    next.setEffectiveWeight(1)
    if (name === 'jump') next.reset()
    if (prev && fade > 0) {
      next.reset().play()
      prev.crossFadeTo(next, fade, false)
    } else {
      prev?.stop()
      next.reset().play()
    }
    this.current = name
  }

  /** Blend between idle, walk and run from a ground speed in metres per second. */
  locomote(speed: number, fade = 0.22) {
    if (speed < 0.25) this.play('idle', fade)
    else if (speed < 3.4) this.play('walk', fade, Math.max(0.6, speed / 1.9))
    else this.play('run', fade, Math.min(1.9, speed / 4.3))
  }

  /** `rate` below 1 skips frames, used for people far from the camera. */
  update(dt: number, interval = 0) {
    if (interval > 0) {
      this.pending += dt
      if (this.pending < interval) return
      dt = this.pending
      this.pending = 0
    }
    this.mixer.update(dt)
    this.applyReach()
  }

  /** Right arm reaching for a point in the world (weight 0-1), on top of whatever animation is playing. */
  reach: { target: THREE.Vector3; w: number } | null = null
  /** Left arm, the same way (holding up her phone) */
  reachLeft: { target: THREE.Vector3; w: number } | null = null
  private arms: Partial<Record<'R' | 'L', { upper: THREE.Object3D; fore: THREE.Object3D; hand: THREE.Object3D } | null>> = {}
  private armOf(side: 'R' | 'L') {
    if (!(side in this.arms)) {
      const find = (re: RegExp) => {
        let f: THREE.Object3D | null = null
        this.model.traverse((o) => {
          if (!f && re.test(o.name)) f = o
        })
        return f as THREE.Object3D | null
      }
      const upper = find(side === 'R' ? /(RightArm|R_UpperArm)$/ : /(LeftArm|L_UpperArm)$/)
      const fore = find(side === 'R' ? /(RightForeArm|R_Forearm)$/ : /(LeftForeArm|L_Forearm)$/)
      const hand = find(side === 'R' ? /(RightHand|R_Hand)$/ : /(LeftHand|L_Hand)$/)
      this.arms[side] = upper && fore && hand ? { upper, fore, hand } : null
    }
    return this.arms[side] ?? null
  }
  private applyReach() {
    this.reachArm('R', this.reach)
    this.reachArm('L', this.reachLeft)
  }
  private reachArm(side: 'R' | 'L', r: { target: THREE.Vector3; w: number } | null) {
    if (!r || r.w <= 0.001) return
    const arm = this.armOf(side)
    if (!arm) return
    const { upper, fore, hand } = arm
    upper.parent?.updateMatrixWorld(true)
    const bp = new THREE.Vector3()
    const hp = new THREE.Vector3()
    const pq = new THREE.Quaternion()
    const q = new THREE.Quaternion()
    // two passes of "point this bone so the hand goes towards the target", forearm then upper arm
    for (let pass = 0; pass < 2; pass++) {
      for (const b of [fore, upper]) {
        b.updateMatrixWorld(true)
        b.getWorldPosition(bp)
        hand.getWorldPosition(hp)
        const from = hp.sub(bp).normalize()
        const to = r.target.clone().sub(bp).normalize()
        if (from.lengthSq() < 1e-6 || to.lengthSq() < 1e-6) continue
        q.setFromUnitVectors(from, to)
        q.slerp(new THREE.Quaternion(), 1 - Math.min(1, r.w) * (b === fore ? 0.6 : 1))
        b.parent!.getWorldQuaternion(pq)
        const local = pq.clone().invert().multiply(q).multiply(pq)
        b.quaternion.premultiply(local)
      }
    }
    upper.updateMatrixWorld(true)
  }

  dispose() {
    this.mixer.stopAllAction()
    this.mixer.uncacheRoot(this.model)
    this.owned.forEach((m) => m.dispose())
  }
}

/* ---------- distant stand-in: one draw call, no skeleton ---------- */
let impostorGeo: THREE.BufferGeometry | null = null
export function makeImpostor(color: string, height = 1.72) {
  if (!impostorGeo) {
    const body = new THREE.CapsuleGeometry(0.2, 0.75, 3, 8)
    body.translate(0, 1.0, 0)
    body.scale(1, 1, 0.62)
    const head = new THREE.SphereGeometry(0.11, 8, 6)
    head.translate(0, 1.66, 0)
    const legs = new THREE.CylinderGeometry(0.15, 0.1, 0.7, 8)
    legs.translate(0, 0.35, 0)
    impostorGeo = mergeGeometries([body.toNonIndexed(), head.toNonIndexed(), legs.toNonIndexed()], false)
  }
  const mesh = new THREE.Mesh(impostorGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))
  mesh.scale.setScalar(height / 1.78)
  mesh.castShadow = false
  return mesh
}

/* ---------- player look from the wardrobe ---------- */
export function playerLook(w: Wearing): Look {
  const out = OUTFITS.find((x) => x.id === w.outfit)
  const isDefault = !out
  return {
    skin: '#b4713f',
    hair: '#0b0b10',
    hairStyle: w.hair === 6 ? 'puffs' : w.hair === 7 ? 'braids' : w.hair === 8 ? 'curls' : 'bob',
    top: out?.top ?? DEFAULT_OUTFIT.top,
    bottom: out?.bottom ?? DEFAULT_OUTFIT.bottom,
    shoes: '#f4f4f8',
    accent: out?.accent ?? DEFAULT_OUTFIT.accent,
    long: !!out?.long,
    collar: isDefault || out?.id === 2,
    zipper: isDefault || out?.id === 2,
    trim: true,
    acc: w.acc,
    height: 1.72,
  }
}
