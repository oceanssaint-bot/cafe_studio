import { useCallback, useEffect, useState } from 'react'
import { formatZar } from '../../../shared/defaults'
import type { StatementStoreRef, StatementView, ExportResult } from '../../../shared/types'

export default function Statements(): JSX.Element {
  const [stores, setStores] = useState<StatementStoreRef[]>([])
  const [storeId, setStoreId] = useState<number | null>(null)
  const [view, setView] = useState<StatementView | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const loadStores = useCallback(async (): Promise<void> => {
    const list = await window.gloria.statements.list()
    setStores(list)
    setStoreId((cur) => cur ?? (list[0]?.storeId ?? null))
  }, [])

  useEffect(() => {
    loadStores()
  }, [loadStores])

  useEffect(() => {
    if (storeId == null) {
      setView(null)
      return
    }
    window.gloria.statements.get(storeId).then(setView)
  }, [storeId, stores])

  async function runImport(): Promise<void> {
    setBusy(true)
    setMsg(null)
    try {
      const res = await window.gloria.statements.import()
      if (res.cancelled) setMsg('Cancelled.')
      else if (res.error) setMsg(res.error)
      else
        setMsg(
          `Imported ${res.filesParsed} statements (${res.linesImported} lines): ${res.storesUpdated.join(', ')}.`
        )
      await loadStores()
      if (storeId != null) setView(await window.gloria.statements.get(storeId))
    } finally {
      setBusy(false)
    }
  }

  async function syncRoyalties(): Promise<void> {
    const res = await window.gloria.statements.syncRoyalties()
    setMsg(`Appended ${res.added} royalty line(s) from the royalty ledger.`)
    await loadStores()
    if (storeId != null) setView(await window.gloria.statements.get(storeId))
  }

  async function exportRun(fn: () => Promise<ExportResult>, label: string): Promise<void> {
    const res = await fn()
    if (res.error) setMsg(`${label} failed: ${res.error}`)
    else if (res.saved && res.path) setMsg(`Saved to ${res.path}`)
    else if (res.saved) setMsg('Print dialog opened.')
  }

  const lines = view?.lines ?? []

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
            Statements of Account
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Each store’s running debtor ledger — stock invoices, royalties and payments, with a live
            balance.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={syncRoyalties}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Sync royalties
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={runImport}
            className="rounded-md bg-gloria-accent px-3 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
          >
            {busy ? 'Importing…' : 'Import statements'}
          </button>
        </div>
      </header>

      {msg && (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      {/* Store tabs */}
      {stores.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {stores.map((s) => (
            <button
              key={s.storeId}
              type="button"
              onClick={() => setStoreId(s.storeId)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium',
                s.storeId === storeId
                  ? 'border-gloria-accent bg-gloria-accent text-white'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
              ].join(' ')}
            >
              {s.storeName} <span className="opacity-60">{formatZar(s.balance)}</span>
            </button>
          ))}
        </div>
      )}

      {!view || lines.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-800">
          {stores.length === 0
            ? 'No statements yet. Click “Import statements” and choose your GJC Statement folder.'
            : 'No transactions for this store.'}
        </div>
      ) : (
        <>
          {/* Account summary + export */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-3">
              <Card label="Invoiced" value={formatZar(view.summary.invoiced)} />
              <Card label="Paid" value={formatZar(view.summary.paid)} />
              <Card label="Balance due" value={formatZar(view.summary.balance)} accent />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => exportRun(() => window.gloria.statements.print(view.storeId), 'Print')}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => exportRun(() => window.gloria.statements.exportPdf(view.storeId), 'Export')}
                className="rounded-md bg-gloria-accent px-3 py-2 text-sm font-medium text-white hover:bg-gloria-brown"
              >
                Export PDF
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gloria-brown text-gloria-cream">
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Transaction</th>
                  <th className="px-3 py-2 text-left font-semibold">Details</th>
                  <th className="px-3 py-2 text-right font-semibold">Debit</th>
                  <th className="px-3 py-2 text-right font-semibold">Credit</th>
                  <th className="px-3 py-2 text-right font-semibold">Balance</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                    <td className="px-3 py-2 tabular-nums text-slate-500">{l.line_date}</td>
                    <td className="px-3 py-2 text-slate-500">
                      {l.tx_type === 'payment' ? 'Payment' : l.tx_type === 'royalty' ? 'Royalty' : 'Invoice'}
                    </td>
                    <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{l.details}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.debit ? formatZar(l.debit) : ''}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                      {l.credit ? formatZar(l.credit) : ''}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-gloria-brown dark:text-gloria-cream">
                      {formatZar(l.balance ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
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
        'rounded-lg border px-4 py-2',
        accent
          ? 'border-gloria-brown bg-gloria-brown text-gloria-cream'
          : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'
      ].join(' ')}
    >
      <p className={['text-[11px] uppercase tracking-wide', accent ? 'text-gloria-cream/70' : 'text-slate-400'].join(' ')}>
        {label}
      </p>
      <p className={['text-base font-bold tabular-nums', accent ? 'text-white' : 'text-gloria-brown dark:text-gloria-cream'].join(' ')}>
        {value}
      </p>
    </div>
  )
}
