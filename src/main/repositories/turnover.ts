import { getDatabase } from '../db'
import { listStores } from './stores'
import { periodLabel } from '../../shared/defaults'
import type {
  TurnoverDailyInput,
  TurnoverMonthly,
  TurnoverReconRow,
  TurnoverView
} from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}
function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

/** Insert or update one day's turnover for a store (keyed by store + date). */
export function upsertTurnoverDaily(input: TurnoverDailyInput, source = 'import'): void {
  getDatabase()
    .prepare(
      `INSERT INTO turnover_daily
         (store_id, date, cash, credit_card, accounts, cheque, non_turnover, tips, total_sales, source, created_at)
       VALUES (@store_id, @date, @cash, @credit_card, @accounts, @cheque, @non_turnover, @tips, @total_sales, @source, @created_at)
       ON CONFLICT(store_id, date) DO UPDATE SET
         cash = excluded.cash,
         credit_card = excluded.credit_card,
         accounts = excluded.accounts,
         cheque = excluded.cheque,
         non_turnover = excluded.non_turnover,
         tips = excluded.tips,
         total_sales = excluded.total_sales,
         source = excluded.source`
    )
    .run({
      store_id: input.store_id,
      date: input.date,
      cash: round2(input.cash ?? 0),
      credit_card: round2(input.credit_card ?? 0),
      accounts: round2(input.accounts ?? 0),
      cheque: round2(input.cheque ?? 0),
      non_turnover: round2(input.non_turnover ?? 0),
      tips: round2(input.tips ?? 0),
      total_sales: round2(input.total_sales),
      source,
      created_at: now()
    })
}

/** Remove all imported daily rows for a store within a YYYY-MM period (keeps manual). */
export function clearImportedMonth(storeId: number, period: string): void {
  getDatabase()
    .prepare(
      `DELETE FROM turnover_daily WHERE store_id = ? AND date LIKE ? AND source = 'import'`
    )
    .run(storeId, `${period}-%`)
}

/**
 * The turnover view for a month: each store's monthly totals (summed from daily
 * rows) plus a reconciliation against the monthly master figure.
 */
export function getTurnoverView(period: string): TurnoverView {
  const db = getDatabase()
  const stores = listStores(false)
  const monthly: TurnoverMonthly[] = []
  const recon: TurnoverReconRow[] = []

  for (const store of stores) {
    const agg = db
      .prepare(
        `SELECT
           COALESCE(SUM(cash),0)         AS cash,
           COALESCE(SUM(credit_card),0)  AS credit_card,
           COALESCE(SUM(accounts),0)     AS accounts,
           COALESCE(SUM(cheque),0)       AS cheque,
           COALESCE(SUM(non_turnover),0) AS non_turnover,
           COALESCE(SUM(tips),0)         AS tips,
           COALESCE(SUM(total_sales),0)  AS total_sales,
           COUNT(*)                      AS days
         FROM turnover_daily
         WHERE store_id = ? AND date LIKE ?`
      )
      .get(store.id, `${period}-%`) as {
      cash: number
      credit_card: number
      accounts: number
      cheque: number
      non_turnover: number
      tips: number
      total_sales: number
      days: number
    }

    if (agg.days === 0) continue

    const hasBreakdown =
      agg.cash !== 0 || agg.credit_card !== 0 || agg.accounts !== 0 || agg.tips !== 0

    monthly.push({
      storeName: store.name,
      storeId: store.id,
      cash: round2(agg.cash),
      credit_card: round2(agg.credit_card),
      accounts: round2(agg.accounts),
      cheque: round2(agg.cheque),
      non_turnover: round2(agg.non_turnover),
      tips: round2(agg.tips),
      total_sales: round2(agg.total_sales),
      days: agg.days,
      hasBreakdown
    })

    const master = db
      .prepare(
        `SELECT COALESCE(turnover,0) AS turnover FROM monthly_store_data WHERE store_id = ? AND period = ?`
      )
      .get(store.id, period) as { turnover: number } | undefined
    const masterTurnover = round2(master?.turnover ?? 0)
    const posTurnover = round2(agg.total_sales)
    const difference = round2(posTurnover - masterTurnover)
    recon.push({
      storeName: store.name,
      storeId: store.id,
      posTurnover,
      masterTurnover,
      difference,
      matches: Math.abs(difference) < 1
    })
  }

  monthly.sort((a, b) => b.total_sales - a.total_sales)
  recon.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference))

  return { period, periodLabel: periodLabel(period), monthly, recon }
}
