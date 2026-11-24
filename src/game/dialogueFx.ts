import { toast } from 'sonner'
import type { DlgCtx, Fx } from './dialogue'
import { engineRef } from './ref'
import { MARKET_GOODS } from './data'
import { marketPay, usdcFor } from '@/chain/pay'
import { addToBag, completeMission, earn, fmtCash, getState, setState, spend, startMission } from './store'

/** Applies the game effects of a dialogue choice: tips, discounts, gigs, directions, missions. */
export function applyFx(list: Fx[] | undefined, ctx: DlgCtx) {
  for (const f of list ?? []) {
    switch (f.t) {
      case 'cash':
        earn(f.n, 0, `${ctx.name} gave you ${fmtCash(f.n)}`)
        break
      case 'pay':
        if (spend(f.n)) toast(`You paid ${fmtCash(f.n)}`, { description: `To ${ctx.name}` })
        break
      case 'buy':
        // with a wallet connected, the seller is paid in real testnet USDC on Arc
        if (marketPay.active) {
          const usdc = usdcFor(f.n * 100)
          const id = f.id
          void marketPay.pay(usdc, `Pay ${ctx.name} ${usdc.toFixed(2)} USDC for ${MARKET_GOODS[id].name.toLowerCase()}`).then((ok) => {
            if (!ok) return
            const e = engineRef.current
            if (e) e.handOver(ctx.npcId, id, () => addToBag(id), 0.3)
            else addToBag(id)
          })
          break
        }
        if (spend(f.n)) {
          // she sees it change hands: from the seller's hand to hers, then into her nylon bag
          const e = engineRef.current
          // a beat for her to finish speaking and the seller to answer "here, collect"
          if (e) e.handOver(ctx.npcId, f.id, () => addToBag(f.id), 2.6)
          else addToBag(f.id)
        }
        break
      case 'taste': {
        const e = engineRef.current
        const enjoy = () => {
          setState((st) => ({ energy: Math.min(100, st.energy + 3), hunger: Math.min(100, st.hunger + 2) }))
          toast.success('Sweet orange!', { description: 'Energy +3' })
        }
        if (e) e.taste(ctx.npcId, enjoy, 2.4)
        else enjoy()
        break
      }
      case 'rep':
        earn(0, f.n, 'Respect earned')
        break
      case 'energy':
        setState((s) => ({ energy: Math.min(100, s.energy + f.n) }))
        toast.success('You feel refreshed', { description: `Energy +${f.n}` })
        break
      case 'hunger':
        setState((s) => ({ hunger: Math.min(100, s.hunger + f.n) }))
        toast.success('You ate a little', { description: `Hunger +${f.n}` })
        break
      case 'discount':
        setState((s) => ({ discount: { pct: f.pct, day: s.day } }))
        toast.success(`${f.pct}% off food today`, { description: 'Applies at every food stall.' })
        break
      case 'gig':
        if (getState().energy < f.energy) {
          toast.error('You are too tired for this', { description: `Needs ${f.energy} energy.` })
        } else {
          setState((s) => ({ energy: s.energy - f.energy }))
          earn(f.pay, f.rep, `Gig done for ${ctx.name}`)
        }
        break
      case 'guide': {
        const p = engineRef.current?.nearestPoi(f.kind)
        if (p) {
          setState({ guide: { label: p.label, x: p.x, z: p.z } })
          toast('Directions set', { description: `${p.label} is marked on your map.` })
        }
        break
      }
      case 'mission':
        startMission(f.id)
        ctx.missions[f.id] = 'active'
        break
      case 'complete':
        completeMission(f.id)
        ctx.missions[f.id] = 'done'
        break
      case 'help':
        setState((s) => ({ energy: Math.max(0, s.energy - 5), helped: { ...s.helped, [ctx.npcId]: s.day } }))
        ctx.helpedToday = true
        earn(20 + Math.floor(Math.random() * 30), 2, `You helped ${ctx.name}`)
        break
      case 'flag':
        ctx.flags.push(f.daily ? `${f.f}@${ctx.day}` : f.f)
        break
    }
  }
}
