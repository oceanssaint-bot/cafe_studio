import { useCallback, useEffect, useState } from 'react'
import PeriodSelector from '../components/PeriodSelector'
import { currentPeriod, formatZar } from '../../../shared/defaults'
import { useStoreScope } from '../hooks/useStoreScope'
import { useActivity } from '../context/ActivityContext'
import type { LedgerEntity, PayrollView } from '../../../shared/types'

const blank = { employee: '', emp_no: '', gross: '', net: '' }

export default function Payroll(): JSX.Element {
  const { storeMode, oceansId } = useStoreScope()
  const { run } = useActivity()
  const [entities, setEntities] = useState<LedgerEntity[]>([])
  const [entityId, setEntityId] = useState<number>(0)
  const [period, setPeriod] = useState<string>(currentPeriod())
  const [data, setData] = useState<PayrollView | null>(null)
  const [form, setForm] = useState({ ...blank })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    window.gloria.ledger.entities().then(setEntities)
  }, [])

  useEffect(() => {
    if (storeMode && oceansId != null) setEntityId(oceansId)
  }, [storeMode, oceansId])

  const refresh = useCallback(async (): Promise<void> => {
    setData(await window.gloria.payroll.get(entityId, period))
  }, [entityId, period])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function add(): Promise<void> {
    if (!form.employee.trim()) return
    await window.gloria.payroll.add({
      entity_store_id: entityId,
      period,
      employee: form.employee,
      emp_no: form.emp_no,
      gross: parseFloat(form.gross) || 0,
      net: parseFloat(form.net) || 0,
      notes: ''
    })
    setForm({ ...blank })
    refresh()
  }

  const entityName = entities.find((e) => e.id === entityId)?.name ?? 'Head Office'

  async function importHours(): Promise<void> {
    setBusy(true)
    setMsg(null)
    try {
      const res = await run('Importing staff hours', () => window.gloria.payroll.importHours())
      if (!res) return
      if (res.cancelled) setMsg('Cancelled.')
      else if (res.error) setMsg(res.error)
      else
        setMsg(
          `Imported ${res.employees} staff across ${res.filesParsed} timesheets (${res.storesUpdated.join(', ')}). Total gross ${formatZar(res.totalGross)}.`
        )
      refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">Payroll</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Staff pay for {entityName}. Import WAGES timesheets, add manually, or read payslip photos in
            Documents.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={importHours}
          className="shrink-0 rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
        >
          {busy ? 'Importing…' : 'Import staff hours'}
        </button>
      </header>

      {msg && (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
        <PeriodSelector period={period} onChange={setPeriod} />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Total label="Employees" value={String(data?.totals.count ?? 0)} />
        <Total label="Total gross" value={formatZar(data?.totals.gross ?? 0)} />
        <Total label="Total net" value={formatZar(data?.totals.net ?? 0)} strong />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gloria-brown text-gloria-cream">
              <th className="px-4 py-2 text-left font-semibold">Employee</th>
              <th className="px-4 py-2 text-left font-semibold">Emp No</th>
              <th className="px-4 py-2 text-right font-semibold">Gross</th>
              <th className="px-4 py-2 text-right font-semibold">Net</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((it) => (
              <tr key={it.id} className="group border-b border-slate-100 last:border-0 dark:border-slate-700">
                <td className="px-4 py-2 text-slate-700 dark:text-slate-200">{it.employee}</td>
                <td className="px-4 py-2 text-slate-500">{it.emp_no || '—'}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatZar(it.gross)}</td>
                <td className="px-4 py-2 text-right font-medium tabular-nums">{formatZar(it.net)}</td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => window.gloria.payroll.remove(it.id).then(refresh)}
                    className="text-xs text-red-400 opacity-0 group-hover:opacity-100 hover:underline"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
            <tr className="bg-slate-50 dark:bg-slate-900/40">
              <td className="px-3 py-1.5">
                <input placeholder="Name" value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })} className={cell} />
              </td>
              <td className="px-3 py-1.5">
                <input placeholder="No." value={form.emp_no} onChange={(e) => setForm({ ...form, emp_no: e.target.value })} className={cell} />
              </td>
              <td className="px-3 py-1.5">
                <input placeholder="gross" inputMode="decimal" value={form.gross} onChange={(e) => setForm({ ...form, gross: e.target.value })} className={cell + ' text-right'} />
              </td>
              <td className="px-3 py-1.5">
                <input placeholder="net" inputMode="decimal" value={form.net} onChange={(e) => setForm({ ...form, net: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} className={cell + ' text-right'} />
              </td>
              <td className="px-3 py-1.5 text-right">
                <button type="button" onClick={add} disabled={!form.employee.trim()} className="rounded bg-gloria-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-40">
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

const cell =
  'w-full rounded border border-slate-300 px-2 py-1 text-xs focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900'

function Total({ label, value, strong }: { label: string; value: string; strong?: boolean }): JSX.Element {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={['mt-0.5 tabular-nums', strong ? 'text-xl font-semibold text-gloria-brown dark:text-gloria-cream' : 'text-base font-medium text-slate-700 dark:text-slate-200'].join(' ')}>
        {value}
      </p>
    </div>
  )
}
