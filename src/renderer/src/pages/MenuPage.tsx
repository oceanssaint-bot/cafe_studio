import { useCallback, useEffect, useState } from 'react'
import { formatZar } from '../../../shared/defaults'
import { useStoreScope } from '../hooks/useStoreScope'
import type { MenuItem, RecipeLine, StockItem } from '../../../shared/types'

export default function MenuPage(): JSX.Element {
  const { oceansId } = useStoreScope()
  const [items, setItems] = useState<MenuItem[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [edit, setEdit] = useState<MenuItem | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (oceansId == null) return
    setItems(await window.gloria.menu.items(oceansId))
    setStock(await window.gloria.stockControl.items(oceansId))
  }, [oceansId])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (oceansId == null) return <div className="p-6 text-sm text-slate-400">Loading…</div>

  const withRecipe = items.filter((i) => i.hasRecipe)
  const avgMargin = withRecipe.length
    ? Math.round(withRecipe.reduce((s, i) => s + i.margin, 0) / withRecipe.length)
    : 0

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">Menu</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Menu items &amp; recipes → cost, margin, and (with sales) what sells best.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEdit({ id: 0, store_id: oceansId, name: '', category: '', sell_price: 0, active: 1, recipeCost: 0, grossProfit: 0, margin: 0, hasRecipe: false })}
          className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown"
        >
          + Menu item
        </button>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Menu items" value={`${items.length}`} />
        <Card label="With recipe" value={`${withRecipe.length}`} sub={`${items.length - withRecipe.length} missing`} />
        <Card label="Avg margin" value={`${avgMargin}%`} accent />
        <Card label="Ingredients" value={`${stock.length}`} />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gloria-brown text-gloria-cream">
              <th className="px-3 py-2 text-left font-semibold">Item</th>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-right font-semibold">Sell</th>
              <th className="px-3 py-2 text-right font-semibold">Recipe cost</th>
              <th className="px-3 py-2 text-right font-semibold">Gross profit</th>
              <th className="px-3 py-2 text-right font-semibold">Margin</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-800">
            {items.map((i) => (
              <tr
                key={i.id}
                onClick={() => setEdit(i)}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"
              >
                <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{i.name}</td>
                <td className="px-3 py-2 text-slate-400">{i.category}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatZar(i.sell_price)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                  {i.hasRecipe ? formatZar(i.recipeCost) : <span className="text-amber-500">no recipe</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{i.hasRecipe ? formatZar(i.grossProfit) : '—'}</td>
                <td className="px-3 py-2 text-right">
                  {i.hasRecipe ? (
                    <span className={['rounded px-1.5 py-0.5 text-xs font-semibold', i.margin >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : i.margin >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'].join(' ')}>
                      {i.margin}%
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No menu items yet. Add items + recipes (or upload your menu &amp; ingredient sheets in Documents).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {edit && <ItemModal item={edit} stock={stock} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh() }} />}
    </div>
  )
}

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }): JSX.Element {
  return (
    <div className={['rounded-lg border p-3', accent ? 'border-gloria-brown bg-gloria-brown text-gloria-cream' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'].join(' ')}>
      <p className={['text-[10px] uppercase tracking-wide', accent ? 'text-gloria-cream/70' : 'text-slate-400'].join(' ')}>{label}</p>
      <p className={['mt-0.5 text-lg font-bold tabular-nums', accent ? 'text-white' : 'text-gloria-brown dark:text-gloria-cream'].join(' ')}>{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-slate-400">{sub}</p>}
    </div>
  )
}

const inp = 'w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900'

function ItemModal({ item, stock, onClose, onSaved }: { item: MenuItem; stock: StockItem[]; onClose: () => void; onSaved: () => void }): JSX.Element {
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category)
  const [sell, setSell] = useState(String(item.sell_price || ''))
  const [recipe, setRecipe] = useState<Array<{ stock_item_id: number; qty: string }>>([])

  useEffect(() => {
    if (item.id) window.gloria.menu.recipe(item.id).then((rl: RecipeLine[]) => setRecipe(rl.map((l) => ({ stock_item_id: l.stock_item_id, qty: String(l.qty) }))))
  }, [item.id])

  const cost = recipe.reduce((s, r) => {
    const si = stock.find((x) => x.id === r.stock_item_id)
    return s + (si ? si.cost_price * (parseFloat(r.qty) || 0) : 0)
  }, 0)
  const sellN = parseFloat(sell) || 0
  const margin = sellN > 0 ? Math.round(((sellN - cost) / sellN) * 100) : 0

  async function save(): Promise<void> {
    if (!name.trim()) return
    const id = await window.gloria.menu.upsert({ id: item.id || undefined, store_id: item.store_id ?? 0, name, category, sell_price: sellN })
    await window.gloria.menu.setRecipe(id, recipe.filter((r) => r.stock_item_id && +r.qty > 0).map((r) => ({ stock_item_id: r.stock_item_id, qty: +r.qty })))
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-lg font-semibold text-gloria-brown dark:text-gloria-cream">{item.id ? 'Edit menu item' : 'Add menu item'}</h3>
        <div className="space-y-2">
          <input className={inp} placeholder="Item name (e.g. Cappuccino)" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-2">
            <input className={inp} placeholder="Category (Coffee, Food…)" value={category} onChange={(e) => setCategory(e.target.value)} />
            <input className={inp} inputMode="decimal" placeholder="Sell price" value={sell} onChange={(e) => setSell(e.target.value)} />
          </div>
        </div>

        <div className="mt-4 mb-1 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Recipe (ingredients used)</h4>
          <button type="button" onClick={() => setRecipe([...recipe, { stock_item_id: stock[0]?.id ?? 0, qty: '' }])} className="text-xs text-gloria-accent hover:underline">+ ingredient</button>
        </div>
        <div className="space-y-1">
          {recipe.map((r, idx) => {
            const si = stock.find((x) => x.id === r.stock_item_id)
            return (
              <div key={idx} className="flex items-center gap-2 text-sm">
                <select className={inp + ' flex-1'} value={r.stock_item_id} onChange={(e) => setRecipe(recipe.map((x, i) => i === idx ? { ...x, stock_item_id: +e.target.value } : x))}>
                  {stock.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <input className={inp + ' w-20'} inputMode="decimal" placeholder="qty" value={r.qty} onChange={(e) => setRecipe(recipe.map((x, i) => i === idx ? { ...x, qty: e.target.value } : x))} />
                <span className="w-10 text-xs text-slate-400">{si?.unit}</span>
                <button type="button" onClick={() => setRecipe(recipe.filter((_, i) => i !== idx))} className="text-red-400">✕</button>
              </div>
            )
          })}
          {recipe.length === 0 && <p className="text-xs text-slate-400">No recipe yet — add the ingredients this item uses.</p>}
        </div>

        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900/40">
          <div className="flex justify-between"><span className="text-slate-500">Recipe cost</span><span className="tabular-nums font-medium">{formatZar(cost)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Gross profit</span><span className="tabular-nums font-medium">{formatZar(sellN - cost)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">Margin</span><span className={['font-bold', margin >= 70 ? 'text-emerald-600' : margin >= 50 ? 'text-amber-600' : 'text-red-600'].join(' ')}>{margin}%</span></div>
        </div>

        <div className="mt-4 flex justify-between">
          {item.id ? <button type="button" onClick={async () => { await window.gloria.menu.remove(item.id); onSaved() }} className="text-sm text-red-500 hover:underline">Delete</button> : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">Cancel</button>
            <button type="button" onClick={save} disabled={!name.trim()} className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save</button>
          </div>
        </div>
      </div>
    </div>
  )
}
