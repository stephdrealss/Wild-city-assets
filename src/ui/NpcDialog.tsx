import { useTxLog } from '@/chain/tx'
import { CHAIN_ID } from '@/chain/contracts'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { ConnectKitButton } from 'connectkit'
import { engineRef } from '@/game/ref'
import type { Fx } from '@/game/dialogue'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Volume2, VolumeX, LogOut } from 'lucide-react'
import { MARKET_GOODS, OUTFITS, isFood, levelFromRep, type GoodsId } from '@/game/data'
import {
  HELPED_NODE,
  PERSONAS,
  deliverNode,
  resolveSay,
  rootChoices,
  type Choice,
  type DlgCtx,
  type Node,
} from '@/game/dialogue'
import { music } from '@/game/audio'
import { applyFx } from '@/game/dialogueFx'
import { addressFor, answersTo, greetings, text, topicChoices, type TalkCtx, type TalkOption } from '@/game/scenes'
import { MISSIONS } from '@/game/missions'
import { addToBag, closeModal, getState, realHour, setState, type Modal, type PortraitLook } from '@/game/store'
import { voice } from '@/game/voice'
import { marketPay, usdcFor } from '@/chain/pay'
import { Avatar } from './Avatar'

type NpcModal = Extract<Modal, { kind: 'npc' }>
interface Line {
  who: 'npc' | 'me' | 'pay'
  text: string
  /** a payment receipt shown in the chat: amount, who to, and when it started (to find its transaction) */
  pay?: { usdc: number; to: string; start: number; item: string; done?: boolean }
}

/** The wallet payment, live in the chat: sign, sending on Arc, paid (with the transaction link). */
function PayCard({ pay }: { pay: NonNullable<Line['pay']> }) {
  const txs = useTxLog()
  const tx = txs.find((t) => t.at >= pay.start - 500)
  const step = pay.done || tx?.status === 'success' ? 2 : !tx ? 0 : tx.status === 'pending' ? 1 : -1
  const row = (n: number, label: string) => (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${
          step > n || step === 2 ? 'bg-[#38ffd0] text-black' : step === n ? 'animate-pulse bg-[#2775ca]' : 'bg-white/15'
        }`}
      >
        {step > n || step === 2 ? '✓' : n + 1}
      </span>
      <span className={step >= n ? 'text-white' : 'text-white/45'}>{label}</span>
    </div>
  )
  return (
    <div className="mx-auto w-full max-w-[19rem] rounded-2xl border border-[#2775ca]/60 bg-[#0b1b33] p-3 shadow-[0_8px_30px_-10px_#2775ca]">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-[#2775ca] font-display text-lg font-bold">$</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-white/60">Pay {pay.to} · {pay.item}</p>
          <p className="font-display tnum text-xl font-bold leading-tight">{pay.usdc.toFixed(2)} USDC</p>
        </div>
        <span className="rounded-lg bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/70">Arc</span>
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {row(0, step === -1 ? 'Payment failed' : 'Sign the transaction in your wallet')}
        {row(1, 'Sending USDC on Arc Testnet')}
        {row(2, step === 2 ? 'Paid' : 'Payment lands')}
      </div>
      {tx && (
        <a
          href={buildTxExplorerUrl(CHAIN_ID, tx.hash as `0x${string}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="tnum mt-2 block truncate text-xs text-[#7be0ff] underline"
        >
          {tx.hash.slice(0, 10)}…{tx.hash.slice(-6)} · view on explorer
        </a>
      )}
    </div>
  )
}

const MENU_PROMPTS = ['Wetin else?', 'Ehen, anything again?', 'Talk to me, I dey hear you.', 'Oya, wetin remain?']

