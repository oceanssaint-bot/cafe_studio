import { getDatabase } from '../db'
import { periodLabel } from '../../shared/defaults'
import type {
  StatementView,
  StatementLine,
  StatementAccount,
  StatementStoreRef
} from '../../shared/types'

function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

/** DD.MM.YYYY or YYYY-MM-DD → sortable YYYYMMDD number. */
function dateKey(d: string): number {
  let m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(d)
  if (m) return +`${m[3]}${m[2]}${m[1]}`
  m = /(\d{4})-(\d{2})-(\d{2})/.exec(d)
  if (m) return +`${m[1]}${m[2]}${m[3]}`
  return 0
}

export function getStatementAccount(storeId: number): StatementAccount | null {
  return (getDatabase()
    .prepare(
      `SELECT store_id, customer_name, vat_no, address, customer_code FROM statement_accounts WHERE store_id = ?`
    )
    .get(storeId) ?? null) as StatementAccount | null
}

export function listStatementStores(): StatementStoreRef[] {
  const rows = getDatabase()
    .prepare(
      `SELECT s.id AS storeId, s.name AS storeName,
              COUNT(l.id) AS lineCount,
              ROUND(COALESCE(SUM(l.debit),0) - COALESCE(SUM(l.credit),0), 2) AS balance
       FROM stores s JOIN statement_lines l ON l.store_id = s.id
       GROUP BY s.id ORDER BY s.sort_order, s.id`
    )
    .all() as StatementStoreRef[]
  return rows
}

export function getStatement(storeId: number): StatementView {
  const db = getDatabase()
  const store = db.prepare(`SELECT name FROM stores WHERE id = ?`).get(storeId) as
    | { name: string }
    | undefined
  const account = (db
    .prepare(`SELECT store_id, customer_name, vat_no, address FROM statement_accounts WHERE store_id = ?`)
    .get(storeId) ?? null) as StatementAccount | null

  const lines = db
    .prepare(`SELECT * FROM statement_lines WHERE store_id = ?`)
    .all(storeId) as StatementLine[]
  lines.sort((a, b) => dateKey(a.line_date) - dateKey(b.line_date) || a.id - b.id)

  let bal = 0
  let invoiced = 0
  let paid = 0
  for (const l of lines) {
    bal = round2(bal + l.debit - l.credit)
    l.balance = bal
    invoiced += l.debit
    paid += l.credit
  }

  const lastPeriod = lines.length ? lines[lines.length - 1].period : ''

  return {
    storeId,
    storeName: store?.name ?? '',
    account,
    lines,
    summary: { invoiced: round2(invoiced), paid: round2(paid), balance: round2(invoiced - paid) },
    periodLabel: lastPeriod ? periodLabel(lastPeriod) : ''
  }
}

/**
 * Appends royalty invoices (from the royalty ledger) as statement lines for any
 * period AFTER the latest imported line — so statements stay current without
 * duplicating imported history. Idempotent (rebuilds source='royalty' lines).
 */
export function syncStatementRoyalties(storeId?: number): { added: number } {
  const db = getDatabase()
  const stores = storeId
    ? [storeId]
    : (db.prepare(`SELECT DISTINCT store_id FROM statement_lines`).all() as Array<{ store_id: number }>).map(
        (r) => r.store_id
      )
  let added = 0
  const run = db.transaction(() => {
    for (const sid of stores) {
      db.prepare(`DELETE FROM statement_lines WHERE store_id = ? AND source = 'royalty'`).run(sid)
      const cutoff = (
        db
          .prepare(
            `SELECT COALESCE(MAX(period),'') AS p FROM statement_lines WHERE store_id = ? AND source = 'import'`
          )
          .get(sid) as { p: string }
      ).p
      const roys = db
        .prepare(
          `SELECT period, invoice_date, invoice_no, total_incl FROM royalty_invoices
           WHERE store_id = ? AND period > ? AND total_incl > 0 ORDER BY period`
        )
        .all(sid, cutoff) as Array<{
        period: string
        invoice_date: string
        invoice_no: string
        total_incl: number
      }>
      const now = new Date().toISOString()
      for (const r of roys) {
        db.prepare(
          `INSERT INTO statement_lines (store_id, line_date, tx_type, reference, details, debit, credit, period, source, created_at)
           VALUES (?, ?, 'royalty', ?, ?, ?, 0, ?, 'royalty', ?)`
        ).run(
          sid,
          r.invoice_date,
          r.invoice_no,
          `Royalties ${periodLabel(r.period)}`,
          round2(r.total_incl),
          r.period,
          now
        )
        added++
      }
    }
  })
  run()
  return { added }
}
