/**
 * Street talk the player steers. Every line she says is one the player picked: how to greet, whether to give her name,
 * what to ask about, whether to bargain. Each pick gets a natural reply and may open follow-up choices.
 * Pure data, no game state is touched here.
 */
import type { Fx } from './dialogue'
import { usdcFor } from '@/chain/pay'
import { MARKET_GOODS, THEME_GOODS, isFood, type FoodId, type GoodsId, type StallTheme } from './data'

export interface TalkCtx {
  /** the other person's first name */
  them: string
  /** the other person is a woman (ma) or a man (sir) */
  female: boolean
  /** her name */
  me: string
  /** they have met before */
  met: boolean
  /** she has told them her name (now or before) */
  introduced: boolean
  /** in-game days since they last talked */
  gap: number
  /** 0..24 */
  hour: number
  /** what is on their table, for market sellers */
  goods?: StallTheme
  /** fixed per person: every seller has their own prices */
  seed: number
  /** she priced something here before, walked away, and this was their last price */
  haggle?: { id: GoodsId; price: number }
}

type Txt = string | ((c: TalkCtx) => string)

export interface TalkOption {
  id: string
  /** what she says */
  say: Txt
  /** their answer */
  reply: Txt
  /** choices that open up after this exchange */
  then?: TalkOption[]
  /** she says this and walks off: the chat ends after their answer */
  leave?: boolean
  /** the price the seller last asked when she walks away, so they remember it if she comes back */
  quote?: { id: GoodsId; price: number }
  /** marks that she gave her name */
  intro?: boolean
  fx?: Fx[]
  show?: (c: TalkCtx) => boolean
}

export const text = (t: Txt, c: TalkCtx) => (typeof t === 'string' ? t : t(c))
export const timeGreet = (h: number) => (h < 12 ? 'Good morning' : h < 16 ? 'Good afternoon' : 'Good evening')
const since = (c: TalkCtx) => (c.gap >= 2 ? `Na ${c.gap} days I no see you o!` : c.gap === 1 ? 'Since yesterday I no see you!' : 'You don come back so soon!')
const firstTime = (c: TalkCtx) => !c.met
const notIntroduced = (c: TalkCtx) => !c.introduced

/* ---------------- greetings: always the first thing the player picks ---------------- */
const any = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)]

/** How people actually answer a greeting on the street: they don't parrot it back, they react. */
const REPLY_NEW = [
  'Omo, I dey fine o! Wetin dey sup?',
  'I dey kampe! You be new face for this area, abi?',
  'Ah, I dey o, we thank God. Wetin I fit do for you?',
  'I dey jare! Na who be this fine person?',
  'Body dey inside cloth! How your side?',
]
const REPLY_AGAIN = (c: TalkCtx) => [
  `Ahn ahn, ${c.me}! ${since(c)} Where you dey hide?`,
  `My person! ${since(c)} I dey o, wetin dey happen?`,
  `${c.me}! Omo, ${since(c).toLowerCase()} You don forget us?`,
  `Ehen, see who show! I dey fine o. ${since(c)}`,
]

/** a seller she walked away from earlier, who remembers */
const REPLY_HAGGLE = (c: TalkCtx) => {
  const item = MARKET_GOODS[c.haggle!.id].name.toLowerCase()
  return [
    `Ehen! See who come back! I tell you say nobody price reach my own. You don come back for the ${item}?`,
    `${c.introduced ? c.me : 'My customer'}! I know say you go come back. You don come for the ${item}?`,
  ]
}