/** Small flat face for whoever she is talking to, drawn from their colours. */
function NpcFace({ look, size = 56 }: { look: PortraitLook; size?: number }) {
  const hairTop =
    look.hairStyle === 'bald' ? null : look.hairStyle === 'afro' || look.hairStyle === 'curls' ? (
      <circle cx="32" cy="22" r="19" fill={look.hair} />
    ) : look.hairStyle === 'puffs' ? (
      <g fill={look.hair}>
        <circle cx="16" cy="14" r="9" />
        <circle cx="48" cy="14" r="9" />
        <ellipse cx="32" cy="22" rx="16" ry="12" />
      </g>
    ) : look.hairStyle === 'wrap' ? (
      <path d="M12 26 Q14 2 32 4 Q52 2 52 26 Q44 16 32 16 Q20 16 12 26Z" fill={look.accent} />
    ) : (
      <ellipse cx="32" cy="20" rx="16" ry="11" fill={look.hair} />
    )
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 rounded-2xl bg-white/10">
      <path d="M8 64 Q10 44 32 44 Q54 44 56 64Z" fill={look.top} />
      <rect x="27" y="36" width="10" height="10" rx="3" fill={look.skin} />
      <ellipse cx="32" cy="28" rx="14" ry="15" fill={look.skin} />
      {hairTop}
      <circle cx="26.5" cy="29" r="1.7" fill="#140d08" />
      <circle cx="37.5" cy="29" r="1.7" fill="#140d08" />
      <path d="M27 35 Q32 38.5 37 35" stroke="#3b1d10" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Typewriter reveal for the newest line. */
function useReveal(text: string, cps = 48) {
  // progress is tied to the text it belongs to, so a new line starts from zero without a reset effect
  const [st, setSt] = useState({ text, n: 0 })
  const n = st.text === text ? st.n : 0
  useEffect(() => {
    const id = window.setInterval(
      () => setSt((v) => (v.text !== text ? { text, n: 1 } : v.n >= text.length ? v : { text, n: v.n + 1 })),
      1000 / cps,
    )
    return () => window.clearInterval(id)
  }, [text, cps])
  return { shown: text.slice(0, n), done: n >= text.length, finish: () => setSt({ text, n: text.length }) }
}

function buildCtx(m: NpcModal): DlgCtx {
  const s = getState()
  const mem = s.npcMemory[m.npcId]
  const outfit = OUTFITS.find((o) => o.id === s.wearing.outfit)
  return {
    npcId: m.npcId,
    name: m.name,
    persona: m.persona,
    met: mem?.met ?? 0,
    lastDay: mem?.lastDay ?? s.day,
    day: s.day,
    rep: s.rep,
    // dialogue treats 0 as a brand new face
    level: levelFromRep(s.rep) - 1,
    outfitName: outfit?.name ?? null,
    cash: s.cash,
    time: s.time,
    flags: [...(mem?.flags ?? [])].filter((f) => !f.includes('@') || f.endsWith(`@${s.day}`)),
    missions: { ...s.missions },
    canHelp: m.canHelp,
    helpedToday: s.helped[m.npcId] === s.day,
    visit: 0,
  }
}

/** a well-mixed number per person, so neighbours do not get near-identical prices */
function seedOf(id: string) {
  let h = 2166136261
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  h ^= h >>> 13
  h = Math.imul(h, 0x5bd1e995)
  return (h ^ (h >>> 15)) >>> 0
}

/** naira this choice costs: market goods carry their price, other payments are in VX (₦100 each) */
function costOf(t: TalkOption) {
  let n = 0
  for (const f of t.fx ?? []) {
    if (f.t === 'buy') n += f.naira ?? f.n * 100
    else if (f.t === 'pay') n += f.n * 100
  }
  return n
}

/** "haggle:garri:1300" = she walked away from garri when the last price was 1,300 naira */
function haggleFrom(flags: string[]) {
  const f = [...flags].reverse().find((x) => x.startsWith('haggle:'))
  if (!f) return undefined
  const [, id, price] = f.split(':')
  return id in MARKET_GOODS ? { id: id as GoodsId, price: Number(price) } : undefined
}

const ME_VOICE = { key: 'player', female: true, pitch: 1.08, rate: 1.0 }
const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms))
const anyOf = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

/** Her name, used when she introduces herself. */
export const PLAYER_NAME = 'Ada'
const BYE_BACK = ['Okay o, waka well!', 'Na so. See you later, you hear?', 'Take care of yourself o!', 'Alright. No forget me o!']

