import React, { useMemo, useState } from 'react'
import {
  Brain,
  Download,
  LoaderCircle,
  PanelLeftOpen,
  Sparkles,
  Upload,
  WandSparkles,
  CheckCircle2,
  AlertTriangle,
  ServerCog,
  Cpu
} from 'lucide-react'
import { SidebarConfig } from './components/SidebarConfig'
import { TabsNav } from './components/TabsNav'
import { FileUpload } from './components/FileUpload'
import { DataPreviewTable } from './components/DataPreviewTable'
import { PredictionResults } from './components/PredictionResults'
import { ImageClassification } from './components/ImageClassification'
import { AiAssistant } from './components/AiAssistant'
import { LiveMonitor } from './components/LiveMonitor'
import { DataAnalysis } from './components/DataAnalysis'
import { Alerts } from './components/Alerts'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { predictBatch } from './services/api'

const SAMPLE_ROWS = [
  { machine_id: 'MX-101', temperature: 78, vibration: 0.24, pressure: 31, rpm: 1210, load: 71, timestamp: '2026-07-05 08:00' },
  { machine_id: 'MX-102', temperature: 84, vibration: 0.42, pressure: 33, rpm: 1195, load: 80, timestamp: '2026-07-05 08:05' },
  { machine_id: 'MX-103', temperature: 74, vibration: 0.18, pressure: 30, rpm: 1225, load: 64, timestamp: '2026-07-05 08:10' },
  { machine_id: 'MX-104', temperature: 88, vibration: 0.49, pressure: 35, rpm: 1188, load: 87, timestamp: '2026-07-05 08:15' },
  { machine_id: 'MX-105', temperature: 71, vibration: 0.15, pressure: 29, rpm: 1236, load: 57, timestamp: '2026-07-05 08:20' },
  { machine_id: 'MX-106', temperature: 90, vibration: 0.53, pressure: 37, rpm: 1174, load: 91, timestamp: '2026-07-05 08:25' },
  { machine_id: 'MX-107', temperature: 76, vibration: 0.22, pressure: 31, rpm: 1214, load: 69, timestamp: '2026-07-05 08:30' },
  { machine_id: 'MX-108', temperature: 86, vibration: 0.46, pressure: 34, rpm: 1189, load: 83, timestamp: '2026-07-05 08:35' }
]

const INITIAL_CONFIG = {
  predictionModel: 'LR_24h',
  threshold: 0.5,
  llmModel: 'GPT-4o Mini',
  temperature: 0,
  maxTokens: 1500
}

const PLACEHOLDER_COPY = {
  analysis: {
    title: 'Data Analysis',
    description: 'KPI exploration, drift analysis, and segment filters — coming soon.'
  },
  machines: {
    title: 'Machine Management',
    description: 'Organize fleet metadata, health states, and maintenance ownership here.'
  },
  monitor: {
    title: 'Live Monitor',
    description: 'A real-time telemetry layout can plug into this shell later without changing the aesthetic.'
  },
  alerts: {
    title: 'Alerts',
    description: 'Alert queues, escalation flows, and resolution timelines fit this surface.'
  }
}

function parseCSVLine(line) {
  // Handles quoted fields correctly
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (!lines.length) return { columns: [], rows: [] }

  const columns = parseCSVLine(lines[0])

  const rows = lines.slice(1).map((line) => {
    const values = parseCSVLine(line)
    return columns.reduce((acc, col, i) => {
      acc[col] = values[i] ?? ''
      return acc
    }, {})
  })

  return { columns, rows }
}

