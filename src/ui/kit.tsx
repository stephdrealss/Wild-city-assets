import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { closeModal } from '@/game/store'

export function Sheet({
  title,
  subtitle,
  onClose = closeModal,
  children,
  accent = '#ff2d9b',
  footer,
}: {
  title: string
  subtitle?: string
  onClose?: () => void
  children: ReactNode
  accent?: string
  footer?: ReactNode
}) {
  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="glass relative flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <div className="h-1 w-full" style={{ background: accent }} />
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold leading-tight text-balance">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-white/65 text-pretty">{subtitle}</p>}
          </div>
          <button aria-label="Close" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full glass-light hover:bg-white/15">
            <X size={18} />
          </button>
        </div>
        <div className="scroll-y min-h-0 flex-1 px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-white/10 px-5 py-3">{footer}</div>}
      </motion.div>
    </motion.div>
  )
}

export function Btn({
  children,
  onClick,
  variant = 'primary',
  disabled,
  className,
  small,
}: {
  children: ReactNode
  onClick?: () => void | Promise<void>
  variant?: 'primary' | 'ghost' | 'gold' | 'teal'
  disabled?: boolean
  className?: string
  small?: boolean
}) {
  return (
    <button
      onClick={() => void onClick?.()}
      disabled={disabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40',
        small ? 'min-h-11 px-3.5 text-sm' : 'min-h-12 px-5 text-[15px]',
        variant === 'primary' && 'bg-[#ff2d9b] text-white shadow-[0_6px_24px_-6px_#ff2d9b] hover:bg-[#ff4aab]',
        variant === 'gold' && 'bg-[#ffd12e] text-[#2a1d00] hover:bg-[#ffdb59]',
        variant === 'teal' && 'bg-[#27c1a8] text-[#00221c] hover:bg-[#3ad3ba]',
        variant === 'ghost' && 'glass-light text-white hover:bg-white/15',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="flex items-center gap-2" aria-label={`${label} ${Math.round(v)} percent`}>
      <div className="h-2.5 w-24 overflow-hidden rounded-full bg-white/15 sm:w-32">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${v}%`, background: v < 20 ? '#ff4d4d' : color }} />
      </div>
    </div>
  )
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('glass-light flex items-center gap-3 rounded-2xl p-3', className)}>{children}</div>
}

export function Tag({ children, color = '#ffffff22' }: { children: ReactNode; color?: string }) {
  return (
    <span className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white/90" style={{ background: color }}>
      {children}
    </span>
  )
}
