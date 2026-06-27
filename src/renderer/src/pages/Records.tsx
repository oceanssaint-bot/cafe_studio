import { useCallback, useEffect, useState } from 'react'
import type { CatalogStats, FileCatalogEntry } from '../../../shared/types'

function fmtBytes(n: number): string {
  if (n > 1e9) return (n / 1e9).toFixed(2) + ' GB'
  if (n > 1e6) return (n / 1e6).toFixed(1) + ' MB'
  if (n > 1e3) return (n / 1e3).toFixed(0) + ' KB'
  return n + ' B'
}

export default function Records(): JSX.Element {
  const [stats, setStats] = useState<CatalogStats | null>(null)
  const [results, setResults] = useState<FileCatalogEntry[]>([])
  const [text, setText] = useState('')
  const [dept, setDept] = useState('')
  const [docType, setDocType] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const loadStats = useCallback(async (): Promise<void> => {
    setStats(await window.gloria.catalog.stats())
  }, [])

  const runSearch = useCallback(async (): Promise<void> => {
    setResults(
      await window.gloria.catalog.search({
        text: text || undefined,
        department: dept || undefined,
        doc_type: docType || undefined,
        limit: 300
      })
    )
  }, [text, dept, docType])

  useEffect(() => {
    loadStats()
  }, [loadStats])
  useEffect(() => {
    runSearch()
  }, [runSearch])

  async function runImport(): Promise<void> {
    setBusy(true)
    setMsg(null)
    try {
      const res = await window.gloria.catalog.import()
      if (res.cancelled) setMsg('Cancelled.')
      else if (res.error) setMsg(`Error: ${res.error}`)
      else
        setMsg(
          `Cataloged ${res.scanned} files (${res.added} new, ${res.updated} updated, ${fmtBytes(res.bytes)}) in ${(res.durationMs / 1000).toFixed(1)}s.`
        )
      await loadStats()
      await runSearch()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">Records</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every file in your admin archive — classified, content-hashed and searchable.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={runImport}
          className="shrink-0 rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
        >
          {busy ? 'Cataloging…' : 'Catalog / refresh archive'}
        </button>
      </header>

      {msg && (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      {/* Summary cards */}
      {stats && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total files" value={stats.total.toLocaleString()} accent />
          <Stat label="Total size" value={fmtBytes(stats.totalSize)} />
          <Stat label="Ingested" value={`${stats.ingested.toLocaleString()}`} />
          <Stat label="Duplicate hashes" value={stats.duplicates.toLocaleString()} />
        </div>
      )}

      {/* Department breakdown */}
      {stats && stats.byDepartment.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDept('')}
            className={chip(dept === '')}
          >
            All departments
          </button>
          {stats.byDepartment.map((d) => (
            <button
              key={d.department}
              type="button"
              onClick={() => setDept(d.department === dept ? '' : d.department)}
              className={chip(dept === d.department)}
            >
              {d.department || '(root)'} <span className="opacity-60">{d.files}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search filename, store, period…"
          className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
        />
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">All types</option>
          {stats?.byType.map((t) => (
            <option key={t.doc_type} value={t.doc_type}>
              {t.doc_type} ({t.files})
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gloria-brown text-gloria-cream">
              <th className="px-4 py-2 text-left font-semibold">File</th>
              <th className="px-4 py-2 text-left font-semibold">Department</th>
              <th className="px-4 py-2 text-left font-semibold">Store</th>
              <th className="px-4 py-2 text-left font-semibold">Period</th>
              <th className="px-4 py-2 text-left font-semibold">Type</th>
            </tr>
          </thead>
          <tbody>
            {results.length > 0 ? (
              results.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => window.gloria.catalog.open(r.path)}
                  title={r.rel_path}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-gloria-cream/40 dark:border-slate-700 dark:hover:bg-slate-700/40"
                >
                  <td className="max-w-[320px] truncate px-4 py-2 text-slate-700 dark:text-slate-200">
                    {r.filename}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{r.department}</td>
                  <td className="px-4 py-2 text-slate-500">{r.store || '—'}</td>
                  <td className="px-4 py-2 tabular-nums text-slate-500">{r.period || '—'}</td>
                  <td className="px-4 py-2 text-slate-500">{r.doc_type}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  {stats && stats.total === 0
                    ? 'No files cataloged yet. Click “Catalog / refresh archive”.'
                    : 'No matches.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {results.length >= 300 && (
        <p className="mt-2 text-xs text-slate-400">Showing first 300 — refine your search.</p>
      )}
      <p className="mt-3 text-xs text-slate-400">Click any row to open the file.</p>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }): JSX.Element {
  return (
    <div
      className={[
        'rounded-lg border p-3',
        accent
          ? 'border-gloria-brown bg-gloria-brown text-gloria-cream'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
      ].join(' ')}
    >
      <p className={['text-[11px] uppercase tracking-wide', accent ? 'text-gloria-cream/70' : 'text-slate-400'].join(' ')}>
        {label}
      </p>
      <p className={['mt-0.5 text-lg font-bold tabular-nums', accent ? 'text-white' : 'text-gloria-brown dark:text-gloria-cream'].join(' ')}>
        {value}
      </p>
    </div>
  )
}

function chip(active: boolean): string {
  return [
    'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
    active
      ? 'border-gloria-accent bg-gloria-accent text-white'
      : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
  ].join(' ')
}
