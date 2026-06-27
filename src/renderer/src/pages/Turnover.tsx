import { useCallback, useEffect, useState } from 'react'
import PeriodSelector from '../components/PeriodSelector'
import { currentPeriod, formatZar } from '../../../shared/defaults'
import { useStoreScope } from '../hooks/useStoreScope'
import type { TurnoverView, TurnoverImportSummary } from '../../../shared/types'

export default function Turnover(): JSX.Element {
  const { storeMode, oceansId } = useStoreScope()
  const [period, setPeriod] = useState<string>(currentPeriod())
  const [view, setView] = useState<TurnoverView | null>(null)
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<TurnoverImportSummary | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setView(await window.gloria.turnover.view(period))
  }, [period])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function runImport(): Promise<void> {
    setBusy(true)
    setSummary(null)
    try {
      const res = await window.gloria.turnover.import()
      setSummary(res)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const scoped = <T extends { storeId: number }>(rows: T[]): T[] =>
    storeMode && oceansId != null ? rows.filter((r) => r.storeId === oceansId) : rows
  const monthly = scoped(view?.monthly ?? [])
  const recon = scoped(view?.recon ?? [])
  const totalTurnover = monthly.reduce((s, m) => s + m.total_sales, 0)
  const mismatches = recon.filter((r) => !r.matches)

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">Turnover</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Daily POS turnover by store — normalised from every submission format (GAAP, 3rd-party,
          or PDF) — and reconciled to the monthly figures used for royalties.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={runImport}
          className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
        >
          {busy ? 'Importing…' : 'Import turnover reports'}
        </button>
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      {summary && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800">
          {summary.cancelled ? (
            <p className="text-slate-500">Import cancelled.</p>
          ) : summary.error ? (
            <p className="text-red-500">{summary.error}</p>
          ) : (
            <ul className="space-y-0.5 text-slate-600 dark:text-slate-300">
              <li>Spreadsheets parsed: {summary.filesParsed}</li>
              {summary.filesAi > 0 && <li>PDFs read with AI: {summary.filesAi}</li>}
              <li>Store-months updated: {summary.storeMonths}</li>
              <li>Total turnover read: {formatZar(summary.totalTurnover)}</li>
              {summary.storesCreated.length > 0 && (
                <li>New stores: {summary.storesCreated.join(', ')}</li>
              )}
              {summary.needsApiKey && (
                <li className="text-amber-600">
                  Some PDFs need the AI key (Settings → Document reading) to be read.
                </li>
              )}
              {summary.warnings.length > 0 && (
                <li className="text-amber-600">
                  {summary.warnings.length} warning(s): {summary.warnings.slice(0, 4).join('; ')}
                  {summary.warnings.length > 4 ? '…' : ''}
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Monthly turnover by store (with Oceans payment breakdown) */}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {view?.periodLabel ?? ''} — turnover by store
      </h3>
      <div className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gloria-brown text-gloria-cream">
              <th className="px-4 py-2 text-left font-semibold">Store</th>
              <th className="px-4 py-2 text-right font-semibold">Days</th>
              <th className="px-4 py-2 text-right font-semibold">Cash</th>
              <th className="px-4 py-2 text-right font-semibold">Card</th>
              <th className="px-4 py-2 text-right font-semibold">Tips</th>
              <th className="px-4 py-2 text-right font-semibold">Turnover</th>
            </tr>
          </thead>
          <tbody>
            {monthly.length > 0 ? (
              monthly.map((m) => (
                <tr
                  key={m.storeId}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-700"
                >
                  <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200">
                    {m.storeName}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-500">{m.days}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                    {m.hasBreakdown ? formatZar(m.cash) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                    {m.hasBreakdown ? formatZar(m.credit_card) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                    {m.hasBreakdown ? formatZar(m.tips) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums text-gloria-brown dark:text-gloria-cream">
                    {formatZar(m.total_sales)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-400">
                  No turnover for this month yet. Click “Import turnover reports”.
                </td>
              </tr>
            )}
          </tbody>
          {monthly.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gloria-brown font-bold text-gloria-brown dark:text-gloria-cream">
                <td className="px-4 py-2.5" colSpan={5}>
                  Total
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatZar(totalTurnover)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Reconciliation vs the monthly master figure */}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Reconciliation — POS vs monthly figure
      </h3>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200">
              <th className="px-4 py-2 text-left font-semibold">Store</th>
              <th className="px-4 py-2 text-right font-semibold">POS turnover</th>
              <th className="px-4 py-2 text-right font-semibold">Monthly figure</th>
              <th className="px-4 py-2 text-right font-semibold">Difference</th>
              <th className="px-4 py-2 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {recon.length > 0 ? (
              recon.map((r) => (
                <tr
                  key={r.storeId}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-700"
                >
                  <td className="px-4 py-2 font-medium text-slate-700 dark:text-slate-200">
                    {r.storeName}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatZar(r.posTurnover)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-slate-500">
                    {formatZar(r.masterTurnover)}
                  </td>
                  <td
                    className={[
                      'px-4 py-2 text-right tabular-nums',
                      r.matches ? 'text-slate-400' : 'font-semibold text-red-500'
                    ].join(' ')}
                  >
                    {r.difference === 0 ? '—' : formatZar(r.difference)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {r.matches ? (
                      <span className="text-emerald-500">✓ matches</span>
                    ) : (
                      <span className="text-red-500">mismatch</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  Nothing to reconcile yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {mismatches.length > 0 && (
        <p className="mt-3 text-sm text-amber-600">
          {mismatches.length} store(s) where the POS turnover differs from the monthly figure — worth
          checking before invoicing royalties.
        </p>
      )}
    </div>
  )
}