function buildResults(rows, threshold) {
  const totalMachines = rows.length
  const enriched = rows.map((row, index) => {
    const volt      = Number(row.volt ?? row.temperature) || 175
    const vibration = Number(row.vibration) || 0.3
    const pressure  = Number(row.pressure)  || 35
    const machineId = row.machineID ?? row.machine_id ?? `Machine-${index + 1}`

    // Normalise to 0-1 risk score matching the heuristic in the backend
    const voltRisk = Math.max(0, (200 - volt) / 100)
    const raw = voltRisk * 0.34 + vibration * 100 * 0.42 + pressure / 100 * 0.12
    const normalized = Math.min(0.98, Math.max(0.02, raw))
    const failureProbability = Math.round(normalized * 100)
    const status = normalized >= Math.max(threshold + 0.2, 0.75) ? 'Critical' : normalized >= threshold ? 'Warning' : 'Healthy'

    return {
      machine: String(machineId),
      failureProbability,
      leadTime: status === 'Critical' ? '6 - 12 hrs' : status === 'Warning' ? '24 hrs' : '72 hrs',
      cause: vibration > 0.42 ? 'Vibration anomaly' : volt < 160 ? 'Low voltage' : 'Pressure drift',
      status,
      normalized
    }
  })

  const criticalMachines = enriched.filter((item) => item.status === 'Critical').length
  const healthyMachines = enriched.filter((item) => item.status === 'Healthy').length
  const avgConfidence = Math.round(
    enriched.reduce((sum, item) => sum + Math.max(72, Math.min(98, item.failureProbability)), 0) / totalMachines
  )

  const riskSeries = ['Now', '+4h', '+8h', '+12h', '+18h', '+24h'].map((hour, index) => ({
    hour,
    risk: Math.round((enriched[0]?.failureProbability || 56) * (0.86 + index * 0.05))
  }))

  const anomalySeries = [
    { sensor: 'Temp', score: 71 },
    { sensor: 'Vibration', score: 88 },
    { sensor: 'Pressure', score: 59 },
    { sensor: 'Load', score: 64 },
    { sensor: 'RPM', score: 52 }
  ]

  return {
    summary: {
      totalMachines,
      criticalMachines,
      healthyMachines,
      avgConfidence
    },
    riskSeries,
    anomalySeries,
    machineResults: enriched.slice(0, 8)
  }
}

