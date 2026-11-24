/** Static game data for Wild City PH. Chain type ids mirror the contract catalogs. */

export type DistrictId = 'market' | 'plaza' | 'beach' | 'residential' | 'downtown'

export const DISTRICTS: Record<DistrictId, { name: string; level: number; tint: string }> = {
  market: { name: 'Market District', level: 1, tint: '#f5a25d' },
  plaza: { name: 'Wild City Plaza', level: 1, tint: '#9bd1c7' },
  beach: { name: 'Beachfront', level: 2, tint: '#f7e2a0' },
  residential: { name: 'Residential Area', level: 3, tint: '#f3b6c8' },
  downtown: { name: 'Downtown Offices', level: 4, tint: '#8fb3ff' },
}

export const REP_LEVELS = [0, 25, 80, 180, 350]
export const levelFromRep = (rep: number) => REP_LEVELS.reduce((l, t, i) => (rep >= t ? i + 1 : l), 1)
export const repForNext = (rep: number) => REP_LEVELS.find((t) => t > rep) ?? REP_LEVELS[REP_LEVELS.length - 1]

/** Real seconds per in-game hour. */
export const SECONDS_PER_HOUR = 25

export interface VehicleDef {
  id: number
  name: string
  speed: number
  cash: number
  blurb: string
  color: string
}
export const VEHICLES: VehicleDef[] = [
  { id: 0, name: 'Okada Bike', speed: 11, cash: 1500, blurb: 'Zips through traffic. Great for deliveries.', color: '#ff7a1a' },
  { id: 1, name: 'Keke Tricycle', speed: 13, cash: 4500, blurb: 'Three wheels, loud horn, lots of style.', color: '#ffd12e' },
  { id: 2, name: 'City Car', speed: 17, cash: 12000, blurb: 'Air-con and a proper radio.', color: '#2fb6a3' },
  { id: 3, name: 'Sports Car', speed: 24, cash: 40000, blurb: 'The fastest wheels in Wild City.', color: '#ff2d78' },
]

export type PropertyKind = 'home' | 'stall' | 'shop'
export interface PropertyDef {
  id: number
  name: string
  kind: PropertyKind
  cash: number
  tier: number
  /** passive cash per in-game hour for local businesses */
  hourly: number
  blurb: string
}
export const PROPERTIES: PropertyDef[] = [
  { id: 0, name: 'Rented Room', kind: 'home', cash: 3000, tier: 1, hourly: 0, blurb: 'A cosy room above the market. Sleep restores most energy.' },
  { id: 1, name: 'Apartment', kind: 'home', cash: 12000, tier: 2, hourly: 0, blurb: 'Plaza apartment with a view and a proper bed.' },
  { id: 2, name: 'Beach House', kind: 'home', cash: 40000, tier: 3, hourly: 0, blurb: 'Sea breeze and full energy every morning.' },
  { id: 3, name: 'Market Stall', kind: 'stall', cash: 5000, tier: 0, hourly: 25, blurb: 'Your own stall in the market. Earns while you play.' },
  { id: 4, name: 'Barber Shop', kind: 'shop', cash: 15000, tier: 0, hourly: 65, blurb: 'Fresh fades all day. Steady income.' },
  { id: 5, name: 'Phone Repair Shop', kind: 'shop', cash: 20000, tier: 0, hourly: 90, blurb: 'Everybody breaks a screen eventually.' },
  { id: 6, name: 'Neon Lounge', kind: 'shop', cash: 50000, tier: 0, hourly: 230, blurb: 'The beach club that never sleeps.' },
]
export const HOME_NAMES = ['Homeless', 'Rented Room', 'Apartment', 'Beach House']

