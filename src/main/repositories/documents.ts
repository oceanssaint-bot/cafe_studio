import { getDatabase } from '../db'
import type { AppDocument, ApplyDocumentInput, ExtractedFields } from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}

export function listDocuments(): AppDocument[] {
  return getDatabase()
    .prepare(`SELECT * FROM documents ORDER BY created_at DESC, id DESC`)
    .all() as AppDocument[]
}

export function getDocument(id: number): AppDocument {
  const doc = getDatabase().prepare(`SELECT * FROM documents WHERE id = ?`).get(id) as
    | AppDocument
    | undefined
  if (!doc) throw new Error(`Document ${id} not found`)
  return doc
}

/** Creates a pending document row for a freshly-copied file. */
export function createDocument(input: {
  filename: string
  stored_path: string
  mime: string
  kind: AppDocument['kind']
}): AppDocument {
  const info = getDatabase()
    .prepare(
      `INSERT INTO documents (filename, stored_path, mime, kind, status, created_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`
    )
    .run(input.filename, input.stored_path, input.mime, input.kind, now())
  return getDocument(Number(info.lastInsertRowid))
}

/** Stores extracted fields on a document and marks it ready for review. */
export function applyExtraction(
  id: number,
  fields: ExtractedFields,
  storeId: number | null,
  period: string
): AppDocument {
  getDatabase()
    .prepare(
      `UPDATE documents SET
         kind = ?, supplier = ?, doc_date = ?, period = ?, store_id = ?,
         sales = ?, purchases = ?, turnover = ?, vat = ?, currency = ?,
         summary = ?, status = 'extracted', error = ''
       WHERE id = ?`
    )
    .run(
      fields.kind,
      fields.supplier,
      fields.doc_date,
      period,
      storeId,
      fields.sales,
      fields.purchases,
      fields.turnover,
      fields.vat,
      fields.currency || 'ZAR',
      fields.summary,
      id
    )
  return getDocument(id)
}

export function setError(id: number, message: string): AppDocument {
  getDatabase()
    .prepare(`UPDATE documents SET status = 'error', error = ? WHERE id = ?`)
    .run(message, id)
  return getDocument(id)
}

export function deleteDocument(id: number): void {
  getDatabase().prepare(`DELETE FROM documents WHERE id = ?`).run(id)
}

/**
 * Commits the user-reviewed figures: accumulates the amounts into the matching
 * store/month, optionally appends a note to a month-end task, and marks the
 * document applied. Runs in a single transaction.
 */
export function applyDocument(input: ApplyDocumentInput): AppDocument {
  const db = getDatabase()
  const run = db.transaction(() => {
    // 1. Persist the reviewed values back onto the document.
    db.prepare(
      `UPDATE documents SET
         store_id = ?, period = ?, sales = ?, purchases = ?, turnover = ?,
         vat = ?, supplier = ?, doc_date = ?, summary = ?, task_id = ?,
         status = 'applied', applied_at = ?
       WHERE id = ?`
    ).run(
      input.store_id,
      input.period,
      input.sales,
      input.purchases,
      input.turnover,
      input.vat,
      input.supplier,
      input.doc_date,
      input.summary,
      input.task_id,
      now(),
      input.id
    )

    // 2. Accumulate figures into the store's month (invoices in a month sum).
    if (input.store_id && input.period && (input.sales || input.purchases || input.turnover)) {
      db.prepare(
        `INSERT INTO monthly_store_data
           (store_id, period, sales, purchases, turnover, notes, updated_at)
         VALUES (@store_id, @period, @sales, @purchases, @turnover, '', @ts)
         ON CONFLICT(store_id, period) DO UPDATE SET
           sales = sales + excluded.sales,
           purchases = purchases + excluded.purchases,
           turnover = turnover + excluded.turnover,
           updated_at = excluded.updated_at`
      ).run({
        store_id: input.store_id,
        period: input.period,
        sales: input.sales,
        purchases: input.purchases,
        turnover: input.turnover,
        ts: now()
      })
    }

    // 3. Append a summary note to the chosen month-end task.
    if (input.task_id && input.summary) {
      const task = db.prepare(`SELECT notes FROM tasks WHERE id = ?`).get(input.task_id) as
        | { notes: string }
        | undefined
      if (task) {
        const line = `[${input.supplier || 'Document'}] ${input.summary}`
        const notes = task.notes ? `${task.notes}\n${line}` : line
        db.prepare(`UPDATE tasks SET notes = ? WHERE id = ?`).run(notes, input.task_id)
      }
    }
  })
  run()
  return getDocument(input.id)
}
