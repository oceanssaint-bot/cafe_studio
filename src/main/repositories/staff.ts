import { getDatabase } from '../db'
import type { Staff, StaffInput, StaffSyncSummary } from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}

/** Derive date of birth + gender from a South African ID number (YYMMDD SSSS C A Z). */
export function deriveFromIdNumber(id: string): { dob: string; gender: string } {
  const m = /^(\d{2})(\d{2})(\d{2})(\d{4})/.exec(String(id).replace(/\s/g, ''))
  if (!m) return { dob: '', gender: '' }
  const yy = +m[1]
  const year = yy <= +String(new Date().getFullYear()).slice(2) ? 2000 + yy : 1900 + yy
  const mm = +m[2]
  const dd = +m[3]
  const dob = mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 ? `${year}-${m[2]}-${m[3]}` : ''
  const gender = +m[4] < 5000 ? 'Female' : 'Male'
  return { dob, gender }
}

export function listStaff(storeId: number): Staff[] {
  return getDatabase()
    .prepare(`SELECT * FROM staff WHERE store_id = ? ORDER BY active DESC, name`)
    .all(storeId) as Staff[]
}

export function upsertStaff(input: StaffInput): Staff {
  const db = getDatabase()
  const { dob, gender } = deriveFromIdNumber(input.id_number)
  if (input.id) {
    db.prepare(
      `UPDATE staff SET name=?, id_number=?, occupation=?, status=?, dob=?, gender=?, phone=?, email=?, monthly_pay=?, notes=?, active=? WHERE id=?`
    ).run(
      input.name.trim(),
      input.id_number.trim(),
      input.occupation.trim(),
      input.status,
      dob,
      gender,
      input.phone.trim(),
      input.email.trim(),
      input.monthly_pay,
      input.notes.trim(),
      input.active ? 1 : 0,
      input.id
    )
    return db.prepare(`SELECT * FROM staff WHERE id = ?`).get(input.id) as Staff
  }
  const info = db
    .prepare(
      `INSERT INTO staff (store_id, name, id_number, occupation, status, dob, gender, phone, email, monthly_pay, notes, active, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      input.store_id,
      input.name.trim(),
      input.id_number.trim(),
      input.occupation.trim(),
      input.status,
      dob,
      gender,
      input.phone.trim(),
      input.email.trim(),
      input.monthly_pay,
      input.notes.trim(),
      input.active ? 1 : 0,
      now()
    )
  return db.prepare(`SELECT * FROM staff WHERE id = ?`).get(Number(info.lastInsertRowid)) as Staff
}

export function deleteStaff(id: number): void {
  getDatabase().prepare(`DELETE FROM staff WHERE id = ?`).run(id)
}

/**
 * Builds the staff register for a store from its imported WAGES payroll, deduped
 * by SA ID number (so "Menzi Rodger" / "Menzi Ridger" collapse to one person).
 * Picks the longest name variant, latest pay, and ≥6 months = Permanent.
 */
export function syncStaffFromPayroll(storeId: number): StaffSyncSummary {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT employee, emp_no, notes, period, gross FROM payroll
       WHERE entity_store_id = ? AND source = 'import-wages' ORDER BY period DESC`
    )
    .all(storeId) as Array<{ employee: string; emp_no: string; notes: string; period: string; gross: number }>

  // group by ID number (fallback: name)
  const groups = new Map<string, typeof rows>()
  for (const r of rows) {
    const key = (r.emp_no || '').trim() || `name:${r.employee.toLowerCase().trim()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  const existing = new Set(
    (db.prepare(`SELECT id_number FROM staff WHERE store_id = ?`).all(storeId) as Array<{ id_number: string }>)
      .map((r) => r.id_number)
      .filter(Boolean)
  )

  let added = 0
  const tx = db.transaction(() => {
    for (const [key, g] of groups) {
      const idNum = key.startsWith('name:') ? '' : key
      if (idNum && existing.has(idNum)) continue
      // canonical name = the most frequently-recorded variant for this ID
      const counts = new Map<string, number>()
      for (const r of g) counts.set(r.employee, (counts.get(r.employee) ?? 0) + 1)
      const name = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
      const occupation = (g[0].notes.split('·')[0] || '').trim() || 'Team Member'
      const months = new Set(g.map((r) => r.period)).size
      const status = months >= 6 ? 'Permanent' : 'Casual'
      upsertStaff({
        store_id: storeId,
        name,
        id_number: idNum,
        occupation,
        status,
        phone: '',
        email: '',
        monthly_pay: g[0].gross,
        notes: `${months} months on record (from timesheets)`,
        active: 1
      })
      added++
    }
  })
  tx()
  const total = (db.prepare(`SELECT COUNT(*) n FROM staff WHERE store_id = ?`).get(storeId) as { n: number }).n
  return { added, total }
}
