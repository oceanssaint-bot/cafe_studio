import { dialog } from 'electron'
import { readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import * as XLSX from 'xlsx'
import { getDatabase } from '../db'
import type { StockSheetImportSummary } from '../../shared/types'

function isoFromName(name: string): string {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(name)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
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
    else if (/\.xlsx$/i.test(name) && /stock\s*sheet/i.test(name) && !/template/i.test(name))
      out.push(full)
  }
  return out
}

export function importStockSheets(rootDir: string): StockSheetImportSummary {
  const db = getDatabase()
  const files = walk(rootDir)
  if (files.length === 0)
    return { ok: false, error: 'No "Stock Sheet" workbooks found in that folder.', sheets: 0, lines: 0, latestDate: '' }

  const del = db.prepare(`DELETE FROM stock_sheet_lines WHERE take_date = ? AND source = 'import'`)
  const ins = db.prepare(
    `INSERT INTO stock_sheet_lines (take_date, code, name, price, opening_qty, counted, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'import', ?)`
  )
  const now = new Date().toISOString()
  let sheets = 0
  let lines = 0
  let latest = ''

  const run = db.transaction(() => {
    for (const file of files) {
      const date = isoFromName(basename(file))
      if (!date) continue
      del.run(date)
      const rows = XLSX.utils.sheet_to_json(
        XLSX.readFile(file).Sheets[XLSX.readFile(file).SheetNames[0]],
        { header: 1, defval: '', blankrows: false }
      ) as unknown[][]
      const hdr = rows.findIndex(
        (r) => /code/i.test(String(r[0])) && r.some((c) => /stock item/i.test(String(c)))
      )
      if (hdr < 0) continue
      let n = 0
      for (let i = hdr + 1; i < rows.length; i++) {
        const code = String(rows[i][0] ?? '').trim()
        const name = String(rows[i][1] ?? '').trim()
        if (!code || !name) continue
        const rawQty = String(rows[i][5] ?? '').trim()
        ins.run(date, code, name, num(rows[i][4]), num(rows[i][5]), rawQty !== '' ? 1 : 0, now)
        n++
      }
      if (n > 0) {
        sheets++
        lines += n
        if (date > latest) latest = date
      }
    }
  })
  run()
  return { ok: true, sheets, lines, latestDate: latest }
}

export async function importStockSheetsDialog(): Promise<StockSheetImportSummary> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose your "Head Office Stock Take" folder',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0)
    return { ok: false, cancelled: true, sheets: 0, lines: 0, latestDate: '' }
  return importStockSheets(filePaths[0])
}
