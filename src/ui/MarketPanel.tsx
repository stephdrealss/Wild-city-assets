import { useState } from 'react'
import { erc20Abi, erc721Abi, type Address } from 'viem'
import { useAccount, usePublicClient, useReadContract, useReadContracts } from 'wagmi'
import { CHAIN_ID, COLLECTIONS, MARKET, USDC_ADDRESS, short, type Kind } from '@/chain/contracts'
import { approveStep, useOwned } from '@/chain/hooks'
import { refetchOwned } from '@/chain/sync'
import { useRunTx, type Step } from '@/chain/tx'
import { OUTFITS, PROPERTIES, VEHICLES } from '@/game/data'
import { formatUsdc, parseUsdc } from '@/onchain-money'
import { Btn, Row, Sheet } from './kit'
import { ConnectKitButton } from 'connectkit'

interface Listing {
  seller: Address
  nft: Address
  tokenId: bigint
  price: bigint
}

const KINDS: Kind[] = ['property', 'vehicle', 'outfit']
const nameOf = (kind: Kind, typeId: number) => (kind === 'property' ? PROPERTIES[typeId]?.name : kind === 'vehicle' ? VEHICLES[typeId]?.name : OUTFITS[typeId]?.name) ?? `Item ${typeId}`
const kindOf = (nft: string): Kind | undefined => KINDS.find((k) => COLLECTIONS[k].address?.toLowerCase() === nft.toLowerCase())

export function MarketPanel({ title }: { title: string }) {
  const [tab, setTab] = useState<'browse' | 'sell'>('browse')
  if (!MARKET.address) {
    return (
      <Sheet title={title} subtitle="Player to player trading for properties, vehicles and outfits." accent="#38ffd0">
        <p className="glass-light mt-3 rounded-2xl p-4 text-sm text-white/80">The marketplace contract has not been deployed to Arc Testnet yet, so trading is switched off for now. Everything else in Wild City works.</p>
      </Sheet>
    )
  }
  return (
    <Sheet title={title} subtitle="Buy and sell NFTs with other players. Payments settle in testnet USDC." accent="#38ffd0">
      <div className="mb-2 mt-2 flex gap-2">
        {(['browse', 'sell'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`min-h-11 flex-1 rounded-xl text-sm font-bold capitalize ${tab === t ? 'bg-[#27c1a8] text-[#00221c]' : 'glass-light'}`}>
            {t === 'browse' ? 'Browse' : 'Sell'}
          </button>
        ))}
      </div>
      <ConnectGate>{tab === 'browse' ? <Browse /> : <Sell />}</ConnectGate>
    </Sheet>
  )
}

function ConnectGate({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount()
  if (isConnected) return <>{children}</>
  return (
    <div className="glass-light flex flex-col items-start gap-3 rounded-2xl p-4">
      <p className="text-sm text-white/80">Connect a wallet to trade. Guest mode only uses in-game cash.</p>
      <ConnectKitButton.Custom>{({ show }) => <Btn onClick={show}>Connect wallet</Btn>}</ConnectKitButton.Custom>
    </div>
  )
}

function Browse() {
  const { address } = useAccount()
  const client = usePublicClient({ chainId: CHAIN_ID })
  const run = useRunTx()
  const { data, refetch } = useReadContract({ address: MARKET.address, abi: MARKET.abi, functionName: 'getListings', args: [0n, 100n], chainId: CHAIN_ID, query: { refetchInterval: 15_000 } })
  const listings = ((data as Listing[] | undefined) ?? []).filter((l) => !!kindOf(l.nft))
  const types = useReadContracts({
    contracts: listings.map((l) => ({ address: l.nft, abi: COLLECTIONS[kindOf(l.nft)!].abi, functionName: 'typeOf', args: [l.tokenId], chainId: CHAIN_ID })) as never[],
    query: { enabled: listings.length > 0 },
  })

  if (!listings.length) return <p className="py-6 text-center text-sm text-white/60">No listings yet. Be the first to sell something.</p>
  return (
    <div className="flex flex-col gap-2">
      {listings.map((l, i) => {
        const kind = kindOf(l.nft)!
        const t = types.data?.[i]
        const typeId = t?.status === 'success' ? Number(t.result) : -1
        const mine = address?.toLowerCase() === l.seller.toLowerCase()
        return (
          <Row key={`${l.nft}-${l.tokenId}`} className="justify-between">
            <div className="min-w-0">
              <p className="font-bold leading-tight">{typeId >= 0 ? nameOf(kind, typeId) : '...'}</p>
              <p className="text-xs text-white/60">
                {COLLECTIONS[kind].noun} #{l.tokenId.toString()} by {short(l.seller)}
              </p>
            </div>
            {mine ? (
              <Btn
                small
                variant="ghost"
                onClick={async () => {
                  if (await run([{ label: 'Cancel listing', address: MARKET.address!, abi: MARKET.abi, functionName: 'cancel', args: [l.nft, l.tokenId] }])) void refetch()
                }}
              >
                Cancel
              </Btn>
            ) : (
              <Btn
                small
                variant="teal"
                onClick={async () => {
                  if (!address) return
                  const allowance = (await client?.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [address, MARKET.address!] })) ?? 0n
                  const steps: Step[] = []
                  if (allowance < l.price) steps.push(approveStep(MARKET.address!, l.price))
                  steps.push({ label: `Buy ${typeId >= 0 ? nameOf(kind, typeId) : 'NFT'}`, address: MARKET.address!, abi: MARKET.abi, functionName: 'buy', args: [l.nft, l.tokenId, l.price] })
                  if (await run(steps)) {
                    void refetch()
                    refetchOwned()
                  }
                }}
              >
                Buy {formatUsdc(l.price)} USDC
              </Btn>
            )}
          </Row>
        )
      })}
    </div>
  )
}

