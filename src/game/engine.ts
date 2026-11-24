import * as THREE from 'three'
import { toast } from 'sonner'
import { spawnNpcs, spawnTraffic, updateNpcs, updateTraffic, type Budget, type Npc, type TrafficCar } from './ambient'
import { Human, playerLook } from './human'
import { loadHumanTemplates, type Templates } from './loader'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { DISTRICTS, HOME_NAMES, PROPERTIES, VEHICLES, WORLD, districtAt, levelFromRep } from './data'
import { music } from './audio'
import { earn, fmtCash, getState, homeTier, ownedVehicles, setState, subscribe, tickClock, type PoiKind, type Wearing } from './store'
import { bubbles } from './bubbles'
import { Carry } from './carry'
import type { GoodsId } from './data'
import { makePlayerVehicle, type PlayerVehicle } from './vehicles'
import { setLoad } from './progress'
import { buildWorld, type World } from './world'
import type { Poi } from './worldTypes'

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const SKY = {
  dayTop: new THREE.Color('#3b9cff'),
  dayHor: new THREE.Color('#bfe9ff'),
  duskTop: new THREE.Color('#6a4fb0'),
  duskHor: new THREE.Color('#ff9a62'),
  nightTop: new THREE.Color('#070b26'),
  nightHor: new THREE.Color('#2b1b55'),
}

type Target = { type: 'poi'; poi: Poi } | { type: 'npc'; npc: Npc }

const VERB: Record<string, string> = {
  food: 'Order food at',
  delivery: 'Open',
  bus: 'Work at',
  stall: 'Work at',
  repair: 'Work at',
  dj: 'Play at',
  home: 'Enter',
  agent: 'Visit',
  dealer: 'Browse',
  boutique: 'Browse',
  broker: 'Visit',
  trade: 'Open',
  leaderboard: 'View',
  business: 'Visit',
  bench: 'Rest at',
}

export class Engine {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(60, 1, 0.3, 900)
  world: World
  npcs: Npc[]
  traffic: TrafficCar[]
  pg = new THREE.Group()
  carry!: Carry
  player: Human
  templates: Templates
  budget: Budget
  vy = 0
  py = 0
  seated = false
  talkId: string | null = null
  private tierT = 0
  private mobile: boolean
  vehicles = new Map<number, PlayerVehicle>()
  riding = false
  pos = new THREE.Vector3(-75, 0, 6)
  heading = Math.PI
  vel = new THREE.Vector2()
  speed = 0
  yaw = 0
  pitch = 0.32
  lastDrag = 0
  keys = new Set<string>()
  joy = { x: 0, y: 0 }
  run = false
  target: Target | null = null
  beacon: THREE.Mesh
  private hemi = new THREE.HemisphereLight('#ffffff', '#6d8a4a', 1)
  private sun = new THREE.DirectionalLight('#fff4d6', 1)
  private shadowExt = 50
  private shadowSize = 1024
  private skyMat: THREE.ShaderMaterial
  private sky: THREE.Mesh
  private sunMesh: THREE.Mesh
  private moonMesh: THREE.Mesh
  private stars: THREE.Points
  private glow = new THREE.PointLight('#ffb3e6', 0, 22, 2)
  private raf = 0
  private clock = new THREE.Clock()
  private t = 0
  private disposed = false
  private unsub: () => void
  private wearingRef: Wearing
  private ownedKey = ''
  private lastDistrict = ''
  private lastLock = 0
  private drag: { id: number; x: number; y: number } | null = null
  private ro: ResizeObserver
  private cleanup: (() => void)[] = []
  private labelTimer = 0
  private deliveryTarget: { x: number; z: number } | null = null

