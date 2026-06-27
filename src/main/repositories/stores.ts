import { getDatabase } from '../db'
import type {
  Store,
  MonthlyStoreData,
  SaveMonthlyStoreInput,
  CreateStoreInput,
  UpdateStoreInput
} from '../../shared/types'

export function listStores(includeArchived = false): Store[] {
  const where = includeArchived ? '' : 'WHERE archived = 0'
  return getDatabase()
    .prepare(`SELECT * FROM stores ${where} ORDER BY archived, sort_order, id`)
    .all() as Store[]
}

export function getStore(id: number): Store | undefined {
  return getDatabase().prepare(`SELECT * FROM stores WHERE id = ?`).get(id) as Store | undefined
}

export function createStore(input: CreateStoreInput): Store {
  const maxOrder = getDatabase()
    .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS m FROM stores`)
    .get() as { m: number }
  const info = getDatabase()
    .prepare(
      `INSERT INTO stores (name, category, include_in_australia, sort_order, archived)
       VALUES (?, ?, ?, ?, 0)`
    )
    .run(input.name.trim(), input.category, input.include_in_australia ? 1 : 0, maxOrder.m + 1)
  return getStore(Number(info.lastInsertRowid)) as Store
}

export function updateStore(input: UpdateStoreInput): Store {
  const cur = getStore(input.id)
  getDatabase()
    .prepare(
      `UPDATE stores SET name = ?, category = ?, include_in_australia = ?, archived = ?,
         address = ?, phone = ?, profile_notes = ?
       WHERE id = ?`
    )
    .run(
      input.name.trim(),
      input.category,
      input.include_in_australia ? 1 : 0,
      input.archived ? 1 : 0,
      input.address ?? cur?.address ?? '',
      input.phone ?? cur?.phone ?? '',
      input.profile_notes ?? cur?.profile_notes ?? '',
      input.id
    )
  return getStore(input.id) as Store
}

export function setBillingEmail(id: number, email: string): void {
  getDatabase().prepare(`UPDATE stores SET billing_email = ? WHERE id = ?`).run(email.trim(), id)
}

/**
 * Finds a store by (loosely-matched) name, creating it if absent. Used by the
 * archive importer so stores that appear in the source data are added
 * automatically. Match is case-insensitive on the leading name part.
 */
export function findOrCreateByName(rawName: string): Store {
  const clean = rawName.split(' - ')[0].trim()
  const key = clean.toLowerCase()
  const existing = listStores(true).find((s) => s.name.toLowerCase() === key)
  if (existing) return existing

  // Sensible defaults: Point Waterfront is excluded from the Australia pack;
  // everything else is included. Category defaults to franchise.
  const include = /point\s*water/i.test(clean) ? 0 : 1
  return createStore({ name: clean, category: 'franchise', include_in_australia: include })
}

export function getMonthlyData(storeId: number, period: string): MonthlyStoreData {
  const row = getDatabase()
    .prepare(`SELECT * FROM monthly_store_data WHERE store_id = ? AND period = ?`)
    .get(storeId, period) as MonthlyStoreData | undefined

  return (
    row ?? {
      store_id: storeId,
      period,
      sales: 0,
      purchases: 0,
      turnover: 0,
      transactions: 0,
      royalty: 0,
      marketing: 0,
      royalty_au: 0,
      consumption: 0,
      notes: '',
      updated_at: null
    }
  )
}

export function saveMonthlyData(input: SaveMonthlyStoreInput): MonthlyStoreData {
  getDatabase()
    .prepare(
      `INSERT INTO monthly_store_data
         (store_id, period, sales, purchases, turnover, notes, updated_at)
       VALUES (@store_id, @period, @sales, @purchases, @turnover, @notes, @updated_at)
       ON CONFLICT(store_id, period) DO UPDATE SET
         sales = excluded.sales,
         purchases = excluded.purchases,
         turnover = excluded.turnover,
         notes = excluded.notes,
         updated_at = excluded.updated_at`
    )
    .run({
      store_id: input.store_id,
      period: input.period,
      sales: input.sales,
      purchases: input.purchases,
      turnover: input.turnover,
      notes: input.notes.trim(),
      updated_at: new Date().toISOString()
    })

  return getMonthlyData(input.store_id, input.period)
}

/**
 * Sets only the provided figures for a store/month (used by the importer).
 * Undefined fields are left untouched so turnover and purchases can come from
 * different source files without overwriting each other.
 */
export function importMonthlyFigures(
  storeId: number,
  period: string,
  fields: Partial<Pick<MonthlyStoreData, 'sales' | 'purchases' | 'turnover' | 'transactions' | 'royalty' | 'marketing' | 'royalty_au' | 'consumption'>>
): void {
  const db = getDatabase()
  // Ensure a row exists, then update provided columns.
  db.prepare(
    `INSERT INTO monthly_store_data (store_id, period, notes, updated_at)
     VALUES (?, ?, '', ?)
     ON CONFLICT(store_id, period) DO NOTHING`
  ).run(storeId, period, new Date().toISOString())

  const cols: string[] = []
  const vals: unknown[] = []
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue
    cols.push(`${k} = ?`)
    vals.push(v)
  }
  if (cols.length === 0) return
  cols.push(`updated_at = ?`)
  vals.push(new Date().toISOString())
  vals.push(storeId, period)
  db.prepare(`UPDATE monthly_store_data SET ${cols.join(', ')} WHERE store_id = ? AND period = ?`).run(
    ...vals
  )
}
