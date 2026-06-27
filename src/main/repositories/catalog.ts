import { getDatabase } from '../db'
import type { CatalogStats, CatalogQuery, FileCatalogEntry } from '../../shared/types'

export function getCatalogStats(): CatalogStats {
  const db = getDatabase()
  const total = (db.prepare(`SELECT COUNT(*) c FROM file_catalog`).get() as { c: number }).c
  const ingested = (
    db.prepare(`SELECT COUNT(*) c FROM file_catalog WHERE ingested = 1`).get() as { c: number }
  ).c
  const totalSize = (
    db.prepare(`SELECT COALESCE(SUM(size),0) s FROM file_catalog`).get() as { s: number }
  ).s
  const byDepartment = db
    .prepare(
      `SELECT department, COUNT(*) AS files, SUM(ingested) AS ingested, COALESCE(SUM(size),0) AS size
       FROM file_catalog GROUP BY department ORDER BY files DESC`
    )
    .all() as CatalogStats['byDepartment']
  const byType = db
    .prepare(`SELECT doc_type, COUNT(*) AS files FROM file_catalog GROUP BY doc_type ORDER BY files DESC`)
    .all() as CatalogStats['byType']
  const byStore = db
    .prepare(
      `SELECT store, COUNT(*) AS files FROM file_catalog WHERE store <> '' GROUP BY store ORDER BY files DESC`
    )
    .all() as CatalogStats['byStore']
  // Files whose content hash appears more than once (potential duplicates).
  const duplicates = (
    db
      .prepare(
        `SELECT COUNT(*) c FROM (
           SELECT sha256 FROM file_catalog WHERE sha256 <> '' GROUP BY sha256 HAVING COUNT(*) > 1
         )`
      )
      .get() as { c: number }
  ).c

  return { total, ingested, totalSize, byDepartment, byType, byStore, duplicates }
}

export function searchCatalog(q: CatalogQuery): FileCatalogEntry[] {
  const where: string[] = []
  const params: unknown[] = []
  if (q.text && q.text.trim()) {
    where.push(`(filename LIKE ? OR rel_path LIKE ? OR store LIKE ? OR department LIKE ? OR period LIKE ?)`)
    const like = `%${q.text.trim()}%`
    params.push(like, like, like, like, like)
  }
  if (q.department) {
    where.push(`department = ?`)
    params.push(q.department)
  }
  if (q.store) {
    where.push(`store = ?`)
    params.push(q.store)
  }
  if (q.period) {
    where.push(`period LIKE ?`)
    params.push(`${q.period}%`)
  }
  if (q.doc_type) {
    where.push(`doc_type = ?`)
    params.push(q.doc_type)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const limit = Math.min(Math.max(q.limit ?? 200, 1), 1000)
  return getDatabase()
    .prepare(`SELECT * FROM file_catalog ${clause} ORDER BY period DESC, department, filename LIMIT ${limit}`)
    .all(...params) as FileCatalogEntry[]
}
