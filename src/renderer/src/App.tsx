import { useCallback, useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import SearchPalette from './components/SearchPalette'
import ActivityToaster from './components/ActivityToaster'
import { navForMode, type PageId } from './navigation'
import { useNav } from './context/NavContext'
import { useTheme } from './context/ThemeContext'
import { useOfficeMode } from './context/OfficeModeContext'
import Dashboard from './pages/Dashboard'
import StoreDashboard from './pages/StoreDashboard'
import MonthEnd from './pages/MonthEnd'
import Stores from './pages/Stores'
import CashUp from './pages/CashUp'
import Ledgers from './pages/Ledgers'
import Payroll from './pages/Payroll'
import StaffPage from './pages/StaffPage'
import StockTake from './pages/StockTake'
import StockControl from './pages/StockControl'
import MenuPage from './pages/MenuPage'
import Trends from './pages/Trends'
import Turnover from './pages/Turnover'
import Purchases from './pages/Purchases'
import Royalties from './pages/Royalties'
import GjcAus from './pages/GjcAus'
import Statements from './pages/Statements'
import Documents from './pages/Documents'
import Records from './pages/Records'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

export default function App(): JSX.Element {
  const { target, nonce, navigate } = useNav()
  const { theme, toggle } = useTheme()
  const { mode } = useOfficeMode()
  const [searchOpen, setSearchOpen] = useState(false)

  const goPage = useCallback((page: PageId) => navigate({ page }), [navigate])

  // If the active page isn't available in the current office, fall back to its dashboard.
  useEffect(() => {
    if (!navForMode(mode).some((i) => i.id === target.page)) goPage('dashboard')
  }, [mode, target.page, goPage])

  // Global keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((o) => !o)
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        toggle()
        return
      }
      if ((e.ctrlKey || e.metaKey) && /^[1-9]$/.test(e.key)) {
        const item = navForMode(mode)[Number(e.key) - 1]
        if (item) {
          e.preventDefault()
          goPage(item.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goPage, toggle, mode])

  function renderPage(): JSX.Element {
    switch (target.page) {
      case 'month-end':
        return <MonthEnd initialPeriod={target.period} />
      case 'stores':
        return <Stores initialStoreId={target.storeId} />
      case 'cash-up':
        return <CashUp />
      case 'ledgers':
        return <Ledgers />
      case 'payroll':
        return <Payroll />
      case 'staff':
        return <StaffPage />
      case 'stock':
        return <StockTake />
      case 'stock-control':
        return <StockControl />
      case 'menu':
        return <MenuPage />
      case 'trends':
        return <Trends />
      case 'turnover':
        return <Turnover />
      case 'purchases':
        return <Purchases />
      case 'royalties':
        return <Royalties />
      case 'statements':
        return <Statements />
      case 'gjc-aus':
        return <GjcAus />
      case 'documents':
        return <Documents />
      case 'records':
        return <Records />
      case 'reports':
        return <Reports />
      case 'settings':
        return <Settings />
      default:
        return mode === 'store' ? <StoreDashboard /> : <Dashboard />
    }
  }

  return (
    <div className="flex h-full bg-gloria-cream text-slate-800 dark:bg-slate-900 dark:text-slate-100">
      <Sidebar active={target.page} onSelect={goPage} />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex shrink-0 items-center gap-3 border-b border-black/5 bg-white/60 px-6 py-3 dark:border-white/10 dark:bg-slate-800/60">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-left text-sm text-slate-400 hover:border-slate-300 dark:border-slate-600 dark:bg-slate-900"
          >
            <span>🔍</span>
            <span className="flex-1">Search tasks and stores…</span>
            <span className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-400 dark:border-slate-600">
              Ctrl K
            </span>
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle dark mode"
            title="Toggle dark mode (Ctrl+D)"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-8 py-7">
          {/* Re-mount on navigation so target params (store, period) take effect. */}
          <div key={nonce}>{renderPage()}</div>
        </main>
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ActivityToaster />
    </div>
  )
}
