import { getDatabase } from '../db'
import { periodLabel } from '../../shared/defaults'
import type { ReportType, ReportRow, ReportData } from '../../shared/types'

/**
 * Each pack maps to a fixed set of stores:
 *  - Head Office: the two head-office stores (Oceans Mall, Express Stores)
 *  - Franchise:   all franchise stores
 *  - Australia:   stores flagged for Australia (franchise stores + Oceans Mall,
 *                 excluding Express Stores and Point Waterfront)
 *
 * The WHERE clauses are constant strings (never user input), so they are safe
 * to inline.
 */
const REPORT_DEFS: Record<ReportType, { title: string; where: string }> = {
  head_office: { title: 'Head Office Pack', where: "s.category = 'head_office'" },
  franchise: { title: 'Franchise Pack', where: "s.category = 'franchise'" },
  australia: { title: 'Australia Pack', where: 's.include_in_australia = 1' }
}

export function getReportData(type: ReportType, period: string): ReportData {
  const def = REPORT_DEFS[type]

  // Store purchases = the captured monthly figure (stock / VAT journal) PLUS the
  // Cash-Up petty-cash purchases and supplier invoices for that store/month
  // (excluding tips). This makes the cash-up total flow into the report packs.
  const rows = getDatabase()
    .prepare(
      `SELECT
         s.name AS storeName,
         COALESCE(d.sales, 0)      AS sales,
         COALESCE(d.purchases, 0) + COALESCE(c.cash_purchases, 0) AS purchases,
         COALESCE(d.turnover, 0)   AS turnover,
         COALESCE(d.royalty, 0)    AS royalty,
         COALESCE(d.royalty_au, 0) AS royalty_au
       FROM stores s
       LEFT JOIN monthly_store_data d
         ON d.store_id = s.id AND d.period = ?
       LEFT JOIN (
         SELECT store_id, SUM(incl_vat) AS cash_purchases
         FROM cash_payouts
         WHERE period = ? AND kind != 'tip'
         GROUP BY store_id
       ) c ON c.store_id = s.id
       WHERE ${def.where} AND s.archived = 0
       ORDER BY s.sort_order, s.id`
    )
    .all(period, period) as ReportRow[]

  const totals = rows.reduce(
    (acc, r) => ({
      sales: acc.sales + r.sales,
      purchases: acc.purchases + r.purchases,
      turnover: acc.turnover + r.turnover,
      royalty: acc.royalty + r.royalty,
      royalty_au: acc.royalty_au + r.royalty_au
    }),
    { sales: 0, purchases: 0, turnover: 0, royalty: 0, royalty_au: 0 }
  )

  return {
    type,
    title: def.title,
    period,
    periodLabel: periodLabel(period),
    rows,
    totals,
    generatedAt: new Date().toISOString()
  }
}
