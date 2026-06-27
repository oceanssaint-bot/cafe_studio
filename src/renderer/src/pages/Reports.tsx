import { useEffect, useState } from 'react'
import PeriodSelector from '../components/PeriodSelector'
import { useActivity } from '../context/ActivityContext'
import { currentPeriod, formatZar } from '../../../shared/defaults'
import type { ReportData, ReportType, ExportResult } from '../../../shared/types'

const REPORT_TABS: Array<{ id: ReportType; label: string }> = [
  { id: 'head_office', label: 'Head Office Pack' },
  { id: 'franchise', label: 'Franchise Pack' },
  { id: 'australia', label: 'Australia Pack' }
]

type Busy = null | 'print' | 'pdf' | 'html'

export default function Reports(): JSX.Element {
  const [type, setType] = useState<ReportType>('head_office')
  const [period, setPeriod] = useState<string>(currentPeriod())
  const [data, setData] = useState<ReportData | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [message, setMessage] = useState<string | null>(null)
  const { run: track } = useActivity()

  useEffect(() => {
    let active = true
    window.gloria.reports.data(type, period).then((d) => {
      if (active) setData(d)
    })
    return () => {
      active = false
    }
  }, [type, period])

  async function run(kind: Busy, fn: () => Promise<ExportResult>): Promise<void> {
    setBusy(kind)
    setMessage(null)
    const res = await track('Generating report', fn)
    if (res) {
      if (res.error) setMessage(`Export failed: ${res.error}`)
      else if (res.saved && res.path) setMessage(`Saved to ${res.path}`)
      else if (res.saved) setMessage('Print dialog opened.')
      else setMessage('Cancelled.')
    }
    setBusy(null)
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5">
        <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
          Reports
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Generate Head Office, Franchise and Australia packs.
        </p>
      </header>

      {/* Tabs + period */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setType(tab.id)}
              className={[
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                type === tab.id
                  ? 'bg-gloria-accent text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      {/* Export actions */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run('print', () => window.gloria.reports.print(type, period))}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Print View
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run('pdf', () => window.gloria.reports.exportPdf(type, period))}
          className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
        >
          {busy === 'pdf' ? 'Exporting…' : 'Export PDF'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => run('html', () => window.gloria.reports.exportHtml(type, period))}
          className="rounded-md border border-gloria-accent px-4 py-2 text-sm font-medium text-gloria-accent hover:bg-gloria-accent/10 disabled:opacity-50"
        >
          {busy === 'html' ? 'Exporting…' : 'Export HTML'}
        </button>
        {message && (
          <span className="ml-1 truncate text-xs text-slate-500 dark:text-slate-400">
            {message}
          </span>
        )}
      </div>

      {/* Live preview */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b-2 border-gloria-accent px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gloria-accent">
            Gloria Jean&apos;s Coffee SA
          </p>
          <h3 className="text-lg font-semibold text-gloria-brown dark:text-gloria-cream">
            {data?.title ?? '—'}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{data?.periodLabel}</p>
        </div>

        {/* At-a-glance summary cards */}
        {data && (
          <div className="grid grid-cols-2 gap-3 px-5 pt-4 sm:grid-cols-4">
            <SummaryCard label="Total turnover" value={formatZar(data.totals.turnover)} accent />
            <SummaryCard label="Total purchases" value={formatZar(data.totals.purchases)} />
            <SummaryCard label="Royalties" value={formatZar(data.totals.royalty)} />
            <SummaryCard label="To Australia (1%)" value={formatZar(data.totals.royalty_au)} />
          </div>
        )}

        <p className="px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Breakdown by store
        </p>

        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gloria-brown text-gloria-cream">
              <th className="px-4 py-2.5 text-left font-semibold">Store</th>
              <th className="px-4 py-2.5 text-right font-semibold">Turnover</th>
              <th className="px-4 py-2.5 text-right font-semibold">Purchases</th>
              <th className="px-4 py-2.5 text-right font-semibold">Royalty</th>
              <th className="px-4 py-2.5 text-right font-semibold">To Australia</th>
            </tr>
          </thead>
          <tbody>
            {data && data.rows.length > 0 ? (
              data.rows.map((r) => (
                <tr
                  key={r.storeName}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-700"
                >
                  <td className="px-4 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                    {r.storeName}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {formatZar(r.turnover)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {formatZar(r.purchases)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {formatZar(r.royalty)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">
                    {formatZar(r.royalty_au)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No stores in this pack.
                </td>
              </tr>
            )}
          </tbody>
          {data && (
            <tfoot>
              <tr className="border-t-2 border-gloria-brown font-bold text-gloria-brown dark:text-gloria-cream">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatZar(data.totals.turnover)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatZar(data.totals.purchases)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatZar(data.totals.royalty)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatZar(data.totals.royalty_au)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  accent
}: {
  label: string
  value: string
  accent?: boolean
}): JSX.Element {
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
      <p
        className={[
          'mt-0.5 text-lg font-bold tabular-nums',
          accent ? 'text-white' : 'text-gloria-brown dark:text-gloria-cream'
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}
