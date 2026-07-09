import React, { useRef, useState } from 'react'
import { FileSpreadsheet, UploadCloud, X, CheckCircle2 } from 'lucide-react'
import { Button } from './ui/button'

export function FileUpload({ fileName, uploadMessage, onFileSelect, onClear }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFile = (file) => {
    if (file) onFileSelect(file)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <span className="rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-rose-200">Upload CSV File</span>
        <span>Use Sample Data</span>
        <span>Manual Input</span>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          const file = event.dataTransfer.files?.[0]
          handleFile(file)
        }}
        className={`group rounded-[28px] border border-dashed p-6 transition-all duration-300 ${
          isDragging
            ? 'border-violet-400/60 bg-violet-500/10 shadow-[0_0_0_1px_rgba(139,92,246,0.2)]'
            : 'border-white/10 bg-slate-950/40 hover:border-violet-400/40 hover:bg-white/[0.04]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-violet-500/10 p-3 text-violet-200 transition duration-300 group-hover:bg-violet-500/15">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-100">Drag and drop file here</p>
              <p className="mt-1 text-sm text-slate-400">CSV only · mock parsing in the browser · no backend upload</p>
            </div>
          </div>

          <Button variant="secondary" className="h-11 px-5" onClick={() => inputRef.current?.click()}>
            Browse files
          </Button>
        </div>
      </div>

      {fileName && (
        <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="rounded-2xl bg-cyan-400/10 p-2 text-cyan-300">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-100">{fileName}</p>
                <p className="text-xs text-slate-500">CSV file loaded locally</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClear}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/8 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {uploadMessage && (
        <div className="flex items-center gap-3 rounded-3xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">
          <CheckCircle2 className="h-4 w-4 text-violet-300" />
          <span>{uploadMessage}</span>
        </div>
      )}
    </div>
  )
}
