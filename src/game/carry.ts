import * as THREE from 'three'
import type { GoodsId } from './data'
import type { Human } from './human'

/**
 * Things you can see change hands: the seller passes what she bought across, and Ada carries a black nylon bag that
 * fills up as she shops. Sizes are in metres; nothing is parented to bones (bone scales differ between models), the
 * meshes simply follow the hand's world position every frame.
 */

const mat = (color: string, rough = 0.7, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal })
const M = {
  nylon: new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.35, metalness: 0.1 }),
  red: mat('#d62828', 0.5),
  garri: mat('#f1e6c8', 0.95),
  sack: mat('#d8c7a0', 0.9),
  rice: mat('#fbfbf7', 0.9),
  beans: mat('#9b6a45', 0.85),
  oil: mat('#c0391b', 0.3),
  cap: mat('#f2c14e', 0.4),
  tomato: mat('#e3271b', 0.35),
  pepper: mat('#d91e18', 0.35),
  pepper2: mat('#ff8c00', 0.35),
  onion: mat('#8b3a62', 0.5),
  yam: mat('#6b4a2b', 0.95),
  ripe: mat('#f2c230', 0.6),
  stem: mat('#5b4325', 0.9),
  orange: mat('#f39c12', 0.55),
  akara: mat('#b0601c', 0.75),
  akara2: mat('#94501a', 0.8),
  stick: mat('#d9b27a', 0.8),
  beef: mat('#6b2e14', 0.7),
  pack: mat('#f6f6f6', 0.6),
  dodo: mat('#e08a1f', 0.5),
  bowl: mat('#f4f4f4', 0.3),
  soup: mat('#7a2e12', 0.25),
  chinchin: mat('#d9a15a', 0.8),
  clear: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1, transparent: true, opacity: 0.35 }),
}

/** orange peel and tomato skin, drawn once */
function peelTexture(base: string, dot: string, n: number) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, 128, 128)
  for (let i = 0; i < n; i++) {
    g.fillStyle = dot
    g.globalAlpha = 0.25 + Math.random() * 0.35
    g.beginPath()
    g.arc(Math.random() * 128, Math.random() * 128, 0.6 + Math.random() * 1.1, 0, Math.PI * 2)
    g.fill()
  }
  g.globalAlpha = 1
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
/** the inside of a cut orange: pale ring, juicy segments */
function fleshTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#f7a823'
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#fff1c9'
  g.beginPath()
  g.arc(64, 64, 62, 0, Math.PI * 2)
  g.fill()
  for (let k = 0; k < 10; k++) {
    const a0 = (k / 10) * Math.PI * 2 + 0.04
    const a1 = ((k + 1) / 10) * Math.PI * 2 - 0.04
    g.fillStyle = k % 2 ? '#ffad33' : '#ffb84d'
    g.beginPath()
    g.moveTo(64, 64)
    g.arc(64, 64, 55, a0, a1)
    g.closePath()
    g.fill()
  }
  g.fillStyle = '#fff1c9'
  g.beginPath()
  g.arc(64, 64, 5, 0, Math.PI * 2)
  g.fill()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
let REAL: { orange: THREE.Material; tomato: THREE.Material; flesh: THREE.Material; leaf: THREE.Material; steel: THREE.Material; handle: THREE.Material } | null = null
const real = () =>
  (REAL ??= {
    orange: new THREE.MeshStandardMaterial({ map: peelTexture('#f39c12', '#b8650a', 900), roughness: 0.55 }),
    tomato: new THREE.MeshStandardMaterial({ map: peelTexture('#e3271b', '#ff6a55', 120), roughness: 0.22, metalness: 0.05 }),
    flesh: new THREE.MeshStandardMaterial({ map: fleshTexture(), roughness: 0.35 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#2f7d2a', roughness: 0.6, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ color: '#cfd5dc', roughness: 0.2, metalness: 0.9 }),
    handle: new THREE.MeshStandardMaterial({ color: '#2b1d12', roughness: 0.7 }),
  })

function realOrange(r = 0.045) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), real().orange)
  body.scale.y = 0.96
  const stem = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 6, 4), real().leaf)
  stem.position.y = r * 0.95
  g.add(body, stem)
  return g
}
function realTomato(r = 0.045) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), real().tomato)
  body.scale.y = 0.82
  g.add(body)
  for (let k = 0; k < 5; k++) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(r * 0.6, r * 0.18), real().leaf)
    const t = (k / 5) * Math.PI * 2
    leaf.position.set(Math.cos(t) * r * 0.25, r * 0.8, Math.sin(t) * r * 0.25)
    leaf.rotation.set(-Math.PI / 2 + 0.3, 0, -t)
    g.add(leaf)
  }
  return g
}
/** half an orange: the peel cup and the cut face showing the segments */
function orangeHalf(r = 0.045) {
  const g = new THREE.Group()
  const cup = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), real().orange)
  const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.98, 20), real().flesh)
  face.rotation.x = -Math.PI / 2
  g.add(cup, face)
  return g
}
function knife() {
  const g = new THREE.Group()
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.13), real().steel)
  blade.position.z = 0.09
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 0.09), real().handle)
  g.add(blade, handle)
  return g
}

