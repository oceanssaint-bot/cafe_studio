import { useCallback, useEffect, useState } from 'react'
import { currentPeriod, formatZar } from '../../../shared/defaults'
import { useStoreScope } from '../hooks/useStoreScope'
import type { StockItem, StockSummary } from '../../../shared/types'

const today = (): string => new Date().toISOString().slice(0, 10)
type Modal = null | 'receive' | 'count' | 'waste' | 'item'

export default function StockControl(): JSX.Element {
  const { oceansId } = useStoreScope()
  const [items, setItems] = useState<StockItem[]>([])
  const [summary, setSummary] = useState<StockSummary | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const period = currentPeriod()

  const refresh = useCallback(async (): Promise<void> => {
    if (oceansId == null) return
    setItems(await window.gloria.stockControl.items(oceansId))
    setSummary(await window.gloria.stockControl.summary(oceansId, period))
  }, [oceansId, period])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (oceansId == null) return <div className="p-6 text-sm text-slate-400">Loading…</div>

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">Stock</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Live stock control — receive, count, wastage, value &amp; loss watch.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => setModal('receive')} primary>Receive stock</Btn>
          <Btn onClick={() => setModal('count')}>Stock count</Btn>
          <Btn onClick={() => setModal('waste')}>Log waste</Btn>
          <Btn onClick={() => setModal('item')}>+ Item</Btn>
        </div>
      </header>

      {msg && (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Card label="Stock value" value={formatZar(summary.stockValue)} accent />
          <Card label="Items" value={`${summary.itemCount}`} sub={`${summary.lowCount} low`} />
          <Card label="Received (mo)" value={formatZar(summary.receivedValue)} />
          <Card label="Waste (mo)" value={formatZar(summary.wasteValue)} />
          <Card label="Loss / theft (mo)" value={formatZar(summary.shrinkageValue)} warn={summary.shrinkageValue > 0} />
          <Card label="Cash-up spend (mo)" value={formatZar(summary.cashupSpend)} />
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gloria-brown text-gloria-cream">
              <th className="px-3 py-2 text-left font-semibold">Item</th>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-right font-semibold">On hand</th>
              <th className="px-3 py-2 text-right font-semibold">Cost</th>
              <th className="px-3 py-2 text-right font-semibold">Value</th>
              <th className="px-3 py-2 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800">
            {items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{i.name}</td>
                <td className="px-3 py-2 text-slate-400">{i.category}</td>
                <td className="px-3 py-2 text-right tabular-nums">{i.on_hand} {i.unit}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">{formatZar(i.cost_price)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{formatZar(i.value)}</td>
                <td className="px-3 py-2 text-center">
                  {i.low && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      reorder
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No stock items yet. Add items, or “Receive stock” to start the ledger.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal === 'item' && <ItemModal storeId={oceansId} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh() }} />}
      {modal === 'waste' && <WasteModal storeId={oceansId} items={items} onClose={() => setModal(null)} onDone={(m) => { setMsg(m); setModal(null); refresh() }} />}
      {modal === 'receive' && <ReceiveModal storeId={oceansId} items={items} onClose={() => setModal(null)} onDone={(m) => { setMsg(m); setModal(null); refresh() }} />}
      {modal === 'count' && <CountModal storeId={oceansId} items={items} onClose={() => setModal(null)} onDone={(m) => { setMsg(m); setModal(null); refresh() }} />}
    </div>
  )
}

