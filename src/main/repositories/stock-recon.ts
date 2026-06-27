import { getDatabase } from '../db'
import type { StockReconRow, StockReconView } from '../../shared/types'

const NONSTOCK = /royalt|swarm|reward|marketing fee|rebate|delivery|admin fee|account|deposit|balance b\/f|opening|pamphlet|uniform/i

function norm(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/\d{2}\.\d{2}\.\d{4}/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(gjc|gj|m|the|and|x|pcs|1x10x10)\b/g, ' ')
    .trim()
}
function toks(s: string): string[] {
  return norm(s).split(' ').filter((t) => t.length > 2)
}

interface Item {
  code: string
  name: string
  price: number
  opening: number
  counted: boolean
  norm: string
  toks: string[]
  sold: number
}

function matcher(items: Item[]) {
  return (name: string, rate: number): Item | null => {
    if (NONSTOCK.test(name)) return null
    const nn = norm(name)
    const it = toks(name)
    let best: Item | null = null
    let bestScore = 0
    for (const s of items) {
      let score = 0
      if (s.norm === nn) score = 100
      else {
        const shared = it.filter((t) => s.toks.includes(t)).length
        score = shared * 3
        if (rate > 0 && Math.abs(s.price - rate) < 0.001) score += 4
        if (shared > 0 && rate > 0 && Math.abs(s.price - rate) < 0.001) score += 2
      }
      if (score > bestScore) {
        bestScore = score
        best = s
      }
    }
    return bestScore >= 4 ? best : null
  }
}

function round(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

/**
 * Updated stock take: the latest Head Office stock count rolled forward to `asOf`
 * (default today) by subtracting every itemised stock line invoiced out to stores
 * since the count, matched item-by-item.
 */
export function getStockReconciliation(asOf?: string): StockReconView {
  const db = getDatabase()
  const empty: StockReconView = {
    hasData: false,
    baselineDate: '',
    asOf: asOf || new Date().toISOString().slice(0, 10),
    rows: [],
    totals: { openingValue: 0, soldValue: 0, remainingValue: 0, items: 0, ok: 0, notCounted: 0, oversold: 0 },
    perStore: [],
    unmatched: [],
    matchedPct: 0
  }
  const baseRow = db
    .prepare(`SELECT take_date FROM stock_sheet_lines ORDER BY take_date DESC LIMIT 1`)
    .get() as { take_date: string } | undefined
  if (!baseRow) return empty
  const baseline = baseRow.take_date
  const asOfDate = asOf || new Date().toISOString().slice(0, 10)

  const items: Item[] = (
    db.prepare(`SELECT code, name, price, opening_qty, counted FROM stock_sheet_lines WHERE take_date = ?`).all(baseline) as Array<{
      code: string
      name: string
      price: number
      opening_qty: number
      counted: number
    }>
  ).map((r) => ({
    code: r.code,
    name: r.name,
    price: r.price,
    opening: r.opening_qty,
    counted: !!r.counted,
    norm: norm(r.name),
    toks: toks(r.name),
    sold: 0
  }))

  const outLines = db
    .prepare(
      `SELECT o.item_name, o.qty, o.rate, o.amount, COALESCE(s.name,'Unknown') AS store
       FROM stock_out_lines o LEFT JOIN stores s ON s.id = o.store_id
       WHERE o.txn_date > ? AND o.txn_date <= ?`
    )
    .all(baseline, asOfDate) as Array<{ item_name: string; qty: number; rate: number; amount: number; store: string }>

  const match = matcher(items)
  const perStore = new Map<string, number>()
  const unmatched = new Map<string, number>()
  let stockLines = 0
  let matchedLines = 0

  for (const o of outLines) {
    if (NONSTOCK.test(o.item_name)) continue
    stockLines++
    const m = match(o.item_name, o.rate)
    if (m) {
      m.sold += o.qty
      matchedLines++
      perStore.set(o.store, (perStore.get(o.store) ?? 0) + o.amount)
    } else {
      unmatched.set(o.item_name, (unmatched.get(o.item_name) ?? 0) + o.amount)
    }
  }

  let openingValue = 0
  let soldValue = 0
  let remainingValue = 0
  let ok = 0
  let notCounted = 0
  let oversold = 0
  const rows: StockReconRow[] = items.map((s) => {
    const remaining = s.opening - s.sold
    const status: StockReconRow['status'] =
      remaining >= 0 ? '' : s.counted ? 'oversold' : 'not-counted'
    if (remaining >= 0) ok++
    else if (s.counted) oversold++
    else notCounted++
    const value = round(Math.max(remaining, 0) * s.price)
    openingValue += s.opening * s.price
    soldValue += s.sold * s.price
    remainingValue += value
    return {
      code: s.code,
      name: s.name,
      price: s.price,
      opening: s.opening,
      counted: s.counted,
      sold: s.sold,
      remaining,
      value,
      status
    }
  })
  rows.sort((a, b) => b.sold - a.sold || a.name.localeCompare(b.name))

  return {
    hasData: true,
    baselineDate: baseline,
    asOf: asOfDate,
    rows,
    totals: {
      openingValue: round(openingValue),
      soldValue: round(soldValue),
      remainingValue: round(remainingValue),
      items: items.length,
      ok,
      notCounted,
      oversold
    },
    perStore: [...perStore.entries()].map(([store, value]) => ({ store, value: round(value) })).sort((a, b) => b.value - a.value),
    unmatched: [...unmatched.entries()].map(([name, value]) => ({ name, value: round(value) })).sort((a, b) => b.value - a.value),
    matchedPct: stockLines ? Math.round((matchedLines / stockLines) * 100) : 0
  }
}
