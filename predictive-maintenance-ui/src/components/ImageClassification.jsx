import React, { useCallback, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ImageIcon, Loader2, ScanLine, UploadCloud, X } from 'lucide-react'
import { predictImage } from '../services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/jpg'

function ResultBadge({ label }) {
  const isDefect = label === 'Defected'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
        isDefect
          ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
          : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
      }`}
    >
      {isDefect ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      {label}
    </span>
  )
}

function ProbBar({ label, value, tone }) {
  const colors = {
    rose: 'bg-rose-500',
    emerald: 'bg-emerald-500',
  }
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span className="font-semibold text-slate-200">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-700 ${colors[tone]}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export function ImageClassification() {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)   // object-URL string
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)     // API response
  const [error, setError] = useState('')

  const handleFile = useCallback((f) => {
    if (!f || !f.type.startsWith('image/')) {
      setError('Please select an image file (JPEG, PNG, or WebP).')
      return
    }
    setError('')
    setResult(null)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }, [])

  const onInputChange = (e) => handleFile(e.target.files?.[0])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const clearImage = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  const classify = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const data = await predictImage(file)
      setResult(data)
    } catch (err) {
      setError(err.message ?? 'Classification failed. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Equipment Image Classification</CardTitle>
          <CardDescription>
            Upload an industrial equipment photo to detect defects using the trained CNN model.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            className={`relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center transition-colors ${
              dragging
                ? 'border-violet-400/60 bg-violet-500/10'
                : 'border-white/15 bg-white/[0.02] hover:border-violet-400/30 hover:bg-white/[0.04]'
            }`}
          >
            {preview ? (
              <>
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-48 max-w-full rounded-2xl object-contain shadow-lg"
                />
                <p className="text-xs text-slate-400">{file?.name}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); clearImage() }}
                  className="absolute right-3 top-3 rounded-full border border-white/10 bg-slate-900/80 p-1.5 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <div className="rounded-2xl bg-violet-500/12 p-4 text-violet-300">
                  <UploadCloud className="h-8 w-8" />
                </div>
                <div>
                  <p className="font-medium text-slate-200">Drop an image here or click to browse</p>
                  <p className="mt-1 text-sm text-slate-500">Supports JPEG, PNG, WebP</p>
                </div>
              </>
            )}
          </div>

          <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={onInputChange} />

          {error && (
            <p className="flex items-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button
              className="h-11 min-w-[180px]"
              disabled={!file || loading}
              onClick={classify}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Classifying...</>
              ) : (
                <><ScanLine className="h-4 w-4" /> Classify Image</>
              )}
            </Button>
            {file && (
              <Button variant="ghost" className="h-11 text-slate-300" onClick={clearImage}>
                <X className="h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Classification Result</CardTitle>
                <CardDescription>CNN model output for the uploaded equipment image</CardDescription>
              </div>
              <ResultBadge label={result.label} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { label: 'Prediction', value: result.label, tone: result.label === 'Defected' ? 'text-rose-300' : 'text-emerald-300' },
                { label: 'Confidence', value: `${result.confidence}%`, tone: 'text-violet-300' },
                { label: 'Image', value: file?.name ?? '—', tone: 'text-slate-200' },
              ].map((item) => (
                <div key={item.label} className="rounded-3xl border border-white/10 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                  <p className={`mt-2 truncate text-lg font-semibold ${item.tone}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/35 p-5">
              <p className="text-sm font-medium text-slate-300">Probability breakdown</p>
              <ProbBar label="Defected" value={result.defect_probability} tone="rose" />
              <ProbBar label="Non-Defected" value={result.healthy_probability} tone="emerald" />
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-amber-400/15 bg-amber-500/8 px-4 py-3">
              <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-sm leading-6 text-slate-400">
                {result.label === 'Defected'
                  ? 'This equipment image shows signs of defects. Recommend a physical inspection and maintenance scheduling.'
                  : 'No defects detected in this image. Equipment appears to be in normal operating condition.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
