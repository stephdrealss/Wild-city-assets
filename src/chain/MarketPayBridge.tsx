import { useEffect } from 'react'
import { parseUnits } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { CHAIN_ID, COLLECTIONS, USDC_ADDRESS } from './contracts'
import { ERC20_TRANSFER_ABI, marketPay } from './pay'
import { useRunTx } from './tx'

/** Connects in-game market purchases to the player's wallet: a USDC transfer on Arc Testnet to the market wallet. */
export function MarketPayBridge() {
  const { isConnected } = useAccount()
  const run = useRunTx()
  // the game owner's wallet receives market payments
  const { data: owner } = useReadContract({
    address: COLLECTIONS.property.address,
    abi: COLLECTIONS.property.abi,
    functionName: 'owner',
    chainId: CHAIN_ID,
    query: { enabled: !!COLLECTIONS.property.address },
  })
  useEffect(() => marketPay.setTreasury(owner as string | undefined), [owner])
  useEffect(() => {
    marketPay.set(
      (usdc, label) =>
        run([
          {
            label,
            address: USDC_ADDRESS,
            abi: ERC20_TRANSFER_ABI,
            functionName: 'transfer',
            // the ERC-20 view of USDC on Arc uses 6 decimals
            args: [marketPay.treasury, parseUnits(usdc.toFixed(2), 6)],
          },
        ]),
      isConnected,
    )
    return () => marketPay.set(null, false)
  }, [run, isConnected, owner])
  return null
}
