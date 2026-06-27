import { useState } from 'react'
import type { Task } from '../../../../shared/types'

interface TaskRowProps {
  task: Task
  onToggle: (id: number, complete: boolean) => void
  onSave: (id: number, title: string, notes: string) => void
  onDelete: (id: number) => void
}

export default function TaskRow({ task, onToggle, onSave, onDelete }: TaskRowProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(task.title)
  const [notes, setNotes] = useState(task.notes)
  const complete = task.status === 'complete'

  function startEdit(): void {
    setTitle(task.title)
    setNotes(task.notes)
    setEditing(true)
  }

  function save(): void {
    if (!title.trim()) return
    onSave(task.id, title, notes)
    setEditing(false)
  }

  if (editing) {
    return (
      <li className="rounded-lg border border-gloria-accent/50 bg-white p-4 dark:bg-slate-800">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          autoFocus
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          rows={2}
          className="mt-2 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-gloria-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-gloria-brown"
          >
            Save
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <input
        type="checkbox"
        checked={complete}
        onChange={(e) => onToggle(task.id, e.target.checked)}
        aria-label={`Mark ${task.title} complete`}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-emerald-500"
      />
      <div className="min-w-0 flex-1">
        <p
          className={[
            'text-sm font-medium',
            complete
              ? 'text-slate-400 line-through dark:text-slate-500'
              : 'text-slate-800 dark:text-slate-100'
          ].join(' ')}
        >
          {task.title}
        </p>
        {task.notes && (
          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500 dark:text-slate-400">
            {task.notes}
          </p>
        )}
        {complete && task.completed_at && (
          <p className="mt-1 text-[11px] text-emerald-600">
            Completed {new Date(task.completed_at).toLocaleDateString('en-ZA')}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={startEdit}
          aria-label="Edit task"
          className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          aria-label="Delete task"
          className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
        >
          Delete
        </button>
      </div>
    </li>
  )
}
