import { getDatabase } from '../db'
import type {
  CashPayout,
  CashPayoutInput,
  CashDeclaration,
  CashReconDay,
  CashUpData
} from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}

function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

export function listPayouts(storeId: number, period: string): CashPayout[] {
  return getDatabase()
    .prepare(
      `SELECT * FROM cash_payouts WHERE store_id = ? AND period = ?
       ORDER BY txn_date, id`
    )
    .all(storeId, period) as CashPayout[]
}

export function addPayout(input: CashPayoutInput): CashPayout {
  const incl = input.incl_vat || round2(input.excl_vat + input.vat)
  const info = getDatabase()
    .prepare(
      `INSERT INTO cash_payouts
         (store_id, period, txn_date, supplier, description, excl_vat, vat, incl_vat, kind, source_doc_id, created_at)
       VALUES (@store_id, @period, @txn_date, @supplier, @description, @excl_vat, @vat, @incl_vat, @kind, @source_doc_id, @created_at)`
    )
    .run({
      store_id: input.store_id,
      period: input.period,
      txn_date: input.txn_date,
      supplier: input.supplier.trim(),
      description: input.description.trim(),
      excl_vat: round2(input.excl_vat),
      vat: round2(input.vat),
      incl_vat: round2(incl),
      kind: input.kind,
      source_doc_id: input.source_doc_id ?? null,
      created_at: now()
    })
  return getDatabase()
    .prepare(`SELECT * FROM cash_payouts WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as CashPayout
}

export function updatePayout(input: CashPayoutInput): void {
  if (!input.id) return
  const incl = input.incl_vat || round2(input.excl_vat + input.vat)
  getDatabase()
    .prepare(
      `UPDATE cash_payouts SET
         txn_date = ?, supplier = ?, description = ?, excl_vat = ?, vat = ?, incl_vat = ?, kind = ?
       WHERE id = ?`
    )
    .run(
      input.txn_date,
      input.supplier.trim(),
      input.description.trim(),
      round2(input.excl_vat),
      round2(input.vat),
      round2(incl),
      input.kind,
      input.id
    )
}

export function deletePayout(id: number): void {
  getDatabase().prepare(`DELETE FROM cash_payouts WHERE id = ?`).run(id)
}

/** Record/overwrite a day's handwritten payout-voucher declared totals. */
export function setDeclaration(d: CashDeclaration): void {
  // Clearing both figures removes the voucher entirely.
  if (round2(d.declared_purchases) === 0 && round2(d.declared_tips) === 0) {
    getDatabase()
      .prepare(`DELETE FROM cash_declarations WHERE store_id = ? AND txn_date = ?`)
      .run(d.store_id, d.txn_date)
    return
  }
  getDatabase()
    .prepare(
      `INSERT INTO cash_declarations (store_id, period, txn_date, declared_purchases, declared_tips)
       VALUES (@store_id, @period, @txn_date, @declared_purchases, @declared_tips)
       ON CONFLICT(store_id, txn_date) DO UPDATE SET
         declared_purchases = excluded.declared_purchases,
         declared_tips = excluded.declared_tips,
         period = excluded.period`
    )
    .run({
      store_id: d.store_id,
      period: d.period,
      txn_date: d.txn_date,
      declared_purchases: round2(d.declared_purchases),
      declared_tips: round2(d.declared_tips)
    })
}

/**
 * Builds the full cash-up view for a store/month: the payout lines, the
 * monthly totals, and a per-day reconciliation of the summed till slips
 * against the handwritten voucher's declared figures.
 */
export function getCashUp(storeId: number, period: string): CashUpData {
  const db = getDatabase()
  const payouts = listPayouts(storeId, period)
  const declarations = db
    .prepare(`SELECT * FROM cash_declarations WHERE store_id = ? AND period = ?`)
    .all(storeId, period) as CashDeclaration[]
  const declByDate = new Map(declarations.map((d) => [d.txn_date, d]))

  const totals = { excl: 0, vat: 0, incl: 0, tips: 0 }
  const byDate = new Map<string, { slips: number; slipsTotal: number; tips: number }>()

  for (const p of payouts) {
    const slot = byDate.get(p.txn_date) ?? { slips: 0, slipsTotal: 0, tips: 0 }
    if (p.kind === 'tip') {
      totals.tips += p.incl_vat
      slot.tips += p.incl_vat
    } else {
      // Both purchases and invoices count toward the monthly purchases total…
      totals.excl += p.excl_vat
      totals.vat += p.vat
      totals.incl += p.incl_vat
      // …but only cash till-slip purchases reconcile to the daily payout voucher.
      // Supplier invoices (paid by EFT) are excluded from the slip-vs-voucher check.
      if (p.kind !== 'invoice') {
        slot.slips += 1
        slot.slipsTotal += p.incl_vat
      }
    }
    byDate.set(p.txn_date, slot)
  }

  const dates = new Set<string>([...byDate.keys(), ...declByDate.keys()])
  const recon: CashReconDay[] = [...dates]
    .sort()
    .map((txn_date) => {
      const s = byDate.get(txn_date) ?? { slips: 0, slipsTotal: 0, tips: 0 }
      const d = declByDate.get(txn_date)
      const declaredPurchases = d ? d.declared_purchases : 0
      const declaredTips = d ? d.declared_tips : 0
      const variance = round2(s.slipsTotal - declaredPurchases)
      return {
        txn_date,
        slipCount: s.slips,
        slipsTotal: round2(s.slipsTotal),
        tipsTotal: round2(s.tips || declaredTips),
        declaredPurchases,
        declaredTips,
        variance,
        // matched if there's a declaration and it ties out within 1 cent
        matched: d ? Math.abs(variance) <= 0.01 : false
      }
    })

  return {
    payouts,
    totals: {
      excl: round2(totals.excl),
      vat: round2(totals.vat),
      incl: round2(totals.incl),
      tips: round2(totals.tips)
    },
    recon
  }
}