export function greetings(persona: string, c: TalkCtx): TalkOption[] {
  const sir = persona === 'pastor' ? ' Pastor' : c.female ? ' ma' : ' sir'
  if (c.met && c.haggle) {
    return [
      { id: 'g-back', say: (x) => `${timeGreet(x.hour)}${sir}! I don come back o.`, reply: (x) => any(REPLY_HAGGLE(x)) },
      { id: 'g-name', say: (x) => `${x.them}! How far now?`, reply: (x) => any(REPLY_HAGGLE(x)) },
    ]
  }
  if (persona === 'pastor') {
    // the pastor answers like a pastor
    return c.met
      ? [
          { id: 'g-polite', say: (x) => `${timeGreet(x.hour)} Pastor. How you dey?`, reply: (x) => `God bless you, my daughter! ${since(x)} I am well. How is your hustle?` },
          { id: 'g-name', say: 'Pastor! Long time o.', reply: (x) => `${x.me}! The Lord has brought you back. ${since(x)}` },
        ]
      : [
          { id: 'g-polite', say: (x) => `${timeGreet(x.hour)} Pastor. How you dey?`, reply: 'I am blessed, my daughter. God is good! You are new around here?' },
          { id: 'g-intro', say: (x) => `${timeGreet(x.hour)} sir. My name na ${x.me}, I just move come this area.`, reply: (x) => `${x.me}, you are welcome! I am Pastor ${x.them}. God brought you here for a reason.`, intro: true },
        ]
  }
  if (c.met) {
    return [
      { id: 'g-name', say: (x) => `${x.them}! How far now?`, reply: (x) => any(REPLY_AGAIN(x)) },
      { id: 'g-body', say: (x) => `Ah, ${x.them}! How you dey now?`, reply: (x) => any(REPLY_AGAIN(x)) },
      { id: 'g-polite', say: (x) => `${timeGreet(x.hour)}${sir}! How body?`, reply: (x) => any(REPLY_AGAIN(x)) },
    ]
  }
  return [
    { id: 'g-polite', say: (x) => `${timeGreet(x.hour)}${sir}. How you dey?`, reply: () => any(REPLY_NEW) },
    { id: 'g-howfar', say: 'How far? How you dey now?', reply: () => any(REPLY_NEW) },
    {
      id: 'g-intro',
      say: (x) => `Hello o! My name na ${x.me}, I just move come this area.`,
      reply: (x) => any([`Ehen, ${x.me}! Welcome o. Me na ${x.them}.`, `${x.me}! Fine name. My own na ${x.them}. You go like this side.`, `Welcome, welcome! Na ${x.them} be my name. Anything you need, just shout.`]),
      intro: true,
    },
  ]
}

/**
 * Her lines are written for a woman seller ("ma", "madam"). Talking to a man, she says "sir" and "oga" instead.
 */
export function addressFor(line: string, female: boolean) {
  if (female) return line
  return line
    .replace(/\bmadam\b/g, 'oga')
    .replace(/\bMadam\b/g, 'Oga')
    .replace(/\bma\b(?=[.,!?\s]|$)/g, 'sir')
    .replace(/\bmummy\b/gi, 'oga')
    .replace(/\bMama\b/g, 'Oga')
    .replace(/\bmama\b/g, 'oga')
}

