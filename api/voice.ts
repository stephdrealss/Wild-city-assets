/**
 * Real Nigerian Pidgin voices for Wild City PH, via 9jaLingo (https://www.9jalingo.org).
 *
 *   GET /api/voice?t=<text>&v=<voice key>&g=<f|m>   -> audio for that line
 *   GET /api/voice?status=1                         -> { enabled: boolean }
 *
 * The API key stays on the server (Vercel env var NAIJALINGO_API_KEY). Every NPC gets a stable Pidgin speaker picked
 * from 9jaLingo's list by gender; the player is always "ada_pcm". Identical lines are cached by Vercel's CDN, so a line
 * is only generated once.
 */

const BASE = (process.env.NAIJALINGO_BASE_URL || 'https://api.9jalingo.org').replace(/\/+$/, '')
const KEY = process.env.NAIJALINGO_API_KEY || ''
/**
 * Svara TTS (Kenpath Labs). It is trained on Indian languages, so it reads Pidgin with an Indian accent: off unless
 * VOICE_PROVIDER=svara is set. 9jaLingo (a real Nigerian Pidgin model) is the default.
 */
const SVARA_KEY = process.env.VOICE_PROVIDER === 'svara' ? process.env.SVARA_API_KEY || '' : ''
const SVARA = 'https://api.kenpathlabs.com'
const SVARA_DEFAULT_VOICE = process.env.SVARA_VOICE || 'sv_gv3r8qnj'
let svaraVoices: { at: number; list: SpeakerInfo[] } | null = null

async function svaraList(): Promise<SpeakerInfo[]> {
  if (svaraVoices && Date.now() - svaraVoices.at < 6 * 3600_000) return svaraVoices.list
  let list: SpeakerInfo[] = []
  for (const path of ['/v1/voices?lang=pcm', '/v1/voices']) {
    try {
      const r = await fetch(`${SVARA}${path}`, { headers: { Authorization: `Bearer ${SVARA_KEY}` } })
      if (!r.ok) continue
      const j = (await r.json()) as { voices?: Record<string, unknown>[]; data?: Record<string, unknown>[] } | Record<string, unknown>[]
      const raw = Array.isArray(j) ? j : (j.voices ?? j.data ?? [])
      list = raw
        .map((v) => {
          const labels = (v.labels ?? {}) as Record<string, unknown>
          const langs = JSON.stringify([v.language, v.languages, v.lang, labels.language, labels.accent]).toLowerCase()
          return { id: String(v.voice_id ?? v.id ?? ''), gender: String(v.gender ?? labels.gender ?? '').toLowerCase(), langs }
        })
        .filter((v) => v.id)
        .sort((a, b) => Number(b.langs.includes('pcm') || b.langs.includes('pidgin') || b.langs.includes('nigeria')) - Number(a.langs.includes('pcm') || a.langs.includes('pidgin') || a.langs.includes('nigeria')))
        .map(({ id, gender }) => ({ id, gender }))
      if (list.length) break
    } catch {
      /* try the next path */
    }
  }
  if (!list.length) list = [{ id: SVARA_DEFAULT_VOICE, gender: '' }]
  svaraVoices = { at: Date.now(), list: list.slice(0, 40) }
  return svaraVoices.list
}

async function svaraVoiceFor(key: string, gender: 'f' | 'm') {
  if (key === 'player' && process.env.SVARA_PLAYER_VOICE) return process.env.SVARA_PLAYER_VOICE
  const all = await svaraList()
  const want = gender === 'm' ? /^m/ : /^f/
  const pool = all.filter((v) => want.test(v.gender))
  const list = pool.length ? pool : all
  return list[hash(key) % list.length].id
}

async function svaraSynth(text: string, voice: string) {
  const call = () =>
    fetch(`${SVARA}/v1/audio/speech`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SVARA_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'svara-tts-turbo', input: text, voice, lang: 'pcm', response_format: 'mp3' }),
    })
  let r = await call()
  // "too many at once" is not a quota problem: wait a moment and try again
  for (let i = 0; i < 8 && r.status === 429; i++) {
    const body = await r.clone().text().catch(() => '')
    if (!body.includes('concurrent')) break
    await sleep(400 + i * 350 + Math.random() * 300)
    r = await call()
  }
  if (!r.ok) {
    const detail = (await r.text().catch(() => '')).slice(0, 300)
    console.error('svara error', r.status, detail)
    const err = new Error(`voice service answered ${r.status}: ${detail}`) as Error & { status?: number; retryAfter?: number }
    err.status = detail.includes('concurrent') ? 409 : r.status
    const ra = r.headers.get('retry-after')
    err.retryAfter = ra ? Number(ra) : undefined
    throw err
  }
  const type = r.headers.get('content-type') || 'audio/mpeg'
  if (type.includes('json')) throw new Error('voice service returned no audio')
  return { bytes: await r.arrayBuffer(), type }
}
const PLAYER_SPEAKER = process.env.PLAYER_SPEAKER || 'ada_pcm'
const MAX_CHARS = 280

interface SpeakerInfo {
  id: string
  gender: string
}

let speakerCache: { at: number; list: SpeakerInfo[] } | null = null
/** after a plan-limit answer, stop calling 9jaLingo until its reset time (saves the quota and keeps the game fast) */
let limitedUntil = 0

async function api(path: string, init?: RequestInit) {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json', 'User-Agent': 'wild-city-ph/1.0', ...(init?.headers ?? {}) },
  })
}

