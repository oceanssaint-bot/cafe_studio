import { dialog } from 'electron'
import { readdirSync, statSync } from 'fs'
import { readFile } from 'fs/promises'
import { join, basename, extname } from 'path'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'
import { findOrCreateByName, listStores } from '../repositories/stores'
import { upsertTurnoverDaily, clearImportedMonth } from '../repositories/turnover'
import { readApiKey } from './apikey'
import type { TurnoverDailyInput, TurnoverImportSummary } from '../../shared/types'

const MODEL = 'claude-opus-4-8'

/** Map a POS node / file name to one of our stores. Order matters (most specific first). */
const STORE_MAP: Array<[RegExp, string]> = [
  [/oceans/i, 'Oceans Mall'],
  [/gateway.*(south|store\s*1)|south.*gateway/i, 'Gateway South'],
  [/gateway.*north/i, 'Gateway North'],
  [/xpress\s*durban|point\s*water|waterfront/i, 'Point Waterfront'],
  [/pavilion/i, 'Pavilion'],
  [/florida/i, 'Florida Fields'],
  [/lakefield|benoni/i, 'Lakefield Benoni']
]

function storesInText(text: string): string[] {
  const hits = new Set<string>()
  for (const [re, name] of STORE_MAP) if (re.test(text)) hits.add(name)
  return [...hits]
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

function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ''))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/** Excel serial date → YYYY-MM-DD (Excel epoch 1899-12-30). */
function serialToISO(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 30000 || serial > 80000) return null
  const ms = Math.round((serial - 25569) * 86400 * 1000)
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function rowsOf(ws: XLSX.WorkSheet): unknown[][] {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', blankrows: false }) as unknown[][]
}

type DailyRow = TurnoverDailyInput & { period: string }

/**
 * GAAP "TurnoverReport" — one sheet, one or more "Node:" sections. Handles both
 * variants: with a "Total Sales" column, or without (total = cash+card+acc+cheque).
 * Store comes from a named "Node:" row, falling back to the file's store.
 */
function parseGAAP(rows: unknown[][], fallbackStoreId: number): DailyRow[] {
  const hdr = rows.findIndex((r) => {
    const has = (re: RegExp): boolean => r.some((c) => re.test(String(c).trim()))
    return has(/^total sales$/i) || (has(/^cash$/i) && has(/credit card/i))
  })
  if (hdr < 0) return []
  const H = rows[hdr].map((c) => String(c).trim().toLowerCase())
  const idx = (re: RegExp): number => H.findIndex((c) => re.test(c))
  const col = {
    ts: idx(/^total sales$/),
    cash: idx(/^cash$/),
    cc: idx(/credit card/),
    acc: idx(/account/),
    chq: idx(/cheque/),
    non: idx(/non turnover/),
    tips: idx(/^tips$/)
  }
  const out: DailyRow[] = []
  let storeId = fallbackStoreId
  for (let i = hdr + 1; i < rows.length; i++) {
    const a = String(rows[i][0] ?? '')
    if (/node:/i.test(a)) {
      const names = storesInText(a)
      if (names.length === 1) storeId = findOrCreateByName(names[0]).id
      continue
    }
    if (storeId < 0) continue
    const iso = typeof rows[i][0] === 'number' ? serialToISO(rows[i][0] as number) : null
    if (!iso) continue
    const cash = num(rows[i][col.cash])
    const cc = num(rows[i][col.cc])
    const acc = col.acc >= 0 ? num(rows[i][col.acc]) : 0
    const chq = col.chq >= 0 ? num(rows[i][col.chq]) : 0
    out.push({
      store_id: storeId,
      date: iso,
      period: iso.slice(0, 7),
      cash,
      credit_card: cc,
      accounts: acc,
      cheque: chq,
      non_turnover: col.non >= 0 ? num(rows[i][col.non]) : 0,
      tips: col.tips >= 0 ? num(rows[i][col.tips]) : 0,
      total_sales: col.ts >= 0 ? num(rows[i][col.ts]) : Math.round((cash + cc + acc + chq) * 100) / 100
    })
  }
  return out
}

