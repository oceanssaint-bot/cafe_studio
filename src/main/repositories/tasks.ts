import { getDatabase } from '../db'
import { DEFAULT_TASK_TITLES } from '../../shared/defaults'
import type {
  Task,
  TaskStats,
  CreateTaskInput,
  UpdateTaskInput
} from '../../shared/types'

function now(): string {
  return new Date().toISOString()
}

/** Seed a month's default checklist if it has no tasks yet. Idempotent. */
function seedIfEmpty(period: string): void {
  const db = getDatabase()
  const count = db
    .prepare(`SELECT COUNT(*) AS n FROM tasks WHERE period = ?`)
    .get(period) as { n: number }
  if (count.n > 0) return

  const insert = db.prepare(
    `INSERT INTO tasks (period, title, notes, status, created_at)
     VALUES (?, ?, '', 'pending', ?)`
  )
  const seedAll = db.transaction((titles: string[]) => {
    const ts = now()
    for (const title of titles) insert.run(period, title, ts)
  })
  seedAll(DEFAULT_TASK_TITLES)
}

export function listTasks(period: string): Task[] {
  seedIfEmpty(period)
  return getDatabase()
    .prepare(`SELECT * FROM tasks WHERE period = ? ORDER BY id`)
    .all(period) as Task[]
}

export function createTask(input: CreateTaskInput): Task {
  const db = getDatabase()
  const info = db
    .prepare(
      `INSERT INTO tasks (period, title, notes, status, created_at)
       VALUES (?, ?, ?, 'pending', ?)`
    )
    .run(input.period, input.title.trim(), input.notes?.trim() ?? '', now())
  return getTask(Number(info.lastInsertRowid))
}

export function updateTask(input: UpdateTaskInput): Task {
  getDatabase()
    .prepare(`UPDATE tasks SET title = ?, notes = ? WHERE id = ?`)
    .run(input.title.trim(), input.notes.trim(), input.id)
  return getTask(input.id)
}

export function setTaskStatus(id: number, complete: boolean): Task {
  getDatabase()
    .prepare(`UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?`)
    .run(complete ? 'complete' : 'pending', complete ? now() : null, id)
  return getTask(id)
}

export function deleteTask(id: number): void {
  getDatabase().prepare(`DELETE FROM tasks WHERE id = ?`).run(id)
}

export function getTaskStats(period: string): TaskStats {
  seedIfEmpty(period)
  const row = getDatabase()
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) AS completed
       FROM tasks WHERE period = ?`
    )
    .get(period) as { total: number; completed: number | null }
  const total = row.total
  const completed = row.completed ?? 0
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
  return { total, completed, percent }
}

/** Distinct months that already have tasks, newest first. */
export function listPeriods(): string[] {
  const rows = getDatabase()
    .prepare(`SELECT DISTINCT period FROM tasks ORDER BY period DESC`)
    .all() as Array<{ period: string }>
  return rows.map((r) => r.period)
}

function getTask(id: number): Task {
  const task = getDatabase()
    .prepare(`SELECT * FROM tasks WHERE id = ?`)
    .get(id) as Task | undefined
  if (!task) throw new Error(`Task ${id} not found`)
  return task
}
