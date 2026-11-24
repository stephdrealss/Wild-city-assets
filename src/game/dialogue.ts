import { MISSIONS } from './missions'
import type { PoiKind } from './store'
import type { GoodsId } from './data'

/** Branching street conversations. Pure data and helpers, no game state is touched here. */

export interface DlgCtx {
  npcId: string
  name: string
  persona: string
  met: number
  lastDay: number
  day: number
  rep: number
  level: number
  outfitName: string | null
  cash: number
  time: number
  flags: string[]
  missions: Record<string, 'active' | 'done'>
  canHelp: boolean
  helpedToday: boolean
  /** bumps on every node so jokes and lines can rotate */
  visit: number
}

export type Fx =
  | { t: 'cash'; n: number }
  /** she pays for something she bought in conversation */
  | { t: 'pay'; n: number }
  /** pay for market goods and put them in her bag */
  | { t: 'buy'; id: GoodsId; n: number; naira?: number }
  /** the seller cuts an orange and gives her a piece to taste */
  | { t: 'taste' }
  | { t: 'rep'; n: number }
  | { t: 'energy'; n: number }
  | { t: 'hunger'; n: number }
  | { t: 'discount'; pct: number }
  | { t: 'gig'; pay: number; rep: number; energy: number }
  | { t: 'guide'; kind: PoiKind }
  | { t: 'mission'; id: string }
  | { t: 'complete'; id: string }
  | { t: 'help' }
  /** remembered on this person. daily flags reset each in-game day */
  | { t: 'flag'; f: string; daily?: boolean }

type Say = string | ((c: DlgCtx) => string)
export interface Choice {
  text: string
  /** node id, or 'end' */
  next: string
  fx?: Fx[]
  show?: (c: DlgCtx) => boolean
}
export interface Node {
  say: Say
  choices: Choice[]
}
export interface Persona {
  id: string
  label: string
  pitch: number
  rate: number
  /** short lines for speech bubbles on the street */
  street: string[]
  first: (c: DlgCtx) => string
  back: (c: DlgCtx) => string
  menu: Choice[]
  nodes: Record<string, Node>
}

export const hasDaily = (c: DlgCtx, f: string) => c.flags.includes(`${f}@${c.day}`)
export const hasFlag = (c: DlgCtx, f: string) => c.flags.includes(f)
const pickBy = <T,>(arr: T[], c: DlgCtx) => arr[(c.day + c.visit + c.met + c.name.length) % arr.length]
const lvl = (n: number) => (c: DlgCtx) => c.level >= n
const noMission = (id: string) => (c: DlgCtx) => !c.missions[id]
const bye = (text = 'Alright, I dey go. God bless.'): Choice => ({ text, next: 'end' })
const back = (text = 'Okay. Another thing.'): Choice => ({ text, next: 'menu' })

/* ---------------- greetings that react to history, reputation and outfit ---------------- */
function reaction(c: DlgCtx) {
  const bits: string[] = []
  if (c.level >= 3) bits.push(pickBy(['Na you be the big name for this city!', 'Everybody dey talk about you for this area!', 'Ah, respect! Your name dey ring!'], c))
  else if (c.level === 0) bits.push(pickBy(['New face, abi?', 'I never see you before o.', 'You be new for this area?'], c))
  else bits.push(pickBy(['I don hear your name small small.', 'People dey talk good things about you.'], c))
  if (c.outfitName) bits.push(pickBy([`See as you shine for that ${c.outfitName}!`, `${c.outfitName}? Chai, you dey look sharp!`], c))
  else if (c.visit % 2 === 0) bits.push('Those hair puffs and that yellow trouser, na your signature o!')
  return bits.join(' ')
}

export function greeting(p: Persona, c: DlgCtx) {
  const base = c.met > 0 ? p.back(c) : p.first(c)
  let lead = ''
  if (c.met > 0) {
    const gap = c.day - c.lastDay
    lead = gap >= 1 ? `Ah, you don come back! Na ${gap} day${gap > 1 ? 's' : ''} I no see you! ` : 'Ah, you don come back so soon! '
  }
  return `${lead}${reaction(c)} ${base}`.trim()
}

export const resolveSay = (n: Node, c: DlgCtx) => (typeof n.say === 'string' ? n.say : n.say(c))

