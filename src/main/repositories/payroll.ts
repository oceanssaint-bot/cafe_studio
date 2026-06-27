import { getDatabase } from '../db'
import type { PayrollItem, PayrollInput, PayrollView } from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}
function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

function entitySql(entityStoreId: number): { sql: string; params: unknown[] } {
  return entityStoreId === 0
    ? { sql: 'entity_store_id IS NULL', params: [] }
    : { sql: 'entity_store_id = ?', params: [entityStoreId] }
}

export function getPayroll(entityStoreId: number, period: string): PayrollView {
  const e = entitySql(entityStoreId)
  const items = getDatabase()
    .prepare(
      `SELECT * FROM payroll WHERE ${e.sql} AND period = ? ORDER BY employee, id`
    )
    .all(...e.params, period) as PayrollItem[]
  return {
    items,
    totals: {
      gross: round2(items.reduce((s, i) => s + i.gross, 0)),
      net: round2(items.reduce((s, i) => s + i.net, 0)),
      count: items.length
    }
  }
}

export function addPayroll(input: PayrollInput, source_doc_id: number | null = null): PayrollItem {
  const info = getDatabase()
    .prepare(
      `INSERT INTO payroll (entity_store_id, period, employee, emp_no, gross, net, notes, source_doc_id, created_at)
       VALUES (@entity, @period, @employee, @emp_no, @gross, @net, @notes, @source_doc_id, @created_at)`
    )
    .run({
      entity: input.entity_store_id === 0 ? null : input.entity_store_id,
      period: input.period,
      employee: input.employee.trim(),
      emp_no: input.emp_no.trim(),
      gross: round2(input.gross),
      net: round2(input.net),
      notes: input.notes.trim(),
      source_doc_id,
      created_at: now()
    })
  return getDatabase()
    .prepare(`SELECT * FROM payroll WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as PayrollItem
}

export function updatePayroll(input: PayrollInput): void {
  if (!input.id) return
  getDatabase()
    .prepare(
      `UPDATE payroll SET employee = ?, emp_no = ?, gross = ?, net = ?, notes = ? WHERE id = ?`
    )
    .run(
      input.employee.trim(),
      input.emp_no.trim(),
      round2(input.gross),
      round2(input.net),
      input.notes.trim(),
      input.id
    )
}

export function deletePayroll(id: number): void {
  getDatabase().prepare(`DELETE FROM payroll WHERE id = ?`).run(id)
}
