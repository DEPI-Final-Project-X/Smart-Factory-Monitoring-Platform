import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Shield,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip as RechartTooltip,
} from 'recharts'
import { fetchMonitor } from '../services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

const POLL_INTERVAL_MS = 8000 // refresh every 8 s

// ── colour maps ──────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  Critical: {
    badge: 'border-rose-400/25 bg-rose-500/10 text-rose-300',
    dot: 'bg-rose-400',
    row: 'hover:bg-rose-500/5',
  },
  Warning: {
    badge: 'border-amber-400/25 bg-amber-500/10 text-amber-300',
    dot: 'bg-amber-400',
    row: 'hover:bg-amber-500/5',
  },
  Healthy: {
    badge: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300',
    dot: 'bg-emerald-400',
    row: 'hover:bg-emerald-500/5',
  },
}

const SENSOR_COLORS = {
  volt: '#a78bfa',
  rotate: '#22d3ee',
  pressure: '#fb923c',
  vibration: '#f472b6',
}

// ── sub-components ───────────────────────────────────────────────────────────

function FleetCard({ label, value, sub, icon: Icon, tone }) {
  const tones = {
    violet: 'text-violet-300 bg-violet-500/10',
    emerald: 'text-emerald-300 bg-emerald-500/10',
    amber:   'text-amber-300  bg-amber-500/10',
    rose:    'text-rose-300   bg-rose-500/10',
    cyan:    'text-cyan-300   bg-cyan-500/10',
  }
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5">
      <div className="flex items-center gap-3">
        <div className={`rounded-2xl p-2.5 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-[0.14em]">{label}</p>
          <p className="text-2xl font-semibold text-slate-100 leading-tight mt-0.5">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  )
}

function Sparkline({ data, color }) {
  const series = (data ?? []).map((v, i) => ({ i, v }))
  return (
    <div style={{ width: 96, height: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.5} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sg-${color.replace('#', '')})`}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function RiskBar({ value }) {
  const pct = Math.round(value * 100)
  const color =
    pct >= 75 ? 'bg-rose-500' : pct >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-400 tabular-nums">{pct}%</span>
    </div>
  )
}

function TelemetryPill({ label, value, unit, color }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-slate-900/60 px-2 py-0.5 text-xs"
      style={{ color }}
    >
      <span className="text-slate-500">{label}</span>
      <span className="font-medium">{typeof value === 'number' ? value.toFixed(value < 10 ? 3 : 1) : value}</span>
      <span className="text-slate-600">{unit}</span>
    </span>
  )
}

// ── main component ───────────────────────────────────────────────────────────

export function LiveMonitor() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [lastTick, setLastTick] = useState(null)
  const [connected, setConnected] = useState(false)
  const timerRef = useRef(null)

  const poll = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    setError('')
    try {
      const res = await fetchMonitor()
      setData(res)
      setLastTick(new Date())
      setConnected(true)
    } catch (err) {
      setError(err.message ?? 'Cannot reach backend')
      setConnected(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // initial load + recurring poll
  useEffect(() => {
    poll(true)
    timerRef.current = setInterval(() => poll(false), POLL_INTERVAL_MS)
    return () => clearInterval(timerRef.current)
  }, [poll])

  const fleet = data?.fleet_summary ?? {}
  const machines = data?.machines ?? []

  return (
    <div className="space-y-6">
      {/* ── header bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${
            connected
              ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-400/20 bg-rose-500/10 text-rose-300'
          }`}>
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected ? 'Live · polling every 8 s' : 'Disconnected'}
          </div>
          {lastTick && (
            <span className="text-xs text-slate-500">
              Last updated {lastTick.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={() => poll(true)}
          disabled={loading}
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 transition hover:bg-white/8 disabled:opacity-50"
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </button>
      </div>

      {/* ── error ── */}
      {error && (
        <p className="flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {/* ── fleet KPI cards ── */}
      {loading && !data ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-3" /> Loading telemetry…
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <FleetCard label="Total Machines"  value={fleet.total   ?? '—'} icon={Activity}     tone="violet" />
            <FleetCard label="Critical"        value={fleet.critical ?? 0}  icon={AlertTriangle} tone="rose"   sub="Immediate action" />
            <FleetCard label="Warning"         value={fleet.warning  ?? 0}  icon={Zap}           tone="amber"  sub="Monitor closely" />
            <FleetCard label="Healthy"         value={fleet.healthy  ?? 0}  icon={CheckCircle2}  tone="emerald" sub="Normal operation" />
            <FleetCard label="Fleet Uptime"    value={`${fleet.uptime_pct ?? '—'}%`} icon={Shield} tone="cyan" sub="Healthy + Warning" />
          </div>

          {/* ── machine table ── */}
          <Card>
            <CardHeader>
              <CardTitle>Machine Telemetry Feed</CardTitle>
              <CardDescription>
                Real-time sensor readings — auto-refreshes every 8 seconds
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/50">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-white/8 text-left">
                    <thead className="bg-white/[0.025]">
                      <tr>
                        {['Machine', 'Status', 'Risk', 'Sensors', 'Risk Trend (24 pts)', 'Last Update'].map(h => (
                          <th key={h} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {machines.map(m => {
                        const st = STATUS_STYLES[m.status] ?? STATUS_STYLES.Healthy
                        const t = m.telemetry ?? {}
                        return (
                          <tr key={m.id} className={`transition ${st.row}`}>
                            {/* id */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${st.dot} animate-pulse`} />
                                <span className="text-sm font-medium text-slate-100">{m.id}</span>
                              </div>
                            </td>
                            {/* status badge */}
                            <td className="px-4 py-3">
                              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${st.badge}`}>
                                {m.status}
                              </span>
                            </td>
                            {/* risk bar */}
                            <td className="px-4 py-3">
                              <RiskBar value={m.risk} />
                            </td>
                            {/* telemetry pills */}
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(t).map(([key, s]) => (
                                  <TelemetryPill
                                    key={key}
                                    label={s.label}
                                    value={s.value}
                                    unit={s.unit}
                                    color={SENSOR_COLORS[key] ?? '#94a3b8'}
                                  />
                                ))}
                              </div>
                            </td>
                            {/* sparkline */}
                            <td className="px-4 py-3">
                              <Sparkline
                                data={m.sparkline}
                                color={
                                  m.status === 'Critical' ? '#f87171'
                                  : m.status === 'Warning' ? '#fbbf24'
                                  : '#34d399'
                                }
                              />
                            </td>
                            {/* timestamp */}
                            <td className="px-4 py-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                              {new Date(m.last_updated).toLocaleTimeString()}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
