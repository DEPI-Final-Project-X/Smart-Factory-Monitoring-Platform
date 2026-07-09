import React from 'react'
import { Database, Rows3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'

export function DataPreviewTable({ columns, rows }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Input Data Preview</CardTitle>
          <CardDescription>First {rows.length} rows rendered from local state</CardDescription>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
          <Rows3 className="h-3.5 w-3.5 text-cyan-300" />
          {columns.length} columns
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/50">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left">
              <thead className="bg-white/[0.03]">
                <tr>
                  {columns.map((column) => (
                    <th key={column} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.map((row, index) => (
                  <tr key={`${row.machine_id || 'row'}-${index}`} className="transition hover:bg-white/[0.03]">
                    {columns.map((column) => (
                      <td key={`${index}-${column}`} className="whitespace-nowrap px-4 py-3 text-sm text-slate-200">
                        {row[column]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
          <Database className="h-3.5 w-3.5" />
          Client-side preview only · parsing kept intentionally lightweight for mock dashboard usage.
        </div>
      </CardContent>
    </Card>
  )
}
