import { useEffect, useState } from 'react'
import { useNav } from '../context/NavContext'
import type { PageId } from '../navigation'
import type { Alert } from '../../../shared/types'

const STYLE: Record<Alert['severity'], { dot: string; ring: string; chip: string }> = {
  urgent: { dot: 'bg-red-500', ring: 'border-red-200 dark:border-red-900/40', chip: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  warn: { dot: 'bg-amber-500', ring: 'border-amber-200 dark:border-amber-900/40', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  info: { dot: 'bg-sky-500', ring: 'border-sky-200 dark:border-sky-900/40', chip: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  good: { dot: 'bg-emerald-500', ring: 'border-emerald-200 dark:border-emerald-900/40', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' }
}

export default function AlertsPanel({
  mode,
  storeId,
  period
}: {
  mode: 'store' | 'franchise'
  storeId: number | null
  period: string
}): JSX.Element {
  const { navigate } = useNav()
  const [alerts, setAlerts] = useState<Alert[] | null>(null)

  useEffect(() => {
    if (mode === 'store' && storeId == null) return
    window.gloria.alerts.get(mode, storeId, period).then(setAlerts).catch(() => setAlerts([]))
  }, [mode, storeId, period])

  if (!alerts) return <div />
  const actionable = alerts.filter((a) => a.severity !== 'good').length

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base">🔔</span>
        <h3 className="text-sm font-semibold text-gloria-brown dark:text-gloria-cream">
          Needs attention today
        </h3>
        {actionable > 0 && (
          <span className="rounded-full bg-gloria-accent px-2 py-0.5 text-[11px] font-bold text-white">
            {actionable}
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {alerts.map((a) => {
          const st = STYLE[a.severity]
          const clickable = !!a.page
          return (
            <li key={a.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => a.page && navigate({ page: a.page as PageId })}
                className={[
                  'flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors',
                  st.ring,
                  clickable ? 'hover:bg-slate-50 dark:hover:bg-slate-700/50' : 'cursor-default'
                ].join(' ')}
              >
                <span className={['mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full', st.dot].join(' ')} />
                <span className="flex-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{a.title}</span>
                  <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{a.detail}</span>
                </span>
                {clickable && <span className="mt-0.5 shrink-0 text-xs text-gloria-accent">Open →</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