const sphere = (r: number, m: THREE.Material, x = 0, y = 0, z = 0) => {
  const o = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), m)
  o.position.set(x, y, z)
  return o
}
const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 12), m)
  o.position.set(x, y, z)
  o.rotation.set(rx, 0, rz)
  return o
}

/** A small 3D version of each market item, the size it really is in the hand. */
export function goodsMesh(id: GoodsId): THREE.Group {
  const g = new THREE.Group()
  switch (id) {
    case 'garri':
      g.add(cyl(0.13, 0.11, 0.22, M.red, 0, 0.11), cyl(0.125, 0.125, 0.02, M.garri, 0, 0.22))
      break
    case 'rice':
    case 'beans':
      g.add(cyl(0.1, 0.12, 0.22, M.sack, 0, 0.11), sphere(0.1, id === 'rice' ? M.rice : M.beans, 0, 0.22))
      break
    case 'palmoil':
      g.add(cyl(0.05, 0.05, 0.26, M.oil, 0, 0.13), cyl(0.022, 0.022, 0.05, M.cap, 0, 0.285))
      break
    case 'tomato':
      for (let i = 0; i < 7; i++) {
        const t = realTomato(0.042)
        t.position.set(Math.cos(i) * 0.06, 0.04 + (i % 3) * 0.035, Math.sin(i) * 0.06)
        g.add(t)
      }
      break
    case 'pepper':
      for (let i = 0; i < 9; i++) g.add(sphere(0.03, i % 3 ? M.pepper : M.pepper2, Math.cos(i * 1.3) * 0.05, 0.03 + (i % 3) * 0.025, Math.sin(i * 1.3) * 0.05))
      break
    case 'onion':
      for (let i = 0; i < 5; i++) g.add(sphere(0.045, M.onion, Math.cos(i * 1.2) * 0.05, 0.045 + (i % 2) * 0.05, Math.sin(i * 1.2) * 0.05))
      break
    case 'yam': {
      const y = cyl(0.07, 0.05, 0.5, M.yam, 0, 0.07, 0, 0, Math.PI / 2)
      g.add(y)
      break
    }
    case 'plantain':
      for (let i = 0; i < 5; i++) g.add(cyl(0.035, 0.025, 0.3, M.ripe, -0.08 + i * 0.04, 0.1, 0, 0, Math.PI / 2 - 0.35 + i * 0.08))
      g.add(cyl(0.035, 0.035, 0.08, M.stem, -0.17, 0.05, 0, 0, Math.PI / 2))
      break
    case 'orange':
      for (let i = 0; i < 5; i++) {
        const o = realOrange(0.042)
        o.position.set(Math.cos(i * 1.25) * 0.05, 0.042 + (i % 2) * 0.05, Math.sin(i * 1.25) * 0.05)
        g.add(o)
      }
      break
    case 'akara':
      // ten golden-brown balls, lumpy
      for (let i = 0; i < 10; i++) {
        const a = sphere(0.035, i % 3 ? M.akara : M.akara2, Math.cos(i * 1.3) * 0.05, 0.035 + (i % 3) * 0.03, Math.sin(i * 1.3) * 0.05)
        a.scale.set(1, 0.82, 1.05)
        g.add(a)
      }
      break
    case 'suya':
      // sticks of spicy beef
      for (let i = 0; i < 3; i++) {
        const k = new THREE.Group()
        k.add(cyl(0.005, 0.005, 0.32, M.stick, 0, 0, 0, Math.PI / 2))
        for (let j = 0; j < 4; j++) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.045), M.beef)
          m.position.set(0, 0, -0.09 + j * 0.06)
          m.rotation.y = j
          k.add(m)
        }
        k.position.set(-0.04 + i * 0.04, 0.03 + i * 0.01, 0)
        g.add(k)
      }
      break
    case 'jollof': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.15), M.pack)
      box.position.y = 0.035
      g.add(box)
      break
    }
    case 'dodo':
      for (let i = 0; i < 8; i++) {
        const d = sphere(0.03, M.dodo, Math.cos(i * 1.6) * 0.04, 0.02 + (i % 3) * 0.015, Math.sin(i * 1.6) * 0.04)
        d.scale.set(1, 0.35, 0.65)
        g.add(d)
      }
      break
    case 'peppersoup': {
      const b = cyl(0.09, 0.06, 0.07, M.bowl, 0, 0.035)
      b.add(cyl(0.085, 0.085, 0.005, M.soup, 0, 0.03))
      g.add(b)
      break
    }
    case 'chinchin': {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.13), M.clear)
      p.position.y = 0.025
      for (let i = 0; i < 6; i++) {
        const cube = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.018), M.chinchin)
        cube.position.set(-0.03 + (i % 3) * 0.03, -0.01, -0.03 + Math.floor(i / 3) * 0.05)
        p.add(cube)
      }
      g.add(p)
      break
    }
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true
  })
  return g
}

