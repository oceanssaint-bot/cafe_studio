import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface Activity {
  id: number
  label: string
  start: number
}
interface ErrToast {
  id: number
  label: string
  message: string
}

interface ActivityValue {
  activities: Activity[]
  errors: ErrToast[]
  /** Run an async op with a visible "working…" indicator + automatic error toast. */
  run: <T>(label: string, fn: () => Promise<T>) => Promise<T | undefined>
  dismissError: (id: number) => void
  notifyError: (label: string, message: string) => void
}

const Ctx = createContext<ActivityValue | null>(null)

export function ActivityProvider({ children }: { children: ReactNode }): JSX.Element {
  const [activities, setActivities] = useState<Activity[]>([])
  const [errors, setErrors] = useState<ErrToast[]>([])
  const counter = useRef(0)

  const dismissError = useCallback((id: number) => setErrors((e) => e.filter((x) => x.id !== id)), [])

  const notifyError = useCallback((label: string, message: string) => {
    const id = ++counter.current
    setErrors((e) => [...e, { id, label, message }])
  }, [])

  const run = useCallback(
    async <T,>(label: string, fn: () => Promise<T>): Promise<T | undefined> => {
      const id = ++counter.current
      setActivities((a) => [...a, { id, label, start: Date.now() }])
      try {
        return await fn()
      } catch (e) {
        notifyError(label, e instanceof Error ? e.message : String(e))
        return undefined
      } finally {
        setActivities((a) => a.filter((x) => x.id !== id))
      }
    },
    [notifyError]
  )

  return (
    <Ctx.Provider value={{ activities, errors, run, dismissError, notifyError }}>{children}</Ctx.Provider>
  )
}

export function useActivity(): ActivityValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useActivity must be used within ActivityProvider')
  return ctx
}
