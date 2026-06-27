import { useCallback, useEffect, useState } from 'react'
import { formatZar } from '../../../shared/defaults'
import { useStoreScope } from '../hooks/useStoreScope'
import type { StorePurchaseView } from '../../../shared/types'

export default function Purchases(): JSX.Element {
  const { storeMode, oceansId } = useStoreScope()
  const [stores, setStores] = useState<Array<{ storeId: number; storeName: string }>>([])
  const [storeId, setStoreId] = useState<number | null>(null)
  const [periods, setPeriods] = useState<string[]>([])
  const [period, setPeriod] = useState<string>('')
  const [view, setView] = useState<StorePurchaseView | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const loadStores = useCallback(async (): Promise<void> => {
    const list = await window.gloria.purchases.stores()
    setStores(list)
    setStoreId((cur) => cur ?? list[0]?.storeId ?? null)
  }, [])

  useEffect(() => {
    loadStores()
  }, [loadStores])

  // In Store mode, lock to Oceans Mall.
  useEffect(() => {
    if (storeMode && oceansId != null) setStoreId(oceansId)
  }, [storeMode, oceansId])

  useEffect(() => {
    if (storeId == null) return
    window.gloria.purchases.periods(storeId).then((p) => {
      setPeriods(p)
      setPeriod((cur) => (p.includes(cur) ? cur : p[0] ?? ''))
    })
  }, [storeId, stores])

  useEffect(() => {
    if (storeId == null || !period) {
      setView(null)
      return
    }
    window.gloria.purchases.view(storeId, period).then(setView)
  }, [storeId, period])

  async function runImport(): Promise<void> {
    setBusy(true)
    setMsg(null)
    try {
      const res = await window.gloria.purchases.import()
      if (res.cancelled) setMsg('Cancelled.')
      else if (res.error) setMsg(res.error)
      else
        setMsg(
          `Imported ${res.filesParsed} files (${res.linesImported} lines, ${formatZar(res.totalIncl)}): ${res.storesUpdated.join(', ')}.`
        )
      await loadStores()
    } finally {
      setBusy(false)
    }
  }

  const lines = view?.lines ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">Purchases</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Per-store purchase journal. <strong>Oceans Mall</strong> feeds SARS; other stores are for
            invoicing &amp; record-keeping.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={runImport}
          className="shrink-0 rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
        >
          {busy ? 'Importing…' : 'Import purchases'}
        </button>
      </header>

      {msg && (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      {stores.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-800">
          No purchases yet. Click “Import purchases” and choose your Store Purchases folder.
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            {!storeMode && (
              <select
                value={storeId ?? ''}
                onChange={(e) => setStoreId(Number(e.target.value))}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
              >
                {stores.map((s) => (
                  <option key={s.storeId} value={s.storeId}>
                    {s.storeName}
                  </option>
                ))}
              </select>
            )}
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
            >
              {periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {view && (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card label="Excl VAT" value={formatZar(view.totals.excl)} />
              <Card label="VAT" value={formatZar(view.totals.vat)} />
              <Card label="Total incl" value={formatZar(view.totals.incl)} accent />
              <Card label="Line items" value={String(view.totals.count)} />
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gloria-brown text-gloria-cream">
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Invoice</th>
                  <th className="px-3 py-2 text-left font-semibold">Supplier</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Excl</th>
                  <th className="px-3 py-2 text-right font-semibold">VAT</th>
                  <th className="px-3 py-2 text-right font-semibold">Incl</th>
                </tr>
              </thead>
              <tbody>
                {lines.length > 0 ? (
                  lines.map((l) => (
                    <tr key={l.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                      <td className="px-3 py-2 tabular-nums text-slate-500">{l.txn_date}</td>
                      <td className="px-3 py-2 text-slate-400">{l.invoice_no}</td>
                      <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{l.supplier}</td>
                      <td className="max-w-[240px] truncate px-3 py-2 text-slate-500">{l.description}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatZar(l.excl_vat)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-500">{formatZar(l.vat)}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{formatZar(l.incl_vat)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                      No purchases for this month.
                    </td>
                  </tr>
                )}
              </tbody>
              {view && lines.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gloria-brown font-bold text-gloria-brown dark:text-gloria-cream">
                    <td className="px-3 py-2.5" colSpan={4}>
                      Total ({view.totals.count})
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatZar(view.totals.excl)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatZar(view.totals.vat)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatZar(view.totals.incl)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
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
