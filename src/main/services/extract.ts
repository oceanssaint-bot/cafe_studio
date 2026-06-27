import { readFile } from 'fs/promises'
import { extname, basename } from 'path'
import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'
import { readApiKey } from './apikey'
import { listStores } from '../repositories/stores'
import { currentPeriod } from '../../shared/defaults'
import type { DocumentKind, ExtractedFields, SheetPreview } from '../../shared/types'

const MODEL = 'claude-opus-4-8'

const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

const SHEET_EXT = new Set(['.xlsx', '.xls', '.xlsm', '.csv'])

export function mimeFor(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  if (IMAGE_MIME[ext]) return IMAGE_MIME[ext]
  if (ext === '.pdf') return 'application/pdf'
  if (SHEET_EXT.has(ext)) return 'application/vnd.ms-excel'
  return 'application/octet-stream'
}

export function kindForFile(filePath: string): DocumentKind {
  const ext = extname(filePath).toLowerCase()
  if (SHEET_EXT.has(ext)) return 'spreadsheet'
  return 'other'
}

export function isSpreadsheet(filePath: string): boolean {
  return SHEET_EXT.has(extname(filePath).toLowerCase())
}

// JSON schema the model must fill — forced via tool_choice so the response is
// always a single structured object.
const RECORD_TOOL: Anthropic.Tool = {
  name: 'record_document',
  description: 'Record the financial details extracted from the document.',
  // @ts-ignore - strict is a supported top-level field
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      kind: { type: 'string', enum: ['receipt', 'invoice', 'other'] },
      cash_role: {
        type: 'string',
        enum: ['till_slip', 'payout_voucher', 'none'],
        description:
          'till_slip = a printed shop receipt (Checkers/Woolworths/etc); payout_voucher = a handwritten cash payout slip listing amounts and tips; none = anything else'
      },
      supplier: { type: 'string', description: 'Supplier / vendor / store name on the document (e.g. Checkers, Woolworths, Pick n Pay)' },
      doc_date: { type: 'string', description: 'Document date as YYYY-MM-DD, or empty string' },
      store_name: {
        type: 'string',
        description: 'Which of our stores this relates to (exact name from the provided list), or empty'
      },
      description: {
        type: 'string',
        description: 'For a till slip: the main item/category bought, one or two words (e.g. Milk, Bread, Ice, Chicken). Else empty.'
      },
      sales: { type: 'number', description: 'Sales amount if this is a sales document, else 0' },
      purchases: { type: 'number', description: 'Total amount of a purchase / till slip (VAT inclusive), else 0' },
      excl_vat: { type: 'number', description: 'Amount excluding VAT (nett), else 0' },
      turnover: { type: 'number', description: 'Turnover figure if explicitly stated, else 0' },
      vat: { type: 'number', description: 'VAT/tax amount, else 0' },
      declared_tips: {
        type: 'number',
        description: 'If this is a handwritten cash payout voucher, the tips amount written on it, else 0'
      },
      currency: { type: 'string', description: 'ISO currency code, default ZAR' },
      summary: { type: 'string', description: 'One short sentence summarising the document' }
    },
    required: [
      'kind',
      'cash_role',
      'supplier',
      'doc_date',
      'store_name',
      'description',
      'sales',
      'purchases',
      'excl_vat',
      'turnover',
      'vat',
      'declared_tips',
      'currency',
      'summary'
    ]
  }
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''))
  return Number.isFinite(n) ? n : 0
}

function coerce(input: Record<string, unknown>): ExtractedFields {
  const kind = input.kind === 'receipt' || input.kind === 'invoice' ? input.kind : 'other'
  const role =
    input.cash_role === 'till_slip' || input.cash_role === 'payout_voucher'
      ? input.cash_role
      : 'none'
  return {
    kind,
    cash_role: role,
    supplier: String(input.supplier ?? '').trim(),
    doc_date: String(input.doc_date ?? '').trim(),
    store_name: String(input.store_name ?? '').trim(),
    sales: num(input.sales),
    purchases: num(input.purchases),
    turnover: num(input.turnover),
    vat: num(input.vat),
    currency: String(input.currency ?? 'ZAR').trim() || 'ZAR',
    summary: String(input.summary ?? '').trim(),
    description: String(input.description ?? '').trim(),
    excl_vat: num(input.excl_vat),
    declared_tips: num(input.declared_tips)
  }
}

/** Resolve the model's free-text store name to one of our store IDs. */
export function matchStore(name: string): number | null {
  const n = name.trim().toLowerCase()
  if (!n) return null
  const stores = listStores()
  const exact = stores.find((s) => s.name.toLowerCase() === n)
  if (exact) return exact.id
  const partial = stores.find(
    (s) => n.includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(n)
  )
  return partial ? partial.id : null
}

export function periodFromDate(doc_date: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(doc_date)
  return m ? `${m[1]}-${m[2]}` : currentPeriod()
}

/** Extracts fields from an image or PDF using Claude vision. */
export async function extractWithClaude(filePath: string, mime: string): Promise<ExtractedFields> {
  const apiKey = readApiKey()
  if (!apiKey) {
    throw new Error('No Anthropic API key set. Add one in Settings to read receipts and invoices.')
  }
  const client = new Anthropic({ apiKey })
  const data = (await readFile(filePath)).toString('base64')
  const storeNames = listStores()
    .map((s) => s.name)
    .join(', ')

  const fileBlock =
    mime === 'application/pdf'
      ? ({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data }
        } as Anthropic.DocumentBlockParam)
      : ({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mime as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
            data
          }
        } as Anthropic.ImageBlockParam)

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    tools: [RECORD_TOOL],
    tool_choice: { type: 'tool', name: 'record_document' },
    messages: [
      {
        role: 'user',
        content: [
          fileBlock,
          {
            type: 'text',
            text:
              `Extract the financial details from this document for a coffee retail business in South Africa. ` +
              `Our stores are: ${storeNames}. ` +
              `If the document clearly relates to one of them, set store_name to that exact name; otherwise leave it empty. ` +
              `Use ZAR currency and report amounts as plain numbers (no symbols).`
          }
        ]
      }
    ]
  })

  const toolUse = message.content.find((b) => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('The model did not return structured data. Try a clearer image.')
  }
  return coerce(toolUse.input as Record<string, unknown>)
}

/** Reads the first sheet of a spreadsheet locally (no AI) for preview. */
export function previewSpreadsheet(filePath: string): SheetPreview {
  const wb = XLSX.readFile(filePath)
  const sheet = wb.SheetNames[0] ?? ''
  const ws = sheet ? wb.Sheets[sheet] : undefined
  const rows = ws
    ? (XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false }) as unknown[][])
    : []
  const preview = rows
    .slice(0, 12)
    .map((r) => r.slice(0, 8).map((c) => (c == null ? '' : String(c))))
  return { sheet, rows: preview }
}

/** Local fields for a spreadsheet — figures left for the user to fill in. */
export function spreadsheetFields(filePath: string): ExtractedFields {
  let summary = `Spreadsheet ${basename(filePath)}`
  try {
    const wb = XLSX.readFile(filePath)
    summary = `Spreadsheet with sheets: ${wb.SheetNames.join(', ')}`
  } catch {
    /* keep default summary */
  }
  return {
    kind: 'spreadsheet',
    supplier: '',
    doc_date: '',
    store_name: '',
    sales: 0,
    purchases: 0,
    turnover: 0,
    vat: 0,
    currency: 'ZAR',
    summary
  }
}
