import { dialog } from 'electron'
import { readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import * as XLSX from 'xlsx'
import { getDatabase } from '../db'
import { findOrCreateByName } from '../repositories/stores'
import { addLedgerItem } from '../repositories/ledger'
import type { LedgerImportSummary, LedgerItemInput } from '../../shared/types'

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

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function rowsOf(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
}

/** Find header row + map columns by keyword. */
function mapColumns(rows: unknown[][]): { headerIdx: number; col: Record<string, number> } {
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i].map((c) => String(c).toLowerCase())
    const has = (re: RegExp): number => cells.findIndex((c) => re.test(c))
    const total = cells.findIndex((c) => /amount|total/.test(c) && !/ex/.test(c))
    const key = has(/creditor|invoice|date/)
    // A real header row has BOTH an amount/total column AND a key column —
    // this skips sheet title rows that merely contain the word "creditors".
    if (total >= 0 && key >= 0) {
      return {
        headerIdx: i,
        col: {
          party: has(/creditor/),
          description: has(/description/),
          invoice_no: has(/invoice (number|no)/),
          invoice_date: has(/invoice date|^date/),
          total,
          vat: cells.findIndex((c) => /vat/.test(c) && !/ex/.test(c)),
          excl: has(/excl|ex vat/)
        }
      }
    }
  }
  return { headerIdx: 0, col: {} }
}

function isTotalRow(rows: unknown[][], i: number): boolean {
  return rows[i].some((c) => /^\s*(gj\s+)?total/i.test(String(c)))
}

/** Parse a creditor/debtor sheet into ledger inputs. */
function parseSheet(
  ws: XLSX.WorkSheet,
  kind: 'creditor' | 'debtor',
  entityStoreId: number,
  fixedParty: string | null
): LedgerItemInput[] {
  const rows = rowsOf(ws)
  const { headerIdx, col } = mapColumns(rows)
  const out: LedgerItemInput[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    if (isTotalRow(rows, i)) continue
    const row = rows[i]
    const total = col.total >= 0 ? num(row[col.total]) : 0
    if (!total) continue
    const party = fixedParty ?? (col.party >= 0 ? String(row[col.party] ?? '').trim() : '')
    if (!party) continue
    const vat = col.vat >= 0 ? num(row[col.vat]) : 0
    out.push({
      kind,
      entity_store_id: entityStoreId,
      party,
      description: col.description >= 0 ? String(row[col.description] ?? '').trim() : '',
      invoice_no: col.invoice_no >= 0 ? String(row[col.invoice_no] ?? '').trim() : '',
      invoice_date: col.invoice_date >= 0 ? String(row[col.invoice_date] ?? '').trim() : '',
      total_incl: total,
      vat,
      excl_vat: col.excl >= 0 ? num(row[col.excl]) : Math.round((total - vat) * 100) / 100,
      paid: 0
    })
  }
  return out
}

function latestCreditorsSchedule(files: string[]): string | null {
  let best: { file: string; key: number } | null = null
  for (const f of files) {
    const m = /Creditors Schedule-\s*(\d{2})\.(\d{2})\.(\d{4})\.xlsx?$/i.exec(basename(f))
    if (!m) continue
    const key = Number(`${m[3]}${m[2]}${m[1]}`)
    if (!best || key > best.key) best = { file: f, key }
  }
  return best ? best.file : null
}

export async function importLedgersDialog(): Promise<LedgerImportSummary> {
  const summary: LedgerImportSummary = {
    ok: true,
    sourceFile: '',
    creditorsHO: 0,
    creditorsStores: 0,
    debtors: 0,
    warnings: []
  }
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose your admin archive folder to import creditors & debtors',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0) return { ...summary, ok: false, cancelled: true }

  const files = walk(filePaths[0])
  const schedule = latestCreditorsSchedule(files)
  if (!schedule) return { ...summary, ok: false, error: 'No "Creditors Schedule- DD.MM.YYYY.xlsx" found.' }
  summary.sourceFile = basename(schedule)

  const db = getDatabase()
  // Idempotent: clear previously-imported rows, keep manual entries.
  db.prepare(`DELETE FROM ledger_items WHERE source = 'import'`).run()

  const post = (items: LedgerItemInput[]): void => {
    for (const it of items) addLedgerItem(it, 'import')
  }

  try {
    const wb = XLSX.readFile(schedule)
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name]
      try {
        if (/^creditors\b/i.test(name.trim())) {
          const items = parseSheet(ws, 'creditor', 0, null) // Head Office
          post(items)
          summary.creditorsHO += items.length
        } else if (/creditors/i.test(name)) {
          // e.g. "Oceans Mall Creditors" -> the named store's creditors
          const storeName = name.replace(/creditors/i, '').trim()
          const store = findOrCreateByName(storeName)
          const items = parseSheet(ws, 'creditor', store.id, null)
          post(items)
          summary.creditorsStores += items.length
        } else if (/debtors/i.test(name)) {
          // Per-store debtors are owed to Head Office; party = the store
          const party = name.replace(/debtors/i, '').trim() || name.trim()
          const items = parseSheet(ws, 'debtor', 0, party)
          post(items)
          summary.debtors += items.length
        }
      } catch (err) {
        summary.warnings.push(`Sheet ${name}: ${err instanceof Error ? err.message : err}`)
      }
    }
  } catch (err) {
    return { ...summary, ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  // Oceans Mall Payment Recon (Supplier | Invoice | Total | Paid | Owing)
  const recon = files.find((f) => /Oceans Mall Payment Recon\.xlsx?$/i.test(basename(f)))
  if (recon) {
    try {
      const store = findOrCreateByName('Oceans Mall')
      const rows = rowsOf(XLSX.readFile(recon).Sheets[XLSX.readFile(recon).SheetNames[0]])
      for (const row of rows.slice(1)) {
        const supplier = String(row[0] ?? '').trim()
        const total = num(row[2])
        if (!supplier || !total) continue
        addLedgerItem(
          {
            kind: 'creditor',
            entity_store_id: store.id,
            party: supplier,
            description: '',
            invoice_no: String(row[1] ?? '').trim(),
            invoice_date: '',
            total_incl: total,
            vat: 0,
            excl_vat: 0,
            paid: num(row[3])
          },
          'import'
        )
        summary.creditorsStores++
      }
    } catch (err) {
      summary.warnings.push(`Payment Recon: ${err instanceof Error ? err.message : err}`)
    }
  }

  return summary
}
