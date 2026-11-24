import type { Abi, Address } from 'viem'

/**
 * Paying market sellers in testnet USDC on Arc. Game code (outside React) calls `marketPay`; a small React component
 * (`MarketPayBridge`) wires it to the connected wallet. Without a wallet, or without a market wallet configured, the
 * game falls back to in-game cash.
 */

/** naira per USDC, from the late-2026 rate (about ₦1,330 official, ₦1,380 parallel) */
export const NAIRA_PER_USDC = 1350

/**
 * Where market payments go: the Wild City market wallet. When none is configured, the game owner's wallet (the
 * owner of the Wild City contracts on Arc) is used, read from the chain.
 */
export const MARKET_TREASURY = ((import.meta.env.VITE_MARKET_TREASURY as string | undefined) || '').trim() as Address | ''
let treasury: string = MARKET_TREASURY
const isAddr = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a) && !/^0x0{40}$/.test(a)

export const usdcFor = (naira: number) => Math.max(0.01, Math.round((naira / NAIRA_PER_USDC) * 100) / 100)

export const ERC20_TRANSFER_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const satisfies Abi

type PayFn = (usdc: number, label: string) => Promise<boolean>
let impl: PayFn | null = null
let connected = false

export const marketPay = {
  /** true when a wallet is connected and a market wallet is known, so buying uses USDC */
  get active() {
    return connected && !!impl && isAddr(treasury)
  },
  get connected() {
    return connected
  },
  get treasury() {
    return treasury as Address
  },
  setTreasury(a: string | undefined) {
    if (!isAddr(MARKET_TREASURY) && a && isAddr(a)) treasury = a
  },
  set(fn: PayFn | null, isConnected: boolean) {
    impl = fn
    connected = isConnected
  },
  pay(usdc: number, label: string) {
    return impl ? impl(usdc, label) : Promise.resolve(false)
  },
}
