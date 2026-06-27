import { useEffect, useState } from 'react'
import ProgressBar from '../components/ProgressBar'
import AlertsPanel from '../components/AlertsPanel'
import { useNav } from '../context/NavContext'
import { currentPeriod, formatZar } from '../../../shared/defaults'
import type { Store, StoreOverview, TaskStats } from '../../../shared/types'

export default function StoreDashboard(): JSX.Element {
  const { navigate } = useNav()
  const [store, setStore] = useState<Store | null>(null)
  const [periods, setPeriods] = useState<string[]>([])
  const [period, setPeriod] = useState<string>(currentPeriod())
  const [ov, setOv] = useState<StoreOverview | null>(null)
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [packMsg, setPackMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Resolve the store (Oceans) and its periods once.
  useEffect(() => {
    window.gloria.stores
      .list(false)
      .then((list) => {
        const oceans = list.find((s) => /oceans/i.test(s.name)) ?? list[0] ?? null
        setStore(oceans)
        if (!oceans) return
        window.gloria.store.periods(oceans.id).then((ps) => {
          setPeriods(ps)
          // default to the most recent month that actually has data
          setPeriod((cur) => (ps.includes(cur) ? cur : ps[0] ?? cur))
        })
      })
      .catch(() => setStore(null))
  }, [])

  useEffect(() => {
    if (!store) return
    window.gloria.store.overview(store.id, period).then(setOv).catch(() => setOv(null))
    window.gloria.tasks.stats(period).then(setStats).catch(() => setStats(null))
  }, [store, period])

  async function exportPack(): Promise<void> {
    if (!store) return
    setBusy(true)
    setPackMsg(null)
    try {
      const r = await window.gloria.store.exportPack(store.id, period)
      if (r.cancelled) setPackMsg('Cancelled.')
      else if (r.error) setPackMsg(r.error)
      else setPackMsg(`Pack for ${r.period} saved — send it to Head Office. (${r.path})`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
            {store?.name ?? 'Oceans Mall'} — Store
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Everything for this store
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
          >
            {(periods.includes(period) ? periods : [period, ...periods]).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={exportPack}
            className="rounded-md bg-gloria-accent px-3 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
          >
            {busy ? 'Exporting…' : 'Export pack → HO'}
          </button>
        </div>
      </header>

      {packMsg && (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {packMsg}
        </p>
      )}

      <AlertsPanel mode="store" storeId={store?.id ?? null} period={period} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Turnover" value={formatZar(ov?.turnover ?? 0)} onClick={() => navigate({ page: 'turnover' })} />
        <Stat label="Purchases (journal)" value={formatZar(ov?.purchases ?? 0)} onClick={() => navigate({ page: 'purchases' })} />
        <Stat label="Cash-up spend" value={formatZar(ov?.cashup ?? 0)} onClick={() => navigate({ page: 'cash-up' })} />
        <Stat label="Payroll gross" value={formatZar(ov?.payrollGross ?? 0)} sub={`${ov?.payrollCount ?? 0} staff`} onClick={() => navigate({ page: 'payroll' })} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Month-end progress */}
        <button
          type="button"
          onClick={() => navigate({ page: 'month-end' })}
          className="rounded-lg border border-slate-200 bg-white p-5 text-left transition-colors hover:border-gloria-accent dark:border-slate-700 dark:bg-slate-800"
        >
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Month-End Progress</h3>
          {stats === null ? (
            <p className="mt-2 text-sm text-slate-400">Loading…</p>
          ) : (
            <>
              <p className="mt-2 text-lg font-semibold text-gloria-brown dark:text-gloria-cream">
                {stats.percent}%
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {stats.completed}/{stats.total} tasks
                </span>
              </p>
              <ProgressBar percent={stats.percent} className="mt-3" />
            </>
          )}
        </button>

        {/* Owed to Head Office */}
        <button
          type="button"
          onClick={() => navigate({ page: 'ledgers' })}
          className="rounded-lg border border-amber-200 bg-amber-50/40 p-5 text-left transition-colors hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-900/10"
        >
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Owed to Head Office
          </h3>
          <p className="mt-2 text-lg font-semibold text-gloria-brown dark:text-gloria-cream">
            {formatZar(ov?.owedToHO ?? 0)}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Royalty {formatZar(ov?.royaltyFee ?? 0)} · Marketing {formatZar(ov?.marketingFee ?? 0)} (+VAT)
          </p>
        </button>
      </div>

      {/* Quick actions */}
      <section className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Quick actions</h3>
        <div className="flex flex-wrap gap-2">
          <Action label="Capture turnover" onClick={() => navigate({ page: 'turnover' })} />
          <Action label="Cash-up" onClick={() => navigate({ page: 'cash-up' })} />
          <Action label="Add purchases" onClick={() => navigate({ page: 'purchases' })} />
          <Action label="This month's tasks" onClick={() => navigate({ page: 'month-end' })} />
          <Action label="Export pack → HO" onClick={exportPack} />
        </div>
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  onClick
}: {
  label: string
  value: string
  sub?: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-white p-4 text-left transition-colors hover:border-gloria-accent dark:border-slate-700 dark:bg-slate-800"
    >
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-gloria-brown dark:text-gloria-cream">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </button>
  )
}

function Action({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-gloria-accent hover:text-gloria-accent dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
    >
      {label}
    </button>
  )
}
