import { ConnectKitButton } from 'connectkit'
import { Check, Gem, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { CHAIN_ID, COLLECTIONS, USDC_ADDRESS, type CatalogItem, type Kind } from '@/chain/contracts'
import { approveStep, useCatalog } from '@/chain/hooks'
import { refetchOwned } from '@/chain/sync'
import { useRunTx } from '@/chain/tx'
import { formatUsdc } from '@/onchain-money'
import { Btn, Tag } from './kit'

export function MintButton({ kind, item, owned }: { kind: Kind; item?: CatalogItem; owned: boolean }) {
  const { isConnected, address } = useAccount()
  const client = usePublicClient({ chainId: CHAIN_ID })
  const run = useRunTx()
  const c = COLLECTIONS[kind]
  if (!c.address) return null
  if (owned)
    return (
      <Tag color="#27c1a844">
        <Check size={11} className="mr-1 inline" />
        NFT owned
      </Tag>
    )
  const soldOut = item ? item.minted >= item.maxSupply || !item.active : false
  const label = item ? `Mint ${formatUsdc(item.price)} USDC` : 'Mint NFT'
  return (
    <ConnectKitButton.Custom>
      {({ show }) => (
        <Btn
          small
          variant="teal"
          disabled={!item || soldOut}
          onClick={async () => {
            if (!isConnected || !address) return show?.()
            if (!item || !c.address) return
            const allowance = (await client?.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [address, c.address] })) ?? 0n
            const steps = []
            if (allowance < item.price) steps.push(approveStep(c.address, item.price))
            steps.push({ label: `Mint ${item.name}`, address: c.address, abi: c.abi, functionName: 'buy', args: [BigInt(item.id)] })
            if (await run(steps)) refetchOwned()
          }}
        >
          {isConnected ? <Gem size={15} /> : <Wallet size={15} />}
          {soldOut ? 'Sold out' : isConnected ? label : 'Connect to mint'}
        </Btn>
      )}
    </ConnectKitButton.Custom>
  )
}

export interface AssetRow {
  id: number
  name: string
  blurb: string
  cash: number
  swatch: string
  ownedLocal: boolean
  ownedChain: boolean
  tag?: string
  extra?: ReactNode
  yieldText?: string
}

/** homes, rides and outfits are bought in USDC only: minted onchain on Arc */
export function AssetList({ kind, rows }: { kind: Kind; rows: AssetRow[]; onCash?: (id: number) => void }) {
  const cat = useCatalog(kind, rows.length)
  return (
    <div className="flex flex-col gap-2.5 pt-2">
      {rows.map((r) => {
        const item = cat.items[r.id]
        return (
          <div key={r.id} className="glass-light flex flex-col gap-2.5 rounded-2xl p-3">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 shrink-0 rounded-xl" style={{ background: r.swatch, boxShadow: `inset 0 -8px 16px #0004` }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="font-display font-bold leading-tight">{r.name}</p>
                  {r.tag && <Tag>{r.tag}</Tag>}
                </div>
                <p className="text-sm text-white/65 text-pretty">{r.blurb}</p>
                {r.yieldText && <p className="tnum mt-0.5 text-xs font-bold text-[#38ffd0]">{r.yieldText}</p>}
                {kind === 'property' && item && item.param > 0n && (
                  <p className="tnum text-xs font-bold text-[#7be0ff]">NFT yield: {formatUsdc(item.param)} USDC per day, claimable onchain</p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {r.ownedLocal || r.ownedChain ? (
                <Tag color="#ffffff22">
                  <Check size={11} className="mr-1 inline" />
                  Yours
                </Tag>
              ) : null}
              <MintButton kind={kind} item={item} owned={r.ownedChain} />
              {r.extra}
            </div>
          </div>
        )
      })}
    </div>
  )
}