/** The black "nylon" market bag, with two loop handles. Its belly grows with how much is inside. */
function nylonBag() {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), M.nylon)
  body.name = 'belly'
  body.scale.set(1, 1.15, 0.75)
  body.position.y = -0.2
  body.castShadow = true
  g.add(body)
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14, Math.PI), M.nylon)
    h.position.set(s * 0.04, -0.03, 0)
    g.add(h)
  }
  return g
}

/** The same black nylon, held open by its handles while the seller packs it. Origin = the bag's mouth. */
function openNylon() {
  const g = new THREE.Group()
  const prof = [
    [0.001, -0.34],
    [0.1, -0.33],
    [0.16, -0.27],
    [0.18, -0.16],
    [0.17, -0.05],
    [0.15, 0],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const mat = M.nylon.clone()
  mat.side = THREE.DoubleSide
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), mat)
  body.name = 'body'
  body.castShadow = true
  g.add(body)
  // the two handles pulled up, the way you hold a nylon open
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14, Math.PI), mat)
    h.position.set(sx * 0.11, 0.0, 0)
    h.rotation.y = Math.PI / 2
    g.add(h)
  }
  return g
}

const leftHands = new WeakMap<Human, THREE.Object3D | null>()
const leftHand = (h: Human) => {
  if (leftHands.has(h)) return leftHands.get(h) ?? null
  let found: THREE.Object3D | null = null
  h.model.traverse((o) => {
    if (!found && /(LeftHand|Hand_L|L_Hand)$/.test(o.name)) found = o
  })
  leftHands.set(h, found)
  return found as THREE.Object3D | null
}

/** A phone with a lit screen: the USDC wallet open on it. */
function phoneMesh() {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.15, 0.011), new THREE.MeshStandardMaterial({ color: '#15151a', roughness: 0.3, metalness: 0.4 }))
  g.add(body)
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 128
  const x = c.getContext('2d')!
  x.fillStyle = '#0b1b33'
  x.fillRect(0, 0, 64, 128)
  x.fillStyle = '#2775ca'
  x.beginPath()
  x.arc(32, 46, 18, 0, Math.PI * 2)
  x.fill()
  x.fillStyle = '#fff'
  x.font = 'bold 20px sans-serif'
  x.textAlign = 'center'
  x.fillText('$', 32, 53)
  x.font = 'bold 11px sans-serif'
  x.fillText('USDC', 32, 82)
  x.fillStyle = '#38ffd0'
  x.fillRect(12, 98, 40, 14)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.138), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
  screen.position.z = 0.0062
  g.add(screen)
  return g
}

const hands = new WeakMap<Human, THREE.Object3D | null>()
const handBone = (h: Human) => {
  if (hands.has(h)) return hands.get(h) ?? null
  let found: THREE.Object3D | null = null
  // Mixamo (RightHand) and Rocketbox (Bip01_R_Hand) skeletons
  const re = /(RightHand|Hand_R|R_Hand)$/
  h.model.traverse((o) => {
    if (!found && re.test(o.name)) found = o
  })
  hands.set(h, found)
  return found as THREE.Object3D | null
}

