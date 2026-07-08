import React, { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
  Zap,
} from 'lucide-react'
import { fetchAlerts } from '../services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'

// ── severity config ───────────────────────────────────────────────────────────
const SEV = {
  Critical: {
    badge:  'border-rose-400/25 bg-rose-500/10 text-rose-300',
    row:    'border-rose-400/10 bg-rose-500/[0.04]',
    icon:   ShieldAlert,
    iconCls:'text-rose-400',
  },
  Warning: {
    badge:  'border-amber-400/25 bg-amber-500/10 text-amber-300',
    row:    'border-amber-400/10 bg-amber-500/[0.03]',
    icon:   Zap,
    iconCls:'text-amber-400',
  },
  Info: {
    badge:  'border-cyan-400/25 bg-cyan-500/10 text-cyan-300',
    row:    'border-cyan-400/10 bg-cyan-500/[0.03]',
    icon:   Bell,
    iconCls:'text-cyan-400',
  },
}

const SENSOR_LABELS = {
  volt:      'Voltage',
  rotate:    'RPM',
  pressure:  'Pressure',
  vibration: 'Vibration',
}

// ── single alert card ─────────────────────────────────────────────────────────
function AlertCard({ alert, onDismiss, onResolve }) {
  const s = SEV[alert.severity] ?? SEV.Info
  const Icon = s.icon
  const ts = new Date(alert.timestamp)

  return (
    <div className={`flex items-start gap-4 rounded-3xl border p-4 transition ${s.row}`}>
      {/* icon */}
      <div className={`mt-0.5 shrink-0 ${s.iconCls}`}>
        <Icon className="h-5 w-5" />
      </div>

      {/* content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.badge}`}>
            {alert.severity}
          </span>
          <span className="text-sm font-semibold text-slate-100">{alert.title}</span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">
            {alert.machine_id}
          </span>
          <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-xs text-slate-500">
            {SENSOR_LABELS[alert.sensor] ?? alert.sensor}
          </span>
        </div>
        <p className="text-sm text-slate-400 leading-5">{alert.description}</p>
        <p className="mt-1.5 text-xs text-slate-600 tabular-nums">
          {ts.toLocaleDateString()} {ts.toLocaleTimeString()}
        </p>
      </div>

      {/* actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => onResolve(alert.id)}
          title="Mark resolved"
          className="flex items-center gap-1.5 rounded-2xl border border-emerald-400/20 bg-emerald-500/8 px-3 py-1.5 text-xs text-emerald-300 transition hover:bg-emerald-500/15"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Resolve
        </button>
        <button
          onClick={() => onDismiss(alert.id)}
          title="Dismiss"
          className="rounded-xl border border-white/10 bg-white/[0.04] p-1.5 text-slate-400 transition hover:bg-white/8 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── summary badge row ─────────────────────────────────────────────────────────
function SummaryBar({ summary, total }) {
  return (
    <div className="flex flex-wrap gap-3">
      {[
        { label: 'Active alerts', value: total,             tone: 'text-slate-200',   bg: 'bg-white/[0.06]' },
        { label: 'Critical',      value: summary.critical,  tone: 'text-rose-300',    bg: 'bg-rose-500/10 border border-rose-400/20' },
        { label: 'Warning',       value: summary.warning,   tone: 'text-amber-300',   bg: 'bg-amber-500/10 border border-amber-400/20' },
      ].map(item => (
        <div key={item.label} className={`rounded-2xl px-4 py-2 flex items-center gap-2 ${item.bg}`}>
          <span className={`text-lg font-semibold tabular-nums ${item.tone}`}>{item.value}</span>
          <span className="text-xs text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── filter tab ────────────────────────────────────────────────────────────────
function FilterTab({ label, active, count, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-violet-500/10 text-violet-200 shadow-[0_0_0_1px_rgba(139,92,246,0.2)]'
          : 'text-slate-400 hover:bg-white/6 hover:text-white'
      }`}
    >
      {label}
      {count != null && (
        <span className={`ml-2 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
          active ? 'bg-violet-500/20 text-violet-300' : 'bg-white/[0.06] text-slate-500'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export function Alerts() {
  const [raw, setRaw]           = useState([])   // full list from backend
  const [summary, setSummary]   = useState({ critical: 0, warning: 0 })
  const [dismissed, setDismissed] = useState(new Set())  // ids hidden by user
  const [resolved, setResolved]   = useState(new Set())  // ids marked resolved
  const [filter, setFilter]     = useState('All')
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [lastFetch, setLastFetch] = useState(null)

  const load = useCallback(async (spinner = false) => {
    if (spinner) setLoading(true)
    setError('')
    try {
      const data = await fetchAlerts()
      setRaw(data.alerts ?? [])
      setSummary(data.summary ?? { critical: 0, warning: 0 })
      setLastFetch(new Date())
    } catch (e) {
      setError(e.message ?? 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(true) }, [load])

  // derive visible list
  const visible = raw.filter(a => {
    if (dismissed.has(a.id) || resolved.has(a.id)) return false
    if (filter === 'All') return true
    return a.severity === filter
  })

  const resolvedList = raw.filter(a => resolved.has(a.id))

  const handleDismiss = (id) => setDismissed(prev => new Set([...prev, id]))
  const handleResolve = (id) => setResolved(prev => new Set([...prev, id]))
  const handleClearAll = () => setDismissed(prev => new Set([...prev, ...visible.map(a => a.id)]))

  const critCount = visible.filter(a => a.severity === 'Critical').length
  const warnCount = visible.filter(a => a.severity === 'Warning').length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>
                Rule-based alerts from live telemetry — refreshed on demand
                {lastFetch && <span className="ml-2 text-slate-600">· {lastFetch.toLocaleTimeString()}</span>}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="h-9 px-3 text-slate-300 text-xs"
                onClick={() => load(true)}
                disabled={loading}
              >
                {loading
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                <span className="ml-1.5">Refresh</span>
              </Button>
              {visible.length > 0 && (
                <Button
                  variant="ghost"
                  className="h-9 px-3 text-slate-400 text-xs"
                  onClick={handleClearAll}
                >
                  <BellOff className="h-3.5 w-3.5" />
                  <span className="ml-1.5">Dismiss all</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* summary bar */}
          <SummaryBar summary={{ critical: critCount, warning: warnCount }} total={visible.length} />

          {/* filter tabs */}
          <div className="flex gap-2 flex-wrap">
            {['All', 'Critical', 'Warning'].map(f => (
              <FilterTab
                key={f}
                label={f}
                active={filter === f}
                count={
                  f === 'All'      ? visible.length
                  : f === 'Critical'? critCount
                  : warnCount
                }
                onClick={() => setFilter(f)}
              />
            ))}
          </div>

          {/* error */}
          {error && (
            <p className="flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          {/* alert list */}
          {loading && raw.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading alerts…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/8 bg-white/[0.02] py-16 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400/60" />
              <p className="text-sm font-medium text-slate-300">No active alerts</p>
              <p className="text-xs text-slate-500">
                {filter !== 'All' ? `No ${filter} alerts at this time.` : 'All machines are within safe thresholds.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map(alert => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onDismiss={handleDismiss}
                  onResolve={handleResolve}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* resolved list */}
      {resolvedList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resolved</CardTitle>
            <CardDescription>Alerts marked as resolved this session</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {resolvedList.map(alert => (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3 opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="text-sm text-slate-400">
                    <span className="font-medium text-slate-300">{alert.machine_id}</span>
                    {' · '}
                    {alert.title}
                    {' · '}
                    {SENSOR_LABELS[alert.sensor] ?? alert.sensor} = {alert.value} {alert.unit}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
