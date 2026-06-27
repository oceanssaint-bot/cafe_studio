import { dialog } from 'electron'
import { readdirSync, statSync } from 'fs'
import { join, basename } from 'path'
import * as XLSX from 'xlsx'
import {
  listStores,
  findOrCreateByName,
  importMonthlyFigures
} from '../repositories/stores'
import { upsertStockTake } from '../repositories/stock'
import type { ImportSummary } from '../../shared/types'

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
}

/** Recursively collect files under a directory (skipping Excel temp files). */
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

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

type Section = 'turnover' | 'transactions' | 'royalty_au' | 'royalty_invoiced' | 'skip'

/** Parse one "GJC SA - MONTHLY STORE SALES <year>.xlsx" master workbook. */
function importMasterWorkbook(
  file: string,
  year: string,
  summary: ImportSummary
): void {
  const wb = XLSX.readFile(file)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]

  let section: Section = 'skip'
  let royaltyInvoicedSeen = 0

  for (const row of rows) {
    const label = String(row[0] ?? '').trim()
    const upper = label.toUpperCase()

    // Section headers (column A keywords).
    if (upper.includes('TURNOVER')) {
      section = 'turnover'
      continue
    }
    if (upper.includes('AVERAGE')) {
      section = 'skip'
      continue
    }
    if (upper.includes('TRANSACTION')) {
      section = 'transactions'
      continue
    }
    if (upper.includes('ROYALTIES DUE TO AUS')) {
      section = 'royalty_au'
      continue
    }
    if (upper.includes('ROYALTIES INVOICED')) {
      royaltyInvoicedSeen++
      section = royaltyInvoicedSeen === 1 ? 'royalty_invoiced' : 'skip'
      continue
    }
    if (!label || section === 'skip') continue
    // Skip obvious non-store helper rows in the royalty breakdown etc.
    if (/^royalt|^marketing|^total/i.test(label)) continue

    const store = findOrCreateByName(label)
    for (let m = 0; m < 12; m++) {
      const value = num(row[m + 1])
      if (value === null || value === 0) continue
      const period = `${year}-${String(m + 1).padStart(2, '0')}`
      if (section === 'turnover') {
        importMonthlyFigures(store.id, period, { turnover: value, sales: value })
        summary.turnoverTotal += value
        summary.monthsImported++
      } else if (section === 'transactions') {
        importMonthlyFigures(store.id, period, { transactions: Math.round(value) })
      } else if (section === 'royalty_au') {
        importMonthlyFigures(store.id, period, { royalty_au: value })
      } else if (section === 'royalty_invoiced') {
        importMonthlyFigures(store.id, period, { royalty: value })
      }
    }
  }
}

const STORE_KEYWORDS: Array<[RegExp, string]> = [
  [/oceans/i, 'Oceans Mall'],
  [/pavilion/i, 'Pavilion'],
  [/florida/i, 'Florida Fields'],
  [/point\s*water/i, 'Point Waterfront'],
  [/gateway/i, 'Gateway South'],
  [/lakefield|benoni/i, 'Lakefield Benoni']
]

/** Parse a "GJC SA Store Consumption Analysis <Month> <Year>.xlsx" → per-store consumption value. */
function importConsumption(file: string, period: string): void {
  const wb = XLSX.readFile(file)
  const perStore = new Map<string, number>()
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: ''
    }) as unknown[][]
    // Find header row containing "retail price" — scan the WHOLE sheet, since
    // these sheets have several blank leading rows before the header.
    let headerIdx = -1
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].some((c) => /retail price/i.test(String(c)))) {
        headerIdx = i
        break
      }
    }
    if (headerIdx < 0) continue
    const header = rows[headerIdx].map((c) => String(c))
    const priceCol = header.findIndex((c) => /retail price/i.test(c))
    const storeCols: Array<{ idx: number; name: string }> = []
    header.forEach((c, idx) => {
      const m = STORE_KEYWORDS.find(([re]) => re.test(c))
      if (m && idx > priceCol) storeCols.push({ idx, name: m[1] })
    })
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const price = num(rows[i][priceCol])
      if (price === null || price === 0) continue
      for (const sc of storeCols) {
        const qty = num(rows[i][sc.idx])
        if (qty && qty > 0) perStore.set(sc.name, (perStore.get(sc.name) ?? 0) + price * qty)
      }
    }
  }
  for (const [storeName, value] of perStore) {
    const store = findOrCreateByName(storeName)
    importMonthlyFigures(store.id, period, { consumption: Math.round(value * 100) / 100 })
  }
}

