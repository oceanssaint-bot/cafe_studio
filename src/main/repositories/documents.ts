import { getDatabase } from '../db'
import { currentPeriod } from '../../shared/defaults'
import type { AppDocument, ApplyDocumentInput, DocDestination, ExtractedFields } from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}

/**
 * Manual capture: a document with no file/AI, ready for the user to key figures
 * in by hand. Flagged source_missing so it's auditable as a hand entry.
 */
export function createManualDocument(input: { kind: AppDocument['kind']; destination: DocDestination }): AppDocument {
  const info = getDatabase()
    .prepare(
      `INSERT INTO documents (filename, stored_path, mime, kind, destination, source_missing, period, summary, status, created_at)
       VALUES ('Manual entry', '', '', ?, ?, 1, ?, 'Hand-keyed — no original slip', 'extracted', ?)`
    )
    .run(input.kind, input.destination, currentPeriod(), now())
  return getDocument(Number(info.lastInsertRowid))
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

/** Best-guess where AI-read figures belong, so the review pre-selects it. */
function deriveDestination(fields: ExtractedFields): DocDestination {
  if (fields.cash_role === 'till_slip' || fields.cash_role === 'payout_voucher') return 'cashup'
  if (fields.kind === 'invoice') return 'purchases'
  if (fields.kind === 'receipt') return 'cashup'
  if (fields.turnover && !fields.purchases) return 'month'
  return fields.purchases ? 'cashup' : 'month'
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
         summary = ?, destination = ?, status = 'extracted', error = ''
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
      deriveDestination(fields),
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
  const flag = input.source_missing ? ' ⚠ no original slip (hand-keyed)' : ''
  const summary = input.summary + (flag && !input.summary.includes('hand-keyed') ? flag : '')
  const txnDate = input.doc_date || `${input.period}-01`
  const desc = (input.description || input.supplier || 'Purchase') + flag
  const run = db.transaction(() => {
    // 1. Persist the reviewed values back onto the document.
    db.prepare(
      `UPDATE documents SET
         store_id = ?, period = ?, sales = ?, purchases = ?, turnover = ?,
         vat = ?, supplier = ?, doc_date = ?, summary = ?, task_id = ?,
         destination = ?, source_missing = ?, status = 'applied', applied_at = ?
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
      summary,
      input.task_id,
      input.destination,
      input.source_missing ? 1 : 0,
      now(),
      input.id
    )

    // 2. Route the figures to the chosen destination.
    if (input.store_id && input.period) {
      if (input.destination === 'cashup' && input.purchases) {
        db.prepare(
          `INSERT INTO cash_payouts (store_id, period, txn_date, supplier, description, excl_vat, vat, incl_vat, kind, source_doc_id, created_at)
           VALUES (?,?,?,?,?,?,?,?, 'purchase', ?, ?)`
        ).run(input.store_id, input.period, txnDate, input.supplier, desc, input.excl_vat || input.purchases - input.vat, input.vat, input.purchases, input.id, now())
      } else if (input.destination === 'purchases' && input.purchases) {
        db.prepare(
          `INSERT INTO store_purchase_lines (store_id, period, txn_date, invoice_no, supplier, description, excl_vat, vat, incl_vat, source, created_at)
           VALUES (?,?,?,?,?,?,?,?,?, 'document', ?)`
        ).run(input.store_id, input.period, txnDate, '', input.supplier, desc, input.excl_vat || input.purchases - input.vat, input.vat, input.purchases, now())
      } else if (input.sales || input.purchases || input.turnover) {
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
    }

    // 3. Append a summary note to the chosen month-end task.
    if (input.task_id && summary) {
      const task = db.prepare(`SELECT notes FROM tasks WHERE id = ?`).get(input.task_id) as
        | { notes: string }
        | undefined
      if (task) {
        const line = `[${input.supplier || 'Document'}] ${summary}`
        const notes = task.notes ? `${task.notes}\n${line}` : line
        db.prepare(`UPDATE tasks SET notes = ? WHERE id = ?`).run(notes, input.task_id)
      }
    }

    // 4. Record it: drop the document into the file catalog so it shows in Records.
    const doc = db.prepare(`SELECT filename, stored_path, kind FROM documents WHERE id = ?`).get(input.id) as
      | { filename: string; stored_path: string; kind: string }
      | undefined
    if (doc) {
      const storeName = input.store_id
        ? ((db.prepare(`SELECT name FROM stores WHERE id = ?`).get(input.store_id) as { name: string } | undefined)?.name ?? '')
        : ''
      const catPath = doc.stored_path && doc.stored_path.length ? doc.stored_path : `document://${input.id}`
      db.prepare(
        `INSERT INTO file_catalog (path, rel_path, filename, department, store, period, doc_type, ext, size, sha256, modified, ingested, module, notes, created_at)
         VALUES (?, ?, ?, 'Documents', ?, ?, ?, '', 0, '', ?, 1, 'document', ?, ?)
         ON CONFLICT(path) DO UPDATE SET store = excluded.store, period = excluded.period,
           doc_type = excluded.doc_type, notes = excluded.notes, ingested = 1`
      ).run(catPath, doc.filename, input.supplier || doc.filename, storeName, input.period, doc.kind, txnDate, summary, now())
    }
  })
  run()
  return getDocument(input.id)
}
