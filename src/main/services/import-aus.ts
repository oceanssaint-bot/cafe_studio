import { dialog } from 'electron'
import { readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import * as XLSX from 'xlsx'
import { getDatabase } from '../db'
import type { AusImportSummary } from '../../shared/types'

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}
/** Excel serial date (or string) → YYYY-MM-DD. */
function isoDate(v: unknown): string {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000)
    return d.toISOString().slice(0, 10)
  }
  const s = String(v ?? '').trim()
  const m = /(\d{4})[-/](\d{2})[-/](\d{2})/.exec(s) || /(\d{2})[./](\d{2})[./](\d{4})/.exec(s)
  if (m) return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`
  return s
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
    else if (/ledger.*\.xlsx$/i.test(name)) out.push(full)
  }
  return out
}

export function importAus(rootDir: string): AusImportSummary {
  const summary: AusImportSummary = {
    ok: true,
    filesParsed: 0,
    linesImported: 0,
    balanceUsd: 0,
    warnings: []
  }
  const db = getDatabase()
  const files = walk(rootDir)
  if (files.length === 0)
    return { ...summary, ok: false, error: 'No GJC Aus "transaction ledger" workbooks found.' }

  const ins = db.prepare(
    `INSERT INTO aus_account_lines (ledger, txn_date, txn_type, doc_no, description, amount_usd, remaining_usd, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'import', ?)`
  )
  const now = new Date().toISOString()

  const run = db.transaction(() => {
    db.prepare(`DELETE FROM aus_account_lines WHERE source = 'import'`).run()
    for (const file of files) {
      try {
        const ledger = /royalty|franchise/i.test(basename(file)) ? 'royalty' : 'stock'
        const wb = XLSX.readFile(file)
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
          header: 1,
          defval: '',
          blankrows: false
        }) as unknown[][]
        // Locate header row by known tokens, then map columns by keyword.
        const hdr = rows.findIndex((r) =>
          r.some((c) => /amount in transac|original amount/i.test(String(c)))
        )
        if (hdr < 0) {
          summary.warnings.push(`${basename(file)}: no recognisable header.`)
          continue
        }
        const head = rows[hdr].map((c) => String(c).trim().toLowerCase())
        const find = (re: RegExp, fallback = -1): number => {
          const i = head.findIndex((c) => re.test(c))
          return i >= 0 ? i : fallback
        }
        const cDate = find(/posting date|^date$/)
        const cType = find(/transaction type|document type/)
        const cDoc = find(/tax invoice|document no/)
        const cDesc = find(/description/)
        const cAmt = find(/amount in transac|original amount/)
        const cRem = find(/remaining|^balance$/)

        let count = 0
        for (let i = hdr + 1; i < rows.length; i++) {
          const r = rows[i]
          const amount = num(r[cAmt])
          const desc = String(r[cDesc] ?? '').trim()
          const type = String(r[cType] ?? '').trim()
          if (amount === 0 && !desc && !type) continue
          ins.run(
            ledger,
            isoDate(r[cDate]),
            type,
            String(r[cDoc] ?? '').trim(),
            desc,
            amount,
            cRem >= 0 ? num(r[cRem]) : 0,
            now
          )
          summary.balanceUsd += amount
          count++
        }
        summary.filesParsed++
        summary.linesImported += count
      } catch (err) {
        summary.warnings.push(`${basename(file)}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  })
  run()
  summary.balanceUsd = Math.round(summary.balanceUsd * 100) / 100
  return summary
}

export async function importAusDialog(): Promise<AusImportSummary> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose your "GJC Aus Account" folder',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0)
    return { ok: false, cancelled: true, filesParsed: 0, linesImported: 0, balanceUsd: 0, warnings: [] }
  return importAus(filePaths[0])
}
