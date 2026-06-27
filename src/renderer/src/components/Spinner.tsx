export default function Spinner({ className = '' }: { className?: string }): JSX.Element {
  return (
    <span
      role="status"
      aria-label="Working"
      className={[
        'inline-block animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em]',
        className
      ].join(' ')}
      style={{ width: '1em', height: '1em' }}
    />
  )
}
