import React from 'react'
import {
  Activity,
  Bell,
  BrainCircuit,
  LineChart,
  Siren,
  Wrench,
  Sparkles,
  Gauge
} from 'lucide-react'

const tabs = [
  { key: 'prediction', label: 'Prediction', icon: Sparkles },
  { key: 'analysis', label: 'Data Analysis', icon: LineChart },
  { key: 'assistant', label: 'AI Assistant', icon: BrainCircuit },
  { key: 'machines', label: 'Machine Management', icon: Wrench },
  { key: 'monitor', label: 'Live Monitor', icon: Activity },
  { key: 'alerts', label: 'Alerts', icon: Bell }
]

export function TabsNav({ activeTab, onChange }) {
  return (
    <div className="glass-card relative overflow-hidden p-3">
      <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-transparent to-cyan-400/5" />
      <div className="relative flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange(tab.key)}
              className={`group relative inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-300 ${
                isActive
                  ? 'bg-violet-500/10 text-violet-100 shadow-[0_0_0_1px_rgba(139,92,246,0.18)]'
                  : 'text-slate-400 hover:bg-white/6 hover:text-white'
              }`}
            >
              <Icon className={`h-4 w-4 transition ${isActive ? 'text-violet-300' : 'text-slate-500 group-hover:text-slate-300'}`} />
              <span>{tab.label}</span>
              <span
                className={`absolute inset-x-4 bottom-1 h-[2px] rounded-full bg-gradient-to-r from-cyan-400 to-violet-500 transition-all duration-300 ${
                  isActive ? 'opacity-100 shadow-[0_0_18px_rgba(139,92,246,0.75)]' : 'opacity-0'
                }`}
              />
            </button>
          )
        })}
        <div className="ml-auto hidden items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-2 text-xs text-slate-400 lg:flex">
          <Gauge className="h-4 w-4 text-emerald-300" />
          UI Only · Mock Data · No Backend
        </div>
      </div>
    </div>
  )
}
