/**
 * Pays players their Wild City earnings in USDC on Arc Testnet, from the game's payout wallet.
 *
 *   GET  /api/payout                       -> { enabled, address }  (the payout wallet, so it can be topped up)
 *   POST /api/payout  { to, amount }       -> { hash, usdc }        amount is in game units (200 = 1 USDC)
 *
 * The payout wallet's key stays on the server (Vercel env var PAYOUT_PRIVATE_KEY). Without it, payouts are off.
 * Testnet money only, so the guard is simple: at most 2 USDC per claim, one claim per wallet every 10 minutes.
 */
import { createWalletClient, createPublicClient, http, parseUnits, isAddress, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { arcTestnet } from 'viem/chains'

const USDC = '0x3600000000000000000000000000000000000000' as Address
const PER_UNIT = 0.005
const MAX_USDC = 2
const GAP_MS = 10 * 60_000
const last = new Map<string, number>()

const ABI = [
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
] as const

function account() {
  const k = (process.env.PAYOUT_PRIVATE_KEY || '').trim()
  if (!/^0x[0-9a-fA-F]{64}$/.test(k)) return null
  return privateKeyToAccount(k as `0x${string}`)
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

export async function GET() {
  const a = account()
  return json({ enabled: !!a, address: a?.address ?? null, maxUsdc: MAX_USDC })
}

export async function POST(request: Request) {
  const a = account()
  if (!a) return json({ error: 'payouts-off' }, 503)
  let body: { to?: string; amount?: number }
  try {
    body = await request.json()
  } catch {
    return json({ error: 'bad-request' }, 400)
  }
  const to = String(body.to || '')
  const units = Math.floor(Number(body.amount) || 0)
  if (!isAddress(to) || units <= 0) return json({ error: 'bad-request' }, 400)
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'ip'
  const now = Date.now()
  for (const key of [to.toLowerCase(), ip]) {
    const t = last.get(key)
    if (t && now - t < GAP_MS) return json({ error: 'too-soon', waitMs: GAP_MS - (now - t) }, 429)
  }
  const usdc = Math.min(MAX_USDC, Math.round(units * PER_UNIT * 100) / 100)
  if (usdc < 0.01) return json({ error: 'too-small' }, 400)
  try {
    const wallet = createWalletClient({ account: a, chain: arcTestnet, transport: http() })
    const pub = createPublicClient({ chain: arcTestnet, transport: http() })
    const hash = await wallet.writeContract({ address: USDC, abi: ABI, functionName: 'transfer', args: [to as Address, parseUnits(usdc.toFixed(2), 6)] })
    last.set(to.toLowerCase(), now)
    last.set(ip, now)
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 25_000 }).catch(() => null)
    if (receipt && receipt.status !== 'success') return json({ error: 'failed', hash }, 502)
    return json({ hash, usdc, paidUnits: Math.round(usdc / PER_UNIT) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return json({ error: /insufficient|exceeds balance/i.test(msg) ? 'wallet-empty' : 'failed' }, 502)
  }
}
