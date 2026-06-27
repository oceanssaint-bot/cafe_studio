import { getDatabase } from '../db'
import type { StockTake, StockTakeInput } from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}
function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

export function listStockTakes(entityStoreId: number): StockTake[] {
  const where = entityStoreId === 0 ? 'entity_store_id IS NULL' : 'entity_store_id = ?'
  const params = entityStoreId === 0 ? [] : [entityStoreId]
  return getDatabase()
    .prepare(`SELECT * FROM stock_takes WHERE ${where} ORDER BY take_date DESC, id DESC`)
    .all(...params) as StockTake[]
}

export function upsertStockTake(input: StockTakeInput, source = 'manual'): void {
  getDatabase()
    .prepare(
      `INSERT INTO stock_takes (entity_store_id, take_date, total_value, item_count, source, created_at)
       VALUES (@entity, @take_date, @total_value, @item_count, @source, @created_at)
       ON CONFLICT(entity_store_id, take_date) DO UPDATE SET
         total_value = excluded.total_value,
         item_count = excluded.item_count,
         source = excluded.source`
    )
    .run({
      entity: input.entity_store_id === 0 ? null : input.entity_store_id,
      take_date: input.take_date,
      total_value: round2(input.total_value),
      item_count: input.item_count,
      source,
      created_at: now()
    })
}

export function deleteStockTake(id: number): void {
  getDatabase().prepare(`DELETE FROM stock_takes WHERE id = ?`).run(id)
}