/** The menu at the root of a conversation, plus mission deliveries and the old "help out" favour. */
export function rootChoices(p: Persona, c: DlgCtx): Choice[] {
  const out: Choice[] = p.menu.filter((x) => !x.show || x.show(c))
  for (const [id, state] of Object.entries(c.missions)) {
    const m = MISSIONS[id]
    if (state === 'active' && m && m.to === p.id) out.push({ text: `Deliver: ${m.title}`, next: `deliver:${id}`, fx: [] })
  }
  if (c.canHelp && !c.helpedToday && c.name) out.push({ text: 'Offer to help out (5 energy)', next: 'helped', fx: [{ t: 'help' }] })
  out.push(bye('Goodbye.'))
  return out
}

export function deliverNode(id: string): Node {
  const m = MISSIONS[id]
  return { say: m.thanks, choices: [{ text: 'Glad to help.', next: 'end', fx: [{ t: 'complete', id }] }] }
}

export const HELPED_NODE: Node = {
  say: 'Ah, God bless you! You carry load like a true city person. Take this small something for your trouble.',
  choices: [{ text: 'No wahala.', next: 'end' }],
}

/* ---------------- personas ---------------- */
const JOKES = [
  'Why the generator no go school? Because every time e start, e dey make noise! Hahaha.',
  'Customer ask me: Oga okada, you fit take me go airport? I say: Madam, I fit take you go heaven, but airport na extra.',
  'Traffic so bad, my bike don born baby for there. We carry the baby go naming ceremony!',
  'I tell my wife I go dey late. She say: Na you be police? I say: No, na okada. Same wahala!',
]

const marketwoman: Persona = {
  id: 'marketwoman',
  label: 'Market woman',
  pitch: 1.15,
  rate: 1.05,
  street: ['Fresh tomato! Cheap-cheap!', 'Customer, come buy pepper!', 'Abeg, no touch my yam!', 'This price don crash o!', 'Ah ah, you hear wetin happen yesterday?'],
  first: () => 'Welcome, welcome! Na fresh tomato, sweet pepper, ripe plantain. Wetin you wan buy today?',
  back: () => 'My good customer! How market, how body?',
  menu: [
    { text: 'Your price too high. Abeg reduce am.', next: 'bargain' },
    { text: 'Any gist for this market?', next: 'gist' },
    { text: 'How trade dey go?', next: 'trade' },
  ],
  nodes: {
    bargain: {
      say: (c) =>
        hasDaily(c, 'disc')
          ? 'Haba! I don give you discount today already o! This one na market, no be bank!'
          : 'Haba! You wan kill me? This price na give-away! Look the pepper, e dey shout buy me, buy me!',
      choices: [
        { text: 'Abeg now, small discount for your customer.', next: 'bargain2', show: (c) => !hasDaily(c, 'disc') },
        { text: 'Okay, I go pay the full price.', next: 'menu' },
      ],
    },
    bargain2: {
      say: (c) =>
        c.level >= 2
          ? 'Ehen, because na you, big name for town, I go give you twenty percent off food today. No tell anybody o!'
          : 'Okay, okay, because of your fine face: ten percent off food today. Make you no forget me!',
      choices: [
        { text: 'Thank you, ma! God bless you.', next: 'end', fx: [{ t: 'discount', pct: 10 }, { t: 'flag', f: 'disc', daily: true }], show: (c) => c.level < 2 },
        { text: 'Thank you, ma! God bless you.', next: 'end', fx: [{ t: 'discount', pct: 20 }, { t: 'flag', f: 'disc', daily: true }], show: lvl(2) },
      ],
    },
    gist: {
      say: 'You hear say Mama Put dey cook pepper soup wey fit cure any hangover? And the area boys dey plan something for the beach tonight. Na so people dey talk.',
      choices: [
        { text: 'Which Mama Put? I wan help her.', next: 'soup', show: noMission('soup') },
        { text: 'Chai, interesting. Anything else?', next: 'menu' },
      ],
    },
    soup: {
      say: 'Ah, you wan help? Take this basket of fresh pepper go give Mama Put for the food stalls. She go reward you well.',
      choices: [
        { text: 'I go carry am.', next: 'end', fx: [{ t: 'mission', id: 'soup' }] },
        { text: 'Maybe later.', next: 'menu' },
      ],
    },
    trade: { say: 'Trade dey move small small. Only wahala na the price of tomato. Everybody dey complain but everybody dey buy!', choices: [back()] },
  },
}

