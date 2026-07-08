import React, { useEffect, useState } from 'react'
import { AlertTriangle, BarChart2, Database, Loader2, TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { fetchEda } from '../services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

// ── colour palette ────────────────────────────────────────────────────────────
const SENSOR_COLORS = {
  volt:      '#a78bfa',
  rotate:    '#22d3ee',
  pressure:  '#fb923c',
  vibration: '#f472b6',
}

const CORR_COLOR = (v) => {
  // interpolate from blue (negative) → grey (zero) → violet (positive)
  if (v > 0) return `rgba(139,92,246,${Math.abs(v).toFixed(2)})`
  return `rgba(34,211,238,${Math.abs(v).toFixed(2)})`
}

// ── tooltip style shared across charts ────────────────────────────────────────
const TT_STYLE = {
  background: 'rgba(15,23,42,0.95)',
  border: '1px solid rgba(148,163,184,0.15)',
  borderRadius: 14,
  fontSize: 12,
}

// ── small summary tile ────────────────────────────────────────────────────────
function SummaryTile({ label, value, icon: Icon, tone }) {
  const tones = {
    violet: 'text-violet-300 bg-violet-500/10',
    cyan:   'text-cyan-300   bg-cyan-500/10',
    rose:   'text-rose-300   bg-rose-500/10',
    emerald:'text-emerald-300 bg-emerald-500/10',
  }
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/40 p-5 flex items-center gap-4">
      <div className={`rounded-2xl p-2.5 ${tones[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <p className="text-2xl font-semibold text-slate-100 mt-0.5">{value ?? '—'}</p>
      </div>
    </div>
  )
}

// ── sensor distribution chart ─────────────────────────────────────────────────
function DistributionChart({ col, data }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">{col} Distribution</CardTitle>
        <CardDescription>Histogram — {data.length} bins</CardDescription>
      </CardHeader>
      <CardContent className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
            <XAxis dataKey="bin" stroke="#475569" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <YAxis stroke="#475569" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={TT_STYLE} />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} fill={SENSOR_COLORS[col] ?? '#8b5cf6'} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── correlation heatmap ───────────────────────────────────────────────────────
function CorrelationHeatmap({ data }) {
  if (!data?.length) return null

  // extract unique axis labels preserving insertion order
  const cols = [...new Set(data.map(d => d.x))]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sensor Correlation Matrix</CardTitle>
        <CardDescription>Pearson correlation between telemetry channels and failure flag</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="w-24" />
                {cols.map(c => (
                  <th key={c} className="px-1 text-center text-xs font-medium text-slate-400 capitalize w-20">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cols.map(row => (
                <tr key={row}>
                  <td className="pr-2 text-right text-xs font-medium text-slate-400 capitalize">{row}</td>
                  {cols.map(col => {
                    const cell = data.find(d => d.x === col && d.y === row)
                    const v = cell?.value ?? 0
                    return (
                      <td
                        key={col}
                        className="rounded-lg text-center text-xs font-semibold tabular-nums w-20 h-10"
                        style={{ background: CORR_COLOR(v), color: Math.abs(v) > 0.4 ? '#fff' : '#94a3b8' }}
                      >
                        {v.toFixed(2)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Violet = positive correlation · Cyan = negative correlation · Intensity = magnitude
        </p>
      </CardContent>
    </Card>
  )
}

// ── failure rate by machine ────────────────────────────────────────────────────
function FailureRateChart({ data }) {
  if (!data?.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 15 Machines by Failure Count</CardTitle>
        <CardDescription>Total recorded failures per machine ID</CardDescription>
      </CardHeader>
      <CardContent className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 40 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" horizontal={false} />
            <XAxis type="number" stroke="#475569" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <YAxis dataKey="machine" type="category" stroke="#475569" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} width={36} />
            <Tooltip contentStyle={TT_STYLE} />
            <Bar dataKey="failures" radius={[0, 6, 6, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.rate > 10 ? '#f87171' : entry.rate > 5 ? '#fbbf24' : '#34d399'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── monthly trend ─────────────────────────────────────────────────────────────
function MonthlyTrendChart({ data }) {
  if (!data?.length) return null
  // limit to last 24 months for readability
  const slice = data.slice(-24)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Monthly Failure Trend</CardTitle>
        <CardDescription>Number of failure events recorded per calendar month</CardDescription>
      </CardHeader>
      <CardContent className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={slice} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="mFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f87171" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
            <XAxis dataKey="month" stroke="#475569" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis stroke="#475569" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={TT_STYLE} />
            <Area type="monotone" dataKey="failures" stroke="#f87171" strokeWidth={2} fill="url(#mFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── error distribution ────────────────────────────────────────────────────────
function ErrorDistChart({ data }) {
  if (!data?.length) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Count Distribution</CardTitle>
        <CardDescription>How many machines have each error count value</CardDescription>
      </CardHeader>
      <CardContent className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
            <XAxis dataKey="errors" stroke="#475569" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <YAxis stroke="#475569" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
            <Tooltip contentStyle={TT_STYLE} />
            <Bar dataKey="machines" radius={[6, 6, 0, 0]} fill="#22d3ee" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ── main component ────────────────────────────────────────────────────────────
export function DataAnalysis() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    fetchEda()
      .then(setData)
      .catch(e => setError(e.message ?? 'Failed to load EDA data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-3" /> Computing dataset statistics…
      </div>
    )
  }

  if (error) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
        <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
      </p>
    )
  }

  const { summary, distributions, failure_by_machine, monthly_trend, correlation, error_distribution } = data ?? {}

  return (
    <div className="space-y-6">
      {/* summary tiles */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Total Records"   value={summary?.rows?.toLocaleString()}     icon={Database}   tone="violet" />
        <SummaryTile label="Machines"        value={summary?.machines}                   icon={BarChart2}  tone="cyan"   />
        <SummaryTile label="Total Failures"  value={summary?.failures?.toLocaleString()} icon={AlertTriangle} tone="rose" />
        <SummaryTile label="Feature Columns" value={summary?.columns}                    icon={TrendingUp} tone="emerald" />
      </div>

      {/* sensor distributions — 2×2 grid */}
      {distributions && (
        <div className="grid gap-6 md:grid-cols-2">
          {Object.entries(distributions).map(([col, bins]) => (
            <DistributionChart key={col} col={col} data={bins} />
          ))}
        </div>
      )}

      {/* failure rate + monthly trend */}
      <div className="grid gap-6 xl:grid-cols-2">
        <FailureRateChart data={failure_by_machine} />
        <MonthlyTrendChart data={monthly_trend} />
      </div>

      {/* correlation heatmap */}
      <CorrelationHeatmap data={correlation} />

      {/* error distribution */}
      <ErrorDistChart data={error_distribution} />
    </div>
  )
}