/** "Turnover_Per_Day" export — daily rows for a single store (from the filename). */
function parsePerDay(rows: unknown[][], storeId: number): DailyRow[] {
  const hdr = rows.findIndex((r) =>
    r.some((c) => /turnover inclusive|total sales/i.test(String(c)))
  )
  if (hdr < 0) return []
  const H = rows[hdr].map((c) => String(c).trim().toLowerCase())
  // Prefer the explicit "turnover inclusive" column; fall back to total sales.
  let tsCol = H.findIndex((c) => /turnover inclusive/.test(c))
  if (tsCol < 0) tsCol = H.findIndex((c) => /total sales/.test(c))
  const dateCol = H.findIndex((c) => /report date|^date/.test(c))
  const out: DailyRow[] = []
  for (let i = hdr + 1; i < rows.length; i++) {
    const cell = rows[i][dateCol >= 0 ? dateCol : 0]
    const iso = typeof cell === 'number' ? serialToISO(cell) : null
    if (!iso) continue
    const total = num(rows[i][tsCol])
    if (!total) continue
    out.push({ store_id: storeId, date: iso, period: iso.slice(0, 7), total_sales: total })
  }
  return out
}

/** Read a turnover spreadsheet/csv into daily rows, choosing the format. */
function parseSpreadsheet(file: string): { rows: DailyRow[]; combined: boolean } {
  const wb = XLSX.readFile(file)
  const rows = rowsOf(wb.Sheets[wb.SheetNames[0]])
  // Single-store files name the store in the filename; this also seeds the GAAP
  // fallback for reports whose "Node:" row is generic (e.g. just "GLORIA JEANS").
  const names = storesInText(basename(file))
  const fileStoreId = names.length === 1 ? findOrCreateByName(names[0]).id : -1
  const gaap = parseGAAP(rows, fileStoreId)
  if (gaap.length) return { rows: gaap, combined: false }
  if (fileStoreId < 0) return { rows: [], combined: names.length > 1 }
  return { rows: parsePerDay(rows, fileStoreId), combined: false }
}

/** Ask Claude for the monthly turnover total from a PDF turnover report. */
async function extractPdfTurnover(
  file: string,
  apiKey: string
): Promise<{ store: string; total: number; period: string } | null> {
  // Fail fast: a hanging PDF call must not stall the whole batch (the SDK
  // default is a 10-minute timeout with retries).
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 90 * 1000 })
  const data = (await readFile(file)).toString('base64')
  const storeNames = listStores().map((s) => s.name).join(', ')
  const tool: Anthropic.Tool = {
    name: 'record_turnover',
    description: 'Record the monthly turnover total from a store turnover report.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        store_name: { type: 'string', description: `Which store this report is for, from: ${storeNames}` },
        month: { type: 'string', description: 'The month the report covers, as YYYY-MM' },
        total_turnover: {
          type: 'number',
          description: 'The total sales / turnover for the whole month (VAT inclusive), as a plain number'
        }
      },
      required: ['store_name', 'month', 'total_turnover']
    }
  }
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'record_turnover' },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
          {
            type: 'text',
            text:
              `This is a monthly turnover/sales report for one of our coffee stores in South Africa. ` +
              `Add up the daily sales and report the total monthly turnover (VAT inclusive, excluding tips). ` +
              `Identify which store it is from the filename "${basename(file)}" and the content.`
          }
        ]
      }
    ]
  })
  const tu = message.content.find((b) => b.type === 'tool_use')
  if (!tu || tu.type !== 'tool_use') return null
  const inp = tu.input as Record<string, unknown>
  const names = storesInText(`${inp.store_name ?? ''} ${basename(file)}`)
  const store = names[0]
  const total = num(inp.total_turnover)
  const period = /^\d{4}-\d{2}$/.test(String(inp.month)) ? String(inp.month) : ''
  if (!store || !total || !period) return null
  return { store, total, period }
}