function Btn({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-md px-3 py-2 text-sm font-medium',
        primary
          ? 'bg-gloria-accent text-white hover:bg-gloria-brown'
          : 'border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700'
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Card({ label, value, sub, accent, warn }: { label: string; value: string; sub?: string; accent?: boolean; warn?: boolean }): JSX.Element {
  return (
    <div className={['rounded-lg border p-3', accent ? 'border-gloria-brown bg-gloria-brown text-gloria-cream' : warn ? 'border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-900/10' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'].join(' ')}>
      <p className={['text-[10px] uppercase tracking-wide', accent ? 'text-gloria-cream/70' : warn ? 'text-red-600 dark:text-red-300' : 'text-slate-400'].join(' ')}>{label}</p>
      <p className={['mt-0.5 text-base font-bold tabular-nums', accent ? 'text-white' : warn ? 'text-red-700 dark:text-red-300' : 'text-gloria-brown dark:text-gloria-cream'].join(' ')}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}

function Shell({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-semibold text-gloria-brown dark:text-gloria-cream">{title}</h3>
        {children}
      </div>
    </div>
  )
}

const inp = 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900'

function ItemModal({ storeId, onClose, onSaved }: { storeId: number; onClose: () => void; onSaved: () => void }): JSX.Element {
  const [f, setF] = useState({ name: '', category: '', unit: 'each', cost_price: '', sell_price: '', reorder_level: '' })
  return (
    <Shell title="Add stock item" onClose={onClose}>
      <div className="space-y-2">
        <input className={inp} placeholder="Item name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <div className="flex gap-2">
          <input className={inp} placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          <input className={inp} placeholder="Unit (kg, each, L)" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <input className={inp} inputMode="decimal" placeholder="Cost price" value={f.cost_price} onChange={(e) => setF({ ...f, cost_price: e.target.value })} />
          <input className={inp} inputMode="decimal" placeholder="Sell price" value={f.sell_price} onChange={(e) => setF({ ...f, sell_price: e.target.value })} />
          <input className={inp} inputMode="decimal" placeholder="Reorder at" value={f.reorder_level} onChange={(e) => setF({ ...f, reorder_level: e.target.value })} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={async () => {
          if (!f.name.trim()) return
          await window.gloria.stockControl.upsertItem({ store_id: storeId, name: f.name, category: f.category, unit: f.unit, cost_price: +f.cost_price || 0, sell_price: +f.sell_price || 0, reorder_level: +f.reorder_level || 0 })
          onSaved()
        }}>Save</Btn>
      </div>
    </Shell>
  )
}

function WasteModal({ storeId, items, onClose, onDone }: { storeId: number; items: StockItem[]; onClose: () => void; onDone: (m: string) => void }): JSX.Element {
  const [itemId, setItemId] = useState<number>(items[0]?.id ?? 0)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  return (
    <Shell title="Log wastage" onClose={onClose}>
      <div className="space-y-2">
        <select className={inp} value={itemId} onChange={(e) => setItemId(+e.target.value)}>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.on_hand} {i.unit})</option>)}
        </select>
        <input className={inp} inputMode="decimal" placeholder="Quantity wasted" value={qty} onChange={(e) => setQty(e.target.value)} />
        <input className={inp} placeholder="Reason (expired, spillage, breakage…)" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={async () => {
          const r = await window.gloria.stockControl.waste(storeId, itemId, +qty || 0, reason, today())
          onDone(r.ok ? 'Wastage logged.' : r.error ?? 'Failed.')
        }}>Log</Btn>
      </div>
    </Shell>
  )
}

function ReceiveModal({ storeId, items, onClose, onDone }: { storeId: number; items: StockItem[]; onClose: () => void; onDone: (m: string) => void }): JSX.Element {
  const [supplier, setSupplier] = useState('')
  const [ref, setRef] = useState('')
  const [rows, setRows] = useState<Record<number, { qty: string; cost: string }>>({})
  const set = (id: number, k: 'qty' | 'cost', v: string): void => setRows((r) => ({ ...r, [id]: { ...(r[id] ?? { qty: '', cost: '' }), [k]: v } }))
  return (
    <Shell title="Receive stock (from supplier invoice)" onClose={onClose}>
      <div className="mb-2 flex gap-2">
        <input className={inp} placeholder="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        <input className={inp} placeholder="Invoice no." value={ref} onChange={(e) => setRef(e.target.value)} />
      </div>
      <div className="max-h-64 space-y-1 overflow-auto">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{i.name}</span>
            <input className={inp + ' w-20'} inputMode="decimal" placeholder="qty" value={rows[i.id]?.qty ?? ''} onChange={(e) => set(i.id, 'qty', e.target.value)} />
            <input className={inp + ' w-24'} inputMode="decimal" placeholder="unit cost" value={rows[i.id]?.cost ?? String(i.cost_price || '')} onChange={(e) => set(i.id, 'cost', e.target.value)} />
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">Add items first.</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={async () => {
          const lines = items.filter((i) => +(rows[i.id]?.qty ?? 0) > 0).map((i) => ({ item_id: i.id, qty: +rows[i.id].qty, unit_cost: +(rows[i.id].cost || i.cost_price) }))
          if (lines.length === 0) return
          const r = await window.gloria.stockControl.receive(storeId, today(), supplier, ref, lines)
          onDone(r.ok ? `Received ${lines.length} item(s).` : r.error ?? 'Failed.')
        }}>Receive</Btn>
      </div>
    </Shell>
  )
}

function CountModal({ storeId, items, onClose, onDone }: { storeId: number; items: StockItem[]; onClose: () => void; onDone: (m: string) => void }): JSX.Element {
  const [counts, setCounts] = useState<Record<number, string>>({})
  return (
    <Shell title="Stock count" onClose={onClose}>
      <p className="mb-2 text-xs text-slate-400">Enter the counted quantity. Blank = unchanged. Differences post as variance (loss/gain).</p>
      <div className="max-h-72 space-y-1 overflow-auto">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate text-slate-600 dark:text-slate-300">{i.name}</span>
            <span className="text-xs text-slate-400">sys {i.on_hand}</span>
            <input className={inp + ' w-24'} inputMode="decimal" placeholder="counted" value={counts[i.id] ?? ''} onChange={(e) => setCounts((c) => ({ ...c, [i.id]: e.target.value }))} />
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">Add items first.</p>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Btn onClick={onClose}>Cancel</Btn>
        <Btn primary onClick={async () => {
          const lines = items.filter((i) => counts[i.id] !== undefined && counts[i.id] !== '').map((i) => ({ item_id: i.id, counted: +counts[i.id] }))
          if (lines.length === 0) return
          const r = await window.gloria.stockControl.count(storeId, today(), lines)
          const v = r.variance ?? 0
          onDone(`Count saved. Net variance ${formatZar(v)}${v < 0 ? ' (loss — investigate if beyond waste)' : ''}.`)
        }}>Save count</Btn>
      </div>
    </Shell>
  )
}
