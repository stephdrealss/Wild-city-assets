import * as THREE from 'three'

/** Floating speech bubbles above people. A small pool of sprites is reused. */
interface Entry {
  sprite: THREE.Sprite
  canvas: HTMLCanvasElement
  tex: THREE.CanvasTexture
  host: THREE.Object3D | null
  left: number
}

const W = 512
const H = 176
const POOL = 8

function draw(c: HTMLCanvasElement, text: string) {
  const g = c.getContext('2d')
  if (!g) return
  g.clearRect(0, 0, W, H)
  g.font = '700 36px "DM Sans", sans-serif'
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w
    if (g.measureText(t).width > W - 70 && cur) {
      lines.push(cur)
      cur = w
    } else cur = t
  }
  if (cur) lines.push(cur)
  const shown = lines.slice(0, 3)
  const bh = 34 + shown.length * 44
  const top = H - 28 - bh
  g.fillStyle = 'rgba(255,255,255,0.97)'
  g.strokeStyle = 'rgba(18,15,36,0.9)'
  g.lineWidth = 5
  g.beginPath()
  g.roundRect(8, Math.max(4, top), W - 16, bh, 28)
  g.fill()
  g.stroke()
  g.beginPath()
  g.moveTo(W / 2 - 18, H - 28)
  g.lineTo(W / 2, H - 6)
  g.lineTo(W / 2 + 18, H - 28)
  g.closePath()
  g.fillStyle = 'rgba(255,255,255,0.97)'
  g.fill()
  g.fillStyle = '#17142b'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  shown.forEach((l, i) => g.fillText(l, W / 2, Math.max(4, top) + 40 + i * 44))
}

export class Bubbles {
  private pool: Entry[] = []
  private byHost = new Map<THREE.Object3D, Entry>()

  private acquire(): Entry | null {
    let e = this.pool.find((x) => !x.host)
    if (!e && this.pool.length < POOL) {
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
      sprite.scale.set(2.3, 2.3 * (H / W), 1)
      sprite.visible = false
      sprite.renderOrder = 10
      e = { sprite, canvas, tex, host: null, left: 0 }
      this.pool.push(e)
    }
    return e ?? null
  }

  /** Show `text` above `host` (a person's group) for `secs` seconds, at `y` metres. */
  show(host: THREE.Object3D, y: number, text: string, secs = 3.2) {
    let e = this.byHost.get(host)
    if (!e) {
      const free = this.acquire()
      if (!free) return
      e = free
      e.host = host
      this.byHost.set(host, e)
      host.add(e.sprite)
    }
    e.sprite.position.set(0, y + 0.95, 0)
    draw(e.canvas, text)
    e.tex.needsUpdate = true
    e.sprite.visible = true
    e.left = secs
  }

  update(dt: number) {
    for (const e of this.pool) {
      if (!e.host) continue
      e.left -= dt
      if (e.left <= 0) this.release(e)
      else if (e.left < 0.4) e.sprite.material.opacity = e.left / 0.4
      else e.sprite.material.opacity = 1
    }
  }

  private release(e: Entry) {
    if (e.host) {
      e.host.remove(e.sprite)
      this.byHost.delete(e.host)
    }
    e.host = null
    e.sprite.visible = false
    e.sprite.material.opacity = 1
  }

  clear() {
    for (const e of this.pool) this.release(e)
  }
}

export const bubbles = new Bubbles()
