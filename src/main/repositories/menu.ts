import { getDatabase } from '../db'
import type { MenuItem, MenuItemInput, RecipeLine, RecipeLineInput } from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}
function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

/** Recipe cost of one menu item = Σ (line qty × stock cost price). */
function recipeCost(menuItemId: number): { cost: number; lines: number } {
  const r = getDatabase()
    .prepare(
      `SELECT COALESCE(SUM(rl.qty * si.cost_price),0) cost, COUNT(*) n
       FROM recipe_lines rl JOIN stock_items si ON si.id = rl.stock_item_id
       WHERE rl.menu_item_id = ?`
    )
    .get(menuItemId) as { cost: number; n: number }
  return { cost: round2(r.cost), lines: r.n }
}

export function listMenuItems(storeId: number): MenuItem[] {
  const items = getDatabase()
    .prepare(`SELECT * FROM menu_items WHERE store_id = ? ORDER BY active DESC, category, name`)
    .all(storeId) as Array<{
    id: number
    store_id: number | null
    name: string
    category: string
    sell_price: number
    active: number
  }>
  return items.map((i) => {
    const rc = recipeCost(i.id)
    const grossProfit = round2(i.sell_price - rc.cost)
    return {
      ...i,
      recipeCost: rc.cost,
      grossProfit,
      margin: i.sell_price > 0 ? Math.round((grossProfit / i.sell_price) * 100) : 0,
      hasRecipe: rc.lines > 0
    }
  })
}

export function upsertMenuItem(input: MenuItemInput): number {
  const db = getDatabase()
  if (input.id) {
    db.prepare(`UPDATE menu_items SET name=?, category=?, sell_price=? WHERE id=?`).run(
      input.name.trim(),
      input.category.trim(),
      input.sell_price,
      input.id
    )
    return input.id
  }
  const info = db
    .prepare(
      `INSERT INTO menu_items (store_id, name, category, sell_price, active, created_at) VALUES (?,?,?,?,1,?)`
    )
    .run(input.store_id, input.name.trim(), input.category.trim(), input.sell_price, now())
  return Number(info.lastInsertRowid)
}

export function deleteMenuItem(id: number): void {
  getDatabase().prepare(`DELETE FROM menu_items WHERE id = ?`).run(id)
}

export function getRecipe(menuItemId: number): RecipeLine[] {
  return getDatabase()
    .prepare(
      `SELECT rl.id, rl.menu_item_id, rl.stock_item_id, rl.qty,
              si.name AS stockName, si.unit, si.cost_price AS unitCost,
              ROUND(rl.qty * si.cost_price, 2) AS lineCost
       FROM recipe_lines rl JOIN stock_items si ON si.id = rl.stock_item_id
       WHERE rl.menu_item_id = ? ORDER BY si.name`
    )
    .all(menuItemId) as RecipeLine[]
}

export function setRecipe(menuItemId: number, lines: RecipeLineInput[]): void {
  const db = getDatabase()
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM recipe_lines WHERE menu_item_id = ?`).run(menuItemId)
    const ins = db.prepare(
      `INSERT INTO recipe_lines (menu_item_id, stock_item_id, qty, created_at) VALUES (?,?,?,?)`
    )
    for (const l of lines) if (l.stock_item_id && l.qty > 0) ins.run(menuItemId, l.stock_item_id, l.qty, now())
  })
  tx()
}
