import { useCallback, useEffect, useState } from 'react'
import PeriodSelector from '../components/PeriodSelector'
import { currentPeriod, formatZar } from '../../../shared/defaults'
import type { RoyaltyView } from '../../../shared/types'

export default function Royalties(): JSX.Element {
  const [period, setPeriod] = useState<string>(currentPeriod())
  const [allMonths, setAllMonths] = useState(false)
  const [view, setView] = useState<RoyaltyView | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setView(await window.gloria.royalty.view(allMonths ? undefined : period))
  }, [period, allMonths])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function generate(): Promise<void> {
    setBusy(true)
    setMsg(null)
    try {
      const res = await window.gloria.royalty.generate(allMonths ? undefined : period)
      setMsg(
        `Generated ${res.created} new + ${res.updated} updated royalty invoices · ${formatZar(res.totalIncl)} total.`
      )
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function togglePaid(id: number, paid: number): Promise<void> {
    await window.gloria.royalty.setPaid(id, !paid)
    refresh()
  }

  const rows = view?.rows ?? []
  const t = view?.totals

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">Royalties</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Auto-calculated from each store’s turnover at its own arrangement (royalty %, plus a
          marketing fee only where the store’s deal includes one) + 15% VAT. Toggle Paid as franchisees settle.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={generate}
            className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
          >
            {busy ? 'Generating…' : allMonths ? 'Generate all months' : 'Generate this month'}
          </button>
          <label className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
            <input type="checkbox" checked={allMonths} onChange={(e) => setAllMonths(e.target.checked)} />
            All months
          </label>
        </div>
        {!allMonths && <PeriodSelector period={period} onChange={setPeriod} />}
      </div>

      {msg && (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      {t && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card label="Royalty + marketing" value={formatZar(t.royalty_fee + t.marketing_fee)} accent />
          <Card label="VAT" value={formatZar(t.vat)} />
          <Card label="Total invoiced" value={formatZar(t.total_incl)} />
          <Card label="Outstanding" value={formatZar(t.outstanding)} />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gloria-brown text-gloria-cream">
              {allMonths && <th className="px-3 py-2 text-left font-semibold">Month</th>}
              <th className="px-3 py-2 text-left font-semibold">Store</th>
              <th className="px-3 py-2 text-right font-semibold">Turnover</th>
              <th className="px-3 py-2 text-right font-semibold">Rate</th>
              <th className="px-3 py-2 text-right font-semibold">Royalty</th>
              <th className="px-3 py-2 text-right font-semibold">Marketing</th>
              <th className="px-3 py-2 text-right font-semibold">Total incl</th>
              <th className="px-3 py-2 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                  {allMonths && <td className="px-3 py-2 tabular-nums text-slate-500">{r.period}</td>}
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{r.storeName}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{formatZar(r.turnover)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-400">{r.rate}%</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatZar(r.royalty_fee)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatZar(r.marketing_fee)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-gloria-brown dark:text-gloria-cream">
                    {formatZar(r.total_incl)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => togglePaid(r.id, r.paid)}
                      className={[
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',
                        r.paid
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                      ].join(' ')}
                    >
                      {r.paid ? 'Paid' : 'Unpaid'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={allMonths ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                  No royalty invoices yet. Click “Generate” (turnover must be captured first).
                </td>
              </tr>
            )}
          </tbody>
          {t && rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gloria-brown font-bold text-gloria-brown dark:text-gloria-cream">
                <td className="px-3 py-2.5" colSpan={allMonths ? 4 : 3}>
                  Total
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatZar(t.royalty_fee)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatZar(t.marketing_fee)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatZar(t.total_incl)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">Click a status to toggle Paid / Unpaid.</p>
    </div>
  )
}

function Card({ label, value, accent }: { label: string; value: string; accent?: boolean }): JSX.Element {
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
