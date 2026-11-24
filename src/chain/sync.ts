/** Lets any component ask the wallet-ownership sync to re-read the chain after a transaction. */
let handler: () => void = () => undefined
export const setRefetchOwned = (fn: () => void) => {
  handler = fn
}
export const refetchOwned = () => handler()
