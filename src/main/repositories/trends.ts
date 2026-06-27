import { getDatabase } from '../db'
import { periodLabel } from '../../shared/defaults'
import type { TrendsView, TrendMonth } from '../../shared/types'

function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

/** Time-based performance for a store: monthly turnover/mix/purchases/payroll, back to opening. */
export function getStoreTrends(storeId: number): TrendsView {
  const db = getDatabase()
  const store = (db.prepare(`SELECT name FROM stores WHERE id = ?`).get(storeId) as { name: string } | undefined)?.name ?? ''

  // turnover (from daily GAAP), payment mix, trading days — per month
  const sales = db
    .prepare(
      `SELECT substr(date,1,7) period,
              ROUND(SUM(total_sales),2) turnover,
              ROUND(SUM(cash),2) cash, ROUND(SUM(credit_card),2) card,
              ROUND(SUM(tips),2) tips, COUNT(*) days
       FROM turnover_daily WHERE store_id = ? GROUP BY period`
    )
    .all(storeId) as Array<{ period: string; turnover: number; cash: number; card: number; tips: number; days: number }>

  const purch = new Map(
    (db.prepare(`SELECT period, purchases FROM monthly_store_data WHERE store_id = ?`).all(storeId) as Array<{ period: string; purchases: number }>).map((r) => [r.period, r.purchases])
  )
  const pay = new Map(
    (db.prepare(`SELECT period, COALESCE(SUM(gross),0) g FROM payroll WHERE entity_store_id = ? GROUP BY period`).all(storeId) as Array<{ period: string; g: number }>).map((r) => [r.period, r.g])
  )

  // union of all periods that have any activity
  const periods = new Set<string>(sales.map((s) => s.period))
  for (const p of purch.keys()) periods.add(p)
  for (const p of pay.keys()) periods.add(p)
  const salesByPeriod = new Map(sales.map((s) => [s.period, s]))

  const months: TrendMonth[] = [...periods]
    .sort()
    .map((period) => {
      const s = salesByPeriod.get(period)
      const turnover = s?.turnover ?? 0
      const purchases = round2(purch.get(period) ?? 0)
      const payroll = round2(pay.get(period) ?? 0)
      return {
        period,
        periodLabel: periodLabel(period),
        turnover,
        cash: s?.cash ?? 0,
        card: s?.card ?? 0,
        tips: s?.tips ?? 0,
        days: s?.days ?? 0,
        purchases,
        payroll,
        grossEst: round2(turnover - purchases - payroll)
      }
    })

  const withTurnover = months.filter((m) => m.turnover > 0)
  const totalTurnover = round2(withTurnover.reduce((a, m) => a + m.turnover, 0))
  const best = withTurnover.reduce<TrendMonth | null>((b, m) => (!b || m.turnover > b.turnover ? m : b), null)
  const totalCash = withTurnover.reduce((a, m) => a + m.cash, 0)
  const totalCard = withTurnover.reduce((a, m) => a + m.card, 0)

  return {
    storeId,
    storeName: store,
    firstMonth: months[0]?.period ?? '',
    months,
    totals: {
      turnover: totalTurnover,
      monthsTrading: withTurnover.length,
      avgMonth: withTurnover.length ? round2(totalTurnover / withTurnover.length) : 0,
      bestPeriod: best?.period ?? '',
      bestTurnover: best?.turnover ?? 0,
      cashPct: totalCash + totalCard > 0 ? Math.round((totalCash / (totalCash + totalCard)) * 100) : 0
    }
  }
}
