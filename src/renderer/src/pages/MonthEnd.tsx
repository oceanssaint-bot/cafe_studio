import { useCallback, useEffect, useMemo, useState } from 'react'
import ProgressBar from '../components/ProgressBar'
import PeriodSelector from '../components/PeriodSelector'
import TaskRow from './month-end/TaskRow'
import { currentPeriod } from '../../../shared/defaults'
import type { Task, TaskStats } from '../../../shared/types'

export default function MonthEnd({ initialPeriod }: { initialPeriod?: string }): JSX.Element {
  const [period, setPeriod] = useState<string>(initialPeriod ?? currentPeriod())
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<TaskStats>({ total: 0, completed: 0, percent: 0 })
  const [hideCompleted, setHideCompleted] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (): Promise<void> => {
    const [list, s] = await Promise.all([
      window.gloria.tasks.list(period),
      window.gloria.tasks.stats(period)
    ])
    setTasks(list)
    setStats(s)
    setLoading(false)
  }, [period])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  const addTask = async (): Promise<void> => {
    const title = newTitle.trim()
    if (!title) return
    await window.gloria.tasks.create({ period, title })
    setNewTitle('')
    refresh()
  }

  const toggle = async (id: number, complete: boolean): Promise<void> => {
    await window.gloria.tasks.setStatus(id, complete)
    refresh()
  }

  const save = async (id: number, title: string, notes: string): Promise<void> => {
    await window.gloria.tasks.update({ id, title, notes })
    refresh()
  }

  const remove = async (id: number): Promise<void> => {
    await window.gloria.tasks.remove(id)
    refresh()
  }

  const visible = useMemo(
    () => (hideCompleted ? tasks.filter((t) => t.status !== 'complete') : tasks),
    [tasks, hideCompleted]
  )

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
            Month End
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Track and complete monthly admin tasks.
          </p>
        </div>
        <PeriodSelector period={period} onChange={setPeriod} />
      </header>

      {/* Progress summary */}
      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Progress
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {stats.completed} of {stats.total} complete ·{' '}
            <span className="font-semibold text-gloria-brown dark:text-gloria-cream">
              {stats.percent}%
            </span>
          </span>
        </div>
        <ProgressBar percent={stats.percent} />
      </div>

      {/* Add + filter controls */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Add a task…"
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={addTask}
            disabled={!newTitle.trim()}
            className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={hideCompleted}
            onChange={(e) => setHideCompleted(e.target.checked)}
            className="h-4 w-4 accent-gloria-accent"
          />
          Hide completed
        </label>
      </div>

      {/* Task list */}
      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          {tasks.length === 0 ? 'No tasks for this month.' : 'All tasks complete. 🎉'}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={toggle}
              onSave={save}
              onDelete={remove}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
