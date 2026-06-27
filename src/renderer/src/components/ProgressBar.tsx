interface ProgressBarProps {
  percent: number
  className?: string
}

export default function ProgressBar({ percent, className }: ProgressBarProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent))
  const done = clamped === 100
  return (
    <div
      className={['h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700', className ?? ''].join(' ')}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={[
          'h-full rounded-full transition-all duration-300',
          done ? 'bg-emerald-500' : 'bg-gloria-accent'
        ].join(' ')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}
