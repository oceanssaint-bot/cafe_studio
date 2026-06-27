import { useCallback, useEffect, useMemo, useState } from 'react'
import StoreDetail from './stores/StoreDetail'
import StoreEditor from './stores/StoreEditor'
import { CATEGORY_LABEL, currentPeriod } from '../../../shared/defaults'
import type { Store, StoreCategory } from '../../../shared/types'

export default function Stores({ initialStoreId }: { initialStoreId?: number }): JSX.Element {
  const [stores, setStores] = useState<Store[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(initialStoreId ?? null)
  const [period, setPeriod] = useState<string>(currentPeriod())
  const [editing, setEditing] = useState<Store | 'new' | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const refresh = useCallback(async (): Promise<void> => {
    const list = await window.gloria.stores.list(true)
    setStores(list)
    setSelectedId((id) => id ?? list.find((s) => !s.archived)?.id ?? null)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const visible = useMemo(
    () => stores.filter((s) => showArchived || !s.archived),
    [stores, showArchived]
  )

  const grouped = useMemo(() => {
    const groups: Record<StoreCategory, Store[]> = { head_office: [], franchise: [] }
    for (const s of visible) groups[s.category].push(s)
    return groups
  }, [visible])

  const selected = stores.find((s) => s.id === selectedId) ?? null

  async function saveStore(input: {
    name: string
    category: StoreCategory
    australia: number
    archived: number
    address: string
    phone: string
    profile_notes: string
  }): Promise<void> {
    if (editing === 'new') {
      const created = await window.gloria.stores.create({
        name: input.name,
        category: input.category,
        include_in_australia: input.australia
      })
      await window.gloria.stores.update({
        id: created.id,
        name: input.name,
        category: input.category,
        include_in_australia: input.australia,
        archived: 0,
        address: input.address,
        phone: input.phone,
        profile_notes: input.profile_notes
      })
      await refresh()
      setSelectedId(created.id)
    } else if (editing) {
      await window.gloria.stores.update({
        id: editing.id,
        name: input.name,
        category: input.category,
        include_in_australia: input.australia,
        archived: input.archived,
        address: input.address,
        phone: input.phone,
        profile_notes: input.profile_notes
      })
      await refresh()
    }
    setEditing(null)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
            Stores
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Store information and monthly data.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown"
        >
          Add store
        </button>
      </header>

      <div className="grid gap-6 md:grid-cols-[15rem_1fr]">
        {/* Store list */}
        <nav className="space-y-4">
          {(['head_office', 'franchise'] as StoreCategory[]).map((cat) =>
            grouped[cat].length === 0 ? null : (
              <div key={cat}>
                <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {CATEGORY_LABEL[cat]}
                </p>
                <ul className="space-y-1">
                  {grouped[cat].map((store) => {
                    const active = store.id === selectedId
                    return (
                      <li key={store.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(store.id)}
                          className={[
                            'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                            active
                              ? 'bg-gloria-accent text-white'
                              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
                          ].join(' ')}
                        >
                          <span className={store.archived ? 'opacity-50' : ''}>{store.name}</span>
                          {store.archived === 1 && (
                            <span className="text-[10px] uppercase opacity-60">archived</span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          )}
          <label className="flex cursor-pointer items-center gap-2 px-1 text-xs text-slate-500 dark:text-slate-400">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="h-3.5 w-3.5 accent-gloria-accent"
            />
            Show archived
          </label>
        </nav>

        {/* Detail */}
        <div>
          {selected ? (
            <>
              <div className="mb-2 text-right">
                <button
                  type="button"
                  onClick={() => setEditing(selected)}
                  className="text-xs font-medium text-gloria-accent hover:underline"
                >
                  Edit store
                </button>
              </div>
              <StoreDetail store={selected} period={period} onPeriodChange={setPeriod} />
            </>
          ) : (
            <p className="text-sm text-slate-400">Loading stores…</p>
          )}
        </div>
      </div>

      {editing && (
        <StoreEditor
          store={editing === 'new' ? null : editing}
          onSave={saveStore}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
