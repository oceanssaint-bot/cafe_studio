import { createContext, useContext, useState, type ReactNode } from 'react'
import type { PageId } from '../navigation'

export interface NavTarget {
  page: PageId
  storeId?: number
  period?: string
}

interface NavContextValue {
  target: NavTarget
  /** Increments on every navigate so pages can re-init from new params. */
  nonce: number
  navigate: (target: NavTarget) => void
}

const NavContext = createContext<NavContextValue | null>(null)

export function NavProvider({ children }: { children: ReactNode }): JSX.Element {
  const [target, setTarget] = useState<NavTarget>({ page: 'dashboard' })
  const [nonce, setNonce] = useState(0)

  const navigate = (next: NavTarget): void => {
    setTarget(next)
    setNonce((n) => n + 1)
  }

  return (
    <NavContext.Provider value={{ target, nonce, navigate }}>{children}</NavContext.Provider>
  )
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext)
  if (!ctx) throw new Error('useNav must be used within NavProvider')
  return ctx
}