async function pidginSpeakers(): Promise<SpeakerInfo[]> {
  if (speakerCache && Date.now() - speakerCache.at < 6 * 3600_000) return speakerCache.list
  let list: SpeakerInfo[] = []
  try {
    const r = await api('/v1/speakers?language=pcm')
    if (r.ok) {
      const data = (await r.json()) as { speakers?: { id?: string; speaker_id?: string; gender?: string | null }[] }
      list = (data.speakers ?? [])
        .map((s) => ({ id: String(s.id ?? s.speaker_id ?? ''), gender: String(s.gender ?? '').toLowerCase() }))
        .filter((s) => s.id.endsWith('_pcm'))
    }
  } catch {
    /* fall back below */
  }
  if (!list.length) list = [{ id: 'ada_pcm', gender: 'female' }, { id: 'blessing_pcm', gender: 'female' }, { id: 'daniel_pcm', gender: 'male' }]
  speakerCache = { at: Date.now(), list }
  return list
}

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

async function speakerFor(key: string, gender: 'f' | 'm') {
  if (key === 'player') return PLAYER_SPEAKER
  const all = await pidginSpeakers()
  // keep Ada's voice for the player only
  const others = all.filter((s) => s.id !== PLAYER_SPEAKER)
  const want = gender === 'm' ? /^m/ : /^f/
  const pool = others.filter((s) => want.test(s.gender))
  const list = pool.length ? pool : others.length ? others : all
  return list[hash(key) % list.length].id
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Generate speech, waiting through a cold start (the engine answers 202 with a job id while it wakes up). */
async function synth(text: string, voice: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  const body = { input: text, voice, lang: 'pcm', model: '9jalingo-tts-1', response_format: 'mp3' }
  let r = await api('/v1/audio/speech', { method: 'POST', body: JSON.stringify(body), headers: { Prefer: 'respond-async-on-cold-start' } })
  if (r.status === 400 || r.status === 422) {
    // older engines only produce wav
    r = await api('/v1/audio/speech', { method: 'POST', body: JSON.stringify({ ...body, response_format: 'wav' }), headers: { Prefer: 'respond-async-on-cold-start' } })
  }
  if (r.status === 202) {
    const job = (await r.json()) as { job_id?: string; id?: string }
    const id = encodeURIComponent(String(job.job_id ?? job.id ?? ''))
    const until = Date.now() + 20_000
    while (Date.now() < until) {
      await sleep(1500)
      const st = (await (await api(`/v1/jobs/${id}`)).json()) as { status?: string }
      const state = String(st.status ?? '').toLowerCase()
      if (state === 'completed') {
        r = await api(`/v1/jobs/${id}/audio`)
        break
      }
      if (state === 'failed') throw new Error('generation failed')
    }
    if (r.status === 202) throw new Error('voice engine still waking up')
  }
  if (!r.ok) {
    const detail = (await r.text().catch(() => '')).slice(0, 300)
    const ra = r.headers.get('retry-after')
    console.error('9jalingo error', r.status, ra, detail)
    const err = new Error(`voice service answered ${r.status}${ra ? ` (retry after ${ra}s)` : ''}: ${detail}`) as Error & { status?: number; retryAfter?: number }
    err.status = r.status
    err.retryAfter = ra ? Number(ra) : undefined
    throw err
  }
  const type = r.headers.get('content-type') || 'audio/mpeg'
  if (type.includes('json')) throw new Error('voice service returned no audio')
  return { bytes: await r.arrayBuffer(), type }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  if (url.searchParams.get('status')) {
    return Response.json({ enabled: (!!SVARA_KEY || !!KEY) && Date.now() > limitedUntil, provider: SVARA_KEY ? 'svara' : KEY ? '9jalingo' : null }, { headers: { 'Cache-Control': 'no-store' } })
  }
  if (Date.now() < limitedUntil) {
    return new Response('voice limit reached', { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(Math.ceil((limitedUntil - Date.now()) / 1000)) } })
  }
  if (!KEY && !SVARA_KEY) return new Response('voices not configured', { status: 503 })
  const text = (url.searchParams.get('t') || '').trim()
  const key = (url.searchParams.get('v') || 'npc').slice(0, 64)
  const gender = url.searchParams.get('g') === 'm' ? 'm' : 'f'
  if (!text || text.length > MAX_CHARS) return new Response('bad text', { status: 400 })
  try {
    const { bytes, type } = SVARA_KEY ? await svaraSynth(text, await svaraVoiceFor(key, gender)) : await synth(text, await speakerFor(key, gender))
    return new Response(bytes, {
      headers: {
        'Content-Type': type,
        // same line + same voice -> served from Vercel's CDN, never generated twice
        'Cache-Control': 'public, max-age=86400, s-maxage=31536000, immutable',
      },
    })
  } catch (e) {
    const st = (e as { status?: number }).status === 429 ? 429 : (e as { status?: number }).status === 409 ? 409 : 502
    const ra = (e as { retryAfter?: number }).retryAfter
    if (st === 429) limitedUntil = Date.now() + Math.min(3600, ra ?? 600) * 1000
    return new Response(e instanceof Error ? e.message : 'voice error', {
      status: st,
      headers: { 'Cache-Control': 'no-store', ...(ra ? { 'Retry-After': String(ra) } : {}) },
    })
  }
}
