/**
 * Generates the placeholder rigged humanoid models in public/models/.
 * Run: bun run models:generate
 * Replace any of the files with your own .glb (see public/models/README.md).
 */
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mkdirSync, writeFileSync } from 'node:fs'
import { buildHumanoid, type HumanKind } from '../src/game/humanoid'

// GLTFExporter reads blobs with FileReader, which Bun does not provide.
class BunFileReader {
  result: ArrayBuffer | string | null = null
  onloadend: (() => void) | null = null
  onload: (() => void) | null = null
  readAsArrayBuffer(blob: Blob) {
    void blob.arrayBuffer().then((b) => {
      this.result = b
      this.onload?.()
      this.onloadend?.()
    })
  }
  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`
      this.onload?.()
      this.onloadend?.()
    })
  }
}
;(globalThis as unknown as { FileReader: unknown }).FileReader = BunFileReader

const files: [string, HumanKind][] = [
  ['player.glb', 'player'],
  ['npc_female.glb', 'female'],
  ['npc_male.glb', 'male'],
  ['npc_child.glb', 'child'],
]

mkdirSync('public/models', { recursive: true })
for (const [file, kind] of files) {
  const { scene, clips } = buildHumanoid(kind)
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, animations: clips })
  writeFileSync(`public/models/${file}`, Buffer.from(glb as ArrayBuffer))
  console.log(`wrote public/models/${file} (${Math.round((glb as ArrayBuffer).byteLength / 1024)} KB, ${clips.length} clips)`)
}
