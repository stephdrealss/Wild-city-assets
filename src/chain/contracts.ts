import type { Abi, Address } from 'viem'
import { arcTestnet } from 'viem/chains'
import { getUsdc } from '@/onchain-facts'
import propertyAbi from './abi-WildCityProperty.json'
import vehicleAbi from './abi-WildCityVehicle.json'
import outfitAbi from './abi-WildCityOutfit.json'
import marketAbi from './abi-WildCityMarketplace.json'
import boardAbi from './abi-WildCityLeaderboard.json'

export const CHAIN_ID = arcTestnet.id
const usdcFact = getUsdc(CHAIN_ID)
if (!usdcFact) throw new Error('USDC is not registered for Arc Testnet')
export const USDC_ADDRESS = usdcFact.address as Address

const addr = (v: unknown): Address | undefined => (typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined)

/** Public Arc Testnet deployments. Used when the VITE_WILDCITY_* variables are not set, e.g. on a static host. */
const DEPLOYED = {
  property: '0xae6e416675e1dd9d11b312f5f74b80941f7a152c',
  vehicle: '0x1d2d1720595293ea1879142bf9f9b6c21b191af9',
  outfit: '0xc2b46156225881b815c3238a4889b01aa9c023b3',
  market: '0xf95a5ca16cef4e769dc795e088ae9999848c2a1a',
  board: '0x0bb80dea57228ccd88eaabcabd39721e613a0a07',
}

export type Kind = 'property' | 'vehicle' | 'outfit'

export const COLLECTIONS: Record<Kind, { address: Address | undefined; abi: Abi; noun: string }> = {
  property: { address: addr(import.meta.env.VITE_WILDCITY_PROPERTY || DEPLOYED.property), abi: propertyAbi as Abi, noun: 'Property' },
  vehicle: { address: addr(import.meta.env.VITE_WILDCITY_VEHICLE || DEPLOYED.vehicle), abi: vehicleAbi as Abi, noun: 'Vehicle' },
  outfit: { address: addr(import.meta.env.VITE_WILDCITY_OUTFIT || DEPLOYED.outfit), abi: outfitAbi as Abi, noun: 'Outfit' },
}
export const MARKET = { address: addr(import.meta.env.VITE_WILDCITY_MARKET || DEPLOYED.market), abi: marketAbi as Abi }
export const BOARD = { address: addr(import.meta.env.VITE_WILDCITY_LEADERBOARD || DEPLOYED.board), abi: boardAbi as Abi }

export const short = (a?: string) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '')

export interface CatalogItem {
  id: number
  name: string
  price: bigint
  param: bigint
  maxSupply: number
  minted: number
  category: number
  active: boolean
}

export function parseOnchainError(e: unknown): string {
  const err = e as { message?: string; code?: number; shortMessage?: string }
  const m = (err?.shortMessage ?? err?.message ?? '').toLowerCase()
  if (err?.code === 4001 || m.includes('user rejected') || m.includes('denied')) return 'Transaction cancelled.'
  if (m.includes('insufficient funds') || m.includes('exceeds balance') || m.includes('transfer amount exceeds')) return 'Not enough testnet USDC. Use Get test USDC in the sidebar.'
  if (m.includes('toosoon')) return 'Leaderboard updates are limited to once per hour per wallet.'
  if (m.includes('soldout') || m.includes('sold out')) return 'That item is sold out.'
  if (m.includes('reverted')) return 'The transaction reverted. Please try again.'
  if (m.includes('network') || m.includes('timeout')) return 'Network issue. Check your connection and retry.'
  return 'Something went wrong. Please try again.'
}
