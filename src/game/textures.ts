import * as THREE from 'three'

const PALETTES = [
  ['#ff2d78', '#ffd12e', '#1b1b5e', '#ffffff'],
  ['#12b5a6', '#ff8a1f', '#fff1c9', '#7a1fa2'],
  ['#e63946', '#2a9d8f', '#f4a261', '#fff7e6'],
  ['#3a86ff', '#ffbe0b', '#ff006e', '#ffffff'],
  ['#06d6a0', '#ef476f', '#ffd166', '#073b4c'],
  ['#8338ec', '#fb5607', '#ffbe0b', '#fefae0'],
]
const cache = new Map<number, THREE.CanvasTexture>()

/** Procedural ankara-style wax print: bold geometric motifs on a vivid ground. */
export function ankaraTexture(i: number): THREE.CanvasTexture {
  const k = i % PALETTES.length
  const hit = cache.get(k)
  if (hit) return hit
  const [a, b, c, d] = PALETTES[k]
  const S = 128
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const g = cv.getContext('2d')!
  g.fillStyle = a
  g.fillRect(0, 0, S, S)
  const motif = (cx: number, cy: number) => {
    for (const [r, col] of [[26, d], [22, c], [16, b], [9, d], [4, a]] as const) {
      g.fillStyle = col
      g.beginPath()
      g.arc(cx, cy, r, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = b
    for (let n = 0; n < 8; n++) {
      const t = (n / 8) * Math.PI * 2
      g.beginPath()
      g.ellipse(cx + Math.cos(t) * 32, cy + Math.sin(t) * 32, 5, 2.5, t, 0, Math.PI * 2)
      g.fill()
    }
  }
  motif(32, 32)
  motif(96, 96)
  g.fillStyle = c
  for (let n = 0; n < 5; n++) {
    g.beginPath()
    g.moveTo(96 + n * 6 - 12, 6)
    g.lineTo(104 + n * 6 - 12, 22)
    g.lineTo(88 + n * 6 - 12, 22)
    g.fill()
    g.beginPath()
    g.moveTo(6 + n * 6, 106)
    g.lineTo(14 + n * 6, 122)
    g.lineTo(-2 + n * 6, 122)
    g.fill()
  }
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 2)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  cache.set(k, t)
  return t
}

/** Small tileable grain textures for asphalt, paving and sand (power-of-two, mip-mapped). */
export function grainTexture(base: string, speck: string, repeat: number, kind: 'noise' | 'tiles' = 'noise'): THREE.CanvasTexture {
  const S = 128
  const cv = document.createElement('canvas')
  cv.width = cv.height = S
  const g = cv.getContext('2d')!
  g.fillStyle = base
  g.fillRect(0, 0, S, S)
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  g.fillStyle = speck
  for (let n = 0; n < 900; n++) {
    g.globalAlpha = 0.08 + rnd() * 0.18
    g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2)
  }
  g.globalAlpha = 1
  if (kind === 'tiles') {
    g.strokeStyle = 'rgba(0,0,0,0.22)'
    g.lineWidth = 2
    for (let i = 0; i <= S; i += 32) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i, S)
      g.moveTo(0, i)
      g.lineTo(S, i)
      g.stroke()
    }
  }
  const t = new THREE.CanvasTexture(cv)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
