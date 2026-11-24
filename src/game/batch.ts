import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()

/** PBR materials shared by all merged world meshes. */
export const LIT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.0 })
export const PAINT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.55 })
export const METAL = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.85 })
export const GLASS_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.42, depthWrite: false })
export const GLOW = new THREE.MeshBasicMaterial({ vertexColors: true })

export interface Xf {
  rx?: number
  ry?: number
  rz?: number
  sx?: number
  sy?: number
  sz?: number
}

/** Collects colored primitives and merges them into one draw call. */
export class Batch {
  private geos: THREE.BufferGeometry[] = []
  private base = new THREE.Matrix4()
  private hasBase = false

  /** Run `fn` with all additions placed relative to (x, z) rotated by ry about Y. */
  at(x: number, z: number, ry: number, fn: () => void, y = 0) {
    const prev = this.base.clone()
    const prevHas = this.hasBase
    const local = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1))
    this.base = prev.clone().multiply(local)
    this.hasBase = true
    fn()
    this.base = prev
    this.hasBase = prevHas
  }

  add(geo: THREE.BufferGeometry, color: string | number, x = 0, y = 0, z = 0, t: Xf = {}) {
    _e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0)
    _q.setFromEuler(_e)
    _m.compose(_p.set(x, y, z), _q, _s.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1))
    if (this.hasBase) _m.premultiply(this.base)
    geo.applyMatrix4(_m)
    _c.set(color)
    const n = geo.attributes.position.count
    const arr = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      arr[i * 3] = _c.r
      arr[i * 3 + 1] = _c.g
      arr[i * 3 + 2] = _c.b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
    this.geos.push(geo)
    return this
  }

  box(w: number, h: number, d: number, color: string | number, x = 0, y = 0, z = 0, t: Xf = {}) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, t)
  }
  /** box with rounded edges and corners (car bodies, bumpers) */
  rbox(w: number, h: number, d: number, r: number, color: string | number, x = 0, y = 0, z = 0, t: Xf = {}) {
    return this.add(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2) * 0.999), color, x, y, z, t)
  }
  cyl(rt: number, rb: number, h: number, color: string | number, x = 0, y = 0, z = 0, seg = 8, t: Xf = {}) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, x, y, z, t)
  }
  sphere(r: number, color: string | number, x = 0, y = 0, z = 0, t: Xf = {}, seg = 8) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(4, seg - 2)), color, x, y, z, t)
  }
  cone(r: number, h: number, color: string | number, x = 0, y = 0, z = 0, seg = 4, t: Xf = {}) {
    return this.add(new THREE.ConeGeometry(r, h, seg), color, x, y, z, t)
  }
  torus(r: number, tube: number, color: string | number, x = 0, y = 0, z = 0, t: Xf = {}) {
    return this.add(new THREE.TorusGeometry(r, tube, 5, 14), color, x, y, z, t)
  }
  plane(w: number, h: number, color: string | number, x = 0, y = 0, z = 0, t: Xf = {}) {
    return this.add(new THREE.PlaneGeometry(w, h), color, x, y, z, { rx: -Math.PI / 2, ...t })
  }

  get count() {
    return this.geos.length
  }

  geometry(): THREE.BufferGeometry | null {
    if (!this.geos.length) return null
    // rounded boxes come without an index; mixing them with indexed shapes needs everything non-indexed to merge
    if (this.geos.some((x) => x.index) && this.geos.some((x) => !x.index)) {
      this.geos = this.geos.map((x) => {
        if (!x.index) return x
        const n = x.toNonIndexed()
        x.dispose()
        return n
      })
    }
    // every piece must carry the same attributes to merge
    for (const x of this.geos) if (!x.attributes.uv) x.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2))
    const g = mergeGeometries(this.geos, false)
    this.geos.forEach((x) => x.dispose())
    this.geos = []
    return g
  }

  mesh(material: THREE.Material = LIT): THREE.Mesh | null {
    const g = this.geometry()
    return g ? new THREE.Mesh(g, material) : null
  }
}
