import { getDatabase } from '../db'
import { periodLabel } from '../../shared/defaults'
import type { ActivityItem } from '../../shared/types'

/**
 * Builds a recent-activity feed by deriving events from existing timestamps:
 * completed tasks (completed_at) and saved store figures (updated_at). No
 * separate activity log is needed.
 */
export function recentActivity(limit = 8): ActivityItem[] {
  const db = getDatabase()

  const completedTasks = db
    .prepare(
      `SELECT title, period, completed_at AS when_ts
       FROM tasks
       WHERE status = 'complete' AND completed_at IS NOT NULL
       ORDER BY completed_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{ title: string; period: string; when_ts: string }>

  const storeUpdates = db
    .prepare(
      `SELECT s.id AS storeId, s.name AS storeName, d.period AS period,
              d.updated_at AS when_ts
       FROM monthly_store_data d
       JOIN stores s ON s.id = d.store_id
       WHERE d.updated_at IS NOT NULL
       ORDER BY d.updated_at DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    storeId: number
    storeName: string
    period: string
    when_ts: string
  }>

  const items: ActivityItem[] = [
    ...completedTasks.map(
      (t): ActivityItem => ({
        kind: 'task_completed',
        label: `Completed “${t.title}”`,
        detail: periodLabel(t.period),
        when: t.when_ts,
        period: t.period
      })
    ),
    ...storeUpdates.map(
      (s): ActivityItem => ({
        kind: 'store_updated',
        label: `Updated ${s.storeName} figures`,
        detail: periodLabel(s.period),
        when: s.when_ts,
        period: s.period,
        storeId: s.storeId
      })
    )
  ]

  return items
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, limit)
}
