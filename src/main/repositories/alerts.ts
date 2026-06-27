import { getDatabase } from '../db'
import { periodLabel, formatZar } from '../../shared/defaults'
import { getStoreOverview } from './store-overview'
import { listPendingInvoices, listApprovedUnsent } from './royalties'
import type { Alert } from '../../shared/types'

function daysSince(isoOrDot: string): number {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(isoOrDot) || /(\d{2})\.(\d{2})\.(\d{4})/.exec(isoOrDot)
  if (!m) return 9999
  const d = m[0].includes('-')
    ? new Date(+m[1], +m[2] - 1, +m[3])
    : new Date(+m[3], +m[2] - 1, +m[1])
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

/** Live "needs attention today" alerts for the active office. */
export function getAlerts(mode: 'store' | 'franchise', storeId: number | null, period: string): Alert[] {
  const db = getDatabase()
  const out: Alert[] = []
  const label = periodLabel(period)

  if (mode === 'store' && storeId != null) {
    const ov = getStoreOverview(storeId, period)

    if (ov.turnover === 0)
      out.push({ id: 'turnover', severity: 'warn', title: 'Turnover not captured', detail: `No sales recorded for ${label} yet.`, page: 'turnover' })

    const last = (db.prepare(`SELECT MAX(txn_date) d FROM cash_payouts WHERE store_id = ?`).get(storeId) as { d: string | null }).d
    if (!last) out.push({ id: 'cashup', severity: 'warn', title: 'No cash-up yet', detail: 'No cash purchases captured.', page: 'cash-up' })
    else if (daysSince(last) > 2)
      out.push({ id: 'cashup', severity: 'warn', title: 'Cash-up behind', detail: `Last cash-up was ${last} (${daysSince(last)} days ago).`, page: 'cash-up' })

    const owed = (db.prepare(`SELECT COALESCE(SUM(total_incl),0) t FROM royalty_invoices WHERE store_id = ? AND paid = 0 AND total_incl > 0`).get(storeId) as { t: number }).t
    if (owed > 0)
      out.push({ id: 'owed', severity: 'info', title: 'Owed to Head Office', detail: `${formatZar(owed)} in unpaid royalty/marketing invoices.`, page: 'ledgers' })

    const tasks = db.prepare(`SELECT COUNT(*) total, COALESCE(SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END),0) done FROM tasks WHERE period = ?`).get(period) as { total: number; done: number }
    if (tasks.total > 0 && tasks.done < tasks.total)
      out.push({ id: 'monthend', severity: 'info', title: 'Month-end open', detail: `${tasks.done}/${tasks.total} tasks done for ${label}.`, page: 'month-end' })

    if (out.length === 0)
      out.push({ id: 'ok', severity: 'good', title: 'All caught up', detail: `Nothing needs your attention for ${label}.` })
    return out
  }

  // Franchise office
  const pending = listPendingInvoices().length
  if (pending > 0)
    out.push({ id: 'approve', severity: 'urgent', title: `${pending} royalty invoices to approve`, detail: 'Generated invoices are waiting for your approval.', page: 'dashboard' })

  const ready = listApprovedUnsent().length
  if (ready > 0)
    out.push({ id: 'send', severity: 'warn', title: `${ready} invoices ready to send`, detail: 'Approved — export or email them to the stores.', page: 'dashboard' })

  const royThis = (db.prepare(`SELECT COUNT(*) n FROM royalty_invoices WHERE period = ?`).get(period) as { n: number }).n
  if (royThis === 0)
    out.push({ id: 'genroy', severity: 'warn', title: 'Royalties not generated', detail: `No royalty invoices for ${label} yet.`, page: 'royalties' })

  const notReported = (db.prepare(`SELECT COUNT(*) n FROM stores s WHERE s.archived = 0 AND NOT EXISTS (SELECT 1 FROM monthly_store_data d WHERE d.store_id = s.id AND d.period = ? AND d.turnover > 0)`).get(period) as { n: number }).n
  if (notReported > 0)
    out.push({ id: 'notreported', severity: 'info', title: `${notReported} stores haven't reported`, detail: `Awaiting ${label} turnover — import their packs.`, page: 'stores' })

  const aus = (db.prepare(`SELECT COALESCE(SUM(amount_usd),0) t FROM aus_account_lines`).get() as { t: number }).t
  if (aus > 0)
    out.push({ id: 'aus', severity: 'info', title: 'Owed to Australia', detail: `US$ ${Math.round(aus).toLocaleString('en-US')} outstanding to Gloria Jeans International.`, page: 'gjc-aus' })

  if (out.length === 0)
    out.push({ id: 'ok', severity: 'good', title: 'All caught up', detail: 'No franchise actions outstanding.' })
  return out
}
