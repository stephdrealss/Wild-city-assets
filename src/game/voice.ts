/** Speaks NPC lines with the browser's speech synthesis. Pitch and rate differ per character. */
const hasSpeech = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'

const FEMALE = /female|woman|samantha|karen|tessa|moira|fiona|serena|zira|susan|hazel|libby|sonia|natasha|jenny|aria|victoria|ava|allison|kate|martha|joanna|amy|emma/i
const MALE = /\bmale\b|daniel|david|george|alex|fred|mark|ryan|oliver|thomas|guy|james|rishi|arthur|gordon|aaron|brian|eric|liam|ezra|reed/i
const LANG_ORDER = ['en-ng', 'en-gb', 'en-za', 'en-au', 'en-ie', 'en-us', 'en']

let voices: SpeechSynthesisVoice[] = []
function loadVoices() {
  if (!hasSpeech()) return
  voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'))
}
if (hasSpeech()) {
  loadVoices()
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices)
}

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

function chooseVoice(key: string, female: boolean) {
  if (!voices.length) loadVoices()
  if (!voices.length) return undefined
  const rank = (v: SpeechSynthesisVoice) => {
    const i = LANG_ORDER.indexOf(v.lang.toLowerCase().replace('_', '-'))
    return i === -1 ? LANG_ORDER.length : i
  }
  const sorted = [...voices].sort((a, b) => rank(a) - rank(b))
  const matches = sorted.filter((v) => (female ? FEMALE.test(v.name) && !MALE.test(v.name) : MALE.test(v.name) && !FEMALE.test(v.name)))
  const pool = matches.length ? matches : sorted
  const best = rank(pool[0])
  // a Nigerian voice, when the phone has one, is used for everyone rather than mixed with British or American ones
  const top = pool.filter((v) => rank(v) <= (best === 0 ? 0 : best + 1))
  return top[hash(key) % top.length]
}

export interface VoiceProfile {
  /** seed so the same person always sounds the same */
  key: string
  female: boolean
  pitch: number
  rate: number
}

let turn = 0