const okadarider: Persona = {
  id: 'okadarider',
  label: 'Okada rider',
  pitch: 0.95,
  rate: 1.2,
  street: ['Oga, I dey go there now!', 'This traffic na wahala o.', 'Who wan join? I get space!', 'Make I tell you one joke...', 'Abeg comot for road!'],
  first: () => 'Oga! Where you dey go? Hop on, I go reach there before you blink! Wetin I fit do for you?',
  back: () => 'My person! Na you dey this side again? Which way now?',
  menu: [
    { text: 'Abeg, how I go reach somewhere?', next: 'dir' },
    { text: 'Tell me one joke.', next: 'joke' },
    { text: 'Any quick hustle?', next: 'hustle' },
  ],
  nodes: {
    dir: {
      say: 'Where you wan go? I know every shortcut for this city, even the ones wey no dey exist.',
      choices: [
        { text: 'Food. I dey hungry.', next: 'dirdone', fx: [{ t: 'guide', kind: 'food' }] },
        { text: 'The bus depot.', next: 'dirdone', fx: [{ t: 'guide', kind: 'bus' }] },
        { text: 'Where to buy a bike or car?', next: 'dirdone', fx: [{ t: 'guide', kind: 'dealer' }] },
        { text: 'Phone repair.', next: 'dirdone', fx: [{ t: 'guide', kind: 'repair' }] },
        { text: 'Never mind.', next: 'menu' },
      ],
    },
    dirdone: { say: 'I don mark am for your map. Follow the star, no drift like pickpocket!', choices: [{ text: 'Thanks, boss.', next: 'end' }, back()] },
    joke: {
      say: (c) => JOKES[c.visit % JOKES.length],
      choices: [{ text: 'Ha ha! Another one.', next: 'joke' }, back('Okay, enough jokes.')],
    },
    hustle: {
      say: 'Go the dispatch office for the market, near Mama Ngozi\'s rooms. If you get bike, you go collect pesin food fast fast. E dey pay!',
      choices: [
        { text: 'Show me where e dey.', next: 'dirdone', fx: [{ t: 'guide', kind: 'delivery' }] },
        back('Thanks.'),
      ],
    },
  },
}

const shopowner: Persona = {
  id: 'shopowner',
  label: 'Shop owner',
  pitch: 1.0,
  rate: 1.0,
  street: ['Business dey boom today!', 'Customers dey come, thank God.', 'Fix your price well, my guy.', 'Welcome to my shop!'],
  first: () => 'Welcome, my friend! Business dey boom! You sabi work? I fit get small gig for hardworking person.',
  back: () => 'Ah, my hardworking friend! Business still dey good. You wan work?',
  menu: [
    { text: 'What gig you get?', next: 'gig' },
    { text: 'How business dey go?', next: 'biz' },
    { text: 'Any errand for me?', next: 'errand', show: noMission('shop-order') },
  ],
  nodes: {
    gig: {
      say: (c) =>
        hasDaily(c, 'gig')
          ? 'You don work for me today finish. Come tomorrow, new boxes go land!'
          : c.level >= 2
            ? 'Big supplier delivery just land. Carry the cartons inside: 0.70 USDC. E go tire you small (8 energy).'
            : 'Carry these boxes enter the store. Na 0.35 USDC and e go cost you 6 energy. Fair?',
      choices: [
        { text: 'Do it.', next: 'gigdone', fx: [{ t: 'gig', pay: 70, rep: 2, energy: 6 }, { t: 'flag', f: 'gig', daily: true }], show: (c) => !hasDaily(c, 'gig') && c.level < 2 },
        { text: 'Do it.', next: 'gigdone', fx: [{ t: 'gig', pay: 140, rep: 3, energy: 8 }, { t: 'flag', f: 'gig', daily: true }], show: (c) => !hasDaily(c, 'gig') && c.level >= 2 },
        { text: 'I too tire for now.', next: 'menu' },
      ],
    },
    gigdone: { say: 'Ehen! See as you work well well. Come back anytime, your money dey always ready.', choices: [{ text: 'Thanks.', next: 'end' }] },
    biz: { say: 'Customers plenty but na thief dey worry me. Save your money and open your own shop one day. Na so I start!', choices: [back()] },
    errand: {
      say: 'Yes! Carry this receipt go give one market woman for the stalls. She dey owe me small something.',
      choices: [
        { text: 'I go deliver am.', next: 'end', fx: [{ t: 'mission', id: 'shop-order' }] },
        back('Maybe later.'),
      ],
    },
  },
}

