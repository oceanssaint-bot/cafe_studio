import { dialog } from 'electron'
import { readdirSync, statSync } from 'fs'
import { join, basename, extname, relative, sep } from 'path'
import { createHash } from 'crypto'
import { getDatabase } from '../db'
import type { CatalogImportSummary } from '../../shared/types'

/** Map text → canonical store name. Order matters (most specific first). */
const STORE_MAP: Array<[RegExp, string]> = [
  [/oceans/i, 'Oceans Mall'],
  [/gateway.*(south|store\s*1|gat0?1)|south.*gateway/i, 'Gateway South'],
  [/gateway.*(north|gat0?2)/i, 'Gateway North'],
  [/xpress\s*durban|point\s*water|waterfront/i, 'Point Waterfront'],
  [/pavilion/i, 'Pavilion'],
  [/florida/i, 'Florida Fields'],
  [/lakefield|benoni/i, 'Lakefield Benoni'],
  [/gateway/i, 'Gateway South'] // bare "Gateway" → South (default)
]

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
}

function storeOf(text: string): string {
  const m = STORE_MAP.find(([re]) => re.test(text))
  return m ? m[1] : ''
}

const validMonth = (m: string): boolean => { const n = +m; return n >= 1 && n <= 12 }
const validYear = (y: string): boolean => { const n = +y; return n >= 2018 && n <= 2031 }

/** Parse a YYYY-MM (or YYYY) period from a filename / path, validating real dates. */
function periodOf(text: string): string {
  let m = /\b(\d{2})\.(\d{2})\.(\d{4})\b/.exec(text) // DD.MM.YYYY
  if (m && validMonth(m[2]) && validYear(m[3])) return `${m[3]}-${m[2]}`
  m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text) // YYYY-MM-DD
  if (m && validYear(m[1]) && validMonth(m[2])) return `${m[1]}-${m[2]}`
  const mn = /(january|february|march|april|may|june|july|august|september|october|november|december)\s*'?\s*(\d{4})/i.exec(
    text
  )
  if (mn && validYear(mn[2])) return `${mn[2]}-${MONTHS[mn[1].toLowerCase()]}`
  const y = /\b(20[12]\d)\b/.exec(text)
  return y && validYear(y[1]) ? y[1] : ''
}

/** Infer a document type from its department + filename. */
function docTypeOf(department: string, name: string, ext: string): string {
  const n = name.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') return 'photo'
  switch (department) {
    case 'Debtors':
      if (/statement/.test(n)) return 'statement'
      if (/delivery/.test(n)) return 'delivery_note'
      if (/order/.test(n)) return 'order'
      if (/invoice|^inv|turnover/.test(n)) return 'store_invoice'
      return 'debtor_doc'
    case 'Royalties SA':
      return /breakdown/.test(n) ? 'royalty_breakdown' : 'royalty_invoice'
    case 'Creditors Schedule':
      return 'creditors_schedule'
    case 'Vat Submission':
      return 'vat_journal'
    case 'Store Purchases':
      return 'purchase_ledger'
    case 'Store Sales':
      return 'sales_report'
    case 'Turnover Reports':
      return 'turnover_report'
    case 'Consumption Analysis':
      return 'consumption'
    case 'Head Office Stock Take':
      return 'stock_take'
    case 'Staff Hours':
      return 'timesheet'
    case 'GJC Aus Account':
      if (/statement/.test(n)) return 'aus_statement'
      if (/ledger/.test(n)) return 'aus_ledger'
      if (/invoice|royalty/.test(n)) return 'aus_invoice'
      return 'aus_doc'
    case 'GJC SA - MONTHLY STORE SALES':
      return 'master_sales'
    case 'Oceans Mall':
      return 'store_doc'
    default:
      return 'other'
  }
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
    if (name.startsWith('~$') || name.toLowerCase() === 'thumbs.db' || name === '.DS_Store') continue
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

function fingerprint(filename: string, size: number, mtime: string): string {
  // Metadata fingerprint only (name+size+mtime) — never reads file content.
  // Critical for speed on cloud-synced folders (OneDrive Files-On-Demand),
  // where reading content would force every placeholder to download.
  return createHash('sha256').update(`${filename}|${size}|${mtime}`).digest('hex')
}

/**
 * Catalogs every file beneath `root` into file_catalog: classified by
 * department/store/period/type and content-hashed. Idempotent (upsert by path).
 */
export function catalogArchive(root: string): CatalogImportSummary {
  const t0 = Date.now()
  const db = getDatabase()
  const files = walk(root)
  let added = 0
  let updated = 0
  let bytes = 0

  const upsert = db.prepare(
    `INSERT INTO file_catalog
       (path, rel_path, filename, department, store, period, doc_type, ext, size, sha256, modified, created_at)
     VALUES (@path, @rel_path, @filename, @department, @store, @period, @doc_type, @ext, @size, @sha256, @modified, @created_at)
     ON CONFLICT(path) DO UPDATE SET
       rel_path = excluded.rel_path, filename = excluded.filename, department = excluded.department,
       store = excluded.store, period = excluded.period, doc_type = excluded.doc_type, ext = excluded.ext,
       size = excluded.size, sha256 = excluded.sha256, modified = excluded.modified`
  )
  // Pre-load existing rows so we can skip unchanged files (incremental re-runs).
  const existing = new Map<string, { size: number; modified: string }>()
  for (const row of db
    .prepare(`SELECT path, size, modified FROM file_catalog`)
    .all() as Array<{ path: string; size: number; modified: string }>) {
    existing.set(row.path, { size: row.size, modified: row.modified })
  }
  const now = new Date().toISOString()
  let unchanged = 0

  const run = db.transaction(() => {
    for (const full of files) {
      let st
      try {
        st = statSync(full)
      } catch {
        continue
      }
      const modified = new Date(st.mtimeMs).toISOString()
      bytes += st.size
      const prior = existing.get(full)
      if (prior && prior.size === st.size && prior.modified === modified) {
        unchanged++
        continue // unchanged — skip re-hash/re-classify
      }
      const rel = relative(root, full)
      const filename = basename(full)
      // First path segment is the department; loose files at the root → 'General'.
      const seg = rel.split(sep)
      const department = seg.length > 1 ? seg[0] : 'General'
      const ext = extname(full).slice(1).toLowerCase()
      const text = `${rel} ${filename}`
      upsert.run({
        path: full,
        rel_path: rel,
        filename,
        department,
        store: storeOf(text),
        period: periodOf(text),
        doc_type: docTypeOf(department, filename, ext),
        ext,
        size: st.size,
        sha256: fingerprint(filename, st.size, modified),
        modified,
        created_at: now
      })
      if (prior) updated++
      else added++
    }
  })
  run()
  void unchanged

  return {
    ok: true,
    root,
    scanned: files.length,
    added,
    updated,
    bytes,
    durationMs: Date.now() - t0
  }
}

export async function catalogArchiveDialog(): Promise<CatalogImportSummary> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose your admin archive folder to catalog (every file is registered & made searchable)',
    properties: ['openDirectory']
  })
  if (canceled || filePaths.length === 0) {
    return { ok: false, cancelled: true, root: '', scanned: 0, added: 0, updated: 0, bytes: 0, durationMs: 0 }
  }
  return catalogArchive(filePaths[0])
}
