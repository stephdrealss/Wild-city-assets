import { useEffect, useMemo } from 'react'
import { erc20Abi, type Address } from 'viem'
import { useAccount, useReadContract, useReadContracts } from 'wagmi'
import { setState } from '@/game/store'
import { COLLECTIONS, CHAIN_ID, USDC_ADDRESS, type CatalogItem, type Kind } from './contracts'
import { setRefetchOwned } from './sync'
import type { Step } from './tx'

interface RawType {
  name: string
  price: bigint
  param: bigint
  maxSupply: number
  minted: number
  category: number
  active: boolean
}

export function useCatalog(kind: Kind, count: number) {
  const c = COLLECTIONS[kind]
  const contracts = useMemo(
    () =>
      c.address
        ? Array.from({ length: count }, (_, i) => ({ address: c.address as Address, abi: c.abi, functionName: 'getType', args: [BigInt(i)], chainId: CHAIN_ID })) as never[]
        : [],
    [c.address, c.abi, count],
  )
  const { data, refetch, isLoading } = useReadContracts({ contracts, query: { enabled: !!c.address, staleTime: 20_000 } })
  const items: (CatalogItem | undefined)[] = (data ?? []).map((r, i) =>
    r.status === 'success' ? { id: i, ...(r.result as RawType) } : undefined,
  )
  return { items, refetch, isLoading }
}

export function useOwned(kind: Kind) {
  const { address } = useAccount()
  const c = COLLECTIONS[kind]
  const { data, refetch } = useReadContract({
    address: c.address,
    abi: c.abi,
    functionName: 'tokensOfOwner',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address && !!c.address, refetchInterval: 15_000 },
  })
  const [tokenIds, typeIds] = (data as [bigint[], bigint[]] | undefined) ?? [[], []]
  return { tokenIds, typeIds: typeIds.map(Number), refetch }
}

/** Mirrors wallet-owned NFTs into the game state so ownership unlocks gameplay. */
export function useChainSync() {
  const { address, isConnected } = useAccount()
  const p = useOwned('property')
  const v = useOwned('vehicle')
  const o = useOwned('outfit')
  const key = `${isConnected}|${address}|${p.typeIds.join()}|${v.typeIds.join()}|${o.typeIds.join()}`
  useEffect(() => {
    setState({
      chain: isConnected
        ? { properties: Array.from(new Set(p.typeIds)), vehicles: Array.from(new Set(v.typeIds)), outfits: Array.from(new Set(o.typeIds)) }
        : { properties: [], vehicles: [], outfits: [] },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  useEffect(() => {
    setRefetchOwned(() => {
      void p.refetch()
      void v.refetch()
      void o.refetch()
    })
  })
}

export function useUsdcBalance() {
  const { address } = useAccount()
  const { data, refetch } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 12_000 },
  })
  return { balance: data, refetch }
}

export function useAllowance(spender: Address | undefined) {
  const { address } = useAccount()
  const { data, refetch } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && spender ? [address, spender] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address && !!spender },
  })
  return { allowance: (data) ?? 0n, refetch }
}

export const approveStep = (spender: Address, amount: bigint): Step => ({
  label: 'Approve USDC',
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: 'approve',
  args: [spender, amount],
})
