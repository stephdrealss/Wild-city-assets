# Wild City PH

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Wild City PH is a 3D street-life game (three.js) set in Wild City, with onchain ownership on Arc Testnet.

- Game code lives in `src/game/` (engine, world, characters, store) and UI in `src/ui/`. Chain code is in `src/chain/`.
- Characters: `src/game/humanoid.ts` builds the placeholder rigged humanoid (also exported to `public/models/*.glb` by `bun run models:generate`). `src/game/loader.ts` loads the GLBs (falls back to the built-in humanoid), `src/game/human.ts` wraps a model with an AnimationMixer, look and LOD helpers, `src/game/ambient.ts` runs NPCs (tiers: full, reduced rate, impostor, hidden) and traffic.
- Rendering: PBR materials in `src/game/batch.ts`, sun shadows and tone mapping in `src/game/engine.ts`.
- Guests play with in-game cash. Wallet NFTs mirror into game state via `useChainSync`.
- Contract addresses come from `VITE_WILDCITY_*` in `.env`. Restart the dev server after changing `.env`.

### Deployed contracts (Arc Testnet)

- WildCityProperty: 0xae6e416675e1dd9d11b312f5f74b80941f7a152c
- WildCityVehicle: 0x1d2d1720595293ea1879142bf9f9b6c21b191af9
- WildCityOutfit: 0xc2b46156225881b815c3238a4889b01aa9c023b3
- WildCityMarketplace: 0xf95a5ca16cef4e769dc795e088ae9999848c2a1a
- WildCityLeaderboard: 0x0bb80dea57228ccd88eaabcabd39721e613a0a07
- USDC: 0x3600000000000000000000000000000000000000. Owner of deployed contracts: platform deployer wallet.
