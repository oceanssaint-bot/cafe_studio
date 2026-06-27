import { useCallback, useEffect, useState } from 'react'
import ProgressBar from '../components/ProgressBar'
import AlertsPanel from '../components/AlertsPanel'
import { useNav } from '../context/NavContext'
import { currentPeriod, periodLabel, formatZar } from '../../../shared/defaults'
import type { DbStatus, TaskStats, ActivityItem, PendingInvoice } from '../../../shared/types'

export default function Dashboard(): JSX.Element {
  const { navigate } = useNav()
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [pending, setPending] = useState<PendingInvoice[]>([])
  const [sendQueue, setSendQueue] = useState<PendingInvoice[]>([])
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState<string | null>(null)
  const period = currentPeriod()

  const loadQueues = useCallback(async (): Promise<void> => {
    setPending(await window.gloria.royalty.pending().catch(() => []))
    setSendQueue(await window.gloria.royalty.approvedUnsent().catch(() => []))
  }, [])

  useEffect(() => {
    window.gloria.getDbStatus().then(setStatus).catch(() => setStatus(null))
    window.gloria.tasks.stats(period).then(setStats).catch(() => setStats(null))
    window.gloria.activity(8).then(setActivity).catch(() => setActivity([]))
    loadQueues()
  }, [period, loadQueues])

  async function approve(id: number): Promise<void> {
    await window.gloria.royalty.setApproved(id, true)
    loadQueues()
  }
  async function approveAll(): Promise<void> {
    await window.gloria.royalty.approveAll()
    loadQueues()
  }
  const [importMsg, setImportMsg] = useState<string | null>(null)
  async function importPack(): Promise<void> {
    const r = await window.gloria.store.importPack()
    if (r.cancelled) return
    if (r.error) setImportMsg(r.error)
    else {
      setImportMsg(`Imported ${r.store} ${r.period}: turnover ${formatZar(r.turnover ?? 0)} — royalties can now be generated.`)
      loadQueues()
    }
  }
  async function exportApproved(): Promise<void> {
    setSending(true)
    setSendMsg(null)
    try {
      const res = await window.gloria.royalty.exportApproved()
      if (res.cancelled) setSendMsg('Cancelled.')
      else if (res.error) setSendMsg(`Exported ${res.count} before error: ${res.error}`)
      else if (res.count === 0) setSendMsg('Nothing to export.')
      else setSendMsg(`Exported ${res.count} invoice PDF(s) and opened the folder — ready to email.`)
      loadQueues()
    } finally {
      setSending(false)
    }
  }
  async function emailApproved(): Promise<void> {
    setSending(true)
    setSendMsg(null)
    try {
      const res = await window.gloria.royalty.emailApproved()
      if (res.cancelled) setSendMsg('Cancelled.')
      else if (res.error) setSendMsg(`Exported ${res.exported} before error: ${res.error}`)
      else {
        let m = `Exported ${res.exported} PDF(s), opened ${res.drafted} email draft(s) — attach the PDFs from the folder.`
        if (res.missingEmail.length)
          m += ` No billing email for: ${res.missingEmail.join(', ')} (add it in Settings).`
        setSendMsg(m)
      }
      loadQueues()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
            Dashboard
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Month-end progress at a glance.
          </p>
        </div>
        <button
          type="button"
          onClick={importPack}
          className="shrink-0 rounded-md border border-gloria-accent px-4 py-2 text-sm font-medium text-gloria-accent hover:bg-gloria-accent hover:text-white"
        >
          Import store pack
        </button>
      </header>

      {importMsg && (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50/60 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
          {importMsg}
        </p>
      )}

      <AlertsPanel mode="franchise" storeId={null} period={period} />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Month-end progress */}
        <button
          type="button"
          onClick={() => navigate({ page: 'month-end' })}
          className="rounded-lg border border-slate-200 bg-white p-5 text-left transition-colors hover:border-gloria-accent dark:border-slate-700 dark:bg-slate-800"
        >
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Month-End Progress
          </h3>
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
              <p className="mt-2 text-xs text-slate-400">{periodLabel(period)}</p>
            </>
          )}
        </button>

        {/* Database */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Database</h3>
          {status === null ? (
            <p className="mt-2 text-sm text-slate-400">Checking…</p>
          ) : status.ok ? (
            <>
              <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-emerald-600">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Connected
              </p>
              <p className="mt-1 text-xs text-slate-400">{status.tables.length} tables · SQLite</p>
            </>
          ) : (
            <p className="mt-2 text-lg font-semibold text-red-600">Error</p>
          )}
        </div>
      </div>

      {/* Invoices pending approval */}
      {pending.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gloria-brown dark:text-gloria-cream">
              Invoices pending approval{' '}
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                {pending.length}
              </span>
            </h3>
            <button
              type="button"
              onClick={approveAll}
              className="rounded-md bg-gloria-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-gloria-brown"
            >
              Approve all
            </button>
          </div>
          <div className="overflow-hidden rounded-lg border border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10">
            <ul className="divide-y divide-amber-100 dark:divide-amber-900/30">
              {pending.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="flex-1 text-slate-700 dark:text-slate-200">
                    Royalty invoice — <strong>{p.storeName}</strong>
                    <span className="ml-2 text-xs text-slate-400">{p.periodLabel}</span>
                  </span>
                  <span className="tabular-nums font-medium text-gloria-brown dark:text-gloria-cream">
                    {formatZar(p.total_incl)}
                  </span>
                  <button
                    type="button"
                    onClick={() => window.gloria.royalty.printInvoice(p.id)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => approve(p.id)}
                    className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                </li>
              ))}
            </ul>
            {pending.length > 8 && (
              <button
                type="button"
                onClick={() => navigate({ page: 'royalties' })}
                className="w-full px-4 py-2 text-center text-xs text-gloria-accent hover:underline"
              >
                +{pending.length - 8} more — open Royalties
              </button>
            )}
          </div>
        </section>
      )}

      {/* Approved — ready to send */}
      {sendQueue.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gloria-brown dark:text-gloria-cream">
              Ready to send{' '}
              <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                {sendQueue.length}
              </span>
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={sending}
                onClick={exportApproved}
                className="rounded-md border border-emerald-600 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
              >
                {sending ? 'Working…' : 'Export to folder'}
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={emailApproved}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {sending ? 'Working…' : 'Export & email'}
              </button>
            </div>
          </div>
          {sendMsg && (
            <p className="mb-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-1.5 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
              {sendMsg}
            </p>
          )}
          <div className="overflow-hidden rounded-lg border border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-900/10">
            <ul className="divide-y divide-emerald-100 dark:divide-emerald-900/30">
              {sendQueue.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="flex-1 text-slate-700 dark:text-slate-200">
                    <strong>{p.storeName}</strong>
                    <span className="ml-2 text-xs text-slate-400">{p.periodLabel}</span>
                  </span>
                  <span className="tabular-nums font-medium text-gloria-brown dark:text-gloria-cream">
                    {formatZar(p.total_incl)}
                  </span>
                </li>
              ))}
            </ul>
            {sendQueue.length > 6 && (
              <p className="px-4 py-2 text-center text-xs text-slate-400">
                +{sendQueue.length - 6} more — all included in the export
              </p>
            )}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          Quick actions
        </h3>
        <div className="flex flex-wrap gap-2">
          <QuickAction label="This month's tasks" onClick={() => navigate({ page: 'month-end' })} />
          <QuickAction label="Capture store data" onClick={() => navigate({ page: 'stores' })} />
          <QuickAction label="Generate report" onClick={() => navigate({ page: 'reports' })} />
          <QuickAction label="Backup & settings" onClick={() => navigate({ page: 'settings' })} />
        </div>
      </section>

      {/* Recent activity */}
      <section className="mt-6">
        <h3 className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          Recent activity
        </h3>
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          {activity === null ? (
            <p className="px-5 py-6 text-sm text-slate-400">Loading…</p>
          ) : activity.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              No activity yet. Complete a task or save store figures to see it here.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
              {activity.map((a, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() =>
                      a.kind === 'store_updated'
                        ? navigate({ page: 'stores', storeId: a.storeId })
                        : navigate({ page: 'month-end', period: a.period })
                    }
                    className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <span className="text-slate-400">
                      {a.kind === 'task_completed' ? '✓' : '⌂'}
                    </span>
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">
                      {a.label}
                      <span className="ml-2 text-xs text-slate-400">{a.detail}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {new Date(a.when).toLocaleDateString('en-ZA')}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
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
