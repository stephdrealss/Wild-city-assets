import { useSyncExternalStore } from 'react'

export interface LoadState {
  pct: number
  label: string
  ready: boolean
  error: string | null
  /** models that could not be loaded and use the built-in placeholder instead */
  fallbacks: string[]
}

let state: LoadState = { pct: 0, label: 'Starting', ready: false, error: null, fallbacks: [] }
const subs = new Set<() => void>()

export function setLoad(p: Partial<LoadState>) {
  state = { ...state, ...p, pct: Math.max(state.pct, p.pct ?? state.pct) }
  if (p.ready === false && p.pct !== undefined && p.pct <= 2) state = { ...state, pct: p.pct, fallbacks: [] }
  subs.forEach((f) => f())
}
export function addFallback(file: string) {
  state = { ...state, fallbacks: [...state.fallbacks, file] }
  subs.forEach((f) => f())
}
export const useLoad = () =>
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => state,
  )