/* ---------------- real Pidgin voices (9jaLingo, through /api/voice) ---------------- */
let realVoices: Promise<boolean> | null = null
/** Whether the server has real voices switched on. Checked once. */
function realEnabled() {
  if (!realVoices) {
    realVoices = fetch('/api/voice?status=1')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((j: { enabled?: boolean }) => !!j.enabled)
      .catch(() => false)
  }
  return realVoices
}
const clips = new Map<string, Promise<string | null>>()
/** voice requests run one at a time (the free plan allows very few at once); urgent ones go first */
const queue: { run: () => Promise<void>; urgent: boolean; key: string }[] = []
/** a line that is about to be spoken moves to the front of the queue */
function bump(key: string) {
  for (const q of queue) if (q.key === key) q.urgent = true
}
let running = 0
function pump() {
  while (running < 2 && queue.length) {
    const i = queue.findIndex((q) => q.urgent)
    const job = queue.splice(i >= 0 ? i : 0, 1)[0]
    running++
    void job.run().finally(() => {
      running--
      pump()
    })
  }
}
function enqueue<T>(fn: () => Promise<T>, urgent: boolean, key = '') {
  return new Promise<T>((resolve) => {
    queue.push({ run: () => fn().then(resolve, () => resolve(null as T)), urgent, key })
    pump()
  })
}
const clipKey = (text: string, p: VoiceProfile) => `${p.key}|${text}`
let audioEl: HTMLAudioElement | null = null
/** A tenth of a second of silence as a WAV data URL, used to unlock audio on the first tap. */
export function silentWav() {
  const n = 2205
  const b = new DataView(new ArrayBuffer(44 + n * 2))
  const w = (o: number, t: string) => [...t].forEach((c, i) => b.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF')
  b.setUint32(4, 36 + n * 2, true)
  w(8, 'WAVEfmt ')
  b.setUint32(16, 16, true)
  b.setUint16(20, 1, true)
  b.setUint16(22, 1, true)
  b.setUint32(24, 22050, true)
  b.setUint32(28, 44100, true)
  b.setUint16(32, 2, true)
  b.setUint16(34, 16, true)
  w(36, 'data')
  b.setUint32(40, n * 2, true)
  let bin = ''
  const u8 = new Uint8Array(b.buffer)
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
  return `data:audio/wav;base64,${btoa(bin)}`
}
/** One shared audio element, unlocked by the first tap so phones allow it to play later without a fresh tap. */
function audio() {
  if (!audioEl && typeof Audio !== 'undefined') audioEl = new Audio()
  return audioEl
}
if (typeof window !== 'undefined') {
  const unlock = () => {
    const a = audio()
    if (a && !a.src) {
      a.src = silentWav()
      void a.play().catch(() => {})
    }
    window.removeEventListener('pointerdown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
}

/** Start fetching a real voice clip for a line (no-op when real voices are off). Resolves to a playable URL or null. */
function fetchClip(text: string, p: VoiceProfile, urgent = false) {
  const k = clipKey(text, p)
  let c = clips.get(k)
  if (c && urgent) bump(k)
  if (!c) {
    c = realEnabled().then((on) => (!on ? null : enqueue(async () => {
      const ctrl = new AbortController()
      const t = window.setTimeout(() => ctrl.abort(), 12000)
      try {
        const q = new URLSearchParams({ t: text, v: p.key, g: p.female ? 'f' : 'm' })
        const r = await fetch(`/api/voice?${q}`, { signal: ctrl.signal })
        // plan limit reached: use the phone voice for the rest of this session instead of asking again
        // only a real quota limit switches voices off; "busy" just falls back for this one line
        if (r.status === 429 || r.status === 503) realVoices = Promise.resolve(false)
        if (!r.ok) {
          clips.delete(k)
          return null
        }
        return URL.createObjectURL(await r.blob())
      } catch {
        clips.delete(k)
        return null
      } finally {
        window.clearTimeout(t)
      }
    }, urgent, k)))
    clips.set(k, c)
    if (clips.size > 120) clips.delete(clips.keys().next().value as string)
  }
  return c
}

/** Play a clip to the end. Resolves false if it could not play. */
function playClip(url: string, token: () => boolean, rate = 1) {
  return new Promise<boolean>((resolve) => {
    const a = audio()
    if (!a) return resolve(false)
    let settled = false
    const done = (ok: boolean) => {
      if (settled) return
      settled = true
      a.onended = null
      a.onerror = null
      window.clearInterval(watch)
      resolve(ok)
    }
    a.onended = () => done(true)
    a.onerror = () => done(false)
    a.src = url
    a.currentTime = 0
    a.playbackRate = rate
    ;(a as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true
    const watch = window.setInterval(() => {
      if (!token()) {
        a.pause()
        done(true)
      }
    }, 150)
    a.play().catch(() => done(false))
  })
}

/**
 * How Pidgin words and Nigerian names should sound. English voices spell short words like "na" letter by letter and
 * stress names wrongly, so the spoken text is respelled phonetically. The text shown on screen is never changed.
 */
const SAY_AS: [RegExp, string][] = [
  [/\bna\b/gi, 'nah'],
  [/\bAda\b/g, 'Ahdah'],
  [/\bo\b(?=[!.,?]|$)/g, 'oh'],
  [/\bdey\b/gi, 'day'],
  [/\babeg\b/gi, 'ah-beg'],
  [/\bwetin\b/gi, 'weh-tin'],
  [/\bjare\b/gi, 'jah-ray'],
  [/\bhaba\b/gi, 'hah-bah'],
  [/\bomo\b/gi, 'oh-moh'],
  [/\bpikin\b/gi, 'pee-kin'],
  [/\bwahala\b/gi, 'wah-hah-lah'],
  [/\behen\b/gi, 'eh-hen'],
  [/\bahn ahn\b/gi, 'an an'],
  [/\bkampe\b/gi, 'kahm-peh'],
  [/\bgarri\b/gi, 'gah-ree'],
  [/\bcomot\b/gi, 'koh-mot'],
  [/\buna\b/gi, 'oo-nah'],
  [/\bsabi\b/gi, 'sah-bee'],
  [/\babi\b/gi, 'ah-bee'],
  [/\boya\b/gi, 'oh-yah'],
  [/\bchai\b/gi, 'chy'],
  [/\bjor\b/gi, 'jaw'],
  [/\bsha\b/gi, 'shah'],
  [/\bnau\b/gi, 'now'],
  [/\bnaim\b/gi, 'nah-im'],
  [/\bmama put\b/gi, 'mama poot'],
  [/\bNgozi\b/g, 'Nn-goh-zee'],
  [/\bChike\b/g, 'Chee-keh'],
  [/\bOgoja\b/g, 'Oh-goh-jah'],
  // phone voices read "oga" as "ogo"
  [/\boga\b/gi, 'aw-gah'],
  [/\bNEPA\b/g, 'Neh-pah'],
  [/\bMTN\b/g, 'M T N'],
]

export function sayAs(text: string) {
  let t = text
  for (const [re, to] of SAY_AS) t = t.replace(re, to)
  return t
}

export const voice = {
  supported: hasSpeech,
  /**
   * Say a line. Returns the last utterance so callers can wait for it to end. With `queue` it waits for whatever is
   * already being said instead of cutting it off.
   */
  speak(text: string, p: VoiceProfile, opts: { queue?: boolean } = {}): SpeechSynthesisUtterance | null {
    if (!hasSpeech()) return null
    const synth = window.speechSynthesis
    // only cancel when something is actually playing: on Android a cancel right before speak can swallow the new line
    if (!opts.queue && (synth.speaking || synth.pending)) synth.cancel()
    const v = chooseVoice(p.key, p.female)
    const jitter = ((hash(p.key) % 21) - 10) / 100
    const rate = Math.min(1.4, Math.max(0.9, (p.rate + jitter / 2) * 1.15))
    const pitch = Math.min(2, Math.max(0.1, p.pitch + (p.female ? 0.15 : 0) + jitter))
    // keep the whole line in one breath; only very long lines are split (some phones stop after ~200 characters)
    const clean = sayAs(text).replace(/\.\.\./g, ',')
    const parts: string[] = []
    let cur = ''
    for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
      if (cur && (cur + ' ' + sentence).length > 180) {
        parts.push(cur)
        cur = sentence
      } else cur = cur ? `${cur} ${sentence}` : sentence
    }
    if (cur) parts.push(cur)
    let last: SpeechSynthesisUtterance | null = null
    for (const part of parts) {
      const u = new SpeechSynthesisUtterance(part)
      if (v) {
        u.voice = v
        u.lang = v.lang
      } else u.lang = 'en-NG'
      u.pitch = pitch
      u.rate = rate
      u.volume = 1
      synth.speak(u)
      last = u
    }
    // some browsers start paused after a cancel
    if (synth.paused) synth.resume()
    return last
  },
  /**
   * Say a line and resolve only when all of it has been spoken, so two people take turns without cutting each other off.
   * Falls back to normal reading time when the browser has no speech, the sound is off, or speech never starts.
   */
  /** Warm up real voice clips for lines that are about to be said. */
  prefetch(text: string, p: VoiceProfile) {
    void fetchClip(text, p)
  },
  /**
   * `maxWait`: how long to wait for the real voice before moving on. `quietIfLate`: if it is late, show the line without
   * any voice (used for her own lines, so a slow network never makes the conversation drag).
   */
  say(text: string, p: VoiceProfile, muted = false, opts: { maxWait?: number; quietIfLate?: boolean } = {}) {
    if (!muted) {
      // real Pidgin voice first, the phone voice only as a fallback
      return realEnabled().then(async (on) => {
        if (on) {
          const token = ++turn
          const late = Symbol('late')
          const got = await Promise.race([fetchClip(text, p, true), new Promise<typeof late>((r) => window.setTimeout(() => r(late), opts.maxWait ?? 6000))])
          if (got === late && opts.quietIfLate) {
            await new Promise((r) => window.setTimeout(r, Math.min(1400, 350 + text.length * 22)))
            return
          }
          const url = got === late ? null : got
          if (url && token === turn) {
            if (hasSpeech()) window.speechSynthesis.cancel()
            // natural speed and pitch: speeding clips up made everyone sound like a cartoon
            const ok = await playClip(url, () => token === turn, 1)
            if (ok) return
          }
          if (token !== turn) return
        }
        return this.speakAndWait(text, p, false)
      })
    }
    return this.speakAndWait(text, p, true)
  },
  speakAndWait(text: string, p: VoiceProfile, muted: boolean) {
    const readMs = Math.max(1000, text.length * 48)
    return new Promise<void>((resolve) => {
      const token = ++turn
      let done = false
      const finish = () => {
        if (done) return
        done = true
        window.clearTimeout(guard)
        resolve()
      }
      const guard = window.setTimeout(finish, muted || !hasSpeech() ? readMs : readMs * 2 + 2500)
      if (muted || !hasSpeech()) return
      const last = this.speak(text, p)
      if (!last) return
      let started = false
      last.onstart = () => {
        started = true
      }
      last.onend = () => window.setTimeout(finish, 120)
      last.onerror = () => finish()
      const synth = window.speechSynthesis
      // backup for phones that never fire onend: finish once speech has been silent for a moment
      let quiet = 0
      const poll = () => {
        if (done) return
        if (token !== turn) return finish()
        // "pending" alone is not talking: some phones leave a line pending forever
        if (synth.speaking) {
          started = true
          quiet = 0
        } else if (started && ++quiet >= 4) return finish()
        window.setTimeout(poll, 120)
      }
      window.setTimeout(poll, 200)
      // the phone voice did not start quickly: no long silence, just carry on at reading pace
      window.setTimeout(() => {
        if (!started && !done) {
          synth.cancel()
          window.clearTimeout(guard)
          window.setTimeout(finish, Math.max(0, Math.min(readMs, 400 + text.length * 35) - 900))
        }
      }, 900)
    })
  },
  stop() {
    turn++
    if (hasSpeech()) window.speechSynthesis.cancel()
    audioEl?.pause()
  },
}
