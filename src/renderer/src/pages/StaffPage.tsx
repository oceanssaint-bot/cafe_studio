import { useCallback, useEffect, useState } from 'react'
import { formatZar } from '../../../shared/defaults'
import { useStoreScope } from '../hooks/useStoreScope'
import type { LedgerEntity, Staff } from '../../../shared/types'

export default function StaffPage(): JSX.Element {
  const { storeMode, oceansId } = useStoreScope()
  const [entities, setEntities] = useState<LedgerEntity[]>([])
  const [storeId, setStoreId] = useState<number | null>(null)
  const [list, setList] = useState<Staff[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [edit, setEdit] = useState<Staff | null>(null)

  useEffect(() => {
    window.gloria.ledger.entities().then((es) => {
      const stores = es.filter((e) => e.id !== 0)
      setEntities(stores)
      setStoreId((cur) => cur ?? stores[0]?.id ?? null)
    })
  }, [])

  // In store mode, lock to Oceans.
  useEffect(() => {
    if (storeMode && oceansId != null) setStoreId(oceansId)
  }, [storeMode, oceansId])

  const refresh = useCallback(async (): Promise<void> => {
    if (storeId == null) return
    setList(await window.gloria.staff.list(storeId))
  }, [storeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function sync(): Promise<void> {
    if (storeId == null) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await window.gloria.staff.sync(storeId)
      setMsg(`Synced from timesheets: ${r.added} added, ${r.total} on register.`)
      refresh()
    } finally {
      setBusy(false)
    }
  }

  async function save(): Promise<void> {
    if (!edit) return
    await window.gloria.staff.upsert({
      id: edit.id || undefined,
      store_id: edit.store_id ?? storeId ?? 0,
      name: edit.name,
      id_number: edit.id_number,
      occupation: edit.occupation,
      status: edit.status,
      phone: edit.phone,
      email: edit.email,
      monthly_pay: edit.monthly_pay,
      notes: edit.notes,
      active: edit.active
    })
    setEdit(null)
    refresh()
  }

  const storeName = entities.find((e) => e.id === storeId)?.name ?? 'Oceans Mall'

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">Staff</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Employee register for {storeName} — one profile per person.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!storeMode && entities.length > 0 && (
            <select
              value={storeId ?? ''}
              onChange={(e) => setStoreId(Number(e.target.value))}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
            >
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={sync}
            className="rounded-md border border-gloria-accent px-3 py-2 text-sm font-medium text-gloria-accent hover:bg-gloria-accent hover:text-white disabled:opacity-50"
          >
            {busy ? 'Syncing…' : 'Sync from timesheets'}
          </button>
          <button
            type="button"
            onClick={() =>
              setEdit({
                id: 0,
                store_id: storeId,
                name: '',
                id_number: '',
                occupation: 'Team Member',
                status: 'Permanent',
                dob: '',
                gender: '',
                phone: '',
                email: '',
                monthly_pay: 0,
                notes: '',
                active: 1
              })
            }
            className="rounded-md bg-gloria-accent px-3 py-2 text-sm font-medium text-white hover:bg-gloria-brown"
          >
            + Add
          </button>
        </div>
      </header>

      {msg && (
        <p className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {msg}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((s) => (
          <div
            key={s.id}
            className={[
              'rounded-lg border p-4',
              s.active ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800' : 'border-slate-200 bg-slate-50 opacity-60 dark:border-slate-700 dark:bg-slate-800/50'
            ].join(' ')}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gloria-brown dark:text-gloria-cream">{s.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {s.occupation} · {s.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEdit(s)}
                className="text-xs text-gloria-accent hover:underline"
              >
                Edit
              </button>
            </div>
            <dl className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <Row k="ID number" v={s.id_number || '—'} />
              <Row k="Born" v={s.dob ? `${s.dob}${s.gender ? ` · ${s.gender}` : ''}` : '—'} />
              <Row k="Monthly pay" v={formatZar(s.monthly_pay)} />
              {s.phone && <Row k="Phone" v={s.phone} />}
              {s.email && <Row k="Email" v={s.email} />}
              {s.notes && <Row k="Notes" v={s.notes} />}
            </dl>
          </div>
        ))}
        {list.length === 0 && (
          <p className="col-span-2 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400 dark:border-slate-600 dark:bg-slate-800">
            No staff yet. Click “Sync from timesheets” to build the register from your WAGES data, or
            “+ Add”.
          </p>
        )}
      </div>

      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setEdit(null)}>
          <div
            className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-semibold text-gloria-brown dark:text-gloria-cream">
              {edit.id ? 'Edit staff' : 'Add staff'}
            </h3>
            <div className="space-y-2">
              <Field label="Full name" value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} />
              <Field label="ID number" value={edit.id_number} onChange={(v) => setEdit({ ...edit, id_number: v })} />
              <Field label="Occupation" value={edit.occupation} onChange={(v) => setEdit({ ...edit, occupation: v })} />
              <div className="flex gap-2">
                <label className="flex-1 text-xs text-slate-500">
                  Status
                  <select
                    value={edit.status}
                    onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                  >
                    <option>Permanent</option>
                    <option>Casual</option>
                  </select>
                </label>
                <label className="flex-1 text-xs text-slate-500">
                  Monthly pay
                  <input
                    inputMode="decimal"
                    value={edit.monthly_pay}
                    onChange={(e) => setEdit({ ...edit, monthly_pay: parseFloat(e.target.value) || 0 })}
                    className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                  />
                </label>
              </div>
              <Field label="Phone" value={edit.phone} onChange={(v) => setEdit({ ...edit, phone: v })} />
              <Field label="Email" value={edit.email} onChange={(v) => setEdit({ ...edit, email: v })} />
              <Field label="Notes" value={edit.notes} onChange={(v) => setEdit({ ...edit, notes: v })} />
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={!!edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked ? 1 : 0 })} />
                Active employee
              </label>
            </div>
            <div className="mt-4 flex justify-between">
              {edit.id ? (
                <button
                  type="button"
                  onClick={async () => {
                    await window.gloria.staff.remove(edit.id)
                    setEdit(null)
                    refresh()
                  }}
                  className="text-sm text-red-500 hover:underline"
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEdit(null)} className="rounded-md border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">
                  Cancel
                </button>
                <button type="button" onClick={save} disabled={!edit.name.trim()} className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }): JSX.Element {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-400">{k}</dt>
      <dd className="text-right text-slate-700 dark:text-slate-200">{v}</dd>
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <label className="block text-xs text-slate-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
      />
    </label>
  )
}
