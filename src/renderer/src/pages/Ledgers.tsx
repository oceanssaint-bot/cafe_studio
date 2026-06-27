import { useCallback, useEffect, useState } from 'react'
import { formatZar } from '../../../shared/defaults'
import { useStoreScope } from '../hooks/useStoreScope'
import type {
  LedgerEntity,
  LedgerKind,
  LedgerView,
  LedgerImportSummary
} from '../../../shared/types'

export default function Ledgers(): JSX.Element {
  const { storeMode, oceansId } = useStoreScope()
  const [entities, setEntities] = useState<LedgerEntity[]>([])
  const [entityId, setEntityId] = useState<number>(0) // 0 = Head Office
  const [kind, setKind] = useState<LedgerKind>('creditor')
  const [view, setView] = useState<LedgerView | null>(null)
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    window.gloria.ledger.entities().then(setEntities)
  }, [])

  useEffect(() => {
    if (storeMode && oceansId != null) setEntityId(oceansId)
  }, [storeMode, oceansId])

  const refresh = useCallback(async (): Promise<void> => {
    setView(await window.gloria.ledger.view(kind, entityId))
  }, [kind, entityId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function runImport(): Promise<void> {
    setImporting(true)
    setMsg(null)
    try {
      const r: LedgerImportSummary = await window.gloria.ledger.import()
      if (r.cancelled) setMsg('Cancelled.')
      else if (r.error) setMsg(`Failed: ${r.error}`)
      else
        setMsg(
          `Imported from ${r.sourceFile}: ${r.creditorsHO} Head-Office creditor(s), ${r.creditorsStores} store creditor(s), ${r.debtors} debtor invoice(s).`
        )
      refresh()
    } finally {
      setImporting(false)
    }
  }

  async function markPaid(id: number, total: number): Promise<void> {
    await window.gloria.ledger.markPaid(id, total)
    refresh()
  }
  async function unpay(id: number): Promise<void> {
    await window.gloria.ledger.markPaid(id, 0)
    refresh()
  }
  async function remove(id: number): Promise<void> {
    await window.gloria.ledger.remove(id)
    refresh()
  }

  function toggle(party: string): void {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(party) ? next.delete(party) : next.add(party)
      return next
    })
  }

  const entityName = entities.find((e) => e.id === entityId)?.name ?? 'Head Office'
  const partyLabel = kind === 'creditor' ? 'Supplier' : 'Debtor'

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
            Creditors &amp; Debtors
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {kind === 'creditor' ? 'Who ' : 'Who owes '}
            <span className="font-medium">{entityName}</span>
            {kind === 'creditor' ? ' owes.' : '.'}
          </p>
        </div>
        <button
          type="button"
          onClick={runImport}
          disabled={importing}
          className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
        >
          {importing ? 'Importing…' : 'Import from schedule'}
        </button>
      </header>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
          {(['creditor', 'debtor'] as LedgerKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={[
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                kind === k
                  ? 'bg-gloria-accent text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
              ].join(' ')}
            >
              {k === 'creditor' ? 'Creditors' : 'Debtors'}
            </button>
          ))}
        </div>
        {storeMode ? (
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{entityName}</span>
        ) : (
          <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            Entity
            <select
              value={entityId}
              onChange={(e) => setEntityId(Number(e.target.value))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {msg && (
        <p className="mb-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      {/* Totals */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Total label="Total invoiced" value={formatZar(view?.totals.total ?? 0)} />
        <Total label="Paid" value={formatZar(view?.totals.paid ?? 0)} />
        <Total label="Outstanding" value={formatZar(view?.totals.owing ?? 0)} strong />
      </div>

      {/* Grouped list */}
      <div className="space-y-2">
        {view && view.groups.length > 0 ? (
          view.groups.map((g) => {
            const open = expanded.has(g.party)
            return (
              <div
                key={g.party}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
              >
                <button
                  type="button"
                  onClick={() => toggle(g.party)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-slate-400">{open ? '▾' : '▸'}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{g.party}</span>
                    <span className="text-xs text-slate-400">
                      {g.items.length} invoice{g.items.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="flex items-center gap-4 text-sm">
                    <span className="text-slate-400">{formatZar(g.total)}</span>
                    <span
                      className={[
                        'font-semibold tabular-nums',
                        g.owing > 0.01 ? 'text-red-500' : 'text-emerald-600'
                      ].join(' ')}
                    >
                      {g.owing > 0.01 ? `${formatZar(g.owing)} owing` : 'settled'}
                    </span>
                  </span>
                </button>
                {open && (
                  <table className="w-full border-t border-slate-100 text-sm dark:border-slate-700">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-1.5">Invoice</th>
                        <th className="px-4 py-1.5">Date</th>
                        <th className="px-4 py-1.5">Description</th>
                        <th className="px-4 py-1.5 text-right">Total</th>
                        <th className="px-4 py-1.5 text-right">Owing</th>
                        <th className="px-4 py-1.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((it) => (
                        <tr
                          key={it.id}
                          className="group border-t border-slate-50 dark:border-slate-700/50"
                        >
                          <td className="px-4 py-1.5 text-slate-600 dark:text-slate-300">
                            {it.invoice_no || '—'}
                          </td>
                          <td className="px-4 py-1.5 text-slate-500">{it.invoice_date || '—'}</td>
                          <td className="px-4 py-1.5 text-slate-500 dark:text-slate-400">
                            {it.description}
                          </td>
                          <td className="px-4 py-1.5 text-right tabular-nums">
                            {formatZar(it.total_incl)}
                          </td>
                          <td
                            className={[
                              'px-4 py-1.5 text-right tabular-nums',
                              it.owing > 0.01 ? 'text-red-500' : 'text-emerald-600'
                            ].join(' ')}
                          >
                            {formatZar(it.owing)}
                          </td>
                          <td className="px-4 py-1.5 text-right">
                            <span className="flex justify-end gap-2 opacity-0 group-hover:opacity-100">
                              {it.owing > 0.01 ? (
                                <button
                                  type="button"
                                  onClick={() => markPaid(it.id, it.total_incl)}
                                  className="text-xs text-emerald-600 hover:underline"
                                >
                                  mark paid
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => unpay(it.id)}
                                  className="text-xs text-slate-400 hover:underline"
                                >
                                  unpay
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => remove(it.id)}
                                className="text-xs text-red-400 hover:underline"
                              >
                                ✕
                              </button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-10 text-center dark:border-slate-700 dark:bg-slate-800/40">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No {kind === 'creditor' ? 'creditors' : 'debtors'} for {entityName} yet. Click{' '}
              <span className="font-medium">Import from schedule</span> to pull them from your
              Creditors Schedule.
            </p>
          </div>
        )}
      </div>
      {view && view.groups.length > 0 && (
        <p className="mt-3 text-xs text-slate-400">
          {partyLabel}s sorted by outstanding amount. Hover a row to mark paid or remove.
        </p>
      )}
    </div>
  )
}

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
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={[
          'mt-0.5 tabular-nums',
          strong
            ? 'text-xl font-semibold text-red-500'
            : 'text-base font-medium text-slate-700 dark:text-slate-200'
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  )
}
