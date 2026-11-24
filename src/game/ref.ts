import type { Engine } from './engine'

/** The live engine instance, set by the canvas component. */
export const engineRef: { current: Engine | null } = { current: null }
