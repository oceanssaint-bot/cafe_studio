import { getDatabase } from '../db'
import type { SearchResults, TaskSearchResult, StoreSearchResult } from '../../shared/types'

/** Searches tasks (title/notes) and stores (name) for a free-text query. */
export function searchAll(query: string): SearchResults {
  const q = query.trim()
  if (!q) return { tasks: [], stores: [] }
  const like = `%${q}%`
  const db = getDatabase()

  const tasks = db
    .prepare(
      `SELECT id, title, period, status
       FROM tasks
       WHERE title LIKE ? OR notes LIKE ?
       ORDER BY period DESC, id
       LIMIT 8`
    )
    .all(like, like) as TaskSearchResult[]

  const stores = db
    .prepare(
      `SELECT id, name, category
       FROM stores
       WHERE name LIKE ?
       ORDER BY sort_order, id
       LIMIT 8`
    )
    .all(like) as StoreSearchResult[]

  return { tasks, stores }
}
