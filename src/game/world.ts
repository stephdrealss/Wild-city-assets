import * as THREE from 'three'
import { Batch, GLOW, LIT } from './batch'
import { BLOCK, DISTRICTS, blockCenter, districtOfBlock } from './data'
import { buildBlocks } from './districts'
import { ankaraTexture, grainTexture } from './textures'
import { mulberry, type Collider, type Ctx, type Poi } from './worldTypes'

export interface World {
  group: THREE.Group
  colliders: Collider[]
  pois: Poi[]
  spots: Ctx['spots']
  drops: Ctx['drops']
  clouds: THREE.Group
  update(night: number, t: number): void
  setPoiLabel(p: Poi, text: string): void
}

const FLOOR: Record<string, string> = {
  market: '#c98f5f',
  plaza: '#eadfc8',
  beach: '#f3e2ac',
  residential: '#a8d98a',
  downtown: '#aab0be',
}

function windowTextures() {
  const mk = (lit: boolean) => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    g.fillStyle = lit ? '#000' : '#eef3fb'
    g.fillRect(0, 0, 128, 128)
    const r = mulberry(7)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const on = r() < 0.55
        g.fillStyle = lit ? (on ? '#ffe9a0' : '#000') : '#5d7fa8'
        g.fillRect(x * 32 + 5, y * 32 + 6, 22, 20)
      }
    const t = new THREE.CanvasTexture(c)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 2
    return t
  }
  return { map: mk(false), emissive: mk(true) }
}

