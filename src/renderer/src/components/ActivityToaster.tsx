import { useEffect, useState } from 'react'
import Spinner from './Spinner'
import { useActivity } from '../context/ActivityContext'

/** Bottom-right stack: live "working…" spinners (with elapsed seconds) + error toasts. */
export default function ActivityToaster(): JSX.Element {
  const { activities, errors, dismissError } = useActivity()
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    if (activities.length === 0) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [activities.length])

  if (activities.length === 0 && errors.length === 0) return <div />

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-80 flex-col gap-2">
      {activities.map((a) => (
        <div
          key={a.id}
          className="pointer-events-auto flex items-center gap-3 rounded-lg border border-gloria-accent/40 bg-white px-4 py-3 shadow-lg dark:border-gloria-accent/40 dark:bg-slate-800"
        >
          <Spinner className="text-gloria-accent" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gloria-brown dark:text-gloria-cream">{a.label}…</p>
            <p className="text-xs text-slate-400">{Math.max(0, Math.round((now - a.start) / 1000))}s — please keep the app open</p>
          </div>
        </div>
      ))}
      {errors.map((e) => (
        <div
          key={e.id}
          className="pointer-events-auto flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 shadow-lg dark:border-red-900/50 dark:bg-red-950/40"
        >
          <span className="mt-0.5 text-red-500">⚠</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">{e.label} failed</p>
            <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{e.message}</p>
          </div>
          <button
            type="button"
            onClick={() => dismissError(e.id)}
            className="text-red-400 hover:text-red-600"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
