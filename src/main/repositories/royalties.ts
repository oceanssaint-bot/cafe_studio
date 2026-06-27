import { getDatabase } from '../db'
import { periodLabel } from '../../shared/defaults'
import type { RoyaltyInvoice, RoyaltyView, RoyaltyGenerateSummary } from '../../shared/types'

const MARKETING_RATE = 2.5
const VAT_RATE = 0.15

function now(): string {
  return new Date().toISOString()
}
function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

/** Last calendar day of a YYYY-MM period, as YYYY-MM-DD. */
function periodEndDate(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return ''
  const day = new Date(y, m, 0).getDate()
  return `${period}-${String(day).padStart(2, '0')}`
}

/**
 * Auto-generates royalty invoices from each store's monthly turnover.
 * Royalty = turnover × rate%, Marketing = turnover × 2.5%, +15% VAT.
 * Idempotent per (store, period); preserves the Paid flag and any manual
 * invoice number on regeneration.
 */
export function generateRoyalties(period?: string): RoyaltyGenerateSummary {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT d.store_id, d.period, d.turnover, s.royalty_rate AS rate
       FROM monthly_store_data d
       JOIN stores s ON s.id = d.store_id AND s.archived = 0
       WHERE d.turnover > 0 ${period ? 'AND d.period = ?' : ''}`
    )
    .all(...(period ? [period] : [])) as Array<{
    store_id: number
    period: string
    turnover: number
    rate: number
  }>

  const existing = db.prepare(
    `SELECT id, paid, invoice_no FROM royalty_invoices WHERE store_id = ? AND period = ?`
  )
  const insert = db.prepare(
    `INSERT INTO royalty_invoices
       (store_id, period, invoice_date, invoice_no, turnover, rate, royalty_fee, marketing_fee, vat, total_incl, paid, source, created_at)
     VALUES (@store_id, @period, @invoice_date, @invoice_no, @turnover, @rate, @royalty_fee, @marketing_fee, @vat, @total_incl, @paid, 'auto', @created_at)`
  )
  const update = db.prepare(
    `UPDATE royalty_invoices SET
       invoice_date = @invoice_date, turnover = @turnover, rate = @rate,
       royalty_fee = @royalty_fee, marketing_fee = @marketing_fee, vat = @vat, total_incl = @total_incl
     WHERE id = @id`
  )

  let created = 0
  let updated = 0
  let totalIncl = 0

  const run = db.transaction(() => {
    for (const r of rows) {
      const rate = r.rate || 8
      const royalty_fee = round2(r.turnover * (rate / 100))
      const marketing_fee = round2(r.turnover * (MARKETING_RATE / 100))
      const vat = round2((royalty_fee + marketing_fee) * VAT_RATE)
      const total_incl = round2(royalty_fee + marketing_fee + vat)
      totalIncl += total_incl
      const prior = existing.get(r.store_id, r.period) as
        | { id: number; paid: number; invoice_no: string }
        | undefined
      const fields = {
        store_id: r.store_id,
        period: r.period,
        invoice_date: periodEndDate(r.period),
        turnover: round2(r.turnover),
        rate,
        royalty_fee,
        marketing_fee,
        vat,
        total_incl
      }
      if (prior) {
        update.run({ ...fields, id: prior.id })
        updated++
      } else {
        insert.run({ ...fields, invoice_no: '', paid: 0, created_at: now() })
        created++
      }
    }
  })
  run()

  return { ok: true, created, updated, skipped: 0, totalIncl: round2(totalIncl) }
}

/** Royalty ledger view, optionally filtered by period and/or store. */
export function getRoyaltyView(period?: string, storeId?: number): RoyaltyView {
  const where: string[] = []
  const params: unknown[] = []
  if (period) {
    where.push('r.period = ?')
    params.push(period)
  }
  if (storeId) {
    where.push('r.store_id = ?')
    params.push(storeId)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const rows = getDatabase()
    .prepare(
      `SELECT r.*, s.name AS storeName
       FROM royalty_invoices r JOIN stores s ON s.id = r.store_id
       ${clause}
       ORDER BY r.period DESC, s.sort_order, s.id`
    )
    .all(...params) as RoyaltyInvoice[]

  const totals = rows.reduce(
    (a, r) => ({
      turnover: a.turnover + r.turnover,
      royalty_fee: a.royalty_fee + r.royalty_fee,
      marketing_fee: a.marketing_fee + r.marketing_fee,
      vat: a.vat + r.vat,
      total_incl: a.total_incl + r.total_incl,
      paidTotal: a.paidTotal + (r.paid ? r.total_incl : 0),
      outstanding: a.outstanding + (r.paid ? 0 : r.total_incl)
    }),
    { turnover: 0, royalty_fee: 0, marketing_fee: 0, vat: 0, total_incl: 0, paidTotal: 0, outstanding: 0 }
  )
  for (const k of Object.keys(totals) as Array<keyof typeof totals>) totals[k] = round2(totals[k])

  return { rows, totals }
}

/** One royalty invoice with the store name (for generating the printed invoice). */
export function getRoyaltyInvoice(id: number): RoyaltyInvoice | undefined {
  return getDatabase()
    .prepare(
      `SELECT r.*, s.name AS storeName FROM royalty_invoices r JOIN stores s ON s.id = r.store_id WHERE r.id = ?`
    )
    .get(id) as RoyaltyInvoice | undefined
}

/** Royalty invoices generated but not yet approved — the dashboard queue. */
export function listPendingInvoices(): import('../../shared/types').PendingInvoice[] {
  return getDatabase()
    .prepare(
      `SELECT r.id, s.name AS storeName, r.period, r.invoice_no, r.total_incl
       FROM royalty_invoices r JOIN stores s ON s.id = r.store_id
       WHERE r.approved = 0 AND r.total_incl > 0
       ORDER BY r.period DESC, s.sort_order, s.id`
    )
    .all()
    .map((r) => {
      const row = r as { id: number; storeName: string; period: string; invoice_no: string; total_incl: number }
      return { ...row, periodLabel: periodLabel(row.period) }
    })
}

/** Approved but not yet sent — the Dashboard "ready to send" queue. */
export function listApprovedUnsent(): import('../../shared/types').PendingInvoice[] {
  return getDatabase()
    .prepare(
      `SELECT r.id, s.name AS storeName, r.period, r.invoice_no, r.total_incl
       FROM royalty_invoices r JOIN stores s ON s.id = r.store_id
       WHERE r.approved = 1 AND r.sent = 0 AND r.total_incl > 0
       ORDER BY r.period DESC, s.sort_order, s.id`
    )
    .all()
    .map((r) => {
      const row = r as { id: number; storeName: string; period: string; invoice_no: string; total_incl: number }
      return { ...row, periodLabel: periodLabel(row.period) }
    })
}

export function markInvoicesSent(ids: number[]): void {
  if (ids.length === 0) return
  const now = new Date().toISOString()
  const stmt = getDatabase().prepare(`UPDATE royalty_invoices SET sent = 1, sent_at = ? WHERE id = ?`)
  const tx = getDatabase().transaction((list: number[]) => {
    for (const id of list) stmt.run(now, id)
  })
  tx(ids)
}

export function setRoyaltyApproved(id: number, approved: boolean): void {
  getDatabase().prepare(`UPDATE royalty_invoices SET approved = ? WHERE id = ?`).run(approved ? 1 : 0, id)
}

export function approveAllRoyalties(period?: string): number {
  const r = getDatabase()
    .prepare(
      `UPDATE royalty_invoices SET approved = 1 WHERE approved = 0 AND total_incl > 0 ${period ? 'AND period = ?' : ''}`
    )
    .run(...(period ? [period] : []))
  return r.changes
}

export function setRoyaltyPaid(id: number, paid: boolean): void {
  getDatabase().prepare(`UPDATE royalty_invoices SET paid = ? WHERE id = ?`).run(paid ? 1 : 0, id)
}

export function setRoyaltyInvoiceNo(id: number, invoiceNo: string): void {
  getDatabase().prepare(`UPDATE royalty_invoices SET invoice_no = ? WHERE id = ?`).run(invoiceNo.trim(), id)
}

export function setStoreRoyaltyRate(storeId: number, rate: number): void {
  getDatabase().prepare(`UPDATE stores SET royalty_rate = ? WHERE id = ?`).run(rate, storeId)
}
