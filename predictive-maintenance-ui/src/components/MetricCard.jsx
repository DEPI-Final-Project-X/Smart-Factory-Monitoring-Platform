import React from 'react'

export function MetricCard({ title, value, subtitle, icon: Icon, tone = 'violet' }) {
  const tones = {
    violet: 'from-violet-500/20 to-transparent text-violet-200',
    cyan: 'from-cyan-400/20 to-transparent text-cyan-200',
    rose: 'from-rose-400/20 to-transparent text-rose-200',
    emerald: 'from-emerald-400/20 to-transparent text-emerald-200'
  }

  return (
    <div className="glass-card relative overflow-hidden p-5">
      <div className={`absolute inset-0 bg-gradient-to-br ${tones[tone]}`} />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  )
}
