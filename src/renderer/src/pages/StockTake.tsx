import { useCallback, useEffect, useState } from 'react'
import { formatZar } from '../../../shared/defaults'
import { useStoreScope } from '../hooks/useStoreScope'
import StockReconPanel from './StockReconPanel'
import type { LedgerEntity, StockTake } from '../../../shared/types'

export default function StockTakePage(): JSX.Element {
  const { storeMode, oceansId } = useStoreScope()
  const [entities, setEntities] = useState<LedgerEntity[]>([])
  const [entityId, setEntityId] = useState<number>(0)
  const [takes, setTakes] = useState<StockTake[]>([])
  const [form, setForm] = useState({ take_date: '', total_value: '', item_count: '' })

  useEffect(() => {
    window.gloria.ledger.entities().then(setEntities)
  }, [])

  useEffect(() => {
    if (storeMode && oceansId != null) setEntityId(oceansId)
  }, [storeMode, oceansId])

  const refresh = useCallback(async (): Promise<void> => {
    setTakes(await window.gloria.stock.list(entityId))
  }, [entityId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function add(): Promise<void> {
    const v = parseFloat(form.total_value) || 0
    if (!form.take_date || !v) return
    await window.gloria.stock.upsert({
      entity_store_id: entityId,
      take_date: form.take_date,
      total_value: v,
      item_count: parseInt(form.item_count) || 0
    })
    setForm({ take_date: '', total_value: '', item_count: '' })
    refresh()
  }

  const latest = takes[0]
  const entityName = entities.find((e) => e.id === entityId)?.name ?? 'Head Office'

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5">
        <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
          Stock Take
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Stock-take snapshots and value for {entityName}. Import via Settings → Import from archive.
        </p>
      </header>

      <div className="mb-4 flex items-center justify-between gap-3">
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
        {latest && (
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Latest ({latest.take_date})
            </p>
            <p className="text-lg font-semibold text-gloria-brown dark:text-gloria-cream">
              {formatZar(latest.total_value)}
            </p>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gloria-brown text-gloria-cream">
              <th className="px-4 py-2 text-left font-semibold">Date</th>
              <th className="px-4 py-2 text-right font-semibold">Items</th>
              <th className="px-4 py-2 text-right font-semibold">Stock value</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {takes.map((t) => (
              <tr key={t.id} className="group border-b border-slate-100 last:border-0 dark:border-slate-700">
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{t.take_date}</td>
                <td className="px-4 py-2 text-right text-slate-500">{t.item_count}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">
                  {formatZar(t.total_value)}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => window.gloria.stock.remove(t.id).then(refresh)}
                    className="text-xs text-red-400 opacity-0 group-hover:opacity-100 hover:underline"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 dark:bg-slate-900/40">
              <td className="px-3 py-1.5">
                <input type="date" value={form.take_date} onChange={(e) => setForm({ ...form, take_date: e.target.value })} className={cell} />
              </td>
              <td className="px-3 py-1.5">
                <input placeholder="items" inputMode="numeric" value={form.item_count} onChange={(e) => setForm({ ...form, item_count: e.target.value })} className={cell + ' text-right'} />
              </td>
              <td className="px-3 py-1.5">
                <input placeholder="value" inputMode="decimal" value={form.total_value} onChange={(e) => setForm({ ...form, total_value: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} className={cell + ' text-right'} />
              </td>
              <td className="px-3 py-1.5 text-right">
                <button type="button" onClick={add} disabled={!form.take_date || !form.total_value} className="rounded bg-gloria-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-40">
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      {takes.length === 0 && (
        <p className="mt-3 text-center text-sm text-slate-400">
          No stock takes yet. Add one above, or import your “GJC SA Stock Sheet” files via Settings →
          Import from archive.
        </p>
      )}

      {!storeMode && <StockReconPanel />}
    </div>
  )
}

const cell =
  'w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900'
