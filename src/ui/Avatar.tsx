import { DEFAULT_OUTFIT, OUTFITS } from '@/game/data'
import type { Wearing } from '@/game/store'

/** Flat portrait of the Wild City PH face: bob, cat-eye glasses, hoops and the signature jacket. */
export function Avatar({ wearing, size = 200 }: { wearing?: Wearing; size?: number }) {
  const o = OUTFITS.find((x) => x.id === wearing?.outfit)
  const top = o?.top ?? DEFAULT_OUTFIT.top
  const accent = o?.accent ?? '#111'
  const dark = '#d41a80'
  const isDefault = !o
  const hair = '#0b0b10'
  const puffs = wearing?.hair === 6
  const braids = wearing?.hair === 7
  const curls = wearing?.hair === 8
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 200 240" role="img" aria-label="Wild City PH character portrait">
      <defs>
        <radialGradient id="av-bg" cx="50%" cy="35%" r="75%">
          <stop offset="0" stopColor="#ff7cc4" />
          <stop offset="1" stopColor="#6a2bd9" />
        </radialGradient>
        <linearGradient id="av-skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#bf7d49" />
          <stop offset="1" stopColor="#a25f33" />
        </linearGradient>
      </defs>
      <rect width="200" height="240" rx="28" fill="url(#av-bg)" />
      {/* back hair */}
      {braids ? (
        <g fill={hair}>
          {[48, 60, 72, 128, 140, 152].map((x) => (
            <rect key={x} x={x - 4} y="90" width="8" height="140" rx="4" />
          ))}
          <ellipse cx="100" cy="92" rx="56" ry="50" />
        </g>
      ) : curls ? (
        <g fill={hair}>
          <circle cx="100" cy="80" r="62" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <circle key={i} cx={100 + Math.cos(i * 0.8) * 58} cy={82 + Math.sin(i * 0.8) * 50} r="16" />
          ))}
        </g>
      ) : (
        <path d="M44 108 C42 40 158 40 156 108 L162 172 L128 172 L128 126 L72 126 L72 172 L38 172 Z" fill={hair} />
      )}
      {puffs && (
        <g fill={hair}>
          <circle cx="52" cy="48" r="26" />
          <circle cx="148" cy="48" r="26" />
        </g>
      )}
      {/* jacket */}
      <path d="M14 240 C14 196 52 176 100 176 C148 176 186 196 186 240 Z" fill={top} />
      {isDefault && (
        <>
          <path d="M62 158 L98 164 L98 214 L54 196 Z" fill={top} stroke={dark} strokeWidth="2" />
          <path d="M138 158 L102 164 L102 214 L146 196 Z" fill={top} stroke={dark} strokeWidth="2" />
          <rect x="98.5" y="164" width="3" height="76" fill="#0a0a0a" />
          <rect x="95" y="192" width="10" height="9" rx="2" fill="#cfd5de" />
        </>
      )}
      {!isDefault && <path d="M70 176 Q100 200 130 176" stroke={accent} strokeWidth="6" fill="none" />}
      {wearing?.acc === 9 && <path d="M70 182 Q100 214 130 182" stroke="#ffcc33" strokeWidth="3" fill="none" />}
      {/* neck + face */}
      <rect x="84" y="140" width="32" height="40" rx="10" fill="#9a5e36" />
      <ellipse cx="100" cy="106" rx="41" ry="50" fill="url(#av-skin)" />
      {/* hair front */}
      {!braids && !curls && (
        <g fill={hair}>
          <path d="M52 114 C48 58 92 46 100 54 C98 80 78 102 52 114 Z" />
          <path d="M148 114 C152 58 108 46 100 54 C102 80 122 102 148 114 Z" />
          <path d="M44 100 C44 62 64 50 82 48 L100 52 C70 56 56 90 58 170 L40 172 Z" />
          <path d="M156 100 C156 62 136 50 118 48 L100 52 C130 56 144 90 142 170 L160 172 Z" />
        </g>
      )}
      {(braids || curls) && <path d="M52 108 C50 56 90 46 100 52 C98 78 78 98 52 108 Z M148 108 C150 56 110 46 100 52 C102 78 122 98 148 108 Z" fill={hair} />}
      {wearing?.acc === 10 && (
        <g fill="#ffd12e">
          <ellipse cx="100" cy="62" rx="62" ry="10" />
          <path d="M56 62 L62 28 Q100 18 138 28 L144 62 Z" />
        </g>
      )}
      {/* brows */}
      <path d="M62 94 Q76 80 94 92" stroke="#150e0c" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <path d="M106 92 Q124 80 138 94" stroke="#150e0c" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <ellipse cx="78" cy="108" rx="5" ry="3.6" fill="#1b1210" />
      <ellipse cx="122" cy="108" rx="5" ry="3.6" fill="#1b1210" />
      {/* cat-eye glasses */}
      <g stroke="#0a0a0a" strokeWidth="4" fill="rgba(20,20,30,0.08)" strokeLinejoin="round">
        <path d="M58 100 L52 91 L74 96 L92 101 Q94 120 78 122 Q60 122 58 100 Z" />
        <path d="M142 100 L148 91 L126 96 L108 101 Q106 120 122 122 Q140 122 142 100 Z" />
        <path d="M92 104 Q100 99 108 104" fill="none" />
      </g>
      <path d="M96 116 Q100 128 104 116" stroke="#8a512f" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* lips */}
      <path d="M85 139 Q100 131 115 139 Q100 152 85 139 Z" fill="#8f4b3a" />
      <ellipse cx="100" cy="142" rx="7" ry="1.8" fill="#dcab97" />
      {/* hoops */}
      <circle cx="54" cy="132" r="9.5" fill="none" stroke="#e3e8f0" strokeWidth="2.6" />
      <circle cx="146" cy="132" r="9.5" fill="none" stroke="#e3e8f0" strokeWidth="2.6" />
    </svg>
  )
}
