import { useEffect, useRef, useState } from 'react'
import { useNav } from '../context/NavContext'
import { CATEGORY_LABEL, periodLabel } from '../../../shared/defaults'
import type { SearchResults } from '../../../shared/types'

interface SearchPaletteProps {
  open: boolean
  onClose: () => void
}

const EMPTY: SearchResults = { tasks: [], stores: [] }

export default function SearchPalette({ open, onClose }: SearchPaletteProps): JSX.Element | null {
  const { navigate } = useNav()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults>(EMPTY)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(EMPTY)
      // Focus after the modal paints.
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      setResults(EMPTY)
      return
    }
    let active = true
    window.gloria.search(q).then((r) => {
      if (active) setResults(r)
    })
    return () => {
      active = false
    }
  }, [query, open])

  if (!open) return null

  const hasResults = results.tasks.length > 0 || results.stores.length > 0

  function go(fn: () => void): void {
    fn()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onClose()}
          placeholder="Search tasks and stores…"
          className="w-full border-b border-slate-100 px-4 py-3 text-sm focus:outline-none dark:border-slate-700 dark:bg-slate-800"
        />
        <div className="max-h-80 overflow-y-auto p-2">
          {!query.trim() ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              Type to search across months and stores.
            </p>
          ) : !hasResults ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">
              No matches for “{query}”.
            </p>
          ) : (
            <>
              {results.tasks.length > 0 && (
                <Section label="Tasks">
                  {results.tasks.map((t) => (
                    <Row
                      key={`t-${t.id}`}
                      onClick={() => go(() => navigate({ page: 'month-end', period: t.period }))}
                      title={t.title}
                      meta={`${periodLabel(t.period)} · ${t.status === 'complete' ? 'Complete' : 'Pending'}`}
                      icon="✓"
                    />
                  ))}
                </Section>
              )}
              {results.stores.length > 0 && (
                <Section label="Stores">
                  {results.stores.map((s) => (
                    <Row
                      key={`s-${s.id}`}
                      onClick={() => go(() => navigate({ page: 'stores', storeId: s.id }))}
                      title={s.name}
                      meta={CATEGORY_LABEL[s.category]}
                      icon="⌂"
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mb-1">
      <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      {children}
    </div>
  )
}

function Row({
  title,
  meta,
  icon,
  onClick
}: {
  title: string
  meta: string
  icon: string
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
    >
      <span className="w-4 text-center text-slate-400">{icon}</span>
      <span className="flex-1 truncate text-sm text-slate-800 dark:text-slate-100">{title}</span>
      <span className="shrink-0 text-xs text-slate-400">{meta}</span>
    </button>
  )
}