export function NpcDialog({ m }: { m: NpcModal }) {
  const persona = PERSONAS[m.persona] ?? PERSONAS.marketwoman
  const ctx = useRef<DlgCtx>(buildCtx(m)).current
  const first = m.name.split(' ')[0]
  const [muted, setMuted] = useState(() => getState().muted)
  const mutedRef = useRef(muted)
  const [log, setLog] = useState<Line[]>([])
  const [node, setNode] = useState<Node | null>(null)
  // she always speaks first: the player picks how to greet
  const [stage, setStage] = useState<'greet' | 'talk'>('greet')
  const [follow, setFollow] = useState<TalkOption[] | null>(null)
  const used = useRef(new Set<string>()).current
  const tctx = useRef<TalkCtx>({
    them: first,
    female: m.look.kind === 'female',
    me: PLAYER_NAME,
    met: ctx.met > 0,
    introduced: ctx.met > 0 || ctx.flags.includes('intro'),
    gap: Math.max(0, ctx.day - ctx.lastDay),
    hour: realHour(),
    goods: m.goods,
    seed: seedOf(m.npcId),
    haggle: haggleFrom(ctx.flags),
  }).current
  const [busy, setBusy] = useState(false)
  const gen = useRef(0)
  const scroller = useRef<HTMLDivElement>(null)
  const last = log[log.length - 1]
  const reveal = useReveal(last?.text ?? '')

  const npcVoice = useMemo(
    () => ({ key: m.npcId, female: m.look.kind !== 'male', pitch: persona.pitch * (m.look.kind === 'child' ? 1.25 : 1), rate: persona.rate }),
    [m.npcId, m.look.kind, persona],
  )

  /** Plays lines one after another: each person finishes talking, a short beat, then the other answers. */
  const play = async (lines: Line[], fresh = false) => {
    const g = ++gen.current
    setBusy(true)
    // fetch every real voice clip in this exchange at once, so the reply is ready when she finishes
    if (!mutedRef.current) for (const l of lines) voice.prefetch(l.text, l.who === 'npc' ? npcVoice : ME_VOICE)
    for (const [i, l] of lines.entries()) {
      if (g !== gen.current) return false
      // a fresh conversation replaces anything left from an interrupted start
      setLog((x) => (fresh && i === 0 ? [l] : [...x, l]))
      await voice.say(l.text, l.who === 'npc' ? npcVoice : ME_VOICE, mutedRef.current, l.who === 'me' ? { maxWait: 900, quietIfLate: true } : { maxWait: 1500 })
      if (g !== gen.current) return false
      await sleep(l.who === 'me' ? 150 : 100)
    }
    if (g === gen.current) setBusy(false)
    return true
  }

  // walk up, greet each other, small talk; remember the meeting when the chat closes
  useEffect(() => {
    music.duck(true)
    return () => {
      gen.current++
      voice.stop()
      music.duck(false)
      setState((s) => {
        const prev = s.npcMemory[m.npcId]
        return {
          npcMemory: {
            ...s.npcMemory,
            [m.npcId]: { met: (prev?.met ?? 0) + 1, lastDay: s.day, flags: ctx.flags.slice(-24) },
          },
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [log, reveal.shown])

  type Option = { label: string; talk?: TalkOption; dlg?: Choice; end?: boolean; reply?: string; spoken?: string }

  // replies are decided when the choices appear, so both voices can be fetched before the player even taps
  const options: Option[] = useMemo(() => {
    const talkOpt = (t: TalkOption): Option => {
      // everything is paid for in USDC: show the amount on the choice
      const cost = costOf(t)
      const said = addressFor(text(t.say, tctx), tctx.female)
      const usdc = cost && !said.includes('USDC') ? ` · pay ${usdcFor(cost).toFixed(2)} USDC` : ''
      return { label: said + usdc, talk: t, reply: text(t.reply, tctx), spoken: said }
    }
    if (stage === 'greet') return greetings(persona.id, tctx).map(talkOpt)
    if (follow?.length)
      return [
        ...follow.map(talkOpt),
        talkOpt({ id: `switch-${log.length}`, say: 'Make we talk another thing.', reply: anyOf(['Okay, wetin dey your mind?', 'No wahala. Wetin again?', 'Ehen, talk am.']) }),
        // she can always just go
        ...(follow.some((f) => f.leave)
          ? []
          : [talkOpt({ id: `leave-${log.length}`, say: anyOf(['Okay, make I dey go. We go see later!', 'I go come back later. Bye bye!']), reply: anyOf(BYE_BACK), leave: true })]),
      ]
    if (node) return node.choices.filter((c) => !c.show || c.show(ctx)).map((c) => ({ label: addressFor(c.text, tctx.female), dlg: c, end: c.next === 'end' }))
    const talk = topicChoices(persona.id, tctx, used).map(talkOpt)
    // at a food spot the cook talks about the food on the fire, not a menu from somewhere else
    const foodSpot = !!m.goods && isFood(m.goods)
    const more = rootChoices(persona, ctx).filter((c) => !foodSpot || !['menu', 'rec', 'taste'].includes(c.next)).map((c) => ({ label: addressFor(c.text, tctx.female), dlg: c, end: c.next === 'end' }))
    return [...talk, ...more]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, follow, node, log.length])


  // get the voices for short choice lists ready before the tap (greetings and follow-ups), so replies come without a wait
  useEffect(() => {
    if (mutedRef.current) return
    for (const o of options) {
      if (!o.talk) continue
      voice.prefetch(o.spoken ?? o.label, ME_VOICE)
      if (o.reply) voice.prefetch(o.reply, npcVoice)
    }
  }, [options, npcVoice])

  const pickTalk = (t: TalkOption, replyText?: string) => {
    used.add(t.id)
    if (t.intro) {
      tctx.introduced = true
      if (!ctx.flags.includes('intro')) ctx.flags.push('intro')
    }
    const reply = replyText ?? text(t.reply, tctx)
    if (costOf(t)) {
      // nothing changes hands until the USDC payment is signed and lands
      void payAndHandOver(t, reply)
      return
    }
    applyFx(t.fx, ctx)
    if (t.leave && t.quote) {
      // the seller remembers what she was told, in case she comes back
      ctx.flags = ctx.flags.filter((f) => !f.startsWith('haggle:'))
      ctx.flags.push(`haggle:${t.quote.id}:${t.quote.price}`)
    }
    if (t.leave) {
      // she says her piece, they answer, and she walks off
      setFollow(null)
      setNode(null)
      void play([
        { who: 'me', text: addressFor(text(t.say, tctx), tctx.female) },
        { who: 'npc', text: reply },
      ]).then((ok) => ok && window.setTimeout(closeModal, 350))
      return
    }
    const lines: Line[] = [
      { who: 'me', text: addressFor(text(t.say, tctx), tctx.female) },
      { who: 'npc', text: reply },
    ]
    setStage('talk')
    setNode(null)
    // if they asked her something, her answers come first; the planned follow-ups stay available after
    const answers = answersTo(reply, tctx, used, log.length)
    const later = t.then?.filter((x) => !used.has(x.id)) ?? []
    const bought = t.fx?.some((f) => f.t === 'buy' || f.t === 'pay')
    if (bought && !answers.length && !later.length) {
      // done buying: thank them and go, or buy something else
      setFollow([
        { id: `thanks-${log.length}`, say: 'Thank you o! Make I dey go.', reply: anyOf(['You welcome my dear. Enjoy am!', 'Na me thank you. Come back again o!', 'God bless you. Waka well!']), leave: true },
        { id: `more-${log.length}`, say: 'Wetin else you get?', reply: anyOf(['Plenty things dey. Check am well.', 'Ehen, see am for table. Wetin you want?']) },
      ])
      void play(lines)
      return
    }
    setFollow(answers.length ? [...answers, ...later] : later.length ? later : null)
    void play(lines)
  }

  /** Buying: she says what she wants, pays the seller in USDC on Arc, and only then is it packed and handed over. */
  const payAndHandOver = async (t: TalkOption, reply: string) => {
    const buy = t.fx?.find((f): f is Extract<Fx, { t: 'buy' }> => f.t === 'buy')
    const amount = costOf(t)
    const usdc = usdcFor(amount)
    const item = buy ? MARKET_GOODS[buy.id].name.toLowerCase() : 'it'
    const meLine: Line = { who: 'me', text: addressFor(text(t.say, tctx), tctx.female) }
    const again: TalkOption = { ...t, id: `${t.id}-again-${log.length}`, say: `Okay, make I pay the ${usdc.toFixed(2)} USDC now.` }
    const later: TalkOption = { id: `pay-later-${log.length}`, say: 'Make I come back later.', reply: 'No wahala. I dey here.', leave: true, quote: buy ? { id: buy.id, price: amount } : undefined }
    setStage('talk')
    setNode(null)
    setFollow(null)
    if (!marketPay.connected) {
      setNeedWallet(true)
      await play([meLine, { who: 'npc', text: `Na ${usdc.toFixed(2)} USDC be that. For this market, na USDC we dey collect. Connect your wallet make you fit pay.` }])
      setFollow([again, later])
      return
    }
    setNeedWallet(false)
    if (!(await play([meLine]))) return
    setBusy(true)
    setPaying(`Paying ${first} ${usdc.toFixed(2)} USDC on Arc… confirm in your wallet`)
    // she takes out her phone and signs; the receipt shows in the chat and fills in as the payment goes through
    const e0 = engineRef.current
    e0?.payPhone('me', true)
    setLog((x) => [...x, { who: 'pay', text: '', pay: { usdc, to: first, start: Date.now(), item } }])
    const ok = marketPay.active && (await marketPay.pay(usdc, `Pay ${first} ${usdc.toFixed(2)} USDC for ${item}`))
    e0?.payPhone('me', false)
    setPaying(null)
    if (ok) setLog((x) => x.map((l) => (l.pay && !l.pay.done && l.pay.usdc === usdc ? { ...l, pay: { ...l.pay, done: true } } : l)))
    if (ok && e0) {
      // the seller checks their phone for the alert
      e0.payPhone(ctx.npcId, true)
      window.setTimeout(() => engineRef.current?.payPhone(ctx.npcId, false), 2300)
    }
    if (!ok) {
      await play([{ who: 'npc', text: anyOf(['Ehn, the money never land o. You wan try again?', 'I never see the alert o. Try am again.']) }])
      setFollow([again, later])
      return
    }
    ctx.flags = ctx.flags.filter((f) => !f.startsWith('haggle:'))
    tctx.haggle = undefined
    // the rest of what this choice does (food filling her up, a guide, a flag) happens once she has paid
    applyFx(t.fx?.filter((f) => f.t !== 'buy' && f.t !== 'pay'), ctx)
    const e = engineRef.current
    if (buy) {
      if (e) e.handOver(ctx.npcId, buy.id, () => addToBag(buy.id), 2.4)
      else addToBag(buy.id)
    }
    await play([{ who: 'npc', text: `Alert don land, ${usdc.toFixed(2)} USDC! ${reply}` }])
    setFollow([
      { id: `thanks-${log.length}`, say: 'Thank you o! Make I dey go.', reply: anyOf(['You welcome my dear. Enjoy am!', 'Na me thank you. Come back again o!', 'God bless you. Waka well!']), leave: true },
      { id: `more-${log.length}`, say: 'Wetin else you get?', reply: anyOf(['Plenty things dey. Check am well.', 'Ehen, see am for table. Wetin you want?']) },
    ])
  }
  const [paying, setPaying] = useState<string | null>(null)
  const [needWallet, setNeedWallet] = useState(false)

  /** she can always say bye and go, whatever stage the talk is at */
  const walkAway = () => {
    if (leaving.current) return
    leaving.current = true
    voice.stop()
    setFollow(null)
    void play([
      { who: 'me', text: anyOf(['Okay, make I dey go. We go see later!', 'Let me dey go. Bye bye!', 'I go see you later o!']) },
      { who: 'npc', text: anyOf(BYE_BACK) },
    ]).then((ok) => ok && window.setTimeout(closeModal, 300))
  }
  const leaving = useRef(false)

  const pickDlg = (c: Choice) => {
    // what she actually says out loud
    let mine = addressFor(c.text.replace(/\s*\(\d+ energy\)$/, ''), tctx.female)
    if (c.next.startsWith('deliver:')) mine = MISSIONS[c.next.slice(8)]?.deliver ?? mine
    const meLine: Line = { who: 'me', text: mine }
    applyFx(c.fx, ctx)
    ctx.visit += 1
    setFollow(null)

    if (c.next === 'end') {
      void play([meLine, { who: 'npc', text: anyOf(BYE_BACK) }]).then((ok) => ok && closeModal())
      return
    }

    let next: Node
    if (c.next === 'menu') next = { say: MENU_PROMPTS[ctx.visit % MENU_PROMPTS.length], choices: [] }
    else if (c.next === 'helped') next = HELPED_NODE
    else if (c.next.startsWith('deliver:')) next = deliverNode(c.next.slice(8))
    else next = persona.nodes[c.next] ?? { say: 'Hmm, I no understand. Wetin you talk?', choices: [] }

    const reply: Line = { who: 'npc', text: resolveSay(next, ctx) }
    setNode(c.next === 'menu' ? null : next.choices.length ? next : null)
    void play([meLine, reply])
  }

  const pick = (o: Option) => {
    if (busy) return
    if (o.talk) pickTalk(o.talk, o.reply)
    else if (o.dlg) pickDlg(o.dlg)
  }

  const toggleMute = () => {
    const v = !muted
    setMuted(v)
    mutedRef.current = v
    if (v) window.speechSynthesis?.cancel()
  }

  const wearing = getState().wearing

  return (
    <motion.div
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-2 sm:p-4"
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
    >
      <div className="glass flex max-h-[52dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl">
        <div className="h-1 w-full bg-[#ffd12e]" />
        <div className="flex items-center gap-3 px-4 pb-2 pt-3">
          <NpcFace look={m.look} size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold leading-tight">{m.name}</h2>
            <p className="text-xs text-white/60">{persona.label}</p>
          </div>
          <button
            aria-label="Walk away"
            onClick={walkAway}
            className="flex h-11 items-center gap-1.5 rounded-full glass-light px-3.5 text-sm font-semibold hover:bg-white/15"
          >
            <LogOut size={16} /> Bye
          </button>
          {voice.supported() && (
            <button
              aria-label={muted ? 'Turn voices on' : 'Mute voices'}
              onClick={toggleMute}
              className="grid h-11 w-11 place-items-center rounded-full glass-light hover:bg-white/15"
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
          )}
        </div>

        <div ref={scroller} className="scroll-y min-h-0 flex-1 space-y-2 px-4 pb-2" onClick={reveal.finish}>
          {log.map((l, i) => {
            const isLast = i === log.length - 1
            const text = isLast ? reveal.shown : l.text
            if (l.who === 'pay' && l.pay) return <PayCard key={i} pay={l.pay} />
            return l.who === 'npc' ? (
              <div key={i} className="flex items-end gap-2">
                <NpcFace look={m.look} size={28} />
                <p className="glass-light max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[15px] leading-relaxed text-pretty">{text}</p>
              </div>
            ) : (
              <div key={i} className="flex items-end justify-end gap-2">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-[#ff2d9b] px-3.5 py-2.5 text-[15px] leading-relaxed text-white text-pretty">{text}</p>
                <div className="shrink-0 overflow-hidden rounded-xl" style={{ width: 28, height: 34 }}>
                  <Avatar wearing={wearing} size={28} />
                </div>
              </div>
            )
          })}

        </div>

        <div className="scroll-y max-h-[30dvh] shrink-0 border-t border-white/10 px-3 py-3">
          {busy ? (
            <p className="min-h-11 px-2 py-2 text-sm text-white/55 animate-pulse" aria-live="polite">
              {paying ?? (last?.who === 'me' ? 'You are talking…' : `${first} is talking…`)}
            </p>
          ) : (
          <AnimatePresence mode="popLayout">
            <motion.div key={log.length} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid gap-2">
              {log.length === 0 && (
                <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-white/50">What will you say?</p>
              )}
              {needWallet && !marketPay.connected && (
                <ConnectKitButton.Custom>
                  {({ show }) => (
                    <button onClick={show} className="min-h-11 rounded-2xl bg-[#2775ca] px-4 py-2 text-left text-[15px] font-semibold text-white hover:brightness-110">
                      Connect wallet to pay in USDC
                    </button>
                  )}
                </ConnectKitButton.Custom>
              )}
              {options.map((c, i) => (
                <button
                  key={`${c.label}-${i}`}
                  disabled={busy}
                  onClick={() => pick(c)}
                  className={
                    c.end
                      ? 'min-h-11 rounded-2xl px-4 text-left text-sm font-semibold text-white/70 glass-light hover:bg-white/15 disabled:opacity-40'
                      : 'min-h-11 rounded-2xl bg-white/10 px-4 py-2 text-left text-[15px] font-semibold hover:bg-white/20 disabled:opacity-40'
                  }
                >
                  {c.label}
                </button>
              ))}
            </motion.div>
          </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  )
}
