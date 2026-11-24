# Wild City PH

A 3D street-life game set in Wild City, a bright West African-inspired coastal city. Start with nothing, hustle on the streets, buy a ride and a home, open your own shop, and trade properties, vehicles and outfits as NFTs with testnet USDC on Arc Testnet. Playable on desktop and mobile, with a guest mode that needs no wallet.

Built with [Arc Studio](https://studio.arc.io)

## Features

- Third-person 3D city with market, plaza, beachfront, residential and downtown districts, day and night, buses, okadas, kekes and street life.
- Jobs as short mini-games: food delivery, market stall selling, bus conductor, phone repair and night DJ gigs.
- Needs (energy and hunger), reputation levels that unlock jobs and districts, homes, vehicles, outfits and businesses with passive income.
- Onchain (Arc Testnet): property, vehicle and outfit NFTs bought with testnet USDC, daily property yield, a player marketplace and a weekly leaderboard. Every onchain action links to the Arc explorer.
- Realistic-style rigged humans loaded from `.glb` files, with smooth idle, walk, run, jump, sit, talk and driving animations. Varied NPCs (ankara prints, casual wear, work uniforms, market traders) walk routes, chat in groups and react to you. Drop your own models into `public/models/` (see `public/models/README.md`).
- Sun and soft shadows, PBR materials, detailed buildings, roads, vehicles and market stalls, with level-of-detail for distant people so it stays smooth on phones.
- Guest mode with in-game cash only. Connect a wallet for ownership, trading and the leaderboard.

## Tech stack

React, TypeScript, Vite, Tailwind CSS, three.js (GLTFLoader, AnimationMixer), wagmi, viem, ConnectKit, Solidity (Foundry, OpenZeppelin).

## Deploying

The project builds to static files with `bun run build` (output folder `dist/`). `vercel.json` sets the build command, output folder, caching and single-page routing. Character models in `public/models/` and the texture transcoder in `public/basis/` are copied into the build. Music and sound effects are generated in the browser, so there are no audio files to host. If a model file is missing, the game shows a loading screen note and uses simple placeholder people instead of failing.

## Development

Prerequisites: Bun and Foundry.

```bash
bun install
bun run dev
```

Other scripts: `bun run build` (production build into `dist/`), `bun run preview`, `bun run models:generate` (rebuild the placeholder `.glb` models), `bun run check` (lint and typecheck), `bun run contracts:build`, `bun run contracts:test`.

### Controls

WASD or arrow keys to move, Shift to run, Space to jump, drag to look around, E to interact, V to ride or dismount. On mobile use the joystick and the on-screen buttons.

### Environment variables

All optional. Each holds the address of a deployed contract on Arc Testnet and overrides the built-in default, which already points at the current deployment. This means a static host such as Vercel works without setting any variables.

- `VITE_WILDCITY_PROPERTY`: property NFT contract.
- `VITE_WILDCITY_VEHICLE`: vehicle NFT contract.
- `VITE_WILDCITY_OUTFIT`: outfit NFT contract.
- `VITE_WILDCITY_MARKET`: marketplace contract.
- `VITE_WILDCITY_LEADERBOARD`: leaderboard contract.
- `VITE_PLAYER_ASSETS_URL`: base URL for `player.glb` and the animation files. Fallback used when a file is not in `public/models/`. Defaults to the GitHub CDN folder `https://cdn.jsdelivr.net/gh/stephdrealss/wild-city-assets@main/`.