/* ---------------- answering what they just asked ---------------- */
const nameAnswer = (n: number): TalkOption => ({
  id: `ans-name-${n}`,
  say: (c) => `My name na ${c.me}.`,
  reply: (c) => `${c.me}! Fine name o. Me na ${c.them}. Anything you need for this area, just shout my name.`,
  intro: true,
})
const RULES: { re: RegExp; answers: (c: TalkCtx, n: number) => TalkOption[] }[] = [
  {
    // "you don come back for the garri?": she can take the price she was given before
    re: /come back for the|come for the/i,
    answers: (c, n) => {
      if (!c.haggle) return []
      const { id, price } = c.haggle
      const g = MARKET_GOODS[id]
      return [
        {
          id: `ans-back-buy-${n}`,
          say: `Yes o! I check everywhere, na your own price better pass. Give me am for ${naira(price)}.`,
          reply: 'Ehen! Na why I like you. Because you come back, I go add small extra for you. Here, collect.',
          fx: [{ t: 'buy', id, n: vx(price), naira: price }],
        },
        {
          id: `ans-back-more-${n}`,
          say: `Yes, but abeg reduce am small for me. ${naira(Math.round((price * 0.93) / 50) * 50)}?`,
          reply: `You no dey tire! Okay, because you be my customer, ${naira(Math.round((price * 0.96) / 50) * 50)}. Na final.`,
          then: [
            {
              id: `ans-back-take-${n}`,
              say: `Okay, deal! I go take am for ${naira(Math.round((price * 0.96) / 50) * 50)}.`,
              reply: 'God bless you my dear! Here, collect.',
              fx: [{ t: 'buy', id, n: vx(Math.round((price * 0.96) / 50) * 50), naira: Math.round((price * 0.96) / 50) * 50 }],
            },
            { id: `ans-back-go-${n}`, say: 'E still pass my pocket. Another time.', reply: 'Okay o. My door dey open anytime.', leave: true, quote: { id, price: Math.round((price * 0.96) / 50) * 50 } },
          ],
        },
        { id: `ans-back-no-${n}`, say: `No o, I just dey greet you. I go buy the ${g.name.toLowerCase()} another day.`, reply: 'No wahala my dear. Anytime you ready, I dey here.' },
      ]
    },
  },
  {
    re: /new face|new for this area|new here|new around here|are new|you be new/i,
    answers: (c, n) => [
      {
        id: `ans-new-yes-${n}`,
        say: 'Yes o! I just move come this area last week.',
        reply: (x) => (x.introduced ? 'Ehen! You don land well. You go enjoy this side, people here get liver.' : 'Ehen! You don land well. So wetin be your name?'),
      },
      {
        id: `ans-new-rumuola-${n}`,
        say: 'Yes, I be new here. Na Rumuola I dey stay before.',
        reply: (x) => (x.introduced ? 'Ah, Rumuola! So you sabi PH well well. Welcome to this side.' : 'Ah, Rumuola! So you sabi PH well well. Welcome! Wetin we go dey call you?'),
      },
      { id: `ans-new-no-${n}`, say: 'No o, I don dey here small time.', reply: 'Ehen? Na me never notice you be that. Welcome sha!' },
    ],
  },
  {
    re: /wetin be your name|who be this|who be you|what is your name|wetin we go dey call you|your name\?/i,
    answers: (c, n) => [nameAnswer(n)],
  },
  {
    re: /where you dey hide|you don forget us|long time/i,
    answers: (c, n) => [
      { id: `ans-hide-work-${n}`, say: 'Ah, work don hold me tight these days.', reply: 'I understand, hustle no easy. Welcome back jare.' },
      { id: `ans-hide-forget-${n}`, say: 'I no fit forget una! I just dey busy small.', reply: 'Ehen, no wahala. You don show face now, na wetin matter.' },
    ],
  },
  {
    re: /wetin dey sup|how your side|how body\?|wetin dey happen|how your hustle|how is your hustle|how you dey\?|how far\?/i,
    answers: (c, n) => [
      { id: `ans-fine-${n}`, say: 'I dey kampe, no wahala.', reply: 'Na so we go dey! God dey.' },
      { id: `ans-cloth-${n}`, say: 'Body dey inside cloth, I thank God.', reply: 'Amen o! As long as we dey breathe.' },
      { id: `ans-hustle-${n}`, say: 'Hustle dey go small small.', reply: 'Small small na im dey fill basket. E go better.' },
    ],
  },
]

/** If they just asked her something, the natural answers to it, so she replies before changing the subject. */
export function answersTo(line: string, c: TalkCtx, used: Set<string>, n: number): TalkOption[] {
  if (!line.includes('?')) return []
  // only the question part counts: "I dey o. Wetin dey sup?" -> "Wetin dey sup?"
  const qs = line.split(/(?<=[.!?])\s+/).filter((x) => x.includes('?'))
  for (const r of RULES) {
    if (!qs.some((q) => r.re.test(q))) continue
    const list = r.answers(c, n).filter((a) => !used.has(a.id) && !(a.intro && c.introduced))
    if (list.length) return list
  }
  return []
}

/** Introduce yourself, available until she has done it. */
const INTRO: TalkOption = {
  id: 'intro',
  say: (c) => `By the way, my name na ${c.me}. I just move come this area.`,
  reply: (c) => `${c.me}! Fine name. Me na ${c.them}. You go like this place, people here dey friendly.`,
  intro: true,
  show: notIntroduced,
}

