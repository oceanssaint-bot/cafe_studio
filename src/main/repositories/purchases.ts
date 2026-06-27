import { getDatabase } from '../db'
import { periodLabel } from '../../shared/defaults'
import type { StorePurchaseLine, StorePurchaseView } from '../../shared/types'

function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}
function dateKey(d: string): number {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(d)
  return m ? +`${m[3]}${m[2]}${m[1]}` : 0
}

/** Stores that have any purchase lines (for the picker). */
export function listPurchaseStores(): Array<{ storeId: number; storeName: string }> {
  return getDatabase()
    .prepare(
      `SELECT DISTINCT s.id AS storeId, s.name AS storeName
       FROM store_purchase_lines p JOIN stores s ON s.id = p.store_id
       ORDER BY s.sort_order, s.id`
    )
    .all() as Array<{ storeId: number; storeName: string }>
}

/** Periods (YYYY-MM) that have purchase lines for a store, newest first. */
export function listPurchasePeriods(storeId: number): string[] {
  return (
    getDatabase()
      .prepare(
        `SELECT DISTINCT period FROM store_purchase_lines WHERE store_id = ? ORDER BY period DESC`
      )
      .all(storeId) as Array<{ period: string }>
  ).map((r) => r.period)
}

export function getStorePurchaseView(storeId: number, period: string): StorePurchaseView {
  const db = getDatabase()
  const store = db.prepare(`SELECT name FROM stores WHERE id = ?`).get(storeId) as
    | { name: string }
    | undefined
  const lines = db
    .prepare(`SELECT * FROM store_purchase_lines WHERE store_id = ? AND period = ?`)
    .all(storeId, period) as StorePurchaseLine[]
  lines.sort((a, b) => dateKey(a.txn_date) - dateKey(b.txn_date) || a.id - b.id)

  const totals = lines.reduce(
    (a, l) => ({
      excl: a.excl + l.excl_vat,
      vat: a.vat + l.vat,
      incl: a.incl + l.incl_vat,
      count: a.count + 1
    }),
    { excl: 0, vat: 0, incl: 0, count: 0 }
  )
  totals.excl = round2(totals.excl)
  totals.vat = round2(totals.vat)
  totals.incl = round2(totals.incl)

  const supMap = new Map<string, { incl: number; count: number }>()
  for (const l of lines) {
    const s = supMap.get(l.supplier) ?? { incl: 0, count: 0 }
    s.incl += l.incl_vat
    s.count += 1
    supMap.set(l.supplier, s)
  }
  const bySupplier = [...supMap.entries()]
    .map(([supplier, v]) => ({ supplier, incl: round2(v.incl), count: v.count }))
    .sort((a, b) => b.incl - a.incl)

  return {
    storeId,
    storeName: store?.name ?? '',
    period,
    periodLabel: periodLabel(period),
    lines,
    totals,
    bySupplier
  }
}