export type OutfitCategory = 0 | 1 | 2
export interface OutfitDef {
  id: number
  name: string
  category: OutfitCategory
  cash: number
  top: string
  bottom: string
  accent: string
  long?: boolean
}
export const DEFAULT_OUTFIT = { top: '#ff2d9b', bottom: '#1a1a22', accent: '#111111' }
export const OUTFITS: OutfitDef[] = [
  { id: 0, name: 'Sunset Kaftan', category: 0, cash: 900, top: '#ff8a2b', bottom: '#8b3a12', accent: '#ffe08a', long: true },
  { id: 1, name: 'Ocean Bubu', category: 0, cash: 900, top: '#17b6c9', bottom: '#0d5a73', accent: '#e9fbff', long: true },
  { id: 2, name: 'Neon Bomber', category: 0, cash: 1400, top: '#7b3cff', bottom: '#14121f', accent: '#38ffd0' },
  { id: 3, name: 'Kente Crop Set', category: 0, cash: 1800, top: '#f2b705', bottom: '#1f8a4c', accent: '#d7263d' },
  { id: 4, name: 'Lagoon Linen', category: 0, cash: 1200, top: '#f6f1e6', bottom: '#4a8fd6', accent: '#ffffff' },
  { id: 5, name: 'Midnight Racer', category: 0, cash: 2400, top: '#15151c', bottom: '#15151c', accent: '#ff2d9b' },
  { id: 6, name: 'Twin Puffs', category: 1, cash: 600, top: '', bottom: '', accent: '#111111' },
  { id: 7, name: 'Box Braids', category: 1, cash: 800, top: '', bottom: '', accent: '#111111' },
  { id: 8, name: 'Curl Crown', category: 1, cash: 800, top: '', bottom: '', accent: '#111111' },
  { id: 9, name: 'Gold Chain', category: 2, cash: 700, top: '', bottom: '', accent: '#ffcc33' },
  { id: 10, name: 'Bucket Hat', category: 2, cash: 600, top: '', bottom: '', accent: '#ffd12e' },
  { id: 11, name: 'Sling Backpack', category: 2, cash: 700, top: '', bottom: '', accent: '#2fb6a3' },
]
export const CATEGORY_NAMES = ['Outfits', 'Hairstyles', 'Accessories']

export interface FoodDef {
  id: string
  name: string
  cost: number
  hunger: number
  energy: number
}
export const FOODS: FoodDef[] = [
  { id: 'jollof', name: 'Jollof and grilled chicken', cost: 60, hunger: 40, energy: 4 },
  { id: 'suya', name: 'Suya skewers', cost: 28, hunger: 18, energy: 2 },
  { id: 'plantain', name: 'Fried plantain and beans', cost: 42, hunger: 30, energy: 3 },
  { id: 'puff', name: 'Puff-puff bag', cost: 20, hunger: 12, energy: 2 },
  { id: 'coconut', name: 'Fresh coconut water', cost: 16, hunger: 6, energy: 8 },
]

export type JobId = 'delivery' | 'bus' | 'stall' | 'repair' | 'dj'
export interface JobDef {
  id: JobId
  name: string
  level: number
  energy: number
  blurb: string
  pay: string
}
export const JOBS: JobDef[] = [
  { id: 'delivery', name: 'Food Delivery', level: 1, energy: 8, blurb: 'Grab the order, race to the customer before the food gets cold.', pay: '60 to 160' },
  { id: 'stall', name: 'Market Stall Selling', level: 1, energy: 8, blurb: 'Serve the queue fast. Keep every customer smiling.', pay: '70 to 200' },
  { id: 'bus', name: 'Bus Conductor', level: 2, energy: 10, blurb: 'Collect fares and count change on the yellow bus.', pay: '110 to 240' },
  { id: 'repair', name: 'Phone Repair', level: 3, energy: 10, blurb: 'Open the phone and unscrew in the right order.', pay: '140 to 320' },
  { id: 'dj', name: 'DJ Gig', level: 3, energy: 14, blurb: 'Night shift at the Neon Lounge. Hit the beat.', pay: '200 to 480' },
]

export const NPC_LINES = [
  'Eh! The sun is sweet today, my friend.',
  'Buy something, my customers are shouting for me!',
  'Keep to the main road. Okada riders no dey look!',
  'I heard Mama Ngozi is renting rooms above the market.',
  'Work hard, save small small, and you will own a shop.',
  'The Neon Lounge is the place to be after dark.',
  'Yellow buses are always late, but never empty.',
  'You look like someone going places. Respect.',
  'Try the suya near the plaza, it is the best in town.',
  'Reputation opens doors in Wild City. Do good work.',
]
/** names by who they are, so a woman is never called Tunde */
export const FEMALE_NAMES = [
  'Amara', 'Zainab', 'Ngozi', 'Chioma', 'Blessing', 'Ifeoma', 'Ibiere', 'Sade', 'Nneka', 'Folake', 'Tamuno', 'Ebiere', 'Precious', 'Joy',
  'Adaeze', 'Ufuoma', 'Nkechi', 'Bisola', 'Mercy', 'Grace',
]
export const MALE_NAMES = [
  'Tunde', 'Femi', 'Chidi', 'Ibuka', 'Emeka', 'Obinna', 'Dagogo', 'Tonye', 'Soye', 'Ebi', 'Seun', 'Musa', 'Ayo', 'Ikenna', 'Godwin',
  'Ibinabo', 'Uche', 'Kelechi', 'Sunday', 'Boma',
]
export const NPC_NAMES = [...FEMALE_NAMES, ...MALE_NAMES]

export const BLOCK = 50
export const HALF = 20
export const WORLD = { minX: -178, maxX: 178, minZ: -150, maxZ: 176 }

