import { periodLabel, shiftPeriod, currentPeriod } from '../../../shared/defaults'

interface PeriodSelectorProps {
  period: string
  onChange: (period: string) => void
}

export default function PeriodSelector({ period, onChange }: PeriodSelectorProps): JSX.Element {
  const isCurrent = period === currentPeriod()
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous month"
        onClick={() => onChange(shiftPeriod(period, -1))}
        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        ‹
      </button>
      <div className="min-w-[9.5rem] text-center text-sm font-semibold text-gloria-brown dark:text-gloria-cream">
        {periodLabel(period)}
      </div>
      <button
        type="button"
        aria-label="Next month"
        onClick={() => onChange(shiftPeriod(period, 1))}
        className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
      >
        ›
      </button>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => onChange(currentPeriod())}
          className="ml-1 rounded-md px-2 py-1.5 text-xs font-medium text-gloria-accent hover:underline"
        >
          This month
        </button>
      )}
    </div>
  )
}
