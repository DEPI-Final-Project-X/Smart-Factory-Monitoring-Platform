import React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Select({ className, options = [], value, onChange, ...props }) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        className="h-11 w-full appearance-none rounded-2xl border border-white/10 bg-slate-950/60 px-4 pr-10 text-sm text-slate-100 outline-none transition duration-300 hover:border-violet-400/40 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-slate-950">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
    </div>
  )
}