/* ---------------- things to talk about, by kind of person ---------------- */
export const TOPICS: Record<string, TalkOption[]> = {
  marketwoman: [
    {
      id: 'garri',
      say: 'Abeg, how much be your garri?',
      reply: 'Na 1.11 USDC for one paint rubber. Fresh one, e just land from Ogoja.',
      then: [
        {
          id: 'garri-low',
          say: 'Haba madam, e too cost o. Abeg do am 0.74 USDC.',
          reply: '0.74 USDC? My pikin, you wan make I close shop? Bring 0.96 USDC, make we finish am.',
          then: [
            { id: 'garri-buy', say: 'Okay ma, I go take am at 0.96 USDC.', reply: 'God bless you my dear! Na correct customer be this. Next time I go add extra for you.', fx: [{ t: 'pay', n: 13 }, { t: 'hunger', n: 20 }] },
            { id: 'garri-walk', say: 'Abeg leave am. I go check another place.', reply: 'Ehn, go check! You go still come back meet me. Nobody price reach my own.', leave: true },
          ],
        },
        { id: 'garri-ok', say: 'Okay, e make sense. Give me one.', reply: 'Na so! Customer wey no dey bargain too much, God go bless you. Here.', fx: [{ t: 'pay', n: 15 }, { t: 'hunger', n: 20 }] },
      ],
    },
    {
      id: 'tomato',
      say: 'Your tomato fine o! Na where you dey buy am?',
      reply: 'Na from Jos e dey come. Trailer dey bring am every Tuesday. That one na why e fresh like this.',
    },
  ],
  mamaput: [
    {
      id: 'menu',
      say: 'Mama, wetin you get for pot today?',
      reply: 'Jollof rice, white rice and stew, beans and plantain, and pepper soup. Everything hot.',
      then: [
        { id: 'jollof', say: 'Give me jollof with plantain.', reply: 'Correct choice! Sit down, e dey come now now. Na 2.22 USDC.', fx: [{ t: 'pay', n: 30 }, { t: 'hunger', n: 35 }] },
        { id: 'soup', say: 'Pepper soup abeg. Make am hot.', reply: 'Hot? My pepper soup go make you sweat like say you dey gym! Na 2.59 USDC.', fx: [{ t: 'pay', n: 35 }, { t: 'hunger', n: 30 }, { t: 'energy', n: 5 }] },
        { id: 'later', say: 'I go come back later, I never hungry reach.', reply: 'No wahala. But no wait too long o, the pot dey finish fast.' },
      ],
    },
  ],
  okadarider: [
    {
      id: 'fare',
      say: 'Okada! You dey go market side? How much?',
      reply: 'Market? Na there I dey go now now. Na five hundred.',
      then: [
        {
          id: 'fare-low',
          say: 'Five hundred for that small distance? Abeg na three hundred.',
          reply: 'Madam, fuel don cost o! Okay, bring four hundred, make we dey go.',
          then: [
            { id: 'fare-ok', say: 'Okay, four hundred. Make we go.', reply: 'Oya, hold me well! Na direction I go show you.', fx: [{ t: 'guide', kind: 'food' }] },
            { id: 'fare-no', say: 'No, I go trek.', reply: 'Trek? For this sun? Okay o, madam strong woman!', leave: true },
          ],
        },
      ],
    },
    { id: 'road', say: 'How road today?', reply: 'Road dey hot o. Police dey everywhere, I dey dodge dem like Messi!' },
  ],
  shopowner: [
    {
      id: 'card',
      say: 'Una dey sell recharge card?',
      reply: 'Yes o! MTN, Glo, Airtel, everything dey. Which one you want?',
      then: [
        { id: 'card-mtn', say: 'MTN, one thousand naira card.', reply: 'Here. Scratch am well, no tear the number o.', fx: [{ t: 'pay', n: 10 }] },
        { id: 'card-no', say: 'Make I check my money first.', reply: 'No wahala. I dey here till evening.' },
      ],
    },
    { id: 'light', say: 'NEPA bring light today?', reply: 'Light? Since morning na generator I dey use. Diesel price wan finish me.' },
  ],
  areaboy: [
    { id: 'area', say: 'How the area? Everything dey calm?', reply: 'Area dey cool. Nobody dey cause wahala. You know say I dey here.' },
    { id: 'nickname', say: 'Wetin people dey call you for this street?', reply: (c) => `Dem dey call me ${c.them} Lion! Because I dey roar when trouble come. Haha!` },
  ],
  student: [
    {
      id: 'study',
      say: 'You be student? Wetin you dey study?',
      reply: 'Economics. All these graphs and demand and supply, e dey scatter my head.',
      then: [
        { id: 'study-me', say: 'Economics? Na wetin I read too!', reply: 'For real? You be my senior then! Abeg, you go fit help me with my revision sometime?' },
        { id: 'study-tip', say: 'Just practise the graphs every day. E go enter.', reply: 'Thank you! I go try am. Na practice dey make perfect.', fx: [{ t: 'rep', n: 1 }] },
      ],
    },
  ],
  pastor: [
    { id: 'church', say: 'Where your church dey, Pastor?', reply: 'Just that corner, after the barbershop. Service na nine o\'clock every Sunday. You are welcome.' },
    { id: 'bless', say: 'Pastor, abeg bless my hustle.', reply: 'May the Lord open doors for you that no man can shut. Your hustle will prosper. Amen!', fx: [{ t: 'energy', n: 5 }] },
  ],
  repairer: [
    {
      id: 'screen',
      say: 'You dey fix phone screen? How much?',
      reply: 'Depends on the phone. Small phone na five thousand, iPhone na another level entirely.',
      then: [
        { id: 'screen-bring', say: 'Okay, I go bring my own come.', reply: 'Bring am! Na me be the best phone doctor for this street, ask anybody!' },
        { id: 'screen-why', say: 'Why iPhone own dey cost like that?', reply: 'Ah, iPhone screen na gold! Even the screw dey cost money. Na Apple wahala be that.' },
      ],
    },
  ],
}

