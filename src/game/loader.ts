import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { buildHumanoid, type HumanKind, type HumanTemplate } from './humanoid'
import { addFallback } from './progress'

/** Files in public/models/. Drop your own .glb over any of these (see public/models/README.md). */
export const MODEL_FILES: Record<HumanKind, string> = {
  player: 'player.glb',
  female: 'npc_female.glb',
  male: 'npc_male.glb',
  child: 'npc_child.glb',
}

/** Realistic townspeople (Mixamo characters). Any that load are mixed in with the regular NPC models. */
export const NPC_VARIANTS: Record<'female' | 'male', string[]> = {
  female: ['npc_female_1.glb', 'npc_female_2.glb', 'npc_female_3.glb'],
  male: ['npc_male_1.glb', 'npc_male_2.glb', 'npc_male_3.glb'],
}

export type Templates = Record<HumanKind, HumanTemplate> & { variants: Record<'female' | 'male', HumanTemplate[]> }

const base = () => import.meta.env.BASE_URL || '/'

/**
 * Fallback location for the player character and her animation files (player.glb, idle.glb, walk.glb, run.glb, jump.glb,
 * sit.glb, talk.glb). The copies in public/models/ are used first. Override this with VITE_PLAYER_ASSETS_URL. If a file is in
 * neither place, the built-in placeholder human is used.
 */
export const PLAYER_ASSETS_URL = (import.meta.env.VITE_PLAYER_ASSETS_URL as string | undefined)?.replace(/\/+$/, '') || 'https://cdn.jsdelivr.net/gh/stephdrealss/wild-city-assets@main'

const urlsFor = (kind: HumanKind) => (kind === 'player' ? [`${base()}models/${MODEL_FILES[kind]}`, `${PLAYER_ASSETS_URL}/${MODEL_FILES[kind]}`] : [`${base()}models/${MODEL_FILES[kind]}`])

/**
 * Loads every human model. GLBs may use KTX2 (Basis) compressed textures and meshopt compression.
 * If a file is missing or broken, the built-in procedural humanoid is used so the game still runs.
 */
export async function loadHumanTemplates(renderer: THREE.WebGLRenderer, onProgress?: (fraction: number) => void): Promise<Templates> {
  const loader = new GLTFLoader()
  const ktx2 = new KTX2Loader().setTranscoderPath(`${base()}basis/`).detectSupport(renderer)
  loader.setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder)

  const kinds = Object.keys(MODEL_FILES) as HumanKind[]
  const frac: Record<string, number> = {}
  const report = () => onProgress?.(kinds.reduce((a, k) => a + (frac[k] ?? 0), 0) / kinds.length)
  const out = {} as Templates

  const load2 = (url: string) =>
    new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timed out')), 15000)
      loader.load(
        url,
        (g) => {
          window.clearTimeout(timer)
          resolve(g)
        },
        undefined,
        (err) => {
          window.clearTimeout(timer)
          reject(err instanceof Error ? err : new Error('failed to load'))
        },
      )
    })

  const loadUrl = (kind: HumanKind, url: string) =>
    new Promise<HumanTemplate>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timed out')), url.startsWith('http') ? 15000 : 60000)
      loader.load(
        url,
        (gltf) => {
          window.clearTimeout(timer)
          resolve({ scene: gltf.scene, clips: gltf.animations })
        },
        (e) => {
          if (e.lengthComputable && e.total > 0) {
            frac[kind] = Math.min(0.95, e.loaded / e.total)
            report()
          }
        },
        (err) => {
          window.clearTimeout(timer)
          reject(err instanceof Error ? err : new Error('failed to load'))
        },
      )
    })

  const load = async (kind: HumanKind) => {
    let last: unknown = new Error('no source')
    for (const url of urlsFor(kind)) {
      try {
        return await loadUrl(kind, url)
      } catch (e) {
        last = e
        console.warn(`Could not load ${url}`, e)
      }
    }
    throw last instanceof Error ? last : new Error('failed to load')
  }

  await Promise.all(
    kinds.map(async (kind) => {
      try {
        const tpl = await load(kind)
        if (kind === 'player') await addAnimationFiles(tpl, load2)
        let skinned = false
        tpl.scene.traverse((o) => {
          if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true
        })
        if (!skinned || !tpl.clips.length) throw new Error('not a rigged, animated model')
        out[kind] = tpl
      } catch (e) {
        // missing file, a host that answers with index.html, or a broken model: use the built-in humanoid
        console.warn(`Could not load models/${MODEL_FILES[kind]}, using the built-in placeholder human.`, e)
        addFallback(MODEL_FILES[kind])
        out[kind] = buildHumanoid(kind)
      } finally {
        frac[kind] = 1
        report()
      }
    }),
  )
  // realistic townspeople: optional, a missing file is simply skipped
  out.variants = { female: [], male: [] }
  await Promise.all(
    (['female', 'male'] as const).flatMap((kind) =>
      NPC_VARIANTS[kind].map(async (file) => {
        try {
          const g = await load2(`${base()}models/${file}`)
          let skinned = false
          g.scene.traverse((o) => {
            if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true
          })
          if (skinned && g.animations.length) out.variants[kind].push({ scene: g.scene, clips: g.animations })
        } catch {
          /* not provided */
        }
      }),
    ),
  )
  ktx2.dispose()
  return out
}

const ANIMATION_FILES = ['idle', 'walk', 'run', 'jump', 'sit', 'talk', 'drive'] as const

/**
 * Optional separate animation files for the player: idle.glb, walk.glb, run.glb, jump.glb, sit.glb, talk.glb, looked up in
 * public/models/ and public/models/animations/ first, then at PLAYER_ASSETS_URL. Each file's first clip is added under the canonical name, so animations
 * exported from Mixamo or Blender next to the character can be used as they are. Bone names must match player.glb.
 */
async function addAnimationFiles(tpl: HumanTemplate, load: (url: string) => Promise<{ animations: THREE.AnimationClip[] }>) {
  const bones = new Set<string>()
  tpl.scene.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.add(o.name)
  })
  await Promise.all(
    ANIMATION_FILES.map(async (name) => {
      for (const where of [`${base()}models/`, `${base()}models/animations/`, PLAYER_ASSETS_URL + '/']) {
        const dir = where
        try {
          const g = await load(`${where}${name}.glb`)
          const src = g.animations[0]
          if (!src) continue
          const clip = src.clone()
          clip.name = name[0].toUpperCase() + name.slice(1)
          // animations recorded with root motion would drift away from the character: keep only the hip height
          for (const t of clip.tracks) {
            if (t.name.endsWith('.position') && /hips$/i.test(t.name.replace('.position', '')) && t.values.length >= 3) {
              for (let i = 0; i < t.values.length; i += 3) {
                t.values[i] = t.values[0]
                t.values[i + 2] = t.values[2]
              }
            }
          }
          const matched = clip.tracks.filter((t) => bones.has(t.name.split('.')[0])).length
          if (matched === 0) {
            console.warn(`${dir}${name}.glb has no bones in common with player.glb, so it was ignored.`)
            continue
          }
          tpl.clips = tpl.clips.filter((c) => c.name.toLowerCase() !== name).concat(clip)
          return
        } catch {
          /* not provided: try the next folder, then keep the clip inside player.glb */
        }
      }
    }),
  )
}
