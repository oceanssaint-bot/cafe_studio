import { getDatabase } from '../db'
import { periodLabel } from '../../shared/defaults'
import { computePaye, computeUif, computeSdl, ageFromDob } from '../services/sars-tax'
import type { Payslip, PayRunLine, PayRunResult, PayRunPreviewRow, Emp201, Staff } from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}
function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

/** Active staff for a store with the fields a pay run needs (gross prefill + age). */
export function payRunStaff(storeId: number): Array<{ id: number; name: string; monthly_pay: number; dob: string }> {
  return getDatabase()
    .prepare(`SELECT id, name, monthly_pay, dob FROM staff WHERE store_id = ? AND active = 1 ORDER BY name`)
    .all(storeId) as Array<{ id: number; name: string; monthly_pay: number; dob: string }>
}

function rowToPayslip(r: Record<string, unknown>): Payslip {
  return {
    id: r.id as number,
    store_id: r.store_id as number | null,
    staff_id: r.staff_id as number | null,
    staff_name: r.staff_name as string,
    period: r.period as string,
    gross: r.gross as number,
    paye: r.paye as number,
    uif: r.uif as number,
    other_deductions: r.other_deductions as number,
    net: r.net as number,
    uif_employer: r.uif_employer as number,
    sdl: r.sdl as number,
    earnings: JSON.parse((r.earnings as string) || '[]'),
    deductions: JSON.parse((r.deductions as string) || '[]')
  }
}

/** Process a pay run: compute PAYE/UIF/SDL/net per staff and store one payslip each. */
export function runPayroll(storeId: number, period: string, lines: PayRunLine[]): PayRunResult {
  const db = getDatabase()
  const up = db.prepare(
    `INSERT INTO payslips (store_id, staff_id, staff_name, period, gross, paye, uif, other_deductions, net, uif_employer, sdl, earnings, deductions, created_at)
     VALUES (@store_id,@staff_id,@staff_name,@period,@gross,@paye,@uif,@other_deductions,@net,@uif_employer,@sdl,@earnings,@deductions,@created_at)
     ON CONFLICT(staff_id, period) DO UPDATE SET
       gross=excluded.gross, paye=excluded.paye, uif=excluded.uif, other_deductions=excluded.other_deductions,
       net=excluded.net, uif_employer=excluded.uif_employer, sdl=excluded.sdl,
       earnings=excluded.earnings, deductions=excluded.deductions`
  )
  const totals = { gross: 0, paye: 0, uif: 0, other: 0, net: 0 }
  let count = 0

  const tx = db.transaction(() => {
    for (const l of lines) {
      const staff = db.prepare(`SELECT * FROM staff WHERE id = ?`).get(l.staff_id) as Staff | undefined
      if (!staff) continue
      const gross = round2(l.gross)
      if (gross <= 0) continue
      // Manual override wins; otherwise auto-calc via SARS (so the run never depends on anything external).
      const paye = round2(l.paye ?? computePaye(gross, ageFromDob(staff.dob)))
      const uif = round2(l.uif ?? computeUif(gross))
      const other = round2(l.other_deductions ?? 0)
      const net = round2(gross - paye - uif - other)
      const earnings = [{ label: 'Basic salary / wages', amount: gross }]
      const deductions = [
        { label: 'PAYE (tax)', amount: paye },
        { label: 'UIF (1%)', amount: uif },
        ...(other > 0 ? [{ label: 'Other deductions', amount: other }] : [])
      ]
      up.run({
        store_id: storeId,
        staff_id: staff.id,
        staff_name: staff.name,
        period,
        gross,
        paye,
        uif,
        other_deductions: other,
        net,
        uif_employer: uif,
        sdl: computeSdl(gross),
        earnings: JSON.stringify(earnings),
        deductions: JSON.stringify(deductions),
        created_at: now()
      })
      totals.gross += gross
      totals.paye += paye
      totals.uif += uif
      totals.other += other
      totals.net += net
      count++
    }
  })
  tx()
  return {
    ok: true,
    period,
    count,
    totals: {
      gross: round2(totals.gross),
      paye: round2(totals.paye),
      uif: round2(totals.uif),
      other: round2(totals.other),
      net: round2(totals.net)
    }
  }
}

/** Preview SARS PAYE/UIF for given gross amounts without saving (fills the "Auto-calc" button). */
export function previewPayroll(lines: PayRunLine[]): PayRunPreviewRow[] {
  const db = getDatabase()
  return lines.map((l) => {
    const staff = db.prepare(`SELECT dob FROM staff WHERE id = ?`).get(l.staff_id) as { dob: string } | undefined
    const gross = round2(l.gross)
    return { staff_id: l.staff_id, paye: computePaye(gross, ageFromDob(staff?.dob ?? '')), uif: computeUif(gross) }
  })
}

export function listPayslips(storeId: number, period: string): Payslip[] {
  return (
    getDatabase()
      .prepare(`SELECT * FROM payslips WHERE store_id = ? AND period = ? ORDER BY staff_name`)
      .all(storeId, period) as Array<Record<string, unknown>>
  ).map(rowToPayslip)
}

export function getPayslip(id: number): Payslip | undefined {
  const r = getDatabase().prepare(`SELECT * FROM payslips WHERE id = ?`).get(id) as
    | Record<string, unknown>
    | undefined
  return r ? rowToPayslip(r) : undefined
}

export function listPayslipPeriods(storeId: number): string[] {
  return (
    getDatabase()
      .prepare(`SELECT DISTINCT period FROM payslips WHERE store_id = ? ORDER BY period DESC`)
      .all(storeId) as Array<{ period: string }>
  ).map((r) => r.period)
}

/** EMP201 monthly employer declaration totals (PAYE + total UIF + SDL). */
export function getEmp201(storeId: number, period: string): Emp201 {
  const r = getDatabase()
    .prepare(
      `SELECT COALESCE(SUM(paye),0) paye, COALESCE(SUM(uif),0) uif_emp, COALESCE(SUM(uif_employer),0) uif_er,
              COALESCE(SUM(sdl),0) sdl, COUNT(*) n
       FROM payslips WHERE store_id = ? AND period = ?`
    )
    .get(storeId, period) as { paye: number; uif_emp: number; uif_er: number; sdl: number; n: number }
  const paye = round2(r.paye)
  const uifTotal = round2(r.uif_emp + r.uif_er)
  const sdl = round2(r.sdl)
  return {
    period,
    periodLabel: periodLabel(period),
    paye,
    uifTotal,
    sdl,
    total: round2(paye + uifTotal + sdl),
    staffCount: r.n
  }
}
