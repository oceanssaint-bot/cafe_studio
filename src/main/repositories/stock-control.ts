import { getDatabase } from '../db'
import { periodLabel } from '../../shared/defaults'
import type {
  StockItem,
  StockItemInput,
  StockMovement,
  StockSummary,
  ReceiveLine,
  CountLine,
  StockActionResult
} from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}
function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

export function listStockItems(storeId: number): StockItem[] {
  return (
    getDatabase()
      .prepare(`SELECT * FROM stock_items WHERE store_id = ? ORDER BY active DESC, category, name`)
      .all(storeId) as Array<Omit<StockItem, 'value' | 'low'>>
  ).map((r) => ({
    ...r,
    value: round2(r.on_hand * r.cost_price),
    low: r.reorder_level > 0 && r.on_hand <= r.reorder_level
  }))
}

export function upsertStockItem(input: StockItemInput): StockItem {
  const db = getDatabase()
  if (input.id) {
    db.prepare(
      `UPDATE stock_items SET name=?, category=?, unit=?, cost_price=?, sell_price=?, reorder_level=? WHERE id=?`
    ).run(
      input.name.trim(),
      input.category.trim(),
      input.unit.trim() || 'each',
      input.cost_price,
      input.sell_price,
      input.reorder_level,
      input.id
    )
  } else {
    db.prepare(
      `INSERT INTO stock_items (store_id, name, category, unit, cost_price, sell_price, reorder_level, on_hand, active, created_at)
       VALUES (?,?,?,?,?,?,?,0,1,?)`
    ).run(
      input.store_id,
      input.name.trim(),
      input.category.trim(),
      input.unit.trim() || 'each',
      input.cost_price,
      input.sell_price,
      input.reorder_level,
      now()
    )
  }
  return listStockItems(input.store_id).find((i) => i.name === input.name.trim())!
}

function post(
  storeId: number,
  itemId: number,
  date: string,
  type: string,
  qtyDelta: number,
  unitCost: number,
  reason: string,
  reference: string
): void {
  const db = getDatabase()
  db.prepare(
    `INSERT INTO stock_movements (store_id, item_id, txn_date, type, qty, unit_cost, value, reason, reference, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(storeId, itemId, date, type, qtyDelta, unitCost, round2(qtyDelta * unitCost), reason, reference, now())
  db.prepare(`UPDATE stock_items SET on_hand = on_hand + ? WHERE id = ?`).run(qtyDelta, itemId)
}

/** Receive stock from a supplier invoice (stock IN). */
export function receiveStock(
  storeId: number,
  date: string,
  supplier: string,
  invoiceRef: string,
  lines: ReceiveLine[]
): StockActionResult {
  const db = getDatabase()
  const tx = db.transaction(() => {
    for (const l of lines) {
      if (l.qty <= 0) continue
      if (l.unit_cost > 0)
        db.prepare(`UPDATE stock_items SET cost_price = ? WHERE id = ?`).run(l.unit_cost, l.item_id)
      post(storeId, l.item_id, date, 'receive', l.qty, l.unit_cost, supplier.trim(), invoiceRef.trim())
    }
  })
  tx()
  return { ok: true, lines: lines.length }
}

/** Log wastage (stock OUT, with reason). */
export function recordWaste(
  storeId: number,
  itemId: number,
  qty: number,
  reason: string,
  date: string
): StockActionResult {
  if (qty <= 0) return { ok: false, error: 'Quantity must be positive.' }
  const item = getDatabase().prepare(`SELECT cost_price FROM stock_items WHERE id = ?`).get(itemId) as
    | { cost_price: number }
    | undefined
  post(storeId, itemId, date, 'waste', -qty, item?.cost_price ?? 0, reason.trim() || 'Wastage', '')
  return { ok: true }
}

/**
 * Record a physical count. Posts a `count` adjustment of (counted − on_hand) per
 * item and sets on-hand to the counted figure. Net negative value = shrinkage to
 * investigate (theft if beyond logged waste).
 */
export function recordCount(storeId: number, date: string, counts: CountLine[]): StockActionResult {
  const db = getDatabase()
  let variance = 0
  const tx = db.transaction(() => {
    for (const c of counts) {
      const item = db.prepare(`SELECT on_hand, cost_price FROM stock_items WHERE id = ?`).get(c.item_id) as
        | { on_hand: number; cost_price: number }
        | undefined
      if (!item) continue
      const delta = round2(c.counted - item.on_hand)
      if (delta === 0) continue
      post(storeId, c.item_id, date, 'count', delta, item.cost_price, `Counted ${c.counted} (was ${item.on_hand})`, '')
      variance += delta * item.cost_price
    }
  })
  tx()
  return { ok: true, variance: round2(variance), lines: counts.length }
}

export function listMovements(storeId: number, limit = 100): StockMovement[] {
  return getDatabase()
    .prepare(
      `SELECT m.*, i.name AS itemName FROM stock_movements m JOIN stock_items i ON i.id = m.item_id
       WHERE m.store_id = ? ORDER BY m.txn_date DESC, m.id DESC LIMIT ?`
    )
    .all(storeId, limit) as StockMovement[]
}

export function getStockSummary(storeId: number, period: string): StockSummary {
  const db = getDatabase()
  const val = db.prepare(
    `SELECT COALESCE(SUM(on_hand * cost_price),0) v, COUNT(*) n FROM stock_items WHERE store_id = ? AND active = 1`
  ).get(storeId) as { v: number; n: number }
  const low = (
    db.prepare(
      `SELECT COUNT(*) n FROM stock_items WHERE store_id = ? AND active = 1 AND reorder_level > 0 AND on_hand <= reorder_level`
    ).get(storeId) as { n: number }
  ).n
  const sumType = (type: string): number =>
    (db.prepare(
      `SELECT COALESCE(SUM(value),0) v FROM stock_movements WHERE store_id = ? AND type = ? AND substr(txn_date,1,7) = ?`
    ).get(storeId, type, period) as { v: number }).v
  const shrink = -(db.prepare(
    `SELECT COALESCE(SUM(value),0) v FROM stock_movements WHERE store_id = ? AND type = 'count' AND value < 0 AND substr(txn_date,1,7) = ?`
  ).get(storeId, period) as { v: number }).v
  const cashup = (db.prepare(
    `SELECT COALESCE(SUM(incl_vat),0) v FROM cash_payouts WHERE store_id = ? AND period = ?`
  ).get(storeId, period) as { v: number }).v
  return {
    storeId,
    period,
    periodLabel: periodLabel(period),
    stockValue: round2(val.v),
    itemCount: val.n,
    lowCount: low,
    receivedValue: round2(sumType('receive')),
    wasteValue: round2(-sumType('waste')),
    shrinkageValue: round2(shrink),
    cashupSpend: round2(cashup)
  }
}
