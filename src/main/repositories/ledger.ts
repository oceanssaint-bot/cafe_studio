import { getDatabase } from '../db'
import { listStores } from './stores'
import type {
  LedgerItem,
  LedgerItemInput,
  LedgerView,
  LedgerGroup,
  LedgerKind,
  LedgerEntity
} from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}
function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

/** API uses 0 for Head Office; stored as NULL. */
function entityClause(entityStoreId: number): { sql: string; params: unknown[] } {
  if (entityStoreId === 0) return { sql: 'entity_store_id IS NULL', params: [] }
  return { sql: 'entity_store_id = ?', params: [entityStoreId] }
}

function withOwing(row: Omit<LedgerItem, 'owing'>): LedgerItem {
  return { ...row, owing: round2(row.total_incl - row.paid) }
}

export function listLedger(kind: LedgerKind, entityStoreId: number): LedgerItem[] {
  const e = entityClause(entityStoreId)
  const rows = getDatabase()
    .prepare(
      `SELECT * FROM ledger_items WHERE kind = ? AND ${e.sql}
       ORDER BY party, invoice_date, id`
    )
    .all(kind, ...e.params) as Array<Omit<LedgerItem, 'owing'>>
  return rows.map(withOwing)
}

export function getLedgerView(kind: LedgerKind, entityStoreId: number): LedgerView {
  const items = listLedger(kind, entityStoreId)
  const byParty = new Map<string, LedgerItem[]>()
  for (const it of items) {
    const key = it.party || '(unnamed)'
    if (!byParty.has(key)) byParty.set(key, [])
    byParty.get(key)!.push(it)
  }
  const groups: LedgerGroup[] = [...byParty.entries()].map(([party, list]) => {
    const total = round2(list.reduce((s, i) => s + i.total_incl, 0))
    const paid = round2(list.reduce((s, i) => s + i.paid, 0))
    return { party, items: list, total, paid, owing: round2(total - paid) }
  })
  groups.sort((a, b) => b.owing - a.owing)
  const totals = {
    total: round2(groups.reduce((s, g) => s + g.total, 0)),
    paid: round2(groups.reduce((s, g) => s + g.paid, 0)),
    owing: round2(groups.reduce((s, g) => s + g.owing, 0))
  }
  return { groups, totals }
}

export function addLedgerItem(input: LedgerItemInput, source = 'manual'): LedgerItem {
  const excl = input.excl_vat || round2(input.total_incl - input.vat)
  const info = getDatabase()
    .prepare(
      `INSERT INTO ledger_items
         (kind, entity_store_id, party, description, invoice_no, invoice_date,
          total_incl, vat, excl_vat, paid, source, created_at)
       VALUES (@kind, @entity, @party, @description, @invoice_no, @invoice_date,
          @total_incl, @vat, @excl_vat, @paid, @source, @created_at)`
    )
    .run({
      kind: input.kind,
      entity: input.entity_store_id === 0 ? null : input.entity_store_id,
      party: input.party.trim(),
      description: input.description.trim(),
      invoice_no: input.invoice_no.trim(),
      invoice_date: input.invoice_date.trim(),
      total_incl: round2(input.total_incl),
      vat: round2(input.vat),
      excl_vat: round2(excl),
      paid: round2(input.paid),
      source,
      created_at: now()
    })
  const row = getDatabase()
    .prepare(`SELECT * FROM ledger_items WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as Omit<LedgerItem, 'owing'>
  return withOwing(row)
}

export function updateLedgerItem(input: LedgerItemInput): void {
  if (!input.id) return
  const excl = input.excl_vat || round2(input.total_incl - input.vat)
  getDatabase()
    .prepare(
      `UPDATE ledger_items SET
         party = ?, description = ?, invoice_no = ?, invoice_date = ?,
         total_incl = ?, vat = ?, excl_vat = ?, paid = ?
       WHERE id = ?`
    )
    .run(
      input.party.trim(),
      input.description.trim(),
      input.invoice_no.trim(),
      input.invoice_date.trim(),
      round2(input.total_incl),
      round2(input.vat),
      round2(excl),
      round2(input.paid),
      input.id
    )
}

export function markPaid(id: number, paid: number): void {
  getDatabase().prepare(`UPDATE ledger_items SET paid = ? WHERE id = ?`).run(round2(paid), id)
}

export function deleteLedgerItem(id: number): void {
  getDatabase().prepare(`DELETE FROM ledger_items WHERE id = ?`).run(id)
}

/** Entities that can hold a ledger: Head Office (0) + every active store. */
export function listLedgerEntities(): LedgerEntity[] {
  return [{ id: 0, name: 'Head Office' }, ...listStores().map((s) => ({ id: s.id, name: s.name }))]
}