function isTurnoverFile(name: string): boolean {
  return /turnover|sales/i.test(name) && storesInText(name).length > 0
}

export async function importTurnover(rootDir: string): Promise<TurnoverImportSummary> {
  const summary: TurnoverImportSummary = {
    ok: true,
    filesParsed: 0,
    filesAi: 0,
    filesFailed: 0,
    storeMonths: 0,
    totalTurnover: 0,
    storesCreated: [],
    warnings: []
  }
  const before = new Set(listStores(true).map((s) => s.name.toLowerCase()))
  const apiKey = readApiKey()
  // Spreadsheets first (fast, deterministic); PDFs last (slow AI calls) so the
  // deterministic data always lands even if an AI read is slow or fails.
  const files = walk(rootDir)
    .filter((f) => isTurnoverFile(basename(f)))
    .sort((a, b) => {
      const ap = extname(a).toLowerCase() === '.pdf' ? 1 : 0
      const bp = extname(b).toLowerCase() === '.pdf' ? 1 : 0
      return ap - bp
    })
  const cleared = new Set<string>() // `${storeId}:${period}` cleared this run

  const write = (r: DailyRow): void => {
    const key = `${r.store_id}:${r.period}`
    if (!cleared.has(key)) {
      clearImportedMonth(r.store_id, r.period)
      cleared.add(key)
    }
    upsertTurnoverDaily(r, 'import')
  }

  for (const file of files) {
    const ext = extname(file).toLowerCase()
    try {
      if (ext === '.xlsx' || ext === '.xls' || ext === '.xlsm' || ext === '.csv') {
        const { rows, combined } = parseSpreadsheet(file)
        if (!rows.length) {
          if (combined)
            summary.warnings.push(
              `${basename(file)}: multiple stores combined in one file — needs manual split.`
            )
          else summary.filesFailed++
          continue
        }
        const months = new Set<string>()
        for (const r of rows) {
          write(r)
          months.add(`${r.store_id}:${r.period}`)
          summary.totalTurnover += r.total_sales
        }
        summary.storeMonths += months.size
        summary.filesParsed++
      } else if (ext === '.pdf') {
        if (!apiKey) {
          summary.needsApiKey = true
          summary.warnings.push(`${basename(file)}: PDF needs the AI key to read (skipped).`)
          continue
        }
        const res = await extractPdfTurnover(file, apiKey)
        if (!res) {
          summary.filesFailed++
          summary.warnings.push(`${basename(file)}: could not read turnover from PDF.`)
          continue
        }
        const store = findOrCreateByName(res.store)
        const key = `${store.id}:${res.period}`
        if (!cleared.has(key)) {
          clearImportedMonth(store.id, res.period)
          cleared.add(key)
        }
        // PDFs give a month total only — store it as a single dated row.
        upsertTurnoverDaily(
          { store_id: store.id, date: `${res.period}-01`, total_sales: res.total },
          'ai'
        )
        summary.totalTurnover += res.total
        summary.storeMonths += 1
        summary.filesAi++
      }
    } catch (err) {
      summary.filesFailed++
      summary.warnings.push(`${basename(file)}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  summary.storesCreated = listStores(true)
    .filter((s) => !before.has(s.name.toLowerCase()))
    .map((s) => s.name)
  summary.totalTurnover = Math.round(summary.totalTurnover * 100) / 100
  return summary
}

export async function importTurnoverDialog(): Promise<TurnoverImportSummary> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose your Turnover Reports folder to import',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0) {
    return {
      ok: false,
      cancelled: true,
      filesParsed: 0,
      filesAi: 0,
      filesFailed: 0,
      storeMonths: 0,
      totalTurnover: 0,
      storesCreated: [],
      warnings: []
    }
  }
  return importTurnover(filePaths[0])
}
