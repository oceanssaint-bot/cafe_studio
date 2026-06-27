import { useEffect, useState } from 'react'
import { periodLabel, formatZar } from '../../../../shared/defaults'
import type { AppDocument, Store, Task, SheetPreview } from '../../../../shared/types'

interface DocumentReviewProps {
  doc: AppDocument
  stores: Store[]
  onApplied: () => void
  onChanged: () => void
}

interface FormState {
  store_id: string
  period: string
  sales: string
  purchases: string
  turnover: string
  vat: string
  supplier: string
  doc_date: string
  summary: string
  task_id: string
}

function toForm(d: AppDocument): FormState {
  return {
    store_id: d.store_id ? String(d.store_id) : '',
    period: d.period || '',
    sales: d.sales ? String(d.sales) : '',
    purchases: d.purchases ? String(d.purchases) : '',
    turnover: d.turnover ? String(d.turnover) : '',
    vat: d.vat ? String(d.vat) : '',
    supplier: d.supplier,
    doc_date: d.doc_date,
    summary: d.summary,
    task_id: d.task_id ? String(d.task_id) : ''
  }
}

export default function DocumentReview({
  doc,
  stores,
  onApplied,
  onChanged
}: DocumentReviewProps): JSX.Element {
  const [form, setForm] = useState<FormState>(toForm(doc))
  const [tasks, setTasks] = useState<Task[]>([])
  const [preview, setPreview] = useState<SheetPreview | null>(null)
  const [busy, setBusy] = useState<null | 'apply' | 'reextract'>(null)
  const applied = doc.status === 'applied'

  useEffect(() => {
    setForm(toForm(doc))
    if (doc.kind === 'spreadsheet') {
      window.gloria.documents.preview(doc.id).then(setPreview).catch(() => setPreview(null))
    } else {
      setPreview(null)
    }
  }, [doc])

  useEffect(() => {
    if (form.period) window.gloria.tasks.list(form.period).then(setTasks).catch(() => setTasks([]))
    else setTasks([])
  }, [form.period])

  function set<K extends keyof FormState>(key: K, value: string): void {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function apply(): Promise<void> {
    setBusy('apply')
    try {
      await window.gloria.documents.apply({
        id: doc.id,
        store_id: form.store_id ? Number(form.store_id) : null,
        period: form.period,
        sales: parseFloat(form.sales) || 0,
        purchases: parseFloat(form.purchases) || 0,
        turnover: parseFloat(form.turnover) || 0,
        vat: parseFloat(form.vat) || 0,
        supplier: form.supplier,
        doc_date: form.doc_date,
        summary: form.summary,
        task_id: form.task_id ? Number(form.task_id) : null
      })
      onApplied()
    } finally {
      setBusy(null)
    }
  }

  async function reextract(): Promise<void> {
    setBusy('reextract')
    try {
      await window.gloria.documents.reextract(doc.id)
      onChanged()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-700">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-gloria-brown dark:text-gloria-cream">
            {doc.filename}
          </h3>
          <p className="mt-0.5 text-xs capitalize text-slate-400">
            {doc.kind} · {applied ? 'Applied' : 'Review the figures, then apply'}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => window.gloria.documents.open(doc.id)}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Open file
          </button>
          {doc.kind !== 'spreadsheet' && (
            <button
              type="button"
              onClick={reextract}
              disabled={busy !== null}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              {busy === 'reextract' ? 'Reading…' : 'Re-read'}
            </button>
          )}
        </div>
      </div>

      {doc.status === 'error' && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/30 dark:text-red-300">
          {doc.error}
        </p>
      )}

      {preview && (
        <div className="mb-4 overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <tbody>
              {preview.rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-700">
                  {row.map((cell, j) => (
                    <td key={j} className="whitespace-nowrap px-2 py-1 text-slate-600 dark:text-slate-300">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier">
          <input
            value={form.supplier}
            onChange={(e) => set('supplier', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Document date">
          <input
            type="date"
            value={form.doc_date}
            onChange={(e) => set('doc_date', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Store">
          <select
            value={form.store_id}
            onChange={(e) => set('store_id', e.target.value)}
            className={inputCls}
          >
            <option value="">— None —</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Month">
          <input
            type="month"
            value={form.period}
            onChange={(e) => set('period', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Money label="Sales" value={form.sales} onChange={(v) => set('sales', v)} />
        <Money label="Purchases" value={form.purchases} onChange={(v) => set('purchases', v)} />
        <Money label="Turnover" value={form.turnover} onChange={(v) => set('turnover', v)} />
        <Money label="VAT" value={form.vat} onChange={(v) => set('vat', v)} />
      </div>

      <Field label="Summary / note" className="mt-4">
        <textarea
          value={form.summary}
          onChange={(e) => set('summary', e.target.value)}
          rows={2}
          className={inputCls + ' resize-y'}
        />
      </Field>

      <Field label="Attach note to month-end task (optional)" className="mt-4">
        <select
          value={form.task_id}
          onChange={(e) => set('task_id', e.target.value)}
          className={inputCls}
        >
          <option value="">— None —</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </Field>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Applying adds these figures to {form.period ? periodLabel(form.period) : 'the month'} ·
          Sales {formatZar(parseFloat(form.sales) || 0)}
        </p>
        <button
          type="button"
          onClick={apply}
          disabled={busy !== null}
          className="rounded-md bg-gloria-accent px-5 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
        >
          {busy === 'apply' ? 'Applying…' : applied ? 'Apply again' : 'Apply'}
        </button>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900'

function Field({
  label,
  children,
  className
}: {
  label: string
  children: React.ReactNode
  className?: string
}): JSX.Element {
  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </label>
      {children}
    </div>
  )
}

function Money({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <Field label={label}>
      <div className="flex items-center rounded-md border border-slate-300 focus-within:border-gloria-accent dark:border-slate-600 dark:bg-slate-900">
        <span className="pl-3 text-sm text-slate-400">R</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full bg-transparent px-2 py-2 text-sm focus:outline-none"
        />
      </div>
    </Field>
  )
}
