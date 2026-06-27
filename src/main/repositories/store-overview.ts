import { getDatabase } from '../db'
import { periodLabel } from '../../shared/defaults'
import type { StoreOverview } from '../../shared/types'

function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

/** Periods (YYYY-MM) that have any activity for this store, newest first. */
export function listStorePeriods(storeId: number): string[] {
  const rows = getDatabase()
    .prepare(
      `SELECT period FROM (
         SELECT period FROM monthly_store_data WHERE store_id = ? AND (sales > 0 OR purchases > 0 OR turnover > 0)
         UNION SELECT period FROM cash_payouts WHERE store_id = ?
         UNION SELECT period FROM payroll WHERE entity_store_id = ?
         UNION SELECT period FROM royalty_invoices WHERE store_id = ?
       ) ORDER BY period DESC`
    )
    .all(storeId, storeId, storeId, storeId) as Array<{ period: string }>
  return rows.map((r) => r.period)
}

/** Consolidated Oceans-Mall-style overview for one store + period. */
export function getStoreOverview(storeId: number, period: string): StoreOverview {
  const db = getDatabase()
  const store = db.prepare(`SELECT name FROM stores WHERE id = ?`).get(storeId) as
    | { name: string }
    | undefined

  const m = db
    .prepare(`SELECT sales, purchases, turnover FROM monthly_store_data WHERE store_id = ? AND period = ?`)
    .get(storeId, period) as { sales: number; purchases: number; turnover: number } | undefined

  const cashup = (
    db
      .prepare(`SELECT COALESCE(SUM(incl_vat),0) t FROM cash_payouts WHERE store_id = ? AND period = ?`)
      .get(storeId, period) as { t: number }
  ).t

  const pay = db
    .prepare(
      `SELECT COALESCE(SUM(gross),0) gross, COUNT(*) n FROM payroll WHERE entity_store_id = ? AND period = ?`
    )
    .get(storeId, period) as { gross: number; n: number }

  const roy = db
    .prepare(
      `SELECT COALESCE(SUM(royalty_fee),0) r, COALESCE(SUM(marketing_fee),0) mk, COALESCE(SUM(total_incl),0) tot
       FROM royalty_invoices WHERE store_id = ? AND period = ?`
    )
    .get(storeId, period) as { r: number; mk: number; tot: number }

  return {
    storeId,
    storeName: store?.name ?? '',
    period,
    periodLabel: periodLabel(period),
    turnover: round2(m?.turnover ?? 0),
    purchases: round2(m?.purchases ?? 0),
    cashup: round2(cashup),
    payrollGross: round2(pay.gross),
    payrollCount: pay.n,
    royaltyFee: round2(roy.r),
    marketingFee: round2(roy.mk),
    owedToHO: round2(roy.tot)
  }
}
