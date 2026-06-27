import { useEffect, useState } from 'react'
import { useOfficeMode } from '../context/OfficeModeContext'

/**
 * In Store mode the app is a single shop (Oceans Mall), so store/entity-scoped
 * pages should lock to that store and hide their pickers. Returns whether we're
 * in store mode and the resolved Oceans store id.
 */
export function useStoreScope(): { storeMode: boolean; oceansId: number | null } {
  const { mode } = useOfficeMode()
  const [oceansId, setOceansId] = useState<number | null>(null)

  useEffect(() => {
    if (mode !== 'store') return
    window.gloria.stores
      .list(false)
      .then((list) => {
        const o = list.find((s) => /oceans/i.test(s.name)) ?? list[0]
        setOceansId(o?.id ?? null)
      })
      .catch(() => setOceansId(null))
  }, [mode])

  return { storeMode: mode === 'store', oceansId }
}