const v = new THREE.Vector3()

/** The seller packs what she bought into a nylon, ties it, and hands the bag across. */
interface Packing {
  t: number
  wait: number
  seller: Human
  buyer: Human
  item: THREE.Group
  pieces: { o: THREE.Object3D; from: THREE.Vector3; start: number }[]
  open: THREE.Group
  closed: THREE.Group
  packed: number
  done: () => void
}

interface Tasting {
  t: number
  wait: number
  seller: Human
  buyer: Human
  whole: THREE.Group
  a: THREE.Group
  b: THREE.Group
  blade: THREE.Group
  done: () => void
}

export class Carry {
  private tastings: Tasting[] = []

  /** the seller cuts an orange in two with a knife and passes half for her to taste */
  taste(seller: Human, buyer: Human, then: () => void, wait = 0) {
    const whole = realOrange(0.055)
    const a = orangeHalf(0.055)
    const b = orangeHalf(0.055)
    const blade = knife()
    for (const o of [whole, a, b, blade]) {
      o.visible = false
      this.scene.add(o)
    }
    this.tastings.push({ t: 0, wait, seller, buyer, whole, a, b, blade, done: then })
  }

  private stepTastings(dt: number, heading: number) {
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    for (const k of [...this.tastings]) {
      if (k.wait > 0) {
        k.wait -= dt
        continue
      }
      k.t += dt
      const t = k.t
      this.handPos(k.seller, s)
      this.handPos(k.buyer, p)
      // do it in the air above the table, leaning towards her, so the stall never hides it
      const towards = p.clone().sub(s).setY(0)
      if (towards.lengthSq() > 1e-4) s.addScaledVector(towards.normalize(), 0.3)
      s.y = Math.max(s.y + 0.08, 1.25)
      const mouth = p.clone()
      mouth.y += 0.42
      // 0-0.7s: holds the orange up. 0.7-1.4s: knife cuts down through it. 1.4-1.8s: halves open.
      // 1.8-2.7s: one half travels to her hand, then up to her mouth. 2.7-3.6s: she eats it.
      k.whole.visible = t < 1.4
      k.whole.position.copy(s)
      k.blade.visible = t > 0.5 && t < 1.7
      k.blade.position.set(s.x, s.y + 0.09 - Math.min(1, Math.max(0, (t - 0.7) / 0.7)) * 0.12, s.z)
      k.blade.rotation.set(0, heading + Math.PI / 2, 0)
      const open = Math.min(1, Math.max(0, (t - 1.4) / 0.4))
      k.a.visible = k.b.visible = t >= 1.4
      k.a.position.set(s.x - 0.04 * open, s.y, s.z)
      k.b.position.set(s.x + 0.04 * open, s.y, s.z)
      // halves turn so their cut faces show
      k.a.rotation.set(0, heading, Math.PI / 2 * open)
      k.b.rotation.set(0, heading, -Math.PI / 2 * open)
      if (t > 1.8) {
        const f = Math.min(1, (t - 1.8) / 0.9)
        const e = f * f * (3 - 2 * f)
        k.b.position.lerpVectors(new THREE.Vector3(s.x + 0.04, s.y, s.z), mouth, e)
        k.b.position.y += Math.sin(e * Math.PI) * 0.12
      }
      if (t > 2.7) {
        const eat = Math.max(0, 1 - (t - 2.7) / 0.9)
        k.b.scale.setScalar(Math.max(0.001, eat))
      }
      if (t > 3.7) {
        for (const o of [k.whole, k.a, k.b, k.blade]) this.scene.remove(o)
        this.tastings.splice(this.tastings.indexOf(k), 1)
        k.done()
      }
    }
  }

  readonly bag = nylonBag()
  private playerHand: THREE.Object3D | null = null
  private playerRef: Human | null = null
  private shown = 0
  private pulse = 0

  constructor(private scene: THREE.Scene) {
    this.bag.visible = false
    scene.add(this.bag)
  }

