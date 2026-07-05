import React from 'react'
import { Cpu, Settings2, Sparkles, SlidersHorizontal } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Select } from './ui/select'
import { Slider } from './ui/slider'

const predictionModels = [
  { label: 'LR_24h', value: 'LR_24h' },
  { label: 'XGBoost_7d', value: 'XGBoost_7d' },
  { label: 'Transformer_48h', value: 'Transformer_48h' }
]

const llmModels = [
  { label: 'GPT-4o Mini', value: 'GPT-4o Mini' },
  { label: 'Claude 3.5 Sonnet', value: 'Claude 3.5 Sonnet' },
  { label: 'Llama 3.1 70B', value: 'Llama 3.1 70B' }
]

function SliderRow({ label, hint, valueLabel, value, min, max, step, onChange }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-200">{label}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2.5 py-1 text-xs font-semibold text-violet-200">
          {valueLabel}
        </span>
      </div>
      <Slider value={[value]} onValueChange={(values) => onChange(values[0])} min={min} max={max} step={step} />
    </div>
  )
}

export function SidebarConfig({ config, setConfig, mobile = false }) {
  const updateField = (field, value) => setConfig((current) => ({ ...current, [field]: value }))

  return (
    <aside
      className={mobile ? 'h-full w-full overflow-y-auto border-r border-white/10 bg-slate-950/90 p-5 backdrop-blur-2xl' : 'fixed inset-y-0 left-0 z-20 hidden w-[320px] border-r border-white/10 bg-slate-950/70 p-5 backdrop-blur-2xl xl:block'}
    >
      <div className="flex h-full flex-col gap-5 overflow-y-auto pr-1">
        <Card className="bg-white/[0.04]">
          <CardHeader>
            <div className="mb-1 flex items-center gap-3">
              <div className="rounded-2xl bg-violet-500/15 p-2 text-violet-200">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Control prediction tuning and model behavior</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-200">Select model</label>
              <Select
                value={config.predictionModel}
                options={predictionModels}
                onChange={(value) => updateField('predictionModel', value)}
              />
            </div>

            <SliderRow
              label="Prediction threshold"
              hint="Used to classify critical machine failures"
              valueLabel={config.threshold.toFixed(2)}
              value={config.threshold}
              min={0.1}
              max={0.95}
              step={0.01}
              onChange={(value) => updateField('threshold', value)}
            />
          </CardContent>
        </Card>

        <Card className="bg-white/[0.04]">
          <CardHeader>
            <div className="mb-1 flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-400/15 p-2 text-cyan-200">
                <Settings2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>LLM Settings</CardTitle>
                <CardDescription>Frontend-only controls with local state</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-200">Choose model</label>
              <Select value={config.llmModel} options={llmModels} onChange={(value) => updateField('llmModel', value)} />
            </div>

            <SliderRow
              label="Temperature"
              hint="Higher values increase answer creativity"
              valueLabel={config.temperature.toFixed(2)}
              value={config.temperature}
              min={0}
              max={1}
              step={0.01}
              onChange={(value) => updateField('temperature', value)}
            />

            <SliderRow
              label="Max tokens"
              hint="Local UI state only, no backend wiring"
              valueLabel={String(config.maxTokens)}
              value={config.maxTokens}
              min={256}
              max={4096}
              step={64}
              onChange={(value) => updateField('maxTokens', value)}
            />
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-gradient-to-br from-violet-500/12 via-white/[0.04] to-cyan-400/10">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-white/10 p-2 text-violet-100">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100">Modern AI SaaS style</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Glass cards, soft gradients, rounded controls, and quick feedback for every interaction.
                </p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                <Cpu className="mb-2 h-4 w-4 text-cyan-300" />
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Model</p>
                <p className="mt-1 text-sm font-medium text-slate-200">{config.predictionModel}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                <Sparkles className="mb-2 h-4 w-4 text-violet-300" />
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">LLM</p>
                <p className="mt-1 text-sm font-medium text-slate-200">{config.llmModel}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </aside>
  )
}
