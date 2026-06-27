import { dialog } from 'electron'
import { readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import * as XLSX from 'xlsx'
import { getDatabase } from '../db'
import { findOrCreateByName } from '../repositories/stores'
import type { StockOutImportSummary } from '../../shared/types'

const STORE_MAP: Array<[RegExp, string]> = [
  [/oceans|invo\d/i, 'Oceans Mall'],
  [/benoni|lakefield|invb\d/i, 'Lakefield Benoni'],
  [/florida|invf\d/i, 'Florida Fields'],
  [/gateway.*north/i, 'Gateway North'],
  [/gateway|invg\d/i, 'Gateway South'],
  [/pavil+ion|invp\d(?!w)/i, 'Pavilion'],
  [/point\s*water|waterfront|invpw\d/i, 'Point Waterfront']
]
function storeOf(name: string): string {
  const m = STORE_MAP.find(([re]) => re.test(name))
  return m ? m[1] : ''
}
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
}
function isoFromName(name: string): string {
  const m = /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i.exec(
    name
  )
  if (!m) return ''
  const mm = String(MONTHS[m[2].toLowerCase()]).padStart(2, '0')
  return `${m[3]}-${mm}-${String(+m[1]).padStart(2, '0')}`
}
function invoiceNo(name: string): string {
  const m = /(INV[A-Z]*\d+)/i.exec(name)
  return m ? m[1] : ''
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
    else if (/\.xlsx$/i.test(name) && /^inv[a-z]*[-\s]?\d/i.test(name)) out.push(full)
  }
  return out
}

export function importStockInvoices(rootDir: string): StockOutImportSummary {
  const db = getDatabase()
  const files = walk(rootDir)
  if (files.length === 0)
    return { ok: false, error: 'No "INV…" store invoices found in that folder.', files: 0, lines: 0, byStore: [] }

  const ins = db.prepare(
    `INSERT INTO stock_out_lines (store_id, txn_date, invoice_no, item_name, qty, rate, amount, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'import', ?)`
  )
  const now = new Date().toISOString()
  const byStore = new Map<string, number>()
  let filesParsed = 0
  let lines = 0

  const run = db.transaction(() => {
    db.prepare(`DELETE FROM stock_out_lines WHERE source = 'import'`).run()
    for (const file of files) {
      const name = basename(file)
      const date = isoFromName(name)
      const storeName = storeOf(name)
      if (!date) continue
      const storeId = storeName ? findOrCreateByName(storeName).id : null
      let rows: unknown[][]
      try {
        rows = XLSX.utils.sheet_to_json(XLSX.readFile(file).Sheets[XLSX.readFile(file).SheetNames[0]], {
          header: 1,
          defval: '',
          blankrows: false
        }) as unknown[][]
      } catch {
        continue
      }
      const hdr = rows.findIndex((r) => String(r[0]).trim() === '#')
      if (hdr < 0) continue
      const inv = invoiceNo(name)
      let n = 0
      for (let i = hdr + 1; i < rows.length; i++) {
        const a = String(rows[i][0]).trim()
        const item = String(rows[i][1] ?? '').trim()
        if (/banking|subtotal/i.test(a) || /banking|subtotal/i.test(item)) break
        const qty = num(rows[i][4])
        if (!item || qty <= 0) continue
        ins.run(storeId, date, inv, item, qty, num(rows[i][5]), num(rows[i][6]), now)
        n++
      }
      if (n > 0) {
        filesParsed++
        lines += n
        const key = storeName || 'Unknown'
        byStore.set(key, (byStore.get(key) ?? 0) + n)
      }
    }
  })
  run()
  return {
    ok: true,
    files: filesParsed,
    lines,
    byStore: [...byStore.entries()].map(([store, l]) => ({ store, lines: l }))
  }
}

export async function importStockInvoicesDialog(): Promise<StockOutImportSummary> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose the folder with your HO→store invoices (e.g. the "Debtors" folder)',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0)
    return { ok: false, cancelled: true, files: 0, lines: 0, byStore: [] }
  return importStockInvoices(filePaths[0])
}