  /** world position of a person's hand, or a sensible point in front of their chest */
  handPos(h: Human, out = new THREE.Vector3()) {
    const b = h === this.playerRef ? this.playerHand : handBone(h)
    if (b) return b.getWorldPosition(out)
    h.group.getWorldPosition(out)
    out.y += 1.0
    return out
  }

  private packings: Packing[] = []

  /** the seller puts the item into a nylon piece by piece, ties it, and hands the bag to her */
  handOver(seller: Human, buyer: Human, id: GoodsId, then: () => void, wait = 0) {
    const item = goodsMesh(id)
    const open = openNylon()
    const closed = nylonBag()
    const kids = [...item.children]
    const stagger = Math.min(0.22, 1.1 / Math.max(1, kids.length))
    const pieces = kids.map((o, i) => ({ o, from: o.position.clone(), start: 0.6 + i * stagger }))
    for (const o of [item, open, closed]) {
      o.visible = false
      this.scene.add(o)
    }
    const packed = (pieces.length ? pieces[pieces.length - 1].start : 0.6) + 0.5
    this.packings.push({ t: 0, wait, seller, buyer, item, pieces, open, closed, packed, done: then })
  }

  /** people holding up their phone: she to pay, the seller to check the alert */
  private phones = new Map<Human, { mesh: THREE.Group; on: boolean; w: number }>()
  showPhone(h: Human, on: boolean) {
    let p = this.phones.get(h)
    if (!p) {
      if (!on) return
      p = { mesh: phoneMesh(), on, w: 0 }
      this.scene.add(p.mesh)
      this.phones.set(h, p)
    }
    p.on = on
  }
  private stepPhones(dt: number) {
    const fwd = new THREE.Vector3()
    const hand = new THREE.Vector3()
    for (const [h, p] of [...this.phones]) {
      p.w = Math.max(0, Math.min(1, p.w + (p.on ? dt * 2.5 : -dt * 3)))
      if (!p.on && p.w <= 0) {
        this.scene.remove(p.mesh)
        this.phones.delete(h)
        h.reachLeft = null
        continue
      }
      // in front of the chest, a little to the left, where you hold a phone to look at it
      // world facing (the player sits inside a moving group)
      h.group.getWorldDirection(fwd).setY(0).normalize()
      const ry = Math.atan2(fwd.x, fwd.z)
      const left = new THREE.Vector3(fwd.z, 0, -fwd.x)
      const base = h.group.getWorldPosition(new THREE.Vector3())
      const target = base.addScaledVector(fwd, 0.22).addScaledVector(left, 0.06)
      target.y += 1.28
      h.reachLeft = { target, w: p.w }
      const b = leftHand(h)
      if (b) b.getWorldPosition(hand)
      else hand.copy(target)
      p.mesh.visible = p.w > 0.35
      p.mesh.position.copy(hand).addScaledVector(fwd, 0.04)
      // screen turned towards her face
      p.mesh.rotation.set(0, 0, 0)
      p.mesh.rotateY(ry + Math.PI)
      p.mesh.rotateX(-0.55)
    }
  }

  /** arms that are let go of slowly after a hand-over */
  private releases: Human[] = []

