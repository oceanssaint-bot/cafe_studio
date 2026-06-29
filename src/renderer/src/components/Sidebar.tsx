import { navForMode, type PageId } from '../navigation'
import { useOfficeMode } from '../context/OfficeModeContext'

interface SidebarProps {
  active: PageId
  onSelect: (page: PageId) => void
}

export default function Sidebar({ active, onSelect }: SidebarProps): JSX.Element {
  const { mode, setMode } = useOfficeMode()
  const items = navForMode(mode)

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-gloria-brown text-gloria-cream">
      <div className="px-5 pb-3 pt-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-gloria-accent px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow">
          <span className="h-1.5 w-1.5 rounded-full bg-white/90" />
          {mode === 'store' ? 'Store' : 'Head Office'}
        </div>
        <h1 className="text-lg font-semibold leading-tight">
          {mode === 'store' ? 'Oceans Mall' : 'Franchise Office'}
        </h1>
        <p className="mt-1 text-xs text-gloria-cream/60">
          {mode === 'store' ? 'Store admin · Gloria Jean’s' : 'Head Office · Gloria Jean’s SA'}
        </p>
      </div>

      {/* Office switcher */}
      <div className="mx-3 mb-3 grid grid-cols-2 gap-1 rounded-lg bg-black/20 p-1">
        <OfficeTab label="Oceans Mall" active={mode === 'store'} onClick={() => setMode('store')} />
        <OfficeTab label="Franchise" active={mode === 'franchise'} onClick={() => setMode('franchise')} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-1">
          {items.map((item, i) => {
            const isActive = item.id === active
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive ? 'bg-gloria-accent text-white' : 'text-gloria-cream/80 hover:bg-white/10'
                  ].join(' ')}
                >
                  <span className="w-5 text-center text-base leading-none">{item.icon}</span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {i < 9 && <span className="text-[11px] text-gloria-cream/40">Ctrl+{i + 1}</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="px-5 py-4 text-[11px] text-gloria-cream/40">v0.1.0 · Local</div>
    </aside>
  )
}

function OfficeTab({
  label,
  active,
  onClick
}: {
  label: string
  active: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-gloria-accent text-white shadow' : 'text-gloria-cream/70 hover:bg-white/10'
      ].join(' ')}
    >
      {label}
    </button>
  )
}