const areaboy: Persona = {
  id: 'areaboy',
  label: 'Area boy',
  pitch: 0.85,
  rate: 1.15,
  street: ['Wetin dey sup, boss?', 'Na so e be o!', 'See gobe!', 'Vibes only, no wahala.', 'Abeg no step on my shoe!'],
  first: () => 'Oga! Wetin dey sup? You dey waka like say na your papa get this street, abi? Haha, I dey play! Wetin you want?',
  back: () => 'Look who just show! My guy don come back. You no fit stay away from correct vibes, abi?',
  menu: [
    { text: 'I dey find you o!', next: 'banter' },
    { text: 'Wetin dey happen for street?', next: 'rumour' },
    { text: 'You dey disturb person?', next: 'tough' },
  ],
  nodes: {
    banter: {
      say: (c) => (c.outfitName ? `See this one o! ${c.outfitName}? Na you dey set trend for this area!` : 'Those puffs and that headphone? Chai, you be correct baddie. Face of the area!'),
      choices: [
        { text: 'Haha, na so. Respect.', next: 'menu', fx: [{ t: 'rep', n: 1 }, { t: 'flag', f: 'banter', daily: true }], show: (c) => !hasDaily(c, 'banter') },
        { text: 'Hmm, you funny.', next: 'menu' },
      ],
    },
    rumour: {
      say: 'Ehen, gist: one parcel dey for the phone repair guy wey nobody don claim. If you tell am say Chike send you, e go pay you well.',
      choices: [
        { text: 'I go do am.', next: 'end', fx: [{ t: 'mission', id: 'phone-parcel' }], show: noMission('phone-parcel') },
        { text: 'No be my business.', next: 'menu' },
      ],
    },
    tough: {
      say: (c) =>
        c.level >= 2
          ? 'Haha, no vex! You get name for this city, everybody respect you. Take small tip for lunch.'
          : 'Abeg, comot for my front before I show you who own this street! ... I dey joke o. Na so we dey play.',
      choices: [
        { text: 'Thanks, my guy.', next: 'menu', fx: [{ t: 'cash', n: 30 }, { t: 'flag', f: 'tip', daily: true }], show: (c) => c.level >= 2 && !hasDaily(c, 'tip') },
        back('Ok, no wahala.'),
      ],
    },
  },
}

const student: Persona = {
  id: 'student',
  label: 'Student',
  pitch: 1.3,
  rate: 1.1,
  street: ['Exam dey come, I never read!', 'Abeg, you get pen?', 'That lecturer na wahala o.', 'My data don finish again!'],
  first: () => 'Good day, please. You fit help me? I dey prepare for exam and my head don dey spin.',
  back: () => 'Good day again! Thank you for last time. I dey still read o.',
  menu: [
    { text: 'Ask me anything.', next: 'quiz' },
    { text: 'How school dey go?', next: 'school' },
    { text: 'You need help with your notes?', next: 'notes', show: noMission('exam-notes') },
  ],
  nodes: {
    quiz: {
      say: 'Okay, quick one: wetin be the capital of Nigeria?',
      choices: [
        { text: 'Lagos.', next: 'wrong' },
        { text: 'Abuja.', next: 'right' },
        { text: 'Kano.', next: 'wrong' },
      ],
    },
    right: {
      say: (c) => (hasDaily(c, 'quiz') ? 'Correct, Abuja! You be genius. I already thank you today, but thank you again!' : 'Correct, Abuja! You be genius. Please take this small thing for your help.'),
      choices: [{ text: 'Happy to help.', next: 'menu', fx: [{ t: 'cash', n: 25 }, { t: 'rep', n: 2 }, { t: 'flag', f: 'quiz', daily: true }], show: (c) => !hasDaily(c, 'quiz') }, back('Happy to help.')],
    },
    wrong: { say: 'Hmm... I think na Abuja o? Don\'t worry, thank you for trying.', choices: [{ text: 'Try another one.', next: 'quiz' }, back()] },
    school: { say: 'Exam dey come, light no dey, data dey finish. But I go pass by God\'s grace.', choices: [back()] },
    notes: {
      say: 'My notes dey with one okada rider for the junction! Abeg tell am make he keep am for me.',
      choices: [
        { text: 'I go pass the message.', next: 'end', fx: [{ t: 'mission', id: 'exam-notes' }] },
        back('Maybe later.'),
      ],
    },
  },
}

