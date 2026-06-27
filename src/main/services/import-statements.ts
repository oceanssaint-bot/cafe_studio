import { dialog } from 'electron'
import { readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import * as XLSX from 'xlsx'
import { getDatabase } from '../db'
import { findOrCreateByName } from '../repositories/stores'
import type { StatementImportSummary, StatementTxType } from '../../shared/types'

const STORE_MAP: Array<[RegExp, string]> = [
  [/oceans/i, 'Oceans Mall'],
  [/gateway.*(south|store\s*1|gat0?1)|south.*gateway/i, 'Gateway South'],
  [/gateway.*(north|gat0?2)/i, 'Gateway North'],
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

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/** DD.MM.YYYY → period YYYY-MM. */
function periodOf(date: string): string {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(date)
  return m ? `${m[3]}-${m[2]}` : ''
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
    else out.push(full)
  }
  return out
}

function isStatementFile(name: string): boolean {
  return /statement of account/i.test(name) && /\.xlsx?$/i.test(name) && storeOf(name) !== ''
}

interface ParsedStatement {
  storeName: string
  customer_name: string
  vat_no: string
  address: string
  lines: Array<{
    line_date: string
    tx_type: StatementTxType
    reference: string
    details: string
    debit: number
    credit: number
    period: string
  }>
}

function parseStatement(file: string): ParsedStatement | null {
  const wb = XLSX.readFile(file)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: '',
    blankrows: false
  }) as unknown[][]

  const headerIdx = rows.findIndex(
    (r) => /^date$/i.test(String(r[0]).trim()) && /transaction/i.test(String(r[1] ?? ''))
  )
  if (headerIdx < 0) return null

  // Customer header: col-0 lines between the "To" row and the table header.
  const addrLines: string[] = []
  let customer_name = ''
  let vat_no = ''
  for (let i = 0; i < headerIdx; i++) {
    const c0 = String(rows[i][0] ?? '').trim()
    if (!c0 || /^to$/i.test(c0)) continue
    if (/vat/i.test(c0)) {
      vat_no = c0.replace(/.*?:\s*/, '').trim()
      continue
    }
    if (!customer_name) customer_name = c0
    else addrLines.push(c0)
  }

  const storeName = storeOf(`${basename(file)} ${customer_name}`)
  if (!storeName) return null

  const lines: ParsedStatement['lines'] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const date = String(rows[i][0] ?? '').trim()
    if (!/\d{2}\.\d{2}\.\d{4}/.test(date)) continue // skip the trailing balance-only row
    const transaction = String(rows[i][1] ?? '').trim()
    const details = String(rows[i][2] ?? '').trim()
    const debit = num(rows[i][3])
    const credit = num(rows[i][4])
    if (!debit && !credit) continue
    let tx_type: StatementTxType = 'invoice'
    if (/payment/i.test(transaction) || credit > 0) tx_type = 'payment'
    else if (/royalt/i.test(details)) tx_type = 'royalty'
    const refMatch = /\b(INV\w+|GJ\w+)\b/i.exec(details)
    lines.push({
      line_date: date,
      tx_type,
      reference: refMatch ? refMatch[1] : '',
      details,
      debit,
      credit,
      period: periodOf(date)
    })
  }

  return { storeName, customer_name, vat_no, address: addrLines.join(', '), lines }
}

export function importStatements(rootDir: string): StatementImportSummary {
  const summary: StatementImportSummary = {
    ok: true,
    filesParsed: 0,
    storesUpdated: [],
    linesImported: 0,
    warnings: []
  }
  const db = getDatabase()
  const files = walk(rootDir).filter((f) => isStatementFile(basename(f)))
  if (files.length === 0)
    return { ...summary, ok: false, error: 'No "Statement of Account …xlsx" files found in that folder.' }

  const delLines = db.prepare(`DELETE FROM statement_lines WHERE store_id = ? AND source = 'import'`)
  const insLine = db.prepare(
    `INSERT INTO statement_lines (store_id, line_date, tx_type, reference, details, debit, credit, period, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'import', ?)`
  )
  const upAcct = db.prepare(
    `INSERT INTO statement_accounts (store_id, customer_name, vat_no, address, updated_at)
     VALUES (@store_id, @customer_name, @vat_no, @address, @updated_at)
     ON CONFLICT(store_id) DO UPDATE SET customer_name=excluded.customer_name, vat_no=excluded.vat_no,
       address=excluded.address, updated_at=excluded.updated_at`
  )
  const now = new Date().toISOString()
  const updated = new Set<string>()

  const run = db.transaction(() => {
    for (const file of files) {
      try {
        const p = parseStatement(file)
        if (!p) {
          summary.warnings.push(`${basename(file)}: could not parse.`)
          continue
        }
        const store = findOrCreateByName(p.storeName)
        delLines.run(store.id)
        for (const l of p.lines) {
          insLine.run(store.id, l.line_date, l.tx_type, l.reference, l.details, l.debit, l.credit, l.period, now)
        }
        upAcct.run({
          store_id: store.id,
          customer_name: p.customer_name,
          vat_no: p.vat_no,
          address: p.address,
          updated_at: now
        })
        summary.filesParsed++
        summary.linesImported += p.lines.length
        updated.add(store.name)
      } catch (err) {
        summary.warnings.push(`${basename(file)}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  })
  run()
  summary.storesUpdated = [...updated]
  return summary
}

export async function importStatementsDialog(): Promise<StatementImportSummary> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose the folder with your "Statement of Account" files',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0)
    return { ok: false, cancelled: true, filesParsed: 0, storesUpdated: [], linesImported: 0, warnings: [] }
  return importStatements(filePaths[0])
}