export function districtAt(x: number, z: number): DistrictId {
  const i = Math.floor((x + 25) / 50) + 3
  const j = Math.floor(z / 50) + 3
  return districtOfBlock(i, j)
}
export function districtOfBlock(i: number, j: number): DistrictId {
  if (j <= 1) return 'downtown'
  if (j >= 5) return 'beach'
  if (i <= 2) return 'market'
  if (i >= 4) return 'residential'
  return 'plaza'
}
export const blockCenter = (i: number, j: number) => ({ x: (i - 3) * 50, z: (j - 2.5) * 50 })

/* ---------------- real market goods ---------------- */
/** cooked food, sold hot from the food spots */
export type FoodId = 'akara' | 'suya' | 'jollof' | 'dodo' | 'peppersoup' | 'chinchin'
export type GoodsId = 'garri' | 'rice' | 'beans' | 'palmoil' | 'tomato' | 'pepper' | 'onion' | 'yam' | 'plantain' | 'orange' | FoodId
export type StallTheme = 'foodstuff' | 'veg' | 'tuber' | 'fruit' | FoodId
export const isFood = (t: string): t is FoodId => ['akara', 'suya', 'jollof', 'dodo', 'peppersoup', 'chinchin'].includes(t)

export interface GoodsDef {
  id: GoodsId
  name: string
  /** how it is sold, as the seller says it */
  unit: string
  /** price in naira, as said in conversation (1 VX = ₦100) */
  naira: number
  /** what she can do with it from her bag */
  use: string
  hunger: number
  energy: number
}

export const MARKET_GOODS: Record<GoodsId, GoodsDef> = {
  garri: { id: 'garri', name: 'Garri', unit: 'one paint rubber', naira: 1500, use: 'Soak garri and drink', hunger: 25, energy: 2 },
  rice: { id: 'rice', name: 'Rice', unit: 'one mudu', naira: 1800, use: 'Cook rice', hunger: 30, energy: 2 },
  beans: { id: 'beans', name: 'Beans', unit: 'one mudu', naira: 1600, use: 'Cook beans', hunger: 30, energy: 3 },
  palmoil: { id: 'palmoil', name: 'Palm oil', unit: 'one bottle', naira: 1200, use: 'Cook with palm oil', hunger: 8, energy: 1 },
  tomato: { id: 'tomato', name: 'Tomatoes', unit: 'one small basket', naira: 4000, use: 'Make tomato stew', hunger: 15, energy: 1 },
  pepper: { id: 'pepper', name: 'Pepper', unit: 'one bowl', naira: 800, use: 'Add pepper to your food', hunger: 4, energy: 3 },
  onion: { id: 'onion', name: 'Onions', unit: 'one bowl', naira: 1000, use: 'Cook with onions', hunger: 5, energy: 1 },
  yam: { id: 'yam', name: 'Yam', unit: 'one tuber', naira: 2500, use: 'Boil yam', hunger: 35, energy: 3 },
  plantain: { id: 'plantain', name: 'Plantain', unit: 'one bunch', naira: 2000, use: 'Fry plantain (dodo)', hunger: 25, energy: 2 },
  orange: { id: 'orange', name: 'Oranges', unit: 'five for', naira: 500, use: 'Eat an orange', hunger: 6, energy: 6 },
  akara: { id: 'akara', name: 'Akara', unit: 'ten pieces', naira: 1000, use: 'Eat akara', hunger: 22, energy: 4 },
  suya: { id: 'suya', name: 'Suya', unit: 'one wrap', naira: 2500, use: 'Eat suya', hunger: 28, energy: 5 },
  jollof: { id: 'jollof', name: 'Jollof rice', unit: 'one pack with chicken', naira: 3000, use: 'Eat jollof rice', hunger: 40, energy: 4 },
  dodo: { id: 'dodo', name: 'Dodo', unit: 'one wrap', naira: 1200, use: 'Eat dodo', hunger: 20, energy: 4 },
  peppersoup: { id: 'peppersoup', name: 'Pepper soup', unit: 'one bowl with goat meat', naira: 3500, use: 'Drink pepper soup', hunger: 30, energy: 8 },
  chinchin: { id: 'chinchin', name: 'Chin chin', unit: 'one pack', naira: 500, use: 'Eat chin chin', hunger: 10, energy: 3 },
}

export const THEME_GOODS: Record<StallTheme, GoodsId[]> = {
  foodstuff: ['garri', 'rice', 'beans', 'palmoil'],
  veg: ['tomato', 'pepper', 'onion'],
  tuber: ['yam', 'plantain'],
  fruit: ['orange', 'plantain'],
  akara: ['akara'],
  suya: ['suya'],
  jollof: ['jollof'],
  dodo: ['dodo'],
  peppersoup: ['peppersoup'],
  chinchin: ['chinchin'],
}
