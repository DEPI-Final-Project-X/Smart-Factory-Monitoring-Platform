import React from 'react'
import {
  AlertTriangle,
  Activity,
  ShieldCheck,
  TimerReset,
  TrendingUp,
  Cpu
} from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { MetricCard } from './MetricCard'

function StatusBadge({ status }) {
  const map = {
    Critical: 'border-rose-400/20 bg-rose-500/10 text-rose-200',
    Warning: 'border-amber-400/20 bg-amber-500/10 text-amber-200',
    Healthy: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
  }

  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${map[status]}`}>{status}</span>
}

export function PredictionResults({ results }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Machines analyzed" value={results.summary.totalMachines} subtitle="Rows processed from uploaded CSV" icon={Cpu} tone="violet" />
        <MetricCard title="Critical risk" value={results.summary.criticalMachines} subtitle="Require action in next 24h" icon={AlertTriangle} tone="rose" />
        <MetricCard title="Average confidence" value={`${results.summary.avgConfidence}%`} subtitle="XGBoost prediction confidence" icon={TrendingUp} tone="cyan" />
        <MetricCard title="Healthy assets" value={results.summary.healthyMachines} subtitle="Operating within threshold" icon={ShieldCheck} tone="emerald" />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.15fr,0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Failure Risk Trend</CardTitle>
            <CardDescription>Risk probability curve across the 24h forecast window</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={results.riskSeries}>
                <defs>
                  <linearGradient id="riskFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.75} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="hour" stroke="#64748b" tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                    borderRadius: '16px'
                  }}
                />
                <Area type="monotone" dataKey="risk" stroke="#a78bfa" strokeWidth={3} fill="url(#riskFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sensor Anomaly Breakdown</CardTitle>
            <CardDescription>Anomaly scoring per telemetry channel</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={results.anomalySeries}>
                <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                <XAxis dataKey="sensor" stroke="#64748b" tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(148, 163, 184, 0.18)',
                    borderRadius: '16px'
                  }}
                />
                <Bar dataKey="score" radius={[10, 10, 0, 0]} fill="#22d3ee" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Prediction Output</CardTitle>
            <CardDescription>Backend prediction output — powered by XGBoost pipeline</CardDescription>
          </div>
          <div className="rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200">
            XGBoost · Live
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/50">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/10 text-left">
                <thead className="bg-white/[0.03]">
                  <tr>
                    {['Machine', 'Failure Probability', 'Lead Time', 'Primary Cause', 'Status'].map((heading) => (
                      <th key={heading} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {results.machineResults.map((item) => (
                    <tr key={item.machine} className="transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-sm font-medium text-slate-100">{item.machine}</td>
                      <td className="px-4 py-3 text-sm text-slate-200">{item.failureProbability}%</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{item.leadTime}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{item.cause}</td>
                      <td className="px-4 py-3 text-sm">
                        <StatusBadge status={item.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-slate-200">
                <TimerReset className="h-4 w-4 text-cyan-300" />
                Recommended action window
              </div>
              <p className="text-sm leading-6 text-slate-400">
                Inspect high-vibration assets within <span className="font-semibold text-slate-200">12 hours</span> and recalibrate units with rising pressure drift.
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-3 flex items-center gap-2 text-slate-200">
                <Activity className="h-4 w-4 text-violet-300" />
                Operator insight
              </div>
              <p className="text-sm leading-6 text-slate-400">
                Confidence grows when vibration and temperature spike together. The XGBoost model weighs all five sensor channels and applies your configured threshold to classify risk.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