function labelTexture(text: string, color: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 96
  drawLabel(c, text, color)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
function drawLabel(c: HTMLCanvasElement, text: string, color: string) {
  const g = c.getContext('2d')!
  g.clearRect(0, 0, c.width, c.height)
  g.fillStyle = 'rgba(16,14,28,0.82)'
  g.beginPath()
  g.roundRect(6, 8, c.width - 12, c.height - 16, 40)
  g.fill()
  g.lineWidth = 6
  g.strokeStyle = color
  g.stroke()
  g.fillStyle = '#ffffff'
  g.font = '700 40px "Space Grotesk", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text.toUpperCase(), c.width / 2, c.height / 2 + 2, c.width - 50)
}

export function buildWorld(): World {
  const group = new THREE.Group()
  const ctx: Ctx = {
    solid: new Batch(),
    glow: new Batch(),
    towers: new Batch(),
    fabric: new Batch(),
    lamp: new Batch(),
    cols: [],
    pois: [],
    drops: [],
    spots: [],
    rand: mulberry(20260),
  }
  const b = ctx.solid

  // grass + city asphalt
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshStandardMaterial({ color: '#ffffff', map: grainTexture('#79c957', '#4a9a3a', 260), roughness: 1, metalness: 0 }))
  grass.rotation.x = -Math.PI / 2
  grass.position.y = -0.06
  group.add(grass)
  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(366, 316),
    new THREE.MeshStandardMaterial({ map: grainTexture('#3d4049', '#8a8f9c', 80), roughness: 0.9, metalness: 0.02 }),
  )
  asphalt.rotation.x = -Math.PI / 2
  asphalt.position.y = 0.035
  asphalt.receiveShadow = true
  group.add(asphalt)
  // sand + boardwalk
  b.box(400, 0.12, 42, '#f3e2ac', 0, -0.0, 176)
  b.box(366, 0.3, 6, '#b07a45', 0, 0.12, 160)
  // pier
  b.box(5, 0.3, 40, '#9b6b3a', 0, 0.1, 176)
  for (let k = 0; k < 7; k++) b.box(0.4, 2, 0.4, '#6b4423', k % 2 ? 2.2 : -2.2, -0.6, 160 + k * 6)

  // blocks
  const paving = new Batch()
  const pavingBox = (w: number, h: number, d: number, rep: number) => {
    const g = new THREE.BoxGeometry(w, h, d)
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep, uv.getY(i) * rep)
    return g
  }
  for (let i = 0; i < 7; i++)
    for (let j = 0; j < 6; j++) {
      const { x, z } = blockCenter(i, j)
      const d = districtOfBlock(i, j)
      paving.add(pavingBox(40, 0.3, 40, 10), '#d8d2c6', x, 0.1, z)
      paving.add(pavingBox(35, 0.34, 35, 9), FLOOR[d], x, 0.12, z)
      // kerb stones around the block
      for (const sx of [-1, 1]) {
        b.box(0.5, 0.36, 40.4, '#e9e4da', x + sx * 20.1, 0.17, z)
        b.box(40.4, 0.36, 0.5, '#e9e4da', x, 0.17, z + sx * 20.1)
      }
    }

  // lane markings
  for (let k = -3.5; k <= 3.5; k++) {
    for (let s = -150; s <= 150; s += 7) {
      const m = (((s + 150) % 50) + 50) % 50
      if (m < 6 || m > 44) continue
      b.box(0.3, 0.02, 3, '#ffd23f', k * 50, 0.06, s)
    }
  }
  for (let k = -3; k <= 3; k++) {
    for (let s = -175; s <= 175; s += 7) {
      const m = (((s + 25) % 50) + 50) % 50
      if (m < 6 || m > 44) continue
      b.box(3, 0.02, 0.3, '#ffffff', s, 0.06, k * 50)
    }
  }

  // zebra crossings on every arm of every junction, plus manholes
  for (let ix = -3.5; ix <= 3.5; ix++)
    for (let iz = -3; iz <= 3; iz++) {
      const jx = ix * 50
      const jz = iz * 50
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let k = -3; k <= 3; k++) {
          const px = jx + ax * 7.2 + (az !== 0 ? k * 1.15 : 0)
          const pz = jz + az * 7.2 + (ax !== 0 ? k * 1.15 : 0)
          b.plane(az !== 0 ? 0.6 : 2.6, ax !== 0 ? 0.6 : 2.6, '#f2f2f2', px, 0.05, pz)
        }
      }
    }
  const mr = mulberry(31)
  for (let k = 0; k < 40; k++) b.cyl(0.45, 0.45, 0.03, '#2b2b30', (Math.floor(mr() * 7) - 3.5) * 50 + (mr() - 0.5) * 3, 0.05, (Math.floor(mr() * 7) - 3) * 50 + 14 + mr() * 20, 10)

  buildBlocks(ctx)

  // distant hills
  const hr = mulberry(5)
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2
    if (Math.sin(a) > 0.55) continue
    const rr = 330 + hr() * 90
    b.cone(40 + hr() * 40, 40 + hr() * 50, hr() < 0.5 ? '#4ea65a' : '#3d9a6a', Math.cos(a) * rr, 15, Math.sin(a) * rr - 20, 7)
  }
  for (let k = 0; k < 70; k++) {
    const x = (hr() - 0.5) * 700
    const z = -170 - hr() * 160
    if (Math.abs(x) < 190 && z > -170) continue
    ctx.solid.cyl(0.4, 0.5, 3, '#7a5230', x, 1.5, z, 5)
    ctx.solid.sphere(2.6, '#3f9f3f', x, 4.2, z, {}, 6)
  }

  // merged meshes
  const pavingMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grainTexture('#ffffff', '#8a8478', 1, 'tiles'), roughness: 0.9, metalness: 0 })
  const pavingMesh = paving.mesh(pavingMat)
  if (pavingMesh) {
    pavingMesh.receiveShadow = true
    group.add(pavingMesh)
  }
  const solidMesh = ctx.solid.mesh(LIT)
  if (solidMesh) {
    solidMesh.castShadow = true
    solidMesh.receiveShadow = true
    group.add(solidMesh)
  }
  grass.receiveShadow = true
  const fabricMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: ankaraTexture(0), roughness: 0.95, metalness: 0, side: THREE.DoubleSide })
  const fabricMesh = ctx.fabric.mesh(fabricMat)
  if (fabricMesh) {
    fabricMesh.castShadow = true
    fabricMesh.receiveShadow = true
    group.add(fabricMesh)
  }
  const signMat = GLOW.clone()
  const glowMesh = ctx.glow.mesh(signMat)
  if (glowMesh) group.add(glowMesh)
  const lampMat = GLOW.clone()
  const lampMesh = ctx.lamp.mesh(lampMat)
  if (lampMesh) group.add(lampMesh)
  const tex = windowTextures()
  const towerMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.3,
    metalness: 0.25,
    map: tex.map,
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: tex.emissive,
    emissiveIntensity: 0,
  })
  const towerMesh = ctx.towers.mesh(towerMat)
  if (towerMesh) {
    towerMesh.receiveShadow = true
    group.add(towerMesh)
  }

  // sea
  const seaGeo = new THREE.PlaneGeometry(1400, 500, 56, 20)
  seaGeo.rotateX(-Math.PI / 2)
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: '#27c4d6', flatShading: true, transparent: true, opacity: 0.92, roughness: 0.18, metalness: 0.15 }))
  sea.position.set(0, -0.25, 440)
  group.add(sea)
  const base = Float32Array.from(seaGeo.attributes.position.array)

  // clouds
  const clouds = new THREE.Group()
  const cb = new Batch()
  const cr = mulberry(11)
  for (let k = 0; k < 14; k++) {
    const cx = (cr() - 0.5) * 700
    const cz = (cr() - 0.5) * 600
    const cy = 90 + cr() * 40
    for (let s = 0; s < 4; s++) cb.sphere(9 + cr() * 7, '#ffffff', cx + s * 11, cy + cr() * 3, cz + (cr() - 0.5) * 8, { sy: 0.55 }, 6)
  }
  const cloudMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, fog: false })
  const cm = cb.mesh(cloudMat)
  if (cm) clouds.add(cm)
  group.add(clouds)

  // POI markers
  const ring = new THREE.RingGeometry(0.9, 1.15, 28)
  ring.rotateX(-Math.PI / 2)
  const gem = new THREE.OctahedronGeometry(0.42, 0)
  const mats = new Map<string, THREE.MeshBasicMaterial>()
  const matFor = (col: string, t: 'ring' | 'gem') => {
    const k = col + t
    if (!mats.has(k))
      mats.set(
        k,
        new THREE.MeshBasicMaterial({
          color: col,
          transparent: t === 'ring',
          opacity: t === 'ring' ? 0.8 : 1,
          fog: false,
          depthWrite: false,
        }),
      )
    return mats.get(k)!
  }
  // painted signboards (market arch and the like)
  for (const sg of ctx.signs ?? []) {
    const cv = document.createElement('canvas')
    cv.width = 1024
    cv.height = Math.round((1024 * sg.h) / sg.w)
    const g2 = cv.getContext('2d')!
    g2.fillStyle = sg.bg
    g2.fillRect(0, 0, cv.width, cv.height)
    g2.fillStyle = sg.fg
    g2.font = `900 ${Math.round(cv.height * 0.62)}px "Space Grotesk", "Arial Black", sans-serif`
    g2.textAlign = 'center'
    g2.textBaseline = 'middle'
    g2.fillText(sg.text, cv.width / 2, cv.height / 2 + 4, cv.width - 40)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sg.w, sg.h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }))
    m.position.set(sg.x, sg.y, sg.z)
    m.rotation.y = sg.ry
    group.add(m)
  }

  for (const p of ctx.pois) {
    const g = new THREE.Group()
    g.position.set(p.x, 0, p.z)
    const r = new THREE.Mesh(ring, matFor(p.color, 'ring'))
    r.position.y = 0.4
    const d = new THREE.Mesh(gem, matFor(p.color, 'gem'))
    d.position.y = 3.0
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(p.label, p.color), transparent: true, depthWrite: false, fog: false }))
    spr.scale.set(5.2, 0.98, 1)
    spr.position.y = 4.3
    spr.name = 'label'
    g.add(r, d, spr)
    g.visible = false
    group.add(g)
    p.marker = g
    p.diamond = d
  }

  return {
    group,
    colliders: ctx.cols,
    pois: ctx.pois,
    spots: ctx.spots,
    drops: ctx.drops,
    clouds,
    setPoiLabel(p, text) {
      const spr = p.marker?.getObjectByName('label') as THREE.Sprite | undefined
      if (!spr) return
      const mat = spr.material
      const canvas = (mat.map as THREE.CanvasTexture).image
      drawLabel(canvas, text, p.color)
      mat.map!.needsUpdate = true
    },
    update(night, t) {
      const k = night
      signMat.color.setScalar(0.62 + 0.38 * k)
      const l = 0.3 + 0.7 * k
      lampMat.color.setRGB(l, l * 0.92, l * 0.6)
      towerMat.emissiveIntensity = k * 1.25
      cloudMat.opacity = 0.9 - k * 0.55
      clouds.position.x = Math.sin(t * 0.01) * 40
      const pos = seaGeo.attributes.position
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3]
        const z = base[i * 3 + 2]
        pos.setY(i, Math.sin(x * 0.04 + t * 1.2) * 0.35 + Math.cos(z * 0.06 + t * 0.9) * 0.3)
      }
      pos.needsUpdate = true
    },
  }
}

export const DISTRICT_TINT = DISTRICTS
export const BLOCK_SIZE = BLOCK