/**
 * The choices to show right now: unused topics for this person (with the intro offer while she has not given her name),
 * or the follow-ups of the last exchange.
 */
export function topicChoices(persona: string, c: TalkCtx, used: Set<string>): TalkOption[] {
  // whoever stands at a stall or a food spot sells what is on that table, and talks about it
  const sells = c.goods ? [...goodsTopics(THEME_GOODS[c.goods], c), ...(isFood(c.goods) ? [FOOD_TALK[c.goods]] : [])] : null
  const list = [...(sells ?? TOPICS[persona] ?? []), INTRO]
  return list.filter((o) => !used.has(o.id) && (!o.show || o.show(c)))
}

export { firstTime }

/* ---------------- small talk about the food at a food spot ---------------- */
const FOOD_TALK: Record<FoodId, TalkOption> = {
  akara: { id: 'food-how', say: 'How you dey take make your akara soft like this?', reply: 'Na the beans o! I peel am well, grind am smooth, add pepper and onion, then I fry am for hot oil.' },
  suya: { id: 'food-how', say: 'Wetin be the red powder wey you dey rub for the meat?', reply: 'Na yaji! Groundnut, pepper, ginger and plenty spice. Na im be my secret.' },
  jollof: { id: 'food-how', say: 'Your jollof get that party smoke?', reply: 'Firewood jollof, my sister! The bottom pot na the sweetest part.' },
  dodo: { id: 'food-how', say: 'How you dey know when the dodo don ready?', reply: 'When e turn golden brown, I go turn am. You no fit let am burn o.' },
  peppersoup: { id: 'food-how', say: 'Na goat meat or catfish pepper soup?', reply: 'Today na goat meat. Catfish go ready for evening time.' },
  chinchin: { id: 'food-how', say: 'You get the one wey crunchy well well?', reply: 'All of dem crunchy! I fry am this morning, e still fresh.' },
}

/* ---------------- buying real goods from a market stall ---------------- */
const FLAVOR: Record<GoodsId, string> = {
  garri: 'Fresh one, e just land from Ogoja. E white like snow!',
  rice: 'Na correct local rice, no stone inside. You fit check am.',
  beans: 'Oloyin beans, the sweet one. E no dey give weevil wahala.',
  palmoil: 'Original red oil, no be the one wey dem mix o.',
  tomato: 'Na from Jos e dey come. See as e red, fresh fresh!',
  pepper: 'This pepper go make your eye water, I dey tell you!',
  onion: 'Big big onions. E go sweet your stew well well.',
  yam: 'Abuja yam, the big one. Once you boil am, e go burst like flour!',
  plantain: 'E don ripe well. Dodo go sweet you today.',
  orange: 'Sweet orange, no sour at all. Taste one if you no believe me.',
  akara: 'Hot hot from the oil, I just dey fry am now. See as e dey sizzle!',
  suya: 'Na correct beef, I don put plenty yaji. E go hot your mouth sweet sweet.',
  jollof: 'Party jollof o, with the smoky bottom pot taste. Chicken dey inside.',
  dodo: 'Na ripe plantain I dey fry, e sweet like sugar.',
  peppersoup: 'Goat meat pepper soup, e go clear your head. Hot hot!',
  chinchin: 'Crunchy chin chin, I fry am this morning. E get small milk inside.',
}
/** every price in this market is said in USDC */
const naira = (n: number) => `${usdcFor(n).toFixed(2)} USDC`
const vx = (n: number) => Math.max(1, Math.round(n / 100))
const lower = (g: GoodsId) => MARKET_GOODS[g].name.toLowerCase()

