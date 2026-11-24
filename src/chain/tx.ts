import { useCallback, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { Abi, Address } from 'viem'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { CHAIN_ID, parseOnchainError } from './contracts'

export interface TxEntry {
  hash: string
  label: string
  status: 'pending' | 'success' | 'failed'
  at: number
}
export interface Step {
  label: string
  address: Address
  abi: Abi
  functionName: string
  args?: readonly unknown[]
}

let log: TxEntry[] = []
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const sub = (f: () => void) => {
  subs.add(f)
  return () => subs.delete(f)
}
export const useTxLog = () => useSyncExternalStore(sub, () => log)

function push(e: TxEntry) {
  log = [e, ...log].slice(0, 20)
  emit()
}
function patch(hash: string, status: TxEntry['status']) {
  log = log.map((e) => (e.hash === hash ? { ...e, status } : e))
  emit()
}

/** Runs transactions in order, waits for each receipt, and links every hash to the Arc explorer. */
export function useRunTx() {
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const client = usePublicClient({ chainId: CHAIN_ID })

  return useCallback(
    async (steps: Step[]): Promise<boolean> => {
      if (!address) {
        toast.error('Connect a wallet first')
        return false
      }
      try {
        if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID })
        for (const step of steps) {
          const toastId = toast.loading(`${step.label}: confirm in your wallet`)
          const hash = await writeContractAsync({
            address: step.address,
            abi: step.abi,
            functionName: step.functionName,
            args: step.args as unknown[] | undefined,
            chainId: CHAIN_ID,
          })
          push({ hash, label: step.label, status: 'pending', at: Date.now() })
          toast.loading(`${step.label}: confirming`, { id: toastId })
          const receipt = await client?.waitForTransactionReceipt({ hash })
          if (receipt && receipt.status !== 'success') {
            patch(hash, 'failed')
            toast.error(`${step.label} failed`, { id: toastId })
            return false
          }
          patch(hash, 'success')
          const url = buildTxExplorerUrl(CHAIN_ID, hash)
          toast.success(`${step.label} confirmed`, {
            id: toastId,
            action: { label: 'View on explorer', onClick: () => window.open(url, '_blank', 'noopener,noreferrer') },
            duration: 9000,
          })
        }
        return true
      } catch (e) {
        const msg = parseOnchainError(e)
        if (msg === 'Transaction cancelled.') toast('Transaction cancelled')
        else toast.error(msg)
        return false
      }
    },
    [address, chainId, switchChainAsync, writeContractAsync, client],
  )
}