  private stepPackings(dt: number, heading: number) {
    for (const h of [...this.releases]) {
      if (!h.reach) {
        this.releases.splice(this.releases.indexOf(h), 1)
        continue
      }
      h.reach.w -= dt * 2.5
      if (h.reach.w <= 0) {
        h.reach = null
        this.releases.splice(this.releases.indexOf(h), 1)
      }
    }
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const hand = new THREE.Vector3()
    for (const k of [...this.packings]) {
      if (k.wait > 0) {
        k.wait -= dt
        continue
      }
      k.t += dt
      const t = k.t
      k.seller.group.getWorldPosition(s)
      this.handPos(k.buyer, p)
      const towards = p.clone().sub(s).setY(0)
      const dir = towards.lengthSq() > 1e-4 ? towards.normalize() : new THREE.Vector3(0, 0, 1)
      // she holds the nylon up in front of her, over the table, so the stall never hides it
      s.addScaledVector(dir, 0.45)
      s.y += 1.32
      const side = new THREE.Vector3(-dir.z, 0, dir.x)
      const tieEnd = k.packed + 0.45
      const passStart = tieEnd + 0.2
      const pass = Math.min(1, Math.max(0, (t - passStart) / 1.1))
      const pe = pass * pass * (3 - 2 * pass)
      // the arm: up to the packing spot, then stretched out towards her
      const mid = s.clone().lerp(p, 0.5)
      mid.y = Math.max(mid.y, 1.2)
      const target = s.clone().lerp(mid, pe)
      if (!k.seller.reach) k.seller.reach = { target: target.clone(), w: 0 }
      k.seller.reach.target.copy(target)
      k.seller.reach.w = Math.min(1, t / 0.4)
      if (t > passStart) {
        if (!k.buyer.reach) k.buyer.reach = { target: mid.clone(), w: 0 }
        k.buyer.reach.target.copy(mid)
        k.buyer.reach.w = Math.min(1, (t - passStart) / 0.5)
      }
      this.handPos(k.seller, hand)
      // 0-0.6s: she shakes a nylon open. then each piece is picked from the tray side and dropped in.
      k.open.visible = t < tieEnd
      k.open.position.copy(hand)
      k.open.rotation.y = heading
      const shake = Math.min(1, t / 0.6)
      const body = k.open.getObjectByName('body')
      if (body) body.scale.set(0.4 + 0.6 * shake, 0.5 + 0.5 * shake + Math.sin(t * 30) * 0.03 * (1 - shake), 0.4 + 0.6 * shake)
      k.item.visible = t > 0.45 && t < tieEnd
      k.item.position.copy(hand)
      k.item.rotation.y = 0
      for (const pc of k.pieces) {
        const f = Math.min(1, Math.max(0, (t - pc.start) / 0.5))
        const e = f * f * (3 - 2 * f)
        // starts beside the bag (as if picked from the tray), arcs over the mouth, drops inside
        const start = pc.from.clone().multiplyScalar(0.6).add(side.clone().multiplyScalar(0.3)).add(new THREE.Vector3(0, -0.05, 0))
        const end = new THREE.Vector3(pc.from.x * 0.4, -0.2 + pc.from.y * 0.3, pc.from.z * 0.4)
        pc.o.position.lerpVectors(start, end, e)
        pc.o.position.y += Math.sin(Math.min(1, e * 1.3) * Math.PI) * 0.22
        pc.o.visible = t > pc.start - 0.15 && f < 1
        pc.o.scale.setScalar(1 - 0.35 * e)
      }
      // tie: the mouth pinches shut, then it is the round bag with its two ears
      if (t > k.packed) {
        const tie = Math.min(1, (t - k.packed) / 0.45)
        if (body) body.scale.set(1 - 0.4 * tie, 1 + 0.15 * tie, 1 - 0.4 * tie)
      }
      if (t >= tieEnd) {
        k.closed.visible = true
        // hangs from her hand, then changes hands halfway
        const buyerHand = this.handPos(k.buyer, new THREE.Vector3())
        k.closed.position.lerpVectors(hand, buyerHand, pe)
        k.closed.rotation.y = heading
        const belly = k.closed.getObjectByName('belly')
        if (belly) belly.scale.set(1.05, 1.2, 0.85)
      }
      if (t > passStart + 1.25) {
        for (const o of [k.item, k.open, k.closed]) this.scene.remove(o)
        this.packings.splice(this.packings.indexOf(k), 1)
        this.releases.push(k.seller, k.buyer)
        this.pulse = 0.35
        k.done()
      }
    }
  }

  /** count = how many items are in her bag */
  update(dt: number, player: Human, heading: number, count: number) {
    if (this.playerRef !== player) {
      this.playerRef = player
      this.playerHand = handBone(player)
    }
    this.stepTastings(dt, heading)
    this.stepPackings(dt, heading)
    this.stepPhones(dt)
    // the nylon bag hangs from her right hand once she has bought something
    const show = count > 0
    this.bag.visible = show
    if (!show) return
    this.handPos(player, v)
    this.bag.position.set(v.x, v.y, v.z)
    this.bag.rotation.set(0, heading, 0)
    if (this.shown !== count) this.shown = count
    const belly = this.bag.getObjectByName('belly')
    if (belly) {
      const fill = 0.75 + Math.min(1.2, count * 0.12)
      this.pulse = Math.max(0, this.pulse - dt)
      const p = 1 + Math.sin(this.pulse * 18) * this.pulse * 0.25
      belly.scale.set(fill * p, 1.15 * (0.85 + fill * 0.2) * p, 0.75 * fill * p)
    }
  }
}
