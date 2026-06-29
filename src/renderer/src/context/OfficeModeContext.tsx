import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { OfficeMode } from '../navigation'

interface OfficeModeValue {
  mode: OfficeMode
  setMode: (m: OfficeMode) => void
}

const OfficeModeContext = createContext<OfficeModeValue | null>(null)
const STORAGE_KEY = 'gloria-office-mode'

function readInitial(): OfficeMode {
  return localStorage.getItem(STORAGE_KEY) === 'franchise' ? 'franchise' : 'store'
}

export function OfficeModeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [mode, setModeState] = useState<OfficeMode>(readInitial)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
    document.documentElement.setAttribute('data-office', mode)
  }, [mode])

  const setMode = (m: OfficeMode): void => setModeState(m)

  return <OfficeModeContext.Provider value={{ mode, setMode }}>{children}</OfficeModeContext.Provider>
}

export function useOfficeMode(): OfficeModeValue {
  const ctx = useContext(OfficeModeContext)
  if (!ctx) throw new Error('useOfficeMode must be used within OfficeModeProvider')
  return ctx
}
