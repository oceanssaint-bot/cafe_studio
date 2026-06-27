import { useCallback, useEffect, useState } from 'react'
import PeriodSelector from '../components/PeriodSelector'
import { currentPeriod, formatZar } from '../../../shared/defaults'
import { useStoreScope } from '../hooks/useStoreScope'
import type { Store, CashUpData, CashImportResult } from '../../../shared/types'

const blankLine = { txn_date: '', supplier: '', description: '', incl: '', vat: '' }

export default function CashUp(): JSX.Element {
  const { storeMode, oceansId } = useStoreScope()
  const [stores, setStores] = useState<Store[]>([])
  const [storeId, setStoreId] = useState<number | null>(null)
  const [period, setPeriod] = useState<string>(currentPeriod())
  const [data, setData] = useState<CashUpData | null>(null)
  const [line, setLine] = useState({ ...blankLine })
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    window.gloria.stores.list().then((list) => {
      setStores(list)
      setStoreId((id) => id ?? list[0]?.id ?? null)
    })
  }, [])

  useEffect(() => {
    if (storeMode && oceansId != null) setStoreId(oceansId)
  }, [storeMode, oceansId])

  const refresh = useCallback(async (): Promise<void> => {
    if (storeId == null) return
    setData(await window.gloria.cash.get(storeId, period))
  }, [storeId, period])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function addLine(): Promise<void> {
    if (storeId == null) return
    const incl = parseFloat(line.incl) || 0
    if (!incl) return
    const vat = parseFloat(line.vat) || 0
    await window.gloria.cash.add({
      store_id: storeId,
      period,
      txn_date: line.txn_date || `${period}-01`,
      supplier: line.supplier,
      description: line.description,
      excl_vat: Math.round((incl - vat) * 100) / 100,
      vat,
      incl_vat: incl,
      kind: 'purchase'
    })
    setLine({ ...blankLine })
    refresh()
  }

  async function remove(id: number): Promise<void> {
    await window.gloria.cash.remove(id)
    refresh()
  }

  async function declare(txn_date: string, purchases: number, tips: number): Promise<void> {
    if (storeId == null) return
    await window.gloria.cash.declare({
      store_id: storeId,
      period,
      txn_date,
      declared_purchases: purchases,
      declared_tips: tips
    })
    refresh()
  }

  async function readSlips(): Promise<void> {
    if (storeId == null) return
    setImporting(true)
    setMsg(null)
    try {
      const r: CashImportResult = await window.gloria.cash.importSlips(storeId, period)
      if (r.cancelled) setMsg('Cancelled.')
      else if (r.error) setMsg(`Failed: ${r.error}`)
      else
        setMsg(
          `Read ${r.slips} till slip(s), ${r.vouchers} voucher(s)` +
            (r.skipped ? `, ${r.skipped} skipped` : '') +
            (r.warnings.length ? `, ${r.warnings.length} warning(s)` : '')
        )
      refresh()
    } finally {
      setImporting(false)
    }
  }

  const purchases = data?.payouts.filter((p) => p.kind === 'purchase') ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
            Cash-Up &amp; Payouts
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Petty-cash purchases from till slips, reconciled to the daily payout vouchers.
          </p>
        </div>
        <button
          type="button"
          onClick={readSlips}
          disabled={importing || storeId == null}
          className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
        >
          {importing ? 'Reading…' : 'Read slips (AI)'}
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {storeMode ? (
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {stores.find((s) => s.id === storeId)?.name ?? 'Oceans Mall'}
          </span>
        ) : (
          <select
            value={storeId ?? ''}
            onChange={(e) => setStoreId(Number(e.target.value))}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
          >
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      {msg && (
        <p className="mb-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      {/* Totals */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Total label="Cash purchases (incl)" value={formatZar(data?.totals.incl ?? 0)} strong />
        <Total label="Excl VAT" value={formatZar(data?.totals.excl ?? 0)} />
        <Total label="VAT" value={formatZar(data?.totals.vat ?? 0)} />
        <Total label="Tips" value={formatZar(data?.totals.tips ?? 0)} />
      </div>

      {/* Payouts table */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gloria-brown text-gloria-cream">
              <th className="px-3 py-2 text-left font-semibold">Date</th>
              <th className="px-3 py-2 text-left font-semibold">Supplier</th>
              <th className="px-3 py-2 text-left font-semibold">Description</th>
              <th className="px-3 py-2 text-right font-semibold">Excl VAT</th>
              <th className="px-3 py-2 text-right font-semibold">VAT</th>
              <th className="px-3 py-2 text-right font-semibold">Incl VAT</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr
                key={p.id}
                className="group border-b border-slate-100 last:border-0 dark:border-slate-700"
              >
                <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{p.txn_date}</td>
                <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">{p.supplier}</td>
                <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{p.description}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatZar(p.excl_vat)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatZar(p.vat)}</td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                  {formatZar(p.incl_vat)}
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    className="text-xs text-red-500 opacity-0 group-hover:opacity-100 hover:underline"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            {/* Add row */}
            <tr className="bg-slate-50 dark:bg-slate-900/40">
              <td className="px-2 py-1.5">
                <input type="date" value={line.txn_date} onChange={(e) => setLine({ ...line, txn_date: e.target.value })} className={cell} />
              </td>
              <td className="px-2 py-1.5">
                <input placeholder="Checkers" value={line.supplier} onChange={(e) => setLine({ ...line, supplier: e.target.value })} className={cell} />
              </td>
              <td className="px-2 py-1.5">
                <input placeholder="Milk" value={line.description} onChange={(e) => setLine({ ...line, description: e.target.value })} className={cell} />
              </td>
              <td className="px-2 py-1.5 text-right text-xs text-slate-400">auto</td>
              <td className="px-2 py-1.5">
                <input placeholder="VAT" inputMode="decimal" value={line.vat} onChange={(e) => setLine({ ...line, vat: e.target.value })} className={cell + ' text-right'} />
              </td>
              <td className="px-2 py-1.5">
                <input placeholder="Incl total" inputMode="decimal" value={line.incl} onChange={(e) => setLine({ ...line, incl: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addLine()} className={cell + ' text-right'} />
              </td>
              <td className="px-2 py-1.5 text-right">
                <button type="button" onClick={addLine} disabled={!line.incl} className="rounded bg-gloria-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-40">
                  Add
                </button>
              </td>
            </tr>
          </tbody>
          {purchases.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gloria-brown font-bold text-gloria-brown dark:text-gloria-cream">
                <td className="px-3 py-2" colSpan={3}>
                  Total ({purchases.length})
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatZar(data?.totals.excl ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatZar(data?.totals.vat ?? 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatZar(data?.totals.incl ?? 0)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Reconciliation */}
      <h3 className="mb-2 mt-6 text-sm font-semibold text-slate-600 dark:text-slate-300">
        Daily reconciliation — till slips vs payout voucher
      </h3>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2 text-center">Slips</th>
              <th className="px-3 py-2 text-right">Slips total</th>
              <th className="px-3 py-2 text-right">Voucher declared</th>
              <th className="px-3 py-2 text-right">Variance</th>
              <th className="px-3 py-2 text-right">Tips</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {data && data.recon.length > 0 ? (
              data.recon.map((r) => (
                <tr key={r.txn_date} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{r.txn_date}</td>
                  <td className="px-3 py-1.5 text-center text-slate-500">{r.slipCount}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatZar(r.slipsTotal)}</td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={r.declaredPurchases || ''}
                      placeholder="enter"
                      onBlur={(e) =>
                        declare(r.txn_date, parseFloat(e.target.value) || 0, r.declaredTips)
                      }
                      className="w-24 rounded border border-slate-200 bg-transparent px-2 py-0.5 text-right text-xs tabular-nums focus:border-gloria-accent focus:outline-none dark:border-slate-600"
                    />
                  </td>
                  <td
                    className={[
                      'px-3 py-1.5 text-right tabular-nums',
                      Math.abs(r.variance) > 0.01 && r.declaredPurchases
                        ? 'text-red-500'
                        : 'text-slate-400'
                    ].join(' ')}
                  >
                    {r.declaredPurchases ? formatZar(r.variance) : '—'}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <input
                      type="number"
                      step="0.01"
                      defaultValue={r.declaredTips || ''}
                      placeholder="tips"
                      onBlur={(e) =>
                        declare(r.txn_date, r.declaredPurchases, parseFloat(e.target.value) || 0)
                      }
                      className="w-20 rounded border border-slate-200 bg-transparent px-2 py-0.5 text-right text-xs tabular-nums focus:border-gloria-accent focus:outline-none dark:border-slate-600"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {!r.declaredPurchases ? (
                      <span className="text-xs text-slate-400">no voucher</span>
                    ) : r.matched ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        ✓ matches
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        mismatch
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-slate-400">
                  No cash purchases yet. Add lines above, or click “Read slips (AI)” to read photos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const cell =
  'w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900'

function Total({
  label,
  value,
  strong
}: {
  label: string
  value: string
  strong?: boolean
}): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={[
          'mt-0.5 tabular-nums',
          strong
            ? 'text-lg font-semibold text-gloria-brown dark:text-gloria-cream'
            : 'text-sm font-medium text-slate-700 dark:text-slate-200'
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}