const mamaput: Persona = {
  id: 'mamaput',
  label: 'Mama Put',
  pitch: 1.0,
  rate: 0.95,
  street: ['Hot rice! Come chop!', 'Pepper soup dey ready!', 'Who never chop?', 'Plantain and beans, sweet pass!'],
  first: () => 'Welcome, my pikin! Rice, beans, plantain, pepper soup. Wetin you go chop today?',
  back: () => 'Ah ah! My customer don return! Come, come, you look hungry!',
  menu: [
    { text: 'Wetin you recommend?', next: 'rec' },
    { text: 'Abeg, small free taste?', next: 'taste' },
    { text: 'Any gist?', next: 'gist' },
  ],
  nodes: {
    rec: { say: 'Jollof and chicken na the king, but pepper soup na wetin go restore your spirit. Everybody dey come back for my soup!', choices: [back()] },
    taste: {
      say: (c) =>
        hasDaily(c, 'taste')
          ? 'I don give you small taste today already, my pikin. No be charity o!'
          : c.met === 0
            ? 'First time? Small portion free for new customer! Take am, taste my hand.'
            : c.level >= 2
              ? 'For you, big name customer? Take am free-free!'
              : 'No be charity, my pikin. But since I know you now, take small.',
      choices: [{ text: 'Thank you, ma!', next: 'menu', fx: [{ t: 'hunger', n: 15 }, { t: 'flag', f: 'taste', daily: true }], show: (c) => !hasDaily(c, 'taste') }, back('Thanks anyway.')],
    },
    gist: { say: 'Small small thing: the market woman always send me pepper. If you carry her basket come, I go reward you well.', choices: [back()] },
  },
}

const pastor: Persona = {
  id: 'pastor',
  label: 'Pastor',
  pitch: 0.7,
  rate: 0.85,
  street: ['God is good, all the time!', 'Peace be unto you.', 'Keep the faith, my friends.', 'Sunday service, nine o\'clock!'],
  first: () => 'Peace be unto you, my child. God bless your hustle. How is your spirit today?',
  back: () => 'Peace! The Lord has brought you back to me. Walk in grace.',
  menu: [
    { text: 'Pray for me, Pastor.', next: 'pray' },
    { text: 'Any word for me?', next: 'word' },
    { text: 'Any church errand?', next: 'flyers', show: noMission('church-flyers') },
  ],
  nodes: {
    pray: {
      say: (c) => (hasDaily(c, 'pray') ? 'I prayed for you earlier today, my child. His grace is sufficient.' : 'Father Lord, give this child strength, favour and wisdom in her hustle. Receive your blessing! Amen!'),
      choices: [{ text: 'Amen!', next: 'end', fx: [{ t: 'energy', n: 12 }, { t: 'rep', n: 1 }, { t: 'flag', f: 'pray', daily: true }], show: (c) => !hasDaily(c, 'pray') }, back('Thank you, Pastor.')],
    },
    word: { say: 'Whatever your hand finds to do, do it with all your might. Even the okada rider must wake early to catch the day.', choices: [back()] },
    flyers: {
      say: 'Take these flyers for our Sunday program go give one shop owner. God go reward you.',
      choices: [
        { text: 'I go deliver them.', next: 'end', fx: [{ t: 'mission', id: 'church-flyers' }] },
        back('Maybe later.'),
      ],
    },
  },
}

const repairer: Persona = {
  id: 'repairer',
  label: 'Phone repairer',
  pitch: 1.1,
  rate: 1.05,
  street: ['Cracked screen? Come!', 'Battery dey die? I fit fix!', 'Phone fix, fast and cheap!', 'Water enter your phone? Bring am!'],
  first: () => 'Phone crack? Battery dey die? Water enter? Bring am come, I fit fix anything wey get motherboard.',
  back: () => 'My guy! You don come again? Phone dey okay or na another repair?',
  menu: [
    { text: 'Teach me one repair secret.', next: 'tip' },
    { text: 'You get work for me?', next: 'work' },
    { text: 'Any gist?', next: 'gist' },
  ],
  nodes: {
    tip: { say: 'Rule number one: never rush. Watch the light sequence well well, then repeat am slow slow. Na patience dey fix phone.', choices: [back()] },
    work: {
      say: (c) => (hasDaily(c, 'work') ? 'You don help me today finish. Come tomorrow, new phones go land!' : 'Yes! I get plenty phone for back. Help me sort the screws: 0.45 USDC, and e go cost 5 energy.'),
      choices: [
        { text: 'Do it.', next: 'workdone', fx: [{ t: 'gig', pay: 90, rep: 2, energy: 5 }, { t: 'flag', f: 'work', daily: true }], show: (c) => !hasDaily(c, 'work') },
        back('Later.'),
      ],
    },
    workdone: { say: 'Oya! Fast fingers! You fit join this business.', choices: [{ text: 'Thanks.', next: 'end' }] },
    gist: { say: 'Everybody dey ask for fast data. Na why I dey sell power bank too. Customers dey increase since the lounge open for beach.', choices: [back()] },
  },
}

export const PERSONAS: Record<string, Persona> = { marketwoman, okadarider, shopowner, areaboy, student, mamaput, pastor, repairer }
export const PERSONA_IDS = Object.keys(PERSONAS)
