import { silentWav } from './voice'
/**
 * Procedural audio (Web Audio, no files): afrobeats loop, street ambience (market chatter,
 * car horns, keke putter), footsteps and UI/gameplay sound effects.
 * Browsers block autoplay, so nothing starts until `start()` or `unlock()` runs from a click.
 */
export interface Scene {
  /** 0..1 closeness to a shop speaker */
  shop: number
  /** 0..1 crowd density around the player */
  market: number
  /** 0..1 closeness of the nearest bus, keke or okada */
  traffic: number
  riding: boolean
  rideSpeed: number
  night: number
}

type Sfx = 'coin' | 'ok' | 'bad' | 'tap' | 'click' | 'jingle' | 'jump' | 'land' | 'horn'

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

export type Station = 'mix' | 'amapiano' | 'afrobeats' | 'highlife' | 'mine' | 'off'
const STATIONS: Station[] = ['mix', 'amapiano', 'afrobeats', 'highlife', 'off']
function loadStation(): Station {
  try {
    const v = localStorage.getItem('wildcity-station') as Station | null
    if (v && STATIONS.includes(v)) return v
  } catch {
    /* storage unavailable */
  }
  return 'mix'
}

class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private musicGain!: GainNode
  private musicFilter!: BiquadFilterNode
  private sfxBus!: GainNode
  private ambBus!: GainNode
  private noise!: AudioBuffer
  private chatter!: GainNode
  private putter!: GainNode
  private ride!: GainNode
  private rideOsc!: OscillatorNode
  private step = 0
  private next = 0
  private timers: number[] = []
  private scene: Scene = { shop: 0, market: 0, traffic: 0, riding: false, rideSpeed: 0, night: 0 }
  private started = false
  muted = false
  volume = 0.8
  private duckLevel = 1
  /** which radio station is playing */
  station: Station = loadStation()
  private mine: HTMLAudioElement | null = null
  mineName = ''
  mineError = false
  private listeners = new Set<() => void>()

  onChange(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private emit() {
    for (const f of this.listeners) f()
  }

  setStation(st: Station) {
    this.station = st
    try {
      if (st !== 'mine') localStorage.setItem('wildcity-station', st)
    } catch {
      /* storage unavailable */
    }
    if (st === 'mine') {
      this.mineVolume()
      void this.mine?.play().catch(() => {})
    }
    else this.mine?.pause()
    this.setScene(this.scene)
    this.emit()
  }

  /**
   * Called on the tap that opens the song picker. Phones only let audio start from a direct tap, and picking a file is
   * not one, so the player element is unlocked here with a moment of silence first.
   */
  primeOwnSong() {
    if (!this.mine) {
      this.mine = new Audio()
      this.mine.loop = true
      this.mine.setAttribute('playsinline', '')
    }
    if (!this.mine.src.startsWith('blob:')) {
      this.mine.src = silentWav()
      void this.mine.play().catch(() => {})
    }
    this.unlock()
  }

  /** Play a song the player picked from their own device. It never leaves their phone. */
  playOwnSong(file: File) {
    this.primeOwnSong()
    if (!this.mine) return
    if (this.mine.src.startsWith('blob:')) URL.revokeObjectURL(this.mine.src)
    this.mine.src = URL.createObjectURL(file)
    this.mine.loop = true
    this.mineName = file.name.replace(/\.[a-z0-9]+$/i, '')
    this.mineError = false
    // a file the phone cannot play (a video, a document...) says so instead of failing silently
    this.mine.onerror = () => {
      if (!this.mine?.src.startsWith('blob:')) return
      this.mineError = true
      this.mineName = ''
      this.setStation('mix')
    }
    this.unlock()
    this.setStation('mine')
  }

  private mineVolume() {
    if (!this.mine) return
    this.mine.volume = this.muted || this.station !== 'mine' ? 0 : Math.min(1, this.volume * 0.85 * this.duckLevel)
  }

  /** Turn the music down while people are talking, and back up after. */
  duck(on: boolean) {
    this.duckLevel = on ? 0.35 : 1
    this.mineVolume()
    // iPhones pause one sound when another starts (the voices), so pick her song back up after the chat
    if (!on && this.station === 'mine' && this.mine?.paused && this.mine.src.startsWith('blob:')) void this.mine.play().catch(() => {})
    this.setScene(this.scene)
  }

  /** Begin audio after the player clicks Play or connects a wallet. */
  start() {
    this.started = true
    this.unlock()
  }

  unlock() {
    const ctx = this.ensure()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
    this.applyMaster()
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v))
    this.applyMaster()
  }

  setMuted(m: boolean) {
    this.muted = m
    this.applyMaster()
  }

  private applyMaster() {
    this.mineVolume()
    if (!this.ctx) return
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.05)
  }

  private ensure() {
    if (this.ctx) return this.ctx
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    const ctx = new AC()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : this.volume
    const comp = ctx.createDynamicsCompressor()
    this.master.connect(comp)
    comp.connect(ctx.destination)

    this.musicGain = ctx.createGain()
    this.musicGain.gain.value = 0
    this.musicFilter = ctx.createBiquadFilter()
    this.musicFilter.type = 'lowpass'
    this.musicFilter.frequency.value = 1800
    this.musicFilter.connect(this.musicGain)
    this.musicGain.connect(this.master)

    this.sfxBus = ctx.createGain()
    this.sfxBus.gain.value = 0.9
    this.sfxBus.connect(this.master)
    this.ambBus = ctx.createGain()
    this.ambBus.gain.value = 1
    this.ambBus.connect(this.master)

    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    this.noise = buf

    this.buildAmbience(ctx)
    this.next = ctx.currentTime + 0.1
    this.timers.push(window.setInterval(() => this.schedule(), 60))
    this.timers.push(window.setInterval(() => this.ambientEvents(), 700))
    return ctx
  }

  /* ---------------- ambience beds ---------------- */
  private loopNoise(ctx: AudioContext) {
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    s.loop = true
    s.start()
    return s
  }

  private buildAmbience(ctx: AudioContext) {
    // market crowd murmur: two band-passed noise layers with slow, uneven wobble
    this.chatter = ctx.createGain()
    this.chatter.gain.value = 0
    this.chatter.connect(this.ambBus)
    for (const [freq, q, rate] of [[420, 1.1, 2.3], [900, 1.6, 3.7], [1500, 2, 5.1]] as const) {
      const src = this.loopNoise(ctx)
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = freq
      bp.Q.value = q
      const g = ctx.createGain()
      g.gain.value = 0.5
      const lfo = ctx.createOscillator()
      lfo.frequency.value = rate
      const depth = ctx.createGain()
      depth.gain.value = 0.35
      lfo.connect(depth)
      depth.connect(g.gain)
      lfo.start()
      src.connect(bp)
      bp.connect(g)
      g.connect(this.chatter)
    }
    // keke engines: low putter, saw through a lowpass with a choppy gain
    this.putter = ctx.createGain()
    this.putter.gain.value = 0
    this.putter.connect(this.ambBus)
    const eng = ctx.createOscillator()
    eng.type = 'sawtooth'
    eng.frequency.value = 58
    const eng2 = ctx.createOscillator()
    eng2.type = 'square'
    eng2.frequency.value = 29
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 320
    const chop = ctx.createGain()
    chop.gain.value = 0.5
    const chopLfo = ctx.createOscillator()
    chopLfo.type = 'square'
    chopLfo.frequency.value = 13
    const chopDepth = ctx.createGain()
    chopDepth.gain.value = 0.4
    chopLfo.connect(chopDepth)
    chopDepth.connect(chop.gain)
    eng.connect(lp)
    eng2.connect(lp)
    lp.connect(chop)
    chop.connect(this.putter)
    eng.start()
    eng2.start()
    chopLfo.start()
    // the player's own ride
    this.ride = ctx.createGain()
    this.ride.gain.value = 0
    this.ride.connect(this.ambBus)
    this.rideOsc = ctx.createOscillator()
    this.rideOsc.type = 'sawtooth'
    this.rideOsc.frequency.value = 60
    const rlp = ctx.createBiquadFilter()
    rlp.type = 'lowpass'
    rlp.frequency.value = 420
    this.rideOsc.connect(rlp)
    rlp.connect(this.ride)
    this.rideOsc.start()
  }

  setScene(s: Scene) {
    this.scene = s
    const ctx = this.ctx
    if (!ctx || !this.started) return
    const t = ctx.currentTime
    const synthOn = this.station !== 'off' && this.station !== 'mine'
    const music = this.muted || !synthOn ? 0 : (0.42 + s.shop * 0.3) * this.duckLevel
    this.mineVolume()
    this.musicGain.gain.setTargetAtTime(music, t, 0.4)
    this.musicFilter.frequency.setTargetAtTime(2600 + s.shop * 3000 + (1 - s.night) * 800, t, 0.4)
    this.chatter.gain.setTargetAtTime(0.05 * s.market, t, 0.5)
    this.putter.gain.setTargetAtTime(0.1 * s.traffic * s.traffic, t, 0.4)
    this.ride.gain.setTargetAtTime(s.riding ? 0.07 + Math.min(0.08, s.rideSpeed * 0.005) : 0, t, 0.2)
    this.rideOsc.frequency.setTargetAtTime(45 + s.rideSpeed * 5, t, 0.15)
  }

  /** Random one-shots: car horns and market calls. */
  private ambientEvents() {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running' || !this.started || this.muted) return
    const s = this.scene
    if (s.traffic > 0.15 && Math.random() < 0.09 * s.traffic) this.horn(0.05 + 0.07 * s.traffic, Math.random() * 2 - 1)
    if (s.market > 0.1 && Math.random() < 0.55 * s.market) this.call(0.05 + 0.08 * s.market)
  }

  private pan(p: number) {
    const ctx = this.ctx!
    const n = ctx.createStereoPanner()
    n.pan.value = p
    n.connect(this.sfxBus)
    return n
  }

  private horn(vol: number, panV = 0) {
    const ctx = this.ctx!
    const out = this.pan(panV)
    const t = ctx.currentTime
    const double = Math.random() < 0.5
    const burst = (at: number, dur: number) => {
      for (const f of [392, 494]) {
        const o = ctx.createOscillator()
        o.type = 'square'
        o.frequency.value = f
        const lp = ctx.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 1500
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, t + at)
        g.gain.linearRampToValueAtTime(vol * 0.5, t + at + 0.015)
        g.gain.setValueAtTime(vol * 0.5, t + at + dur - 0.03)
        g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur)
        o.connect(lp)
        lp.connect(g)
        g.connect(out)
        o.start(t + at)
        o.stop(t + at + dur + 0.02)
      }
    }
    burst(0, double ? 0.14 : 0.4)
    if (double) burst(0.22, 0.2)
  }

  /** A short shouted word from a trader: band-passed noise with a pitch glide. */
  private call(vol: number) {
    const ctx = this.ctx!
    const out = this.pan(Math.random() * 1.6 - 0.8)
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noise
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 4
    const f0 = 500 + Math.random() * 500
    bp.frequency.setValueAtTime(f0, t)
    bp.frequency.linearRampToValueAtTime(f0 * (0.7 + Math.random() * 0.8), t + 0.28)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    src.connect(bp)
    bp.connect(g)
    g.connect(out)
    src.start(t, Math.random())
    src.stop(t + 0.4)
  }

  /* ---------------- music ---------------- */
  private tone(t: number, f: number, dur: number, type: OscillatorType, vol: number, to: AudioNode = this.musicFilter) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = f
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
    o.connect(g)
    g.connect(to)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private hit(t: number, hp: number, dur: number, vol: number, lp = 0) {
    const ctx = this.ctx!
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = hp
    const g = ctx.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur)
    s.connect(f)
    let last: AudioNode = f
    if (lp) {
      const l = ctx.createBiquadFilter()
      l.type = 'lowpass'
      l.frequency.value = lp
      f.connect(l)
      last = l
    }
    last.connect(g)
    g.connect(this.musicFilter)
    s.start(t, Math.random())
    s.stop(t + dur)
  }

  private kick(t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12)
    g.gain.setValueAtTime(0.95, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    o.connect(g)
    g.connect(this.musicFilter)
    o.start(t)
    o.stop(t + 0.24)
  }

  /** Amapiano log drum: a pitched, punchy low note that slides down into place. */
  private logDrum(t: number, f: number, vol = 0.55) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const o2 = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o2.type = 'triangle'
    o.frequency.setValueAtTime(f * 1.9, t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.05)
    o2.frequency.setValueAtTime(f * 3.8, t)
    o2.frequency.exponentialRampToValueAtTime(f * 2, t + 0.05)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42)
    const g2 = ctx.createGain()
    g2.gain.value = 0.18
    o.connect(g)
    o2.connect(g2)
    g2.connect(g)
    g.connect(this.musicFilter)
    o.start(t)
    o2.start(t)
    o.stop(t + 0.45)
    o2.stop(t + 0.45)
  }

  /** Soft electric-piano chord with a slow fade, the warm amapiano keys. */
  private keys(t: number, notes: number[], dur: number, vol = 0.05) {
    for (const n of notes) {
      this.tone(t, midi(n), dur, 'triangle', vol)
      this.tone(t + 0.004, midi(n + 12), dur * 0.6, 'sine', vol * 0.35)
    }
  }

  /** 112 bpm afro-amapiano: four-to-the-floor kick, log drum riffs, 16th shakers, off-beat hats and lazy piano chords. */
  private amapiano(t: number, s: number, bar: number) {
    const roots = [45, 43, 41, 43] // Am, G, F, G
    const chords = [[57, 60, 64, 67], [55, 59, 62, 66], [53, 57, 60, 64], [55, 59, 62, 65]]
    if (s % 4 === 0) this.kick(t)
    // shaker on every 16th, accented off-beats
    this.hit(t, 8000, 0.03, s % 4 === 2 ? 0.12 : 0.06)
    // open hat on the off-beat
    if (s % 4 === 2) this.hit(t, 6000, 0.12, 0.07)
    // clap on 2 and 4
    if (s === 4 || s === 12) {
      this.hit(t, 1500, 0.16, 0.34)
      this.hit(t + 0.015, 3200, 0.1, 0.18)
    }
    // log drum riff, changes on alternate bars
    const r = roots[bar]
    const riff = bar % 2 === 0 ? [0, -1, -1, 0, -1, -1, 7, -1, -1, 0, -1, 12, -1, -1, 10, -1] : [0, -1, -1, 0, -1, -1, 7, -1, 0, -1, 3, -1, 5, -1, 7, -1]
    const n = riff[s]
    if (n >= 0) this.logDrum(t, midi(r - 12 + n))
    // piano chords: long on 1, short pushes after
    if (s === 0) this.keys(t, chords[bar], 1.1)
    if (s === 6 || s === 11) this.keys(t, chords[bar], 0.35, 0.035)
    // little vocal-ish flute line every 4th bar
    if (bar === 3 && [0, 2, 4, 7, 10].includes(s)) this.tone(t, midi([76, 74, 72, 74, 69][[0, 2, 4, 7, 10].indexOf(s)]), 0.3, 'sine', 0.06)
  }

  /** 120 bpm highlife: bright guitar picking, bell pattern, walking bass, soft congas. */
  private highlife(t: number, s: number, bar: number) {
    const roots = [48, 53, 55, 48] // C, F, G, C
    const triads = [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]]
    // bell (gankogui-style) pattern
    if ([0, 2, 4, 5, 7, 9, 11].includes(s % 12)) this.tone(t, midi(s % 12 === 0 ? 84 : 91), 0.08, 'square', 0.03)
    if (s % 8 === 0) this.kick(t)
    if (s % 4 === 2) this.hit(t, 2500, 0.08, 0.12, 6000)
    this.hit(t, 8000, 0.025, s % 2 ? 0.04 : 0.07)
    // guitar picking through the chord
    const tri = triads[bar]
    const pick = [0, 1, 2, 1, 0, 2, 1, 2][s % 8]
    if (s % 2 === 0) this.tone(t, midi(tri[pick] + 12), 0.22, 'triangle', 0.07)
    if (s === 6 || s === 14) this.tone(t, midi(tri[2] + 12), 0.18, 'triangle', 0.05)
    // walking bass
    const walk = [0, -1, -1, -1, 4, -1, -1, -1, 7, -1, -1, -1, 9, -1, 7, -1][s]
    if (walk >= 0) this.tone(t, midi(roots[bar] - 12 + walk), 0.3, 'triangle', 0.3)
  }

  /** 104 bpm afrobeats: syncopated kick, clap on 2 and 4, shaker, clave, rolling bass and chord stabs. */
  private schedule() {
    const ctx = this.ctx
    if (!ctx || ctx.state !== 'running' || !this.started || this.muted) {
      if (ctx) this.next = Math.max(this.next, ctx.currentTime + 0.05)
      return
    }
    const roots = [45, 41, 48, 43] // A, F, C, G
    const chords = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]
    const pent = [0, 3, 5, 7, 10, 12, 15]
    while (this.next < ctx.currentTime + 0.25) {
      const t = this.next
      const s = this.step % 16
      const bar = Math.floor(this.step / 16) % 4
      const st = this.station
      if (st === 'off' || st === 'mine') {
        this.next += 60 / 112 / 4
        this.step++
        continue
      }
      if (st === 'highlife') {
        this.highlife(t, s, bar)
        this.next += 60 / 120 / 4
        this.step++
        continue
      }
      // the mix plays 16 bars of amapiano, then 8 of afrobeats, round and round
      const amapiano = st === 'amapiano' || (st === 'mix' && Math.floor(this.step / 16) % 24 < 16)
      if (amapiano) {
        this.amapiano(t, s, bar)
        this.next += 60 / 112 / 4
        this.step++
        continue
      }
      if (s === 0 || s === 7 || s === 10 || (s === 14 && bar % 2 === 1)) this.kick(t)
      if (s === 4 || s === 12) {
        this.hit(t, 1400, 0.14, 0.4)
        this.hit(t + 0.012, 3000, 0.09, 0.22)
      }
      if (s === 15 && bar === 3) this.hit(t, 1400, 0.08, 0.2)
      this.hit(t, 7500, 0.035, s % 2 === 0 ? 0.13 : 0.07)
      if ([0, 3, 6, 10, 12].includes(s)) this.tone(t, midi(88), 0.05, 'square', 0.05)
      const r = roots[bar]
      const bassPat = [0, -1, 0, 7, -1, 0, 12, -1, 0, -1, 7, 0, -1, 5, 7, -1][s]
      if (bassPat >= 0) this.tone(t, midi(r + bassPat), 0.2, 'triangle', 0.34)
      if ([2, 5, 9, 13].includes(s)) for (const n of chords[bar]) this.tone(t, midi(n), 0.14, 'sawtooth', 0.035)
      if ([0, 3, 7, 8, 11, 14].includes(s) && bar % 2 === 1) {
        const n = pent[(this.step * 3 + s) % pent.length]
        this.tone(t, midi(69 + n), 0.18, 'sine', 0.09)
      }
      this.next += 60 / 104 / 4
      this.step++
    }
  }

  /* ---------------- effects ---------------- */
  footstep(surface: 'pave' | 'sand', run: boolean) {
    const ctx = this.ensure()
    if (!ctx || this.muted || !this.started) return
    const t = ctx.currentTime
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = surface === 'sand' ? 'lowpass' : 'bandpass'
    f.frequency.value = surface === 'sand' ? 700 : 1800 + Math.random() * 600
    f.Q.value = 0.8
    const g = ctx.createGain()
    const v = (run ? 0.2 : 0.13) * (0.8 + Math.random() * 0.4)
    g.gain.setValueAtTime(v, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + (surface === 'sand' ? 0.12 : 0.07))
    s.connect(f)
    f.connect(g)
    g.connect(this.sfxBus)
    s.start(t, Math.random())
    s.stop(t + 0.14)
    this.tone(t, 95 + Math.random() * 20, 0.07, 'sine', v * 0.8, this.sfxBus)
  }

  sfx(kind: Sfx) {
    const ctx = this.ensure()
    if (!ctx || this.muted) return
    if (ctx.state === 'suspended') void ctx.resume()
    const t = ctx.currentTime
    const note = (f: number, at: number, dur: number, type: OscillatorType, vol = 0.15) => this.tone(t + at, f, dur, type, vol, this.sfxBus)
    switch (kind) {
      case 'coin':
        note(988, 0, 0.1, 'square', 0.08)
        note(1319, 0.08, 0.22, 'square', 0.08)
        note(1976, 0.08, 0.15, 'sine', 0.05)
        break
      case 'ok':
        note(523, 0, 0.1, 'triangle')
        note(784, 0.09, 0.2, 'triangle')
        break
      case 'bad':
        note(180, 0, 0.22, 'sawtooth', 0.1)
        note(140, 0.1, 0.25, 'sawtooth', 0.08)
        break
      case 'tap':
        note(660, 0, 0.05, 'triangle', 0.1)
        break
      case 'click':
        note(1100, 0, 0.035, 'square', 0.04)
        note(740, 0.02, 0.05, 'triangle', 0.07)
        break
      case 'jingle':
        ;[523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.09, 0.22, 'triangle', 0.14))
        for (const f of [523, 659, 784, 1047]) note(f, 0.42, 0.7, 'sine', 0.07)
        note(1568, 0.5, 0.45, 'triangle', 0.06)
        break
      case 'jump': {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.frequency.setValueAtTime(260, t)
        o.frequency.exponentialRampToValueAtTime(520, t + 0.12)
        g.gain.setValueAtTime(0.06, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
        o.connect(g)
        g.connect(this.sfxBus)
        o.start(t)
        o.stop(t + 0.18)
        break
      }
      case 'land':
        this.footstep('pave', true)
        break
      case 'horn':
        this.horn(0.16, 0)
        break
    }
  }
}

export const music = new AudioEngine()