function PlaceholderPanel({ title, description }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative p-8 lg:p-12">
        <div className="absolute inset-0 bg-grid bg-[size:18px_18px] opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-400/10" />
        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-violet-200">
            Frontend shell
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white">{title}</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">{description}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { label: 'Glass panels', value: 'Ready' },
              { label: 'Transitions', value: 'Enabled' },
              { label: 'State hooks', value: 'Local only' }
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/10 bg-slate-950/35 p-4">
                <p className="text-sm text-slate-400">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-slate-100">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function App() {
  const [activeTab, setActiveTab] = useState('prediction')
  const [config, setConfig] = useState(INITIAL_CONFIG)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [fileName, setFileName] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [previewColumns, setPreviewColumns] = useState([])
  const [previewRows, setPreviewRows] = useState([])
  const [predictionLoading, setPredictionLoading] = useState(false)
  const [predictionResults, setPredictionResults] = useState(null)

  const hasData = previewRows.length > 0
  const previewSlice = useMemo(() => previewRows.slice(0, 8), [previewRows])

  const applyRows = (rows, providedName = 'sample_telemetry.csv') => {
    if (!rows.length) return
    const columns = Object.keys(rows[0])
    setPreviewColumns(columns)
    setPreviewRows(rows)
    setFileName(providedName)
    setUploadMessage(`${rows.length} rows loaded successfully.`)
    setPredictionResults(null)
  }

  const handleFileUpload = (file) => {
    if (!file) return

    // For large files (>5 MB) read only the first 100 KB to extract
    // a preview — avoids hanging the browser on 500+ MB datasets.
    const PREVIEW_BYTES = 100 * 1024  // 100 KB — enough for ~500 rows
    const blob = file.size > PREVIEW_BYTES ? file.slice(0, PREVIEW_BYTES) : file

    const reader = new FileReader()
    reader.onload = (event) => {
      let text = String(event.target?.result || '')

      // If we sliced the file, drop the last (possibly incomplete) line
      if (file.size > PREVIEW_BYTES) {
        const lastNewline = text.lastIndexOf('\n')
        if (lastNewline > 0) text = text.slice(0, lastNewline)
      }

      const { columns, rows } = parseCSV(text)
      setPreviewColumns(columns)
      setPreviewRows(rows)
      setFileName(file.name)
      const totalNote = file.size > PREVIEW_BYTES
        ? `${rows.length} preview rows loaded (file is ${(file.size / 1024 / 1024).toFixed(0)} MB — showing first rows for prediction)`
        : `${rows.length} rows loaded successfully.`
      setUploadMessage(totalNote)
      setPredictionResults(null)
    }
    reader.readAsText(blob)
  }

  const clearUploadedFile = () => {
    setFileName('')
    setUploadMessage('')
    setPreviewColumns([])
    setPreviewRows([])
    setPredictionResults(null)
  }

  const loadSampleData = () => applyRows(SAMPLE_ROWS, 'sample_telemetry.csv')

  const [predictionError, setPredictionError] = useState('')

  const runPrediction = async () => {
    setPredictionLoading(true)
    setPredictionError('')
    try {
      const results = await predictBatch(previewRows, config.threshold)
      setPredictionResults(results)
    } catch (err) {
      setPredictionError(err.message ?? 'Prediction failed. Is the backend running?')
    } finally {
      setPredictionLoading(false)
    }
  }

  return (
    <div className="min-h-screen">
      <SidebarConfig config={config} setConfig={setConfig} />

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm xl:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 w-[320px] transform transition-transform duration-300 xl:hidden ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarConfig config={config} setConfig={setConfig} mobile />
      </div>

      <main className="min-h-screen px-4 py-4 sm:px-6 xl:ml-[320px] xl:px-8 xl:py-6">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <header className="glass-card relative overflow-hidden p-6 lg:p-8">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/12 via-transparent to-cyan-400/10" />
            <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(true)}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3 text-slate-300 transition hover:bg-white/10 xl:hidden"
                >
                  <PanelLeftOpen className="h-5 w-5" />
                </button>

                <div className="rounded-3xl bg-violet-500/12 p-3 text-violet-200 shadow-glow">
                  <Brain className="h-7 w-7" />
                </div>
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-violet-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Predictive Maintenance System
                  </div>
                  <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                    Smart Factory Monitoring Platform
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 lg:text-base">
                    XGBoost predictive maintenance · CNN equipment defect detection · RAG maintenance assistant — all wired to a live FastAPI backend.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Prediction', value: 'XGBoost', icon: WandSparkles, tone: 'violet' },
                  { label: 'Vision', value: 'CNN Model', icon: CheckCircle2, tone: 'emerald' },
                  { label: 'Assistant', value: 'Cohere RAG', icon: Cpu, tone: 'cyan' }
                ].map((item) => (
                  <div key={item.label} className="rounded-3xl border border-white/10 bg-slate-950/40 px-4 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <item.icon className={`h-4 w-4 ${item.tone === 'emerald' ? 'text-emerald-300' : item.tone === 'cyan' ? 'text-cyan-300' : 'text-violet-300'}`} />
                      {item.label}
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-100">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </header>

          <TabsNav activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === 'prediction' ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Machine Failure Prediction</CardTitle>
                  <CardDescription>
                    Upload a CSV with sensor readings, preview the rows, then trigger a live XGBoost prediction via the backend API.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap gap-3">
                    <Button variant="secondary" className="h-11 px-4" onClick={loadSampleData}>
                      <Download className="h-4 w-4" />
                      Load sample data
                    </Button>
                    <Button variant="ghost" className="h-11 px-4 text-slate-300" onClick={clearUploadedFile}>
                      <Upload className="h-4 w-4" />
                      Reset state
                    </Button>
                  </div>

                  <FileUpload
                    fileName={fileName}
                    uploadMessage={uploadMessage}
                    onFileSelect={handleFileUpload}
                    onClear={clearUploadedFile}
                  />

                  {hasData && <DataPreviewTable columns={previewColumns} rows={previewSlice} />}

                  <div className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/40 p-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">Run prediction</p>
                      <p className="mt-1 text-sm text-slate-400">
                        Button stays disabled until a CSV or sample dataset is loaded. Results are powered by the live XGBoost backend.
                      </p>
                    </div>
                    <Button className="h-12 min-w-[190px]" disabled={!hasData || predictionLoading} onClick={runPrediction}>
                      {predictionLoading ? (
                        <>
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Running prediction...
                        </>
                      ) : (
                        <>
                          <ServerCog className="h-4 w-4" />
                          Run Prediction
                        </>
                      )}
                    </Button>
                  </div>

                  {predictionError && (
                    <p className="flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                      <AlertTriangle className="h-4 w-4 shrink-0" /> {predictionError}
                    </p>
                  )}
                </CardContent>
              </Card>

              {predictionResults ? (
                <PredictionResults results={predictionResults} />
              ) : (
                <Card>
                  <CardContent className="p-8 lg:p-12">
                    <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-amber-200">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Awaiting prediction
                        </div>
                        <h2 className="text-2xl font-semibold text-white">No results yet</h2>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                          Load a CSV or sample data, then click Run Prediction. Results are computed by the live XGBoost pipeline on the backend.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-slate-950/35 p-4 text-sm text-slate-400">
                        Threshold: <span className="font-semibold text-slate-200">{config.threshold.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : activeTab === 'assistant' ? (
            <AiAssistant />
          ) : activeTab === 'machines' ? (
            <ImageClassification />
          ) : activeTab === 'monitor' ? (
            <LiveMonitor />
          ) : activeTab === 'analysis' ? (
            <DataAnalysis />
          ) : activeTab === 'alerts' ? (
            <Alerts />
          ) : (
            <PlaceholderPanel title={PLACEHOLDER_COPY[activeTab]?.title ?? activeTab} description={PLACEHOLDER_COPY[activeTab]?.description ?? ''} />
          )}
        </div>
      </main>
    </div>
  )
}
