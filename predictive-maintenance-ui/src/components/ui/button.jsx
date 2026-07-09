import React from 'react'
import { cn } from '../../lib/utils'

const variants = {
  default:
    'bg-violet-500 text-white hover:bg-violet-400 shadow-[0_12px_30px_rgba(139,92,246,0.35)] hover:shadow-[0_16px_34px_rgba(139,92,246,0.42)]',
  secondary:
    'bg-white/8 text-slate-100 hover:bg-white/12 border border-white/10',
  ghost:
    'bg-transparent text-slate-300 hover:bg-white/8 hover:text-white',
  danger:
    'bg-rose-500/90 text-white hover:bg-rose-400'
}

export function Button({ className, variant = 'default', children, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
