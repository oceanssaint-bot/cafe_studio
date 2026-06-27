import { dialog } from 'electron'
import { readdirSync, statSync } from 'fs'
import { join, basename, relative } from 'path'
import * as XLSX from 'xlsx'
import { getDatabase } from '../db'
import { findOrCreateByName } from '../repositories/stores'
import type { StaffHoursImportSummary } from '../../shared/types'

const STORE_MAP: Array<[RegExp, string | null]> = [
  [/head\s*office/i, null],
  [/oceans/i, 'Oceans Mall'],
  [/pavilion/i, 'Pavilion'],
  [/florida/i, 'Florida Fields'],
  [/gateway.*north/i, 'Gateway North'],
  [/gateway/i, 'Gateway South'],
  [/lakefield|benoni/i, 'Lakefield Benoni'],
  [/waterfront|point/i, 'Point Waterfront']
]
function storeOf(relPath: string): { matched: boolean; name: string | null } {
  const m = STORE_MAP.find(([re]) => re.test(relPath))
  return m ? { matched: true, name: m[1] } : { matched: false, name: null }
}
const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
}
function periodOf(text: string): string {
  const m = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i.exec(
    text
  )
  return m ? `${m[2]}-${MONTHS[m[1].toLowerCase()]}` : ''
}
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}
function walk(dir: string): string[] {
  const out: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    if (name.startsWith('~$')) continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) out.push(...walk(full))
    else if (/wages.*\.xlsx$/i.test(name)) out.push(full)
  }
  return out
}

export function importStaffHours(rootDir: string): StaffHoursImportSummary {
  const summary: StaffHoursImportSummary = {
    ok: true,
    filesParsed: 0,
    storesUpdated: [],
    employees: 0,
    totalGross: 0,
    warnings: []
  }
  const db = getDatabase()
  const files = walk(rootDir)
  if (files.length === 0)
    return { ...summary, ok: false, error: 'No WAGES workbooks found in that folder.' }

  const del = db.prepare(
    `DELETE FROM payroll WHERE source = 'import-wages' AND period = ? AND (entity_store_id IS ? OR entity_store_id = ?)`
  )
  const ins = db.prepare(
    `INSERT INTO payroll (entity_store_id, period, employee, emp_no, gross, net, notes, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'import-wages', ?)`
  )
  const now = new Date().toISOString()
  const updated = new Set<string>()
  const cleared = new Set<string>()

  const run = db.transaction(() => {
    for (const file of files) {
      try {
        const rel = relative(rootDir, file)
        const period = periodOf(basename(file)) || periodOf(rel)
        const store = storeOf(rel)
        if (!period || !store.matched) {
          if (!period) summary.warnings.push(`${basename(file)}: no period in name.`)
          continue
        }
        const storeId = store.name ? findOrCreateByName(store.name).id : null
        const label = store.name ?? 'Head Office'
        const key = `${storeId ?? 'HO'}:${period}`
        if (!cleared.has(key)) {
          del.run(period, storeId, storeId)
          cleared.add(key)
        }

        const wb = XLSX.readFile(file)
        const sheet = wb.SheetNames.find((s) => /summary/i.test(s))
        if (!sheet) {
          summary.warnings.push(`${basename(file)}: no SUMMARY sheet.`)
          continue
        }
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {
          header: 1,
          defval: '',
          blankrows: false
        }) as unknown[][]
        const hdr = rows.findIndex((r) => /^name\b/i.test(String(r[0]).trim()))
        if (hdr < 0) {
          summary.warnings.push(`${basename(file)}: no NAME header.`)
          continue
        }
        // Gross = the "Total" column just before "Deductions"; Net = the last "Total".
        const head = rows[hdr].map((c) => String(c).trim().toLowerCase())
        const dedIdx = head.findIndex((c) => /deduction/i.test(c))
        const totalCols = head.map((c, i) => (c === 'total' ? i : -1)).filter((i) => i >= 0)
        const grossCol = dedIdx > 0 ? [...totalCols].reverse().find((i) => i < dedIdx) ?? 19 : 19
        const netCol = totalCols.length ? totalCols[totalCols.length - 1] : 28

        let count = 0
        for (let i = hdr + 1; i < rows.length; i++) {
          const name = String(rows[i][0] ?? '').trim()
          if (!name || /^(name|manager)$/i.test(name)) continue
          const gross = num(rows[i][grossCol])
          const net = num(rows[i][netCol])
          if (gross === 0 && net === 0) continue
          ins.run(
            storeId,
            period,
            name,
            String(rows[i][1] ?? '').trim(),
            Math.round(gross * 100) / 100,
            Math.round(net * 100) / 100,
            `${String(rows[i][2] ?? '').trim()} · std hrs ${num(rows[i][3])}`.trim(),
            now
          )
          summary.totalGross += gross
          count++
        }
        summary.filesParsed++
        summary.employees += count
        updated.add(label)
      } catch (err) {
        summary.warnings.push(`${basename(file)}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  })
  run()
  summary.storesUpdated = [...updated]
  summary.totalGross = Math.round(summary.totalGross * 100) / 100
  return summary
}

export async function importStaffHoursDialog(): Promise<StaffHoursImportSummary> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose your "Staff Hours" folder',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0)
    return { ok: false, cancelled: true, filesParsed: 0, storesUpdated: [], employees: 0, totalGross: 0, warnings: [] }
  return importStaffHours(filePaths[0])
}
