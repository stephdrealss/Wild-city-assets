/** Street missions unlocked by rumours and favours in conversation. */
export interface MissionDef {
  id: string
  title: string
  /** shown in the phone */
  desc: string
  /** persona that gives it and persona who receives the delivery */
  from: string
  to: string
  /** what the player says when delivering */
  deliver: string
  /** the receiver's reply */
  thanks: string
  cash: number
  rep: number
}

export const MISSIONS: Record<string, MissionDef> = {
  soup: {
    id: 'soup',
    title: 'Pepper for Mama Put',
    desc: 'Carry the market woman\'s fresh pepper to a food seller (mama put).',
    from: 'marketwoman',
    to: 'mamaput',
    deliver: 'The market woman send this pepper for you.',
    thanks: 'Ahh! She don remember me! God bless her hand. Take this one for your trouble, my pikin.',
    cash: 90,
    rep: 3,
  },
  'phone-parcel': {
    id: 'phone-parcel',
    title: 'Chike\'s parcel',
    desc: 'Tell a phone repairer "Chike send you" to collect the unclaimed parcel.',
    from: 'areaboy',
    to: 'repairer',
    deliver: 'Chike send me for the parcel.',
    thanks: 'Ah! Chike\'s person! Wait, make I find am. Here, na your own. Tell am say we are even.',
    cash: 110,
    rep: 4,
  },
  'church-flyers': {
    id: 'church-flyers',
    title: 'Sunday flyers',
    desc: 'Take the pastor\'s church flyers to a shop owner.',
    from: 'pastor',
    to: 'shopowner',
    deliver: 'The pastor send these flyers for your shop window.',
    thanks: 'Ah, God bless the pastor! I go paste am for the front. Take small something for the road.',
    cash: 70,
    rep: 5,
  },
  'exam-notes': {
    id: 'exam-notes',
    title: 'Notes for the rider',
    desc: 'Tell an okada rider to keep the student\'s exam notes.',
    from: 'student',
    to: 'okadarider',
    deliver: 'The student say make you keep her notes for her.',
    thanks: 'Ha! No wahala! I go keep am like gold. Tell am make she pass, I go carry her go school free!',
    cash: 60,
    rep: 3,
  },
  'shop-order': {
    id: 'shop-order',
    title: 'Receipt for the market',
    desc: 'Bring the shop owner\'s receipt to a market woman.',
    from: 'shopowner',
    to: 'marketwoman',
    deliver: 'The shop owner send this receipt.',
    thanks: 'Ah ah! So he remember to send am! Tell am I go pay Friday. Here, this one na for you.',
    cash: 100,
    rep: 3,
  },
}