/** oranges can be tasted before buying; after the taste, the same buy and bargain choices come back */
function withTaste(id: GoodsId, buy: TalkOption[]): TalkOption[] {
  if (id !== 'orange') return buy
  const taste: TalkOption = {
    id: 'taste-orange',
    say: 'Make I taste one first.',
    reply: 'Ehen! Make I cut am for you. Taste am, you go see say e sweet pass sugar!',
    fx: [{ t: 'taste' }],
    then: buy,
  }
  return [taste, ...buy]
}

/** every seller prices a little differently: from about 8% under to 10% over the usual price */
export const priceAt = (naira: number, seed: number) => Math.max(50, Math.round((naira * (0.9 + (seed % 23) / 100)) / 50) * 50)

export function goodsTopics(ids: GoodsId[], c: TalkCtx): TalkOption[] {
  return ids.map((id) => {
    const g = { ...MARKET_GOODS[id], naira: priceAt(MARKET_GOODS[id].naira, c.seed) }
    const ask = Math.round((g.naira * 0.6) / 50) * 50
    const meet = Math.round((g.naira * 0.85) / 50) * 50
    const last = Math.round((ask + meet) / 2 / 50) * 50
    const take = (n: number, sid: string): TalkOption => ({
      id: sid,
      say: `Okay ma, I go take am for ${naira(n)}.`,
      reply: 'God bless you my dear! Na correct customer be this. Next time I go add extra for you.',
      fx: [{ t: 'buy', id, n: vx(n), naira: n }],
    })
    const walk = (sid: string): TalkOption => ({
      id: sid,
      say: 'Abeg leave am. I go check another place.',
      reply: 'Ehn, go check! You go still come back meet me. Nobody price reach my own.',
      leave: true,
      quote: { id, price: meet },
    })
    const unit = g.unit === 'five for' ? `five for ${naira(g.naira)}` : `${naira(g.naira)} for ${g.unit}`
    return {
      id: `buy-${id}`,
      say: isFood(id) ? `Abeg, how much you dey sell your ${lower(id)}?` : `Abeg, how much be your ${lower(id)}?`,
      reply: `Na ${unit}. ${FLAVOR[id]}`,
      then: withTaste(id, [
        {
          id: `buy-${id}-low`,
          say: `Haba madam, e too cost o. Abeg do am ${naira(ask)}.`,
          reply: `${naira(ask)}? My pikin, you wan make I close shop? Bring ${naira(meet)}, make we finish am.`,
          then: [
            take(meet, `buy-${id}-meet`),
            {
              id: `buy-${id}-last`,
              say: `Abeg make e be ${naira(last)}. Na wetin I get for hand be that.`,
              reply: `Ah, you too like price! I no fit reach ${naira(last)}, I go lose money. My last price na ${naira(meet)}.`,
              then: [take(meet, `buy-${id}-meet2`), walk(`buy-${id}-walk2`)],
            },
            walk(`buy-${id}-walk`),
          ],
        },
        { id: `buy-${id}-ok`, say: `Okay, e make sense. Give me ${g.unit === 'five for' ? 'five' : g.unit}.`, reply: 'Na so! Customer wey no dey bargain too much, God go bless you. Here, collect.', fx: [{ t: 'buy', id, n: vx(g.naira), naira: g.naira }] },
        { id: `buy-${id}-pass`, say: 'E too cost for my pocket now. I go come back another time.', reply: 'No wahala my dear. When you ready, I dey here.', leave: true, quote: { id, price: g.naira } },
      ]),
    }
  })
}
