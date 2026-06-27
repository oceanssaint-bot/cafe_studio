import { useCallback, useEffect, useState } from 'react'
import { formatZar } from '../../../shared/defaults'
import type { StockReconView } from '../../../shared/types'

const today = (): string => new Date().toISOString().slice(0, 10)

export default function StockReconPanel(): JSX.Element {
  const [view, setView] = useState<StockReconView | null>(null)
  const [asOf, setAsOf] = useState<string>(today())
  const [busy, setBusy] = useState<null | 'sheets' | 'invoices' | 'export'>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setView(await window.gloria.stockRecon.view(asOf).catch(() => null))
  }, [asOf])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function importSheets(): Promise<void> {
    setBusy('sheets')
    setMsg(null)
    try {
      const r = await window.gloria.stockRecon.importSheets()
      if (r.cancelled) setMsg('Cancelled.')
      else if (r.error) setMsg(r.error)
      else setMsg(`Imported ${r.sheets} stock count(s), ${r.lines} items. Latest: ${r.latestDate}.`)
      refresh()
    } finally {
      setBusy(null)
    }
  }
  async function importInvoices(): Promise<void> {
    setBusy('invoices')
    setMsg(null)
    try {
      const r = await window.gloria.stockRecon.importInvoices()
      if (r.cancelled) setMsg('Cancelled.')
      else if (r.error) setMsg(r.error)
      else
        setMsg(
          `Imported ${r.lines} stock lines from ${r.files} invoices (${r.byStore.map((b) => `${b.store} ${b.lines}`).join(', ')}).`
        )
      refresh()
    } finally {
      setBusy(null)
    }
  }
  async function exportExcel(): Promise<void> {
    setBusy('export')
    try {
      const r = await window.gloria.stockRecon.export(asOf)
      if (r.error) setMsg(r.error)
      else if (r.saved) setMsg(`Exported to ${r.path}`)
    } finally {
      setBusy(null)
    }
  }

  const t = view?.totals
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gloria-brown dark:text-gloria-cream">
            Updated Stock Take — Head Office
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Latest stock count − stock invoiced out to stores since = stock on hand today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={importSheets}
            className="rounded-md border border-gloria-accent px-3 py-1.5 text-xs font-medium text-gloria-accent hover:bg-gloria-accent hover:text-white disabled:opacity-50"
          >
            {busy === 'sheets' ? 'Importing…' : 'Import stock counts'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={importInvoices}
            className="rounded-md border border-gloria-accent px-3 py-1.5 text-xs font-medium text-gloria-accent hover:bg-gloria-accent hover:text-white disabled:opacity-50"
          >
            {busy === 'invoices' ? 'Importing…' : 'Import stock-out invoices'}
          </button>
        </div>
      </div>

      {msg && (
        <p className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      {!view?.hasData ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800">
          Import your “Head Office Stock Take” folder (the counts) and the “Debtors” folder (the
          store invoices) to roll your last count forward to today.
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-slate-500 dark:text-slate-400">
              Baseline <strong className="text-slate-700 dark:text-slate-200">{view.baselineDate}</strong> → as of
            </span>
            <input
              type="date"
              value={asOf}
              max={today()}
              onChange={(e) => setAsOf(e.target.value || today())}
              className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
            />
            <span className="text-xs text-slate-400">{view.matchedPct}% of lines matched</span>
            <button
              type="button"
              disabled={busy !== null}
              onClick={exportExcel}
              className="ml-auto rounded-md bg-gloria-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
            >
              {busy === 'export' ? 'Exporting…' : 'Export to Excel'}
            </button>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card label={`Opening (${view.baselineDate})`} value={formatZar(t!.openingValue)} />
            <Card label="Sold out since" value={formatZar(t!.soldValue)} />
            <Card label="Remaining today" value={formatZar(t!.remainingValue)} accent />
            <Card
              label="To verify"
              value={`${t!.notCounted + t!.oversold} of ${t!.items}`}
              sub={`${t!.notCounted} not counted · ${t!.oversold} oversold`}
            />
          </div>

          {view.perStore.length > 0 && (
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Sold per store:{' '}
              {view.perStore.map((p) => `${p.store} ${formatZar(p.value)}`).join(' · ')}
            </p>
          )}

          <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className="bg-gloria-brown text-gloria-cream">
                  <th className="px-2 py-2 text-left font-semibold">Item</th>
                  <th className="px-2 py-2 text-right font-semibold">Price</th>
                  <th className="px-2 py-2 text-right font-semibold">Opening</th>
                  <th className="px-2 py-2 text-right font-semibold">Sold</th>
                  <th className="px-2 py-2 text-right font-semibold">Remaining</th>
                  <th className="px-2 py-2 text-right font-semibold">Value</th>
                  <th className="px-2 py-2 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-800">
                {view.rows.map((r) => (
                  <tr key={r.code} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                    <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">{r.name}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{r.price}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                      {r.counted ? r.opening : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{r.sold}</td>
                    <td
                      className={[
                        'px-2 py-1.5 text-right tabular-nums font-medium',
                        r.remaining < 0 ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'
                      ].join(' ')}
                    >
                      {r.remaining}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatZar(r.value)}</td>
                    <td className="px-2 py-1.5">
                      {r.status === 'not-counted' && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          not counted
                        </span>
                      )}
                      {r.status === 'oversold' && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          sold &gt; count
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {view.unmatched.length > 0 && (
            <p className="mt-2 text-[11px] text-slate-400">
              {view.unmatched.length} unmatched line(s) (off-sheet / non-stock), e.g.{' '}
              {view.unmatched.slice(0, 4).map((u) => u.name).join(', ')} — see the Excel “Unmatched” sheet.
            </p>
          )}
        </>
      )}
    </section>
  )
}

function Card({
  label,
  value,
  sub,
  accent
}: {
  label: string
  value: string
  sub?: string
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
      <p className={['mt-0.5 text-base font-bold tabular-nums', accent ? 'text-white' : 'text-gloria-brown dark:text-gloria-cream'].join(' ')}>
        {value}
      </p>
      {sub && <p className={['mt-0.5 text-[10px]', accent ? 'text-gloria-cream/60' : 'text-slate-400'].join(' ')}>{sub}</p>}
    </div>
  )
}
