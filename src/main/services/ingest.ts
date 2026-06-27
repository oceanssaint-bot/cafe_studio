import { app, dialog, shell } from 'electron'
import { copyFile, mkdir } from 'fs/promises'
import { join, basename } from 'path'
import {
  createDocument,
  applyExtraction,
  setError,
  getDocument
} from '../repositories/documents'
import {
  mimeFor,
  kindForFile,
  isSpreadsheet,
  extractWithClaude,
  spreadsheetFields,
  matchStore,
  periodFromDate,
  previewSpreadsheet
} from './extract'
import { currentPeriod } from '../../shared/defaults'
import type { AppDocument, SheetPreview } from '../../shared/types'

function docsDir(): string {
  return join(app.getPath('userData'), 'documents')
}

/** Runs extraction for a single document row and persists the result. */
async function runExtraction(doc: AppDocument): Promise<AppDocument> {
  try {
    if (isSpreadsheet(doc.stored_path)) {
      const fields = spreadsheetFields(doc.stored_path)
      return applyExtraction(doc.id, fields, null, currentPeriod())
    }
    const fields = await extractWithClaude(doc.stored_path, doc.mime)
    const storeId = matchStore(fields.store_name)
    const period = periodFromDate(fields.doc_date)
    return applyExtraction(doc.id, fields, storeId, period)
  } catch (err) {
    return setError(doc.id, err instanceof Error ? err.message : String(err))
  }
}

/**
 * Opens a file picker, copies each chosen file into the app's documents folder,
 * creates a row, and runs extraction. Returns the resulting document rows.
 */
export async function uploadDocuments(): Promise<AppDocument[]> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Upload receipts, invoices or spreadsheets',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Documents', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'xlsx', 'xls', 'csv'] },
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      { name: 'PDF', extensions: ['pdf'] },
      { name: 'Spreadsheets', extensions: ['xlsx', 'xls', 'csv'] }
    ]
  })
  if (canceled || filePaths.length === 0) return []

  await mkdir(docsDir(), { recursive: true })
  const results: AppDocument[] = []

  for (const src of filePaths) {
    const stored = join(docsDir(), `${Date.now()}-${basename(src)}`)
    await copyFile(src, stored)
    const doc = createDocument({
      filename: basename(src),
      stored_path: stored,
      mime: mimeFor(src),
      kind: kindForFile(src)
    })
    results.push(await runExtraction(doc))
  }
  return results
}

/** Re-runs extraction for an existing document (e.g. after adding a key). */
export async function reextractDocument(id: number): Promise<AppDocument> {
  return runExtraction(getDocument(id))
}

export function previewDocument(id: number): SheetPreview | null {
  const doc = getDocument(id)
  return isSpreadsheet(doc.stored_path) ? previewSpreadsheet(doc.stored_path) : null
}

export function openDocumentFile(id: number): void {
  shell.openPath(getDocument(id).stored_path)
}
