import { dialog } from 'electron'
import { readdirSync, statSync } from 'fs'
import { join, basename, relative } from 'path'
import * as XLSX from 'xlsx'
import { getDatabase } from '../db'
import { findOrCreateByName } from '../repositories/stores'
import type { PurchaseImportSummary } from '../../shared/types'

const STORE_MAP: Array<[RegExp, string]> = [
  [/oceans/i, 'Oceans Mall'],
  [/gateway.*(south|store\s*1)|south.*gateway/i, 'Gateway South'],
  [/gateway.*north/i, 'Gateway North'],
  [/xpress\s*durban|point\s*water|waterfront/i, 'Point Waterfront'],
  [/pavilion/i, 'Pavilion'],
  [/florida/i, 'Florida Fields'],
  [/lakefield|benoni/i, 'Lakefield Benoni'],
  [/gateway/i, 'Gateway South']
]
const storeOf = (t: string): string => {
  const m = STORE_MAP.find(([re]) => re.test(t))
  return m ? m[1] : ''
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
    else if (/\.xlsx?$/i.test(name) && /purchase/i.test(`${full}`)) out.push(full)
  }
  return out
}

export function importPurchases(rootDir: string): PurchaseImportSummary {
  const summary: PurchaseImportSummary = {
    ok: true,
    filesParsed: 0,
    storesUpdated: [],
    linesImported: 0,
    totalIncl: 0,
    warnings: []
  }
  const db = getDatabase()
  const files = walk(rootDir)
  if (files.length === 0)
    return { ...summary, ok: false, error: 'No purchase workbooks found in that folder.' }

  const del = db.prepare(
    `DELETE FROM store_purchase_lines WHERE store_id = ? AND period = ? AND source = 'import'`
  )
  const ins = db.prepare(
    `INSERT INTO store_purchase_lines (store_id, period, txn_date, invoice_no, supplier, description, excl_vat, vat, incl_vat, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'import', ?)`
  )
  const now = new Date().toISOString()
  const updated = new Set<string>()
  const cleared = new Set<string>()

  const run = db.transaction(() => {
    for (const file of files) {
      try {
        const name = basename(file)
        const period = periodOf(name)
        // Match the store from the path RELATIVE to the chosen root — the absolute
        // path contains the Windows username which can falsely match a store.
        const storeName = storeOf(relative(rootDir, file))
        if (!period || !storeName) continue
        const store = findOrCreateByName(storeName)
        const key = `${store.id}:${period}`
        if (!cleared.has(key)) {
          del.run(store.id, period)
          cleared.add(key)
        }
        const rows = XLSX.utils.sheet_to_json(XLSX.readFile(file).Sheets[XLSX.readFile(file).SheetNames[0]], {
          header: 1,
          defval: '',
          blankrows: false
        }) as unknown[][]
        const h = rows.findIndex(
          (r) => /date/i.test(String(r[0])) && r.some((c) => /supplier/i.test(String(c)))
        )
        if (h < 0) {
          summary.warnings.push(`${name}: no header.`)
          continue
        }
        let count = 0
        for (let i = h + 1; i < rows.length; i++) {
          const supplier = String(rows[i][2] ?? '').trim()
          const incl = num(rows[i][6])
          if (!supplier) continue // total row / blank
          ins.run(
            store.id,
            period,
            String(rows[i][0] ?? '').trim(),
            String(rows[i][1] ?? '').trim(),
            supplier,
            String(rows[i][3] ?? '').trim(),
            num(rows[i][4]),
            num(rows[i][5]),
            incl,
            now
          )
          summary.totalIncl += incl
          count++
        }
        summary.filesParsed++
        summary.linesImported += count
        updated.add(store.name)
      } catch (err) {
        summary.warnings.push(`${basename(file)}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  })
  run()
  summary.storesUpdated = [...updated]
  summary.totalIncl = Math.round(summary.totalIncl * 100) / 100
  return summary
}

export async function importPurchasesDialog(): Promise<PurchaseImportSummary> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose your "Store Purchases" folder',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0)
    return { ok: false, cancelled: true, filesParsed: 0, storesUpdated: [], linesImported: 0, totalIncl: 0, warnings: [] }
  return importPurchases(filePaths[0])
}