function Sell() {
  const { address } = useAccount()
  const client = usePublicClient({ chainId: CHAIN_ID })
  const run = useRunTx()
  const p = useOwned('property')
  const v = useOwned('vehicle')
  const o = useOwned('outfit')
  const [price, setPrice] = useState('1')
  const owned = [
    ...p.tokenIds.map((id, i) => ({ kind: 'property' as Kind, id, type: p.typeIds[i] })),
    ...v.tokenIds.map((id, i) => ({ kind: 'vehicle' as Kind, id, type: v.typeIds[i] })),
    ...o.tokenIds.map((id, i) => ({ kind: 'outfit' as Kind, id, type: o.typeIds[i] })),
  ]
  if (!owned.length) return <p className="py-6 text-center text-sm text-white/60">You do not own any NFTs yet. Mint a property, vehicle or outfit first.</p>
  return (
    <div className="flex flex-col gap-2">
      <label className="glass-light flex items-center justify-between gap-3 rounded-2xl p-3 text-sm">
        <span className="font-bold">Asking price (USDC)</span>
        <input
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
          className="tnum w-24 rounded-xl bg-white/10 px-3 py-2 text-right font-bold outline-none focus:ring-2 focus:ring-[#27c1a8]"
        />
      </label>
      {owned.map((it) => (
        <Row key={`${it.kind}-${it.id}`} className="justify-between">
          <div className="min-w-0">
            <p className="font-bold leading-tight">{nameOf(it.kind, it.type)}</p>
            <p className="text-xs text-white/60">
              {COLLECTIONS[it.kind].noun} #{it.id.toString()}
            </p>
          </div>
          <Btn
            small
            variant="teal"
            onClick={async () => {
              const c = COLLECTIONS[it.kind]
              if (!c.address || !address || !MARKET.address) return
              let raw: bigint
              try {
                raw = parseUsdc(price)
              } catch {
                return
              }
              if (raw <= 0n) return
              const approved = await client?.readContract({ address: c.address, abi: erc721Abi, functionName: 'isApprovedForAll', args: [address, MARKET.address] })
              const steps: Step[] = []
              if (!approved) steps.push({ label: 'Approve marketplace', address: c.address, abi: c.abi, functionName: 'setApprovalForAll', args: [MARKET.address, true] })
              steps.push({ label: `List ${nameOf(it.kind, it.type)}`, address: MARKET.address, abi: MARKET.abi, functionName: 'list', args: [c.address, it.id, raw] })
              await run(steps)
            }}
          >
            List for sale
          </Btn>
        </Row>
      ))}
      <p className="text-xs text-white/55">Tip: claim any property yield before you sell. Unclaimed yield stays as credit on your wallet.</p>
    </div>
  )
}
