import { useEffect, useState } from 'react'
import PeriodSelector from '../../components/PeriodSelector'
import { CATEGORY_LABEL, formatZar } from '../../../../shared/defaults'
import type { Store, MonthlyStoreData } from '../../../../shared/types'

interface StoreDetailProps {
  store: Store
  period: string
  onPeriodChange: (period: string) => void
}

interface FormState {
  sales: string
  purchases: string
  turnover: string
  notes: string
}

function toForm(data: MonthlyStoreData): FormState {
  return {
    sales: data.sales ? String(data.sales) : '',
    purchases: data.purchases ? String(data.purchases) : '',
    turnover: data.turnover ? String(data.turnover) : '',
    notes: data.notes
  }
}

export default function StoreDetail({
  store,
  period,
  onPeriodChange
}: StoreDetailProps): JSX.Element {
  const [form, setForm] = useState<FormState>({
    sales: '',
    purchases: '',
    turnover: '',
    notes: ''
  })
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [extra, setExtra] = useState<MonthlyStoreData | null>(null)

  useEffect(() => {
    let active = true
    window.gloria.stores.getData(store.id, period).then((data) => {
      if (!active) return
      setForm(toForm(data))
      setSavedAt(data.updated_at)
      setExtra(data)
      setDirty(false)
    })
    return () => {
      active = false
    }
  }, [store.id, period])

  function set<K extends keyof FormState>(key: K, value: string): void {
    setForm((f) => ({ ...f, [key]: value }))
    setDirty(true)
  }

  async function save(): Promise<void> {
    setSaving(true)
    const result = await window.gloria.stores.saveData({
      store_id: store.id,
      period,
      sales: parseFloat(form.sales) || 0,
      purchases: parseFloat(form.purchases) || 0,
      turnover: parseFloat(form.turnover) || 0,
      notes: form.notes
    })
    setForm(toForm(result))
    setSavedAt(result.updated_at)
    setDirty(false)
    setSaving(false)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-700">
        <div>
          <h3 className="text-xl font-semibold text-gloria-brown dark:text-gloria-cream">
            {store.name}
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {CATEGORY_LABEL[store.category]}
            </span>
            {store.include_in_australia === 1 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                Australia pack
              </span>
            )}
          </div>
        </div>
        <PeriodSelector period={period} onChange={onPeriodChange} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MoneyField label="Sales value" value={form.sales} onChange={(v) => set('sales', v)} />
        <MoneyField
          label="Purchases value"
          value={form.purchases}
          onChange={(v) => set('purchases', v)}
        />
        <MoneyField
          label="Turnover value"
          value={form.turnover}
          onChange={(v) => set('turnover', v)}
        />
      </div>

      {extra &&
        (extra.transactions > 0 ||
          extra.royalty > 0 ||
          extra.marketing > 0 ||
          extra.royalty_au > 0 ||
          extra.consumption > 0) && (
          <div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-900/40 sm:grid-cols-5">
            <Stat label="Transactions" value={extra.transactions.toLocaleString('en-ZA')} />
            <Stat label="Royalty invoiced" value={formatZar(extra.royalty)} />
            <Stat label="Marketing" value={formatZar(extra.marketing)} />
            <Stat label="Due to Australia (1%)" value={formatZar(extra.royalty_au)} />
            <Stat label="Consumption" value={formatZar(extra.consumption)} />
          </div>
        )}

      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
          Monthly notes
        </label>
        <textarea
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={4}
          placeholder="Notes for this store this month…"
          className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
        />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {savedAt
            ? `Saved ${new Date(savedAt).toLocaleString('en-ZA')}`
            : 'Not saved yet'}
          {form.sales || form.purchases || form.turnover ? (
            <span className="ml-2 text-slate-500 dark:text-slate-400">
              · Sales {formatZar(parseFloat(form.sales) || 0)}
            </span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={save}
          disabled={saving || !dirty}
          className="rounded-md bg-gloria-accent px-5 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 font-medium text-slate-700 dark:text-slate-200">{value}</p>
    </div>
  )
}

function MoneyField({
  label,
  value,
  onChange
}: {
  label: string
  value: string
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
      </label>
      <div className="flex items-center rounded-md border border-slate-300 focus-within:border-gloria-accent dark:border-slate-600 dark:bg-slate-900">
        <span className="pl-3 text-sm text-slate-400">R</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full bg-transparent px-2 py-2 text-sm focus:outline-none"
        />
      </div>
    </div>
  )
}
