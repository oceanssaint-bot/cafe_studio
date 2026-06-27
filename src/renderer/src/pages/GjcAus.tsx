import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useActivity } from '../context/ActivityContext'
import type { AusAccountView } from '../../../shared/types'

const usd = (n: number): string =>
  'US$ ' + (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function fmtDate(d: string): string {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : d
}

export default function GjcAus(): JSX.Element {
  const [ledger, setLedger] = useState<'all' | 'royalty' | 'stock'>('all')
  const [view, setView] = useState<AusAccountView | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const { run } = useActivity()

  const refresh = useCallback(async (): Promise<void> => {
    setView(await window.gloria.aus.get(ledger))
  }, [ledger])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function runImport(): Promise<void> {
    setBusy(true)
    setMsg(null)
    try {
      const res = await run('Importing Aus ledgers', () => window.gloria.aus.import())
      if (!res) return
      if (res.cancelled) setMsg('Cancelled.')
      else if (res.error) setMsg(res.error)
      else setMsg(`Imported ${res.linesImported} transactions from ${res.filesParsed} ledger(s).`)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  const lines = view?.lines ?? []
  const empty = (view?.totals.count ?? 0) === 0

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
            GJC Australia Account
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            What GJC South Africa owes Gloria Jeans International — royalty (1% franchise fees) &amp; stock,
            in USD.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={runImport}
          className="shrink-0 rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
        >
          {busy ? 'Importing…' : 'Import Aus ledgers'}
        </button>
      </header>

      {msg && (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      {empty ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-800">
          No Australia transactions yet. Click “Import Aus ledgers” and choose your GJC Aus Account folder.
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Card label="Charged (USD)" value={usd(view!.totals.charged)} />
            <Card label="Paid (USD)" value={usd(view!.totals.paid)} />
            <Card label="Balance owed (USD)" value={usd(view!.totals.balance)} accent />
          </div>

          {/* per-ledger breakdown */}
          <div className="mb-4 flex flex-wrap gap-2">
            <Chip active={ledger === 'all'} onClick={() => setLedger('all')}>
              All ({view!.totals.count})
            </Chip>
            {view!.ledgers.map((l) => (
              <Chip
                key={l.ledger}
                active={ledger === l.ledger}
                onClick={() => setLedger(l.ledger as 'royalty' | 'stock')}
              >
                {l.ledger === 'royalty' ? 'Royalty' : 'Stock'} — {usd(l.balance)} ({l.count})
              </Chip>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gloria-brown text-gloria-cream">
                  <th className="px-3 py-2 text-left font-semibold">Date</th>
                  <th className="px-3 py-2 text-left font-semibold">Ledger</th>
                  <th className="px-3 py-2 text-left font-semibold">Type</th>
                  <th className="px-3 py-2 text-left font-semibold">Doc</th>
                  <th className="px-3 py-2 text-left font-semibold">Description</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount (USD)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                    <td className="px-3 py-2 tabular-nums text-slate-500">{fmtDate(l.txn_date)}</td>
                    <td className="px-3 py-2 capitalize text-slate-400">{l.ledger}</td>
                    <td className="px-3 py-2 text-slate-500">{l.txn_type}</td>
                    <td className="px-3 py-2 text-slate-400">{l.doc_no}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-slate-600 dark:text-slate-300">
                      {l.description}
                    </td>
                    <td
                      className={[
                        'px-3 py-2 text-right font-medium tabular-nums',
                        l.amount_usd < 0 ? 'text-emerald-600' : 'text-slate-700 dark:text-slate-200'
                      ].join(' ')}
                    >
                      {usd(l.amount_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Negative amounts (green) are payments made to Australia. Balance owed = charged − paid.
          </p>
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

function Chip({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-gloria-accent bg-gloria-accent text-white'
          : 'border-slate-300 text-slate-600 hover:border-gloria-accent dark:border-slate-600 dark:text-slate-300'
      ].join(' ')}
    >
      {children}
    </button>
  )
}