  static async create(canvas: HTMLCanvasElement) {
    const pause = () => new Promise<void>((r) => window.setTimeout(r, 16))
    setLoad({ pct: 2, label: 'Starting the renderer', ready: false, error: null })
    const mobile = window.matchMedia('(pointer: coarse)').matches
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2))
    await pause()
    const templates = await loadHumanTemplates(renderer, (p) => setLoad({ pct: 5 + p * 50, label: 'Loading characters' }))
    setLoad({ pct: 58, label: 'Building the city' })
    await pause()
    const world = buildWorld()
    setLoad({ pct: 76, label: 'Placing people and traffic' })
    await pause()
    const npcs = spawnNpcs(world.group, world.spots, templates)
    const traffic = spawnTraffic(world.group, templates)
    setLoad({ pct: 90, label: 'Lighting the streets' })
    await pause()
    const engine = new Engine(canvas, renderer, templates, mobile, { world, npcs, traffic })
    try {
      await Promise.race([renderer.compileAsync(engine.scene, engine.camera), new Promise((r) => window.setTimeout(r, 5000))])
    } catch {
      /* shaders will compile on first frame instead */
    }
    setLoad({ pct: 100, label: 'Ready', ready: true })
    return engine
  }

  private constructor(
    private canvas: HTMLCanvasElement,
    renderer: THREE.WebGLRenderer,
    templates: Templates,
    mobile: boolean,
    parts: { world: World; npcs: Npc[]; traffic: TrafficCar[] },
  ) {
    this.renderer = renderer
    this.templates = templates
    this.mobile = mobile
    this.world = parts.world
    this.npcs = parts.npcs
    this.traffic = parts.traffic
    this.budget = mobile ? { full: 7, mid: 10 } : { full: 14, mid: 20 }
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.12
    const pm = new THREE.PMREMGenerator(renderer)
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.3
    pm.dispose()
    const ext = mobile ? 38 : 55
    const sc = this.sun.shadow.camera
    sc.left = -ext
    sc.right = ext
    sc.top = ext
    sc.bottom = -ext
    sc.near = 1
    sc.far = 300
    this.sun.castShadow = true
    const size = mobile ? 1024 : 2048
    this.sun.shadow.mapSize.set(size, size)
    this.sun.shadow.bias = -0.0004
    this.sun.shadow.normalBias = 0.05
    this.shadowExt = ext
    this.shadowSize = size
    this.scene.fog = new THREE.Fog('#bfe9ff', 90, 360)

    this.scene.add(this.world.group)
    this.scene.add(this.hemi, this.sun, this.sun.target, this.glow)

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: [
        'uniform vec3 top;',
        'uniform vec3 hor;',
        'varying vec3 vP;',
        'void main() {',
        '  float h = clamp(normalize(vP).y * 1.5 + 0.08, 0.0, 1.0);',
        '  gl_FragColor = vec4(mix(hor, top, pow(h, 0.65)), 1.0);',
        '',
        '#include <colorspace_fragment>',
        '',
        '}',
        '',
      ].join('\n'),
    })
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(800, 16, 10), this.skyMat)
    this.sky.renderOrder = -10
    this.scene.add(this.sky)
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(30, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff0b0', fog: false }))
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(20, 12, 8), new THREE.MeshBasicMaterial({ color: '#dfe8ff', fog: false }))
    this.scene.add(this.sunMesh, this.moonMesh)
    const sp = new Float32Array(500 * 3)
    for (let i = 0; i < 500; i++) {
      const a = Math.random() * Math.PI * 2
      const e = Math.random() * 1.3 + 0.1
      sp[i * 3] = Math.cos(a) * Math.cos(e) * 760
      sp[i * 3 + 1] = Math.sin(e) * 760
      sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 760
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3))
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }))
    this.scene.add(this.stars)

    this.beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 70, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ff2d9b', transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide }),
    )
    this.beacon.visible = false
    this.scene.add(this.beacon)


    this.scene.add(this.pg)
    this.carry = new Carry(this.scene)
    this.wearingRef = getState().wearing
    this.player = new Human(templates.player, playerLook(this.wearingRef))
    this.pg.add(this.player.group)
    this.pg.position.copy(this.pos)

    this.unsub = subscribe(() => this.onStore())
    this.bind()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(canvas.parentElement ?? canvas)
    this.resize()
    this.syncOwnership(true)
    this.clock.start()
    this.loop()
  }

  /* ---------------- input ---------------- */
  private bind() {
    const kd = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return
      const k = e.key.toLowerCase()
      this.keys.add(k)
      if (k === 'e' || k === 'enter') this.interact()
      if (k === 'v') this.toggleVehicle()
      if (k === ' ') this.jump()
      if (k === 'h' && this.riding) music.sfx('horn')
      if (k === 'shift') this.run = true
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) && !getState().modal) e.preventDefault()
    }
    const ku = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      this.keys.delete(k)
      if (k === 'shift') this.run = false
    }
    const pd = (e: PointerEvent) => {
      if (this.drag) return
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
      this.canvas.setPointerCapture(e.pointerId)
      music.unlock()
    }
    const pm = (e: PointerEvent) => {
      if (!this.drag || this.drag.id !== e.pointerId) return
      this.yaw -= (e.clientX - this.drag.x) * 0.006
      this.pitch = Math.min(1.05, Math.max(0.08, this.pitch + (e.clientY - this.drag.y) * 0.004))
      this.drag.x = e.clientX
      this.drag.y = e.clientY
      this.lastDrag = performance.now()
    }
    const pu = (e: PointerEvent) => {
      if (this.drag?.id === e.pointerId) this.drag = null
    }
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    this.canvas.addEventListener('pointerdown', pd)
    this.canvas.addEventListener('pointermove', pm)
    this.canvas.addEventListener('pointerup', pu)
    this.canvas.addEventListener('pointercancel', pu)
    this.cleanup.push(
      () => window.removeEventListener('keydown', kd),
      () => window.removeEventListener('keyup', ku),
      () => this.canvas.removeEventListener('pointerdown', pd),
      () => this.canvas.removeEventListener('pointermove', pm),
      () => this.canvas.removeEventListener('pointerup', pu),
      () => this.canvas.removeEventListener('pointercancel', pu),
    )
  }

  setJoystick(x: number, y: number) {
    this.joy.x = x
    this.joy.y = y
  }

  /** Closest point of interest of a kind, for directions given in conversation. */
  nearestPoi(kind: PoiKind) {
    let best: (typeof this.world.pois)[number] | null = null
    let bd = Infinity
    for (const p of this.world.pois) {
      if (p.kind !== kind) continue
      const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z)
      if (d < bd) {
        bd = d
        best = p
      }
    }
    return best
  }

  /** the seller hands something she bought across to the player */
  handOver(npcId: string, id: GoodsId, then: () => void, wait = 0) {
    const n = this.npcById(npcId)
    if (!n || !n.visible) return then()
    this.carry.handOver(n.human, this.player, id, then, wait)
  }

  /** the seller cuts an orange and hands the player half to taste */
  taste(npcId: string, then: () => void, wait = 0) {
    const n = this.npcById(npcId)
    if (!n || !n.visible) return then()
    this.carry.taste(n.human, this.player, then, wait)
  }

  /** paying: she holds up her phone to sign; then the seller checks theirs for the alert */
  payPhone(who: 'me' | string, on: boolean) {
    if (who === 'me') return this.carry.showPhone(this.player, on)
    const n = this.npcById(who)
    if (n?.visible) this.carry.showPhone(n.human, on)
  }

  npcById(id: string) {
    return this.npcs.find((n) => n.id === id) ?? null
  }

  interact() {
    const s = getState()
    if (s.modal || !s.started || !this.target) return
    music.unlock()
    if (this.target.type === 'npc') {
      const n = this.target.npc
      n.pause = 4
      setState({ modal: { kind: 'npc', npcId: n.id, name: n.name, persona: n.persona, look: n.portrait, canHelp: n.canHelp, goods: n.goods } })
    } else {
      const p = this.target.poi
      setState({ modal: { kind: 'poi', poiId: p.id, poiKind: p.kind, label: p.label, extra: p.extra } })
    }
  }

  toggleVehicle() {
    const s = getState()
    if (s.modal) return
    if (this.riding) {
      this.setRiding(false)
      return
    }
    const owned = ownedVehicles(s)
    if (!owned.length) {
      toast('You do not own a vehicle yet', { description: 'Visit Zoom Motors in the plaza.' })
      return
    }
    const id = owned.includes(s.activeVehicle) ? s.activeVehicle : owned[0]
    setState({ activeVehicle: id })
    this.setRiding(true)
  }

  private setRiding(on: boolean) {
    this.riding = on
    this.applyVehicle()
  }

  jump() {
    const st = getState()
    if (st.modal || !st.started || this.riding || this.py > 0.001 || st.energy <= 0) return
    this.vy = 5.4
    this.py = 0.001
    music.sfx('jump')
  }

  private applyVehicle() {
    for (const v of this.vehicles.values()) this.pg.remove(v.group)
    const id = getState().activeVehicle
    if (this.riding && id >= 0) {
      let v = this.vehicles.get(id)
      if (!v) {
        v = makePlayerVehicle(id)
        v.group.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).receiveShadow = true
        })
        this.vehicles.set(id, v)
      }
      this.pg.add(v.group)
      this.player.group.position.set(v.seatX, v.seatY - 0.45, v.seatZ)
      this.player.play('drive', 0.2)
    } else {
      this.riding = false
      this.player.group.position.set(0, 0, 0)
    }
  }

  /* ---------------- store sync ---------------- */
  private onStore() {
    const s = getState()
    if (s.wearing !== this.wearingRef) {
      this.wearingRef = s.wearing
      this.player.applyLook(playerLook(s.wearing))
    }
    if (this.riding && !ownedVehicles(s).includes(s.activeVehicle)) this.setRiding(false)
    else if (this.riding && this.vehicles.size && !this.pg.children.some((c) => this.vehicles.get(s.activeVehicle)?.group === c)) this.applyVehicle()
    this.syncOwnership(false)
  }

  private syncOwnership(force: boolean) {
    const s = getState()
    const key = `${homeTier(s)}|${s.businessesLocal.join()}|${s.chain.properties.join()}`
    if (!force && key === this.ownedKey) return
    this.ownedKey = key
    const tier = homeTier(s)
    const owned = new Set([...s.businessesLocal, ...s.chain.properties])
    for (const p of this.world.pois) {
      if (p.kind === 'business' && p.extra !== undefined) this.world.setPoiLabel(p, owned.has(p.extra) ? `Your ${PROPERTIES[p.extra].name}` : `${p.label} (for sale)`)
      if (p.kind === 'home' && p.extra !== undefined) this.world.setPoiLabel(p, tier === p.extra ? `Your ${HOME_NAMES[p.extra]}` : p.label)
    }
  }

  /* ---------------- delivery ---------------- */
  startDelivery(): boolean {
    const s = getState()
    if (s.delivery) return false
    const lvl = levelFromRep(s.rep)
    const open = (d: keyof typeof DISTRICTS) => DISTRICTS[d].level <= lvl
    const pickups = this.world.pois.filter((p) => p.kind === 'food' && open(p.district))
    const pick = pickups[Math.floor(Math.random() * pickups.length)]
    const drops = this.world.drops.filter((d) => open(d.district) && Math.hypot(d.x - pick.x, d.z - pick.z) > 45)
    const drop = drops[Math.floor(Math.random() * drops.length)]
    if (!pick || !drop) return false
    const dist = Math.hypot(pick.x - this.pos.x, pick.z - this.pos.z) + Math.hypot(drop.x - pick.x, drop.z - pick.z)
    const reward = Math.round(55 + dist * 0.45)
    setState({
      delivery: { from: pick.label, to: `${DISTRICTS[drop.district].name} customer`, phase: 'pickup', timeLeft: dist / 4 + 30, reward, dist },
      energy: Math.max(0, s.energy - 8),
    })
    this.deliveryTarget = { x: pick.x, z: pick.z }
    this.pendingDrop = { x: drop.x, z: drop.z }
    return true
  }

  cancelDelivery() {
    this.deliveryTarget = null
    this.beacon.visible = false
    setState({ delivery: null })
  }

  private pendingDrop: { x: number; z: number } | null = null

  private updateDelivery(dt: number) {
    const s = getState()
    const d = s.delivery
    if (!d) {
      this.beacon.visible = false
      return
    }
    const tgt = d.phase === 'pickup' ? this.deliveryTarget : this.pendingDrop
    if (!tgt) return
    this.beacon.visible = true
    this.beacon.position.set(tgt.x, 35, tgt.z)
    const dist = Math.hypot(tgt.x - this.pos.x, tgt.z - this.pos.z)
    const timeLeft = d.timeLeft - dt
    if (timeLeft <= 0) {
      toast.error('Delivery failed', { description: 'The customer cancelled the order.' })
      this.deliveryTarget = null
      this.pendingDrop = null
      this.beacon.visible = false
      setState({ delivery: null })
      return
    }
    if (dist < 4) {
      if (d.phase === 'pickup') {
        toast('Order picked up', { description: 'Deliver it before the food gets cold.' })
        music.sfx('ok')
        setState({ delivery: { ...d, phase: 'dropoff', timeLeft } })
      } else {
        const tip = Math.round(Math.max(0, timeLeft) * 0.6)
        earn(d.reward + tip, 4, `Delivered! ${tip ? `Tip ${fmtCash(tip)}` : ''}`)
        music.sfx('jingle')
        setState((st) => ({ delivery: null, jobsDone: st.jobsDone + 1 }))
        this.deliveryTarget = null
        this.pendingDrop = null
        this.beacon.visible = false
      }
      return
    }
    if (Math.floor(timeLeft * 4) !== Math.floor(d.timeLeft * 4)) setState({ delivery: { ...d, timeLeft } })
    else (d as { timeLeft: number }).timeLeft = timeLeft
  }

  /* ---------------- frame ---------------- */
  private resize() {
    const p = this.canvas.parentElement ?? this.canvas
    const w = p.clientWidth || window.innerWidth
    const h = p.clientHeight || window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private loop = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = Math.min(0.05, this.clock.getDelta())
    this.t += dt
    const s = getState()
    if (s.started) this.step(dt)
    else this.idleOrbit(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private idleOrbit(dt: number) {
    this.yaw += dt * 0.1
    this.player.locomote(0)
    this.player.update(dt)
    this.pg.position.copy(this.pos)
    this.pg.rotation.y = this.heading
    this.placeCamera(dt, true)
    this.dayNight(dt)
    this.stepNpcs(dt)
    updateTraffic(this.traffic, dt, this.pos.x, this.pos.z)
  }

  private step(dt: number) {
    const s = getState()
    const frozen = !!s.modal
    // input
    let ix = 0
    let iy = 0
    if (!frozen) {
      const k = this.keys
      ix = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
      iy = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0)
      ix += this.joy.x
      iy += this.joy.y
      const m = Math.hypot(ix, iy)
      if (m > 1) {
        ix /= m
        iy /= m
      }
      if (k.has('q')) this.yaw += dt * 1.6
      if (k.has('z')) this.yaw -= dt * 1.6
    }
    const mag = Math.hypot(ix, iy)
    const vDef = this.riding && s.activeVehicle >= 0 ? VEHICLES[s.activeVehicle] : null
    const tired = s.energy < 5 ? 0.6 : 1
    const base = vDef ? vDef.speed : this.run || mag > 0.92 ? 7.2 : 4.6
    const targetSpeed = base * Math.min(1, mag) * tired
    // camera relative movement
    const fx = -Math.sin(this.yaw)
    const fz = -Math.cos(this.yaw)
    const rx = Math.cos(this.yaw)
    const rz = -Math.sin(this.yaw)
    const dx = fx * iy + rx * ix
    const dz = fz * iy + rz * ix
    if (mag > 0.05) {
      const want = Math.atan2(dx, dz)
      let d = want - this.heading
      d = Math.atan2(Math.sin(d), Math.cos(d))
      this.heading += d * Math.min(1, dt * (vDef ? 5 : 11))
    }
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * (vDef ? 2.5 : 9))
    if (mag < 0.05 && this.speed < 0.05) this.speed = 0
    const vx = Math.sin(this.heading) * this.speed
    const vz = Math.cos(this.heading) * this.speed
    this.move(vx * dt, vz * dt, vDef ? 1.3 : 0.45)

    // visuals
    if (this.py > 0 || this.vy > 0) {
      this.vy -= 15 * dt
      this.py += this.vy * dt
      if (this.py <= 0) {
        this.py = 0
        this.vy = 0
        music.sfx('land')
      }
    }
    this.pg.position.set(this.pos.x, this.py, this.pos.z)
    this.pg.rotation.y = this.heading
    this.animatePlayer(dt)
    // camera auto-follow when running straight
    if (iy > 0.5 && Math.abs(ix) < 0.35 && performance.now() - this.lastDrag > 1500) {
      let d = this.heading + Math.PI - this.yaw
      d = Math.atan2(Math.sin(d), Math.cos(d))
      this.yaw += d * Math.min(1, dt * 0.9)
    }
    this.placeCamera(dt, false)

    this.stepNpcs(dt)
    updateTraffic(this.traffic, dt, this.pos.x, this.pos.z)
    this.updateDelivery(dt)
    this.updateTargets(dt)
    this.dayNight(dt)
    tickClock(dt, this.riding)
    this.labelTimer += dt
    this.updateAudio(dt)
  }

  private stepNpcs(dt: number) {
    this.tierT -= dt
    const tick = this.tierT <= 0
    if (tick) this.tierT = 0.25
    updateNpcs(this.npcs, dt, { x: this.pos.x, z: this.pos.z, speed: this.speed, riding: this.riding, talkId: this.talkId }, this.budget, tick)
    bubbles.update(dt)
  }

  private animatePlayer(dt: number) {
    const m = getState().modal
    const benchNow = m?.kind === 'poi' && m.poiKind === 'bench'
    if (benchNow && !this.seated) {
      this.seated = true
      const poi = this.world.pois.find((p) => m.kind === 'poi' && p.id === m.poiId)
      if (poi) {
        this.pos.set(poi.x, 0, poi.z - 2)
        this.heading = 0
      }
    } else if (!benchNow && this.seated) this.seated = false
    const talkNow = m?.kind === 'npc' ? m.npcId : null
    if (talkNow && !this.talkId) bubbles.clear()
    this.talkId = talkNow
    let approaching = false
    if (this.talkId) {
      const n = this.npcById(this.talkId)
      if (n) {
        let d = Math.atan2(n.x - this.pos.x, n.z - this.pos.z) - this.heading
        d = Math.atan2(Math.sin(d), Math.cos(d))
        this.heading += d * Math.min(1, dt * 6)
        // walk up to them first, stopping at a natural talking distance
        const gap = Math.hypot(n.x - this.pos.x, n.z - this.pos.z)
        if (gap > 1.35 && !this.riding && !this.seated) {
          const stepLen = Math.min(gap - 1.35, 1.5 * dt)
          this.pos.x += ((n.x - this.pos.x) / gap) * stepLen
          this.pos.z += ((n.z - this.pos.z) / gap) * stepLen
          approaching = true
        }
        this.pg.position.set(this.pos.x, this.py, this.pos.z)
        this.pg.rotation.y = this.heading
      }
    }
    const p = this.player
    if (this.riding) p.play('drive', 0.25)
    else if (this.seated) p.play('sit', 0.3)
    else if (this.py > 0.002 || this.vy > 0) p.play('jump', 0.1, 1.4)
    else if (approaching) p.locomote(1.5)
    else if (this.talkId) p.play('talk', 0.3)
    else p.locomote(this.speed)
    p.update(dt)
    const bagCount = Object.values(getState().bag).reduce((a, b) => a + (b ?? 0), 0)
    this.carry.update(dt, p, this.heading, bagCount)
  }

  private move(mx: number, mz: number, r: number) {
    const s = getState()
    const lvl = levelFromRep(s.rep)
    const old = districtAt(this.pos.x, this.pos.z)
    let nx = this.pos.x + mx
    let nz = this.pos.z + mz
    nx = Math.min(WORLD.maxX, Math.max(WORLD.minX, nx))
    nz = Math.min(WORLD.maxZ, Math.max(WORLD.minZ, nz))
    const nd = districtAt(nx, nz)
    if (nd !== old && DISTRICTS[nd].level > lvl) {
      const now = performance.now()
      if (now - this.lastLock > 2500) {
        this.lastLock = now
        toast(`${DISTRICTS[nd].name} is locked`, { description: `Reach reputation level ${DISTRICTS[nd].level} to enter.` })
      }
      nx = this.pos.x
      nz = this.pos.z
      this.speed *= 0.5
    }
    // push out of colliders
    for (const c of this.world.colliders) {
      if (nx < c.x0 - r - 1 || nx > c.x1 + r + 1 || nz < c.z0 - r - 1 || nz > c.z1 + r + 1) continue
      const cx = Math.min(c.x1, Math.max(c.x0, nx))
      const cz = Math.min(c.z1, Math.max(c.z0, nz))
      const ddx = nx - cx
      const ddz = nz - cz
      const d2 = ddx * ddx + ddz * ddz
      if (d2 < r * r) {
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2)
          nx += (ddx / d) * (r - d)
          nz += (ddz / d) * (r - d)
        } else {
          const l = nx - c.x0
          const rr = c.x1 - nx
          const t = nz - c.z0
          const b = c.z1 - nz
          const m = Math.min(l, rr, t, b)
          if (m === l) nx = c.x0 - r
          else if (m === rr) nx = c.x1 + r
          else if (m === t) nz = c.z0 - r
          else nz = c.z1 + r
        }
      }
    }
    this.pos.x = nx
    this.pos.z = nz
    const d = districtAt(nx, nz)
    const name = DISTRICTS[d].name
    if (name !== this.lastDistrict) {
      this.lastDistrict = name
      setState({ district: name })
    }
  }

  private placeCamera(dt: number, idle: boolean) {
    const talk = !idle && this.talkId ? this.npcById(this.talkId) : null
    if (talk) {
      // conversation two-shot: camera to the side of the pair, framing both faces
      const mx = (this.pos.x + talk.x) / 2
      const mz = (this.pos.z + talk.z) / 2
      let dx = talk.x - this.pos.x
      let dz = talk.z - this.pos.z
      const len = Math.hypot(dx, dz) || 1
      dx /= len
      dz /= len
      // stay on whichever side the camera already is, so it swings in instead of flipping
      const side = -dz * (this.camera.position.x - mx) + dx * (this.camera.position.z - mz) >= 0 ? 1 : -1
      const tx = mx + -dz * 4.2 * side - dx * 0.8
      const tz = mz + dx * 4.2 * side - dz * 0.8
      const k = Math.min(1, dt * 4)
      this.camera.position.x += (tx - this.camera.position.x) * k
      this.camera.position.y += (2.1 - this.camera.position.y) * k
      this.camera.position.z += (tz - this.camera.position.z) * k
      // aim low so both faces sit in the top half, above the chat panel
      this.camera.lookAt(mx, 0.55, mz)
      return
    }
    const dist = idle ? 5 : this.riding ? 11 + this.speed * 0.15 : 7.5
    const cp = Math.cos(this.pitch)
    const sp = Math.sin(this.pitch)
    // open-world style: sit slightly to the right of her shoulder and look just past her
    const shoulder = idle ? 0 : this.riding ? 0.7 : 0.95
    const rx = Math.cos(this.yaw)
    const rz = -Math.sin(this.yaw)
    const tx = this.pos.x + Math.sin(this.yaw) * cp * dist + rx * shoulder
    const tz = this.pos.z + Math.cos(this.yaw) * cp * dist + rz * shoulder
    const ty = 1.5 + sp * dist
    const k = Math.min(1, dt * 7)
    this.camera.position.x += (tx - this.camera.position.x) * k
    this.camera.position.y += (ty - this.camera.position.y) * k
    this.camera.position.z += (tz - this.camera.position.z) * k
    this.camera.lookAt(this.pos.x + rx * shoulder * 0.55, 1.45 + (this.riding ? 0.3 : 0) + this.py * 0.6, this.pos.z + rz * shoulder * 0.55)
  }

  private updateTargets(dt: number) {
    let best: Target | null = null
    let bd = 1e9
    const reach = this.riding ? 2.2 : 0
    for (const p of this.world.pois) {
      const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z)
      const vis = d < 75
      if (p.marker) {
        p.marker.visible = vis
        if (vis && p.diamond) {
          p.diamond.rotation.y += dt * 1.8
          p.diamond.position.y = 3 + Math.sin(this.t * 2 + p.x) * 0.25
        }
      }
      if (d < p.r + reach && d < bd) {
        bd = d
        best = { type: 'poi', poi: p }
      }
    }
    for (const n of this.npcs) {
      if (!n.visible) continue
      const d = Math.hypot(n.x - this.pos.x, n.z - this.pos.z)
      if (d < 2.6 + reach && d < bd - 0.5) {
        bd = d
        best = { type: 'npc', npc: n }
      }
    }
    this.target = best
    const s = getState()
    let prompt: string | null = null
    if (best && !s.modal) {
      prompt = best.type === 'npc' ? `Talk to ${best.npc.name}` : `${VERB[best.poi.kind] ?? 'Use'} ${best.poi.label}`
    }
    if (prompt !== s.prompt) setState({ prompt })
  }

  private stepDist = 0
  private sceneT = 0

  private updateAudio(dt: number) {
    // footsteps: one per stride on foot, softer on sand
    if (!this.riding && !this.seated && this.py <= 0.001 && this.speed > 0.8) {
      this.stepDist += this.speed * dt
      const stride = this.speed > 5.5 ? 2.0 : 1.35
      if (this.stepDist >= stride) {
        this.stepDist = 0
        music.footstep(this.lastDistrict === 'Beachfront' ? 'sand' : 'pave', this.speed > 5.5)
      }
    } else this.stepDist = 0
    // ambience mix, a few times a second
    this.sceneT -= dt
    if (this.sceneT > 0) return
    this.sceneT = 0.2
    let crowd = 0
    for (const n of this.npcs) if ((n.role === 'vendor' || n.role === 'chatter') && Math.hypot(n.x - this.pos.x, n.z - this.pos.z) < 20) crowd++
    let near = 1e9
    for (const c of this.traffic) near = Math.min(near, Math.hypot(c.x - this.pos.x, c.z - this.pos.z))
    const t = getState().time
    music.setScene({
      shop: this.musicLevel(),
      market: Math.min(1, crowd / 7),
      traffic: Math.max(0, 1 - near / 40),
      riding: this.riding,
      rideSpeed: this.speed,
      night: t >= 19.5 || t < 5.5 ? 1 : 0,
    })
  }

  private musicLevel() {
    let best = 0
    for (const p of this.world.pois) {
      if (!p.music) continue
      const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z)
      best = Math.max(best, 1 - Math.min(1, d / 38))
    }
    return best
  }

  private dayNight(dt: number) {
    void dt
    const t = getState().time
    const day = smooth(5, 7.5, t) * (1 - smooth(17.5, 20, t))
    const night = 1 - day
    const dusk = Math.max(0, 1 - Math.abs(t - 6.3) / 1.4) + Math.max(0, 1 - Math.abs(t - 18.8) / 1.5)
    const top = new THREE.Color().copy(SKY.nightTop).lerp(SKY.dayTop, day).lerp(SKY.duskTop, Math.min(1, dusk) * 0.8)
    const hor = new THREE.Color().copy(SKY.nightHor).lerp(SKY.dayHor, day).lerp(SKY.duskHor, Math.min(1, dusk) * 0.85)
    ;(this.skyMat.uniforms.top.value as THREE.Color).copy(top)
    ;(this.skyMat.uniforms.hor.value as THREE.Color).copy(hor)
    ;(this.scene.fog as THREE.Fog).color.copy(hor)
    this.hemi.color.set('#5b66d8').lerp(new THREE.Color('#ffffff'), day).lerp(new THREE.Color('#ffc58a'), Math.min(1, dusk) * 0.4)
    this.hemi.groundColor.set('#1a1a38').lerp(new THREE.Color('#7d9a58'), day)
    this.hemi.intensity = 0.5 + 0.4 * day
    const a = ((t - 6) / 12) * Math.PI
    const sunDir = new THREE.Vector3(Math.cos(a) * 0.6, Math.sin(a), Math.cos(a) * 0.5 + 0.3).normalize()
    // keep the shadow camera locked to the shadow-map texel grid so shadows do not shimmer
    const texel = (this.shadowExt * 2) / this.shadowSize
    const sx = Math.round(this.pos.x / texel) * texel
    const sz = Math.round(this.pos.z / texel) * texel
    const lightDir = new THREE.Vector3(sunDir.x, Math.max(sunDir.y, 0.3), sunDir.z).normalize()
    this.sun.target.position.set(sx, 0, sz)
    this.sun.position.set(sx, 0, sz).addScaledVector(lightDir, 140)
    this.sun.castShadow = day > 0.12
    this.sun.intensity = (Math.max(0.15, Math.sin(a)) * 2.1 * day) + 0.04
    this.scene.environmentIntensity = 0.1 + 0.28 * day
    this.sun.color.set('#fff4d6').lerp(new THREE.Color('#ff9d5c'), Math.min(1, dusk) * 0.7)
    const cp = this.camera.position
    this.sky.position.copy(cp)
    this.sunMesh.position.copy(cp).addScaledVector(sunDir, 640)
    this.moonMesh.position.copy(cp).addScaledVector(sunDir, -640)
    this.sunMesh.visible = sunDir.y > -0.05
    this.moonMesh.visible = sunDir.y < 0.1
    this.stars.position.copy(cp)
    ;(this.stars.material as THREE.PointsMaterial).opacity = Math.min(1, night * 1.2)
    this.glow.position.set(this.pos.x, 3.2, this.pos.z)
    this.glow.intensity = night * 40
    this.world.update(night, this.t)
  }

  snapshot() {
    return { x: this.pos.x, z: this.pos.z, yaw: this.heading, target: this.deliveryTarget && getState().delivery?.phase === 'pickup' ? this.deliveryTarget : this.pendingDrop }
  }

  dispose() {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.unsub()
    this.ro.disconnect()
    this.cleanup.forEach((f) => f())
    this.renderer.dispose()
  }
}
