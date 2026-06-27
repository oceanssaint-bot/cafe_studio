import { useEffect, useState } from 'react'
import { formatZar } from '../../../shared/defaults'
import { useStoreScope } from '../hooks/useStoreScope'
import type { TrendsView } from '../../../shared/types'

export default function Trends(): JSX.Element {
  const { oceansId } = useStoreScope()
  const [view, setView] = useState<TrendsView | null>(null)

  useEffect(() => {
    if (oceansId == null) return
    window.gloria.trends.store(oceansId).then(setView).catch(() => setView(null))
  }, [oceansId])

  if (oceansId == null || !view) return <div className="p-6 text-sm text-slate-400">Loading…</div>
  const t = view.totals
  const max = Math.max(1, ...view.months.map((m) => m.turnover))
  const recent = [...view.months].reverse()

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">Trends</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {view.storeName} performance over time{view.firstMonth ? ` — since ${view.firstMonth}` : ''}.
        </p>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Turnover (all time)" value={formatZar(t.turnover)} accent />
        <Card label="Months trading" value={`${t.monthsTrading}`} sub={`avg ${formatZar(t.avgMonth)}/mo`} />
        <Card label="Best month" value={formatZar(t.bestTurnover)} sub={t.bestPeriod} />
        <Card label="Cash vs card" value={`${t.cashPct}% cash`} sub={`${100 - t.cashPct}% card`} />
      </div>

      {/* turnover bar chart */}
      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Monthly turnover</h3>
        <div className="flex items-end gap-1 overflow-x-auto pb-1" style={{ height: 160 }}>
          {view.months.map((m) => (
            <div key={m.period} className="flex min-w-[14px] flex-1 flex-col items-center justify-end" title={`${m.periodLabel}: ${formatZar(m.turnover)}`}>
              <div
                className="w-full rounded-t bg-gloria-accent"
                style={{ height: `${Math.max(2, (m.turnover / max) * 140)}px` }}
              />
              <span className="mt-1 rotate-0 text-[8px] text-slate-400">{m.period.slice(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* monthly table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gloria-brown text-gloria-cream">
              <th className="px-3 py-2 text-left font-semibold">Month</th>
              <th className="px-3 py-2 text-right font-semibold">Turnover</th>
              <th className="px-3 py-2 text-right font-semibold">Cash %</th>
              <th className="px-3 py-2 text-right font-semibold">Purchases</th>
              <th className="px-3 py-2 text-right font-semibold">Payroll</th>
              <th className="px-3 py-2 text-right font-semibold">Turnover − P&amp;P</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800">
            {recent.map((m) => {
              const mix = m.cash + m.card
              return (
                <tr key={m.period} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                  <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{m.periodLabel}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">{formatZar(m.turnover)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{mix > 0 ? Math.round((m.cash / mix) * 100) : '—'}{mix > 0 ? '%' : ''}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{m.purchases ? formatZar(m.purchases) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-500">{m.payroll ? formatZar(m.payroll) : '—'}</td>
                  <td className={['px-3 py-2 text-right tabular-nums font-medium', m.grossEst < 0 ? 'text-red-500' : 'text-emerald-600'].join(' ')}>
                    {m.purchases || m.payroll ? formatZar(m.grossEst) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Turnover is the actual daily POS (GAAP). “Turnover − P&amp;P” = turnover less purchases &amp; payroll (a
        rough operating margin before rent/royalties). Item-level “what sells” unlocks when a GAAP product-mix
        export is added.
      </p>
    </div>
  )
}

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }): JSX.Element {
  return (
    <div className={['rounded-lg border p-3', accent ? 'border-gloria-brown bg-gloria-brown text-gloria-cream' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'].join(' ')}>
      <p className={['text-[10px] uppercase tracking-wide', accent ? 'text-gloria-cream/70' : 'text-slate-400'].join(' ')}>{label}</p>
      <p className={['mt-0.5 text-lg font-bold tabular-nums', accent ? 'text-white' : 'text-gloria-brown dark:text-gloria-cream'].join(' ')}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}