/** Parse a VAT "Sales & Purchases Journal- <Month> <Year>.xlsx" → store purchases. */
function importVatJournal(
  file: string,
  month: string,
  year: string,
  summary: ImportSummary
): void {
  const wb = XLSX.readFile(file)
  const salesSheet = wb.SheetNames.find((n) => /^sales/i.test(n))
  if (!salesSheet) return
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[salesSheet], { header: 1, defval: '' }) as unknown[][]

  // Locate header row and the Name / Inclusive columns.
  let nameCol = 2
  let incCol = 6
  for (const row of rows.slice(0, 5)) {
    const cells = row.map((c) => String(c).toLowerCase())
    const ni = cells.findIndex((c) => c.includes('name'))
    const ii = cells.findIndex((c) => c.includes('inclusive'))
    if (ni >= 0 && ii >= 0) {
      nameCol = ni
      incCol = ii
      break
    }
  }

  const perStore = new Map<string, number>()
  for (const row of rows) {
    const name = String(row[nameCol] ?? '')
    const amount = num(row[incCol])
    if (!name || amount === null || amount === 0) continue
    if (/^name of company|total/i.test(name.trim())) continue
    const match = STORE_KEYWORDS.find(([re]) => re.test(name))
    if (!match) continue
    perStore.set(match[1], (perStore.get(match[1]) ?? 0) + amount)
  }

  const period = `${year}-${month}`
  for (const [storeName, total] of perStore) {
    const store = findOrCreateByName(storeName)
    importMonthlyFigures(store.id, period, { purchases: Math.round(total * 100) / 100 })
    summary.purchasesTotal += total
  }
}

/**
 * Imports an entire archive folder: every yearly master sales workbook plus
 * every monthly VAT journal found anywhere beneath the chosen folder.
 */
export function importArchive(rootDir: string): ImportSummary {
  const summary: ImportSummary = {
    ok: true,
    filesScanned: 0,
    storesCreated: [],
    monthsImported: 0,
    turnoverTotal: 0,
    purchasesTotal: 0,
    years: [],
    warnings: []
  }
  const before = new Set(listStores(true).map((s) => s.name.toLowerCase()))
  const yearSet = new Set<string>()

  const files = walk(rootDir)
  for (const file of files) {
    const name = basename(file)
    if (!/\.xlsx?$/i.test(name)) continue

    const master = /MONTHLY STORE SALES\s+(\d{4})\.xlsx?$/i.exec(name)
    if (master) {
      summary.filesScanned++
      yearSet.add(master[1])
      try {
        importMasterWorkbook(file, master[1], summary)
      } catch (err) {
        summary.warnings.push(`Master ${name}: ${err instanceof Error ? err.message : err}`)
      }
      continue
    }

    const stock = /Stock Sheet\s*-\s*(\d{2})\.(\d{2})\.(\d{4})\.xlsx?$/i.exec(name)
    if (stock) {
      summary.filesScanned++
      try {
        const wb = XLSX.readFile(file)
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
        const header = rows.findIndex((r) => r.some((c) => /rand value/i.test(String(c))))
        if (header >= 0) {
          const valCol = rows[header].findIndex((c) => /rand value/i.test(String(c)))
          let total = 0
          let count = 0
          for (let i = header + 1; i < rows.length; i++) {
            if (rows[i].some((c) => /^\s*total/i.test(String(c)))) continue
            const v = num(rows[i][valCol])
            if (v && v > 0) {
              total += v
              count++
            }
          }
          upsertStockTake(
            { entity_store_id: 0, take_date: `${stock[3]}-${stock[2]}-${stock[1]}`, total_value: total, item_count: count },
            'import'
          )
          summary.stockTakes = (summary.stockTakes ?? 0) + 1
        }
      } catch (err) {
        summary.warnings.push(`Stock ${name}: ${err instanceof Error ? err.message : err}`)
      }
      continue
    }

    const consumption = /Consumption Analysis\s+([A-Za-z]+)\s+(\d{4})\.xlsx?$/i.exec(name)
    if (consumption) {
      const mm = MONTHS[consumption[1].toLowerCase()]
      if (!mm) continue
      summary.filesScanned++
      yearSet.add(consumption[2])
      try {
        importConsumption(file, `${consumption[2]}-${mm}`)
      } catch (err) {
        summary.warnings.push(`Consumption ${name}: ${err instanceof Error ? err.message : err}`)
      }
      continue
    }

    const journal = /Journal-\s*([A-Za-z]+)\s+(\d{4})\.xlsx?$/i.exec(name)
    if (journal) {
      const mm = MONTHS[journal[1].toLowerCase()]
      if (!mm) continue
      summary.filesScanned++
      yearSet.add(journal[2])
      try {
        importVatJournal(file, mm, journal[2], summary)
      } catch (err) {
        summary.warnings.push(`Journal ${name}: ${err instanceof Error ? err.message : err}`)
      }
    }
  }

  const after = listStores(true)
  summary.storesCreated = after
    .filter((s) => !before.has(s.name.toLowerCase()))
    .map((s) => s.name)
  summary.years = [...yearSet].sort()
  return summary
}

/** Opens a folder picker and imports the chosen archive folder. */
export async function importArchiveDialog(): Promise<ImportSummary> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose your admin archive folder to import',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0) {
    return {
      ok: false,
      cancelled: true,
      filesScanned: 0,
      storesCreated: [],
      monthsImported: 0,
      turnoverTotal: 0,
      purchasesTotal: 0,
      years: [],
      warnings: []
    }
  }
  return importArchive(filePaths[0])
}
