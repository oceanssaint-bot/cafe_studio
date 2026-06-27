import { useState } from 'react'
import type { Store, StoreCategory } from '../../../../shared/types'

interface StoreEditorProps {
  store: Store | null // null = create new
  onSave: (input: {
    name: string
    category: StoreCategory
    australia: number
    archived: number
    address: string
    phone: string
    profile_notes: string
  }) => void
  onClose: () => void
}

export default function StoreEditor({ store, onSave, onClose }: StoreEditorProps): JSX.Element {
  const [name, setName] = useState(store?.name ?? '')
  const [category, setCategory] = useState<StoreCategory>(store?.category ?? 'franchise')
  const [australia, setAustralia] = useState(store ? store.include_in_australia === 1 : true)
  const [archived, setArchived] = useState(store ? store.archived === 1 : false)
  const [address, setAddress] = useState(store?.address ?? '')
  const [phone, setPhone] = useState(store?.phone ?? '')
  const [profileNotes, setProfileNotes] = useState(store?.profile_notes ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-gloria-brown dark:text-gloria-cream">
          {store ? 'Edit store' : 'Add store'}
        </h3>

        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Store name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          placeholder="e.g. Gateway South"
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
        />

        <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
          Category
        </label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as StoreCategory)}
          className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="franchise">Franchise</option>
          <option value="head_office">Head Office</option>
        </select>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Address
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Shop, mall, city"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Phone
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="031 …"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
            Notes (lease, banking, manager…)
          </label>
          <textarea
            value={profileNotes}
            onChange={(e) => setProfileNotes(e.target.value)}
            rows={2}
            className="w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
          />
        </div>

        <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={australia}
            onChange={(e) => setAustralia(e.target.checked)}
            className="h-4 w-4 accent-gloria-accent"
          />
          Include in Australia pack
        </label>

        {store && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
              className="h-4 w-4 accent-gloria-accent"
            />
            Archived (hidden from lists & reports)
          </label>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!name.trim()}
            onClick={() =>
              onSave({
                name: name.trim(),
                category,
                australia: australia ? 1 : 0,
                archived: archived ? 1 : 0,
                address: address.trim(),
                phone: phone.trim(),
                profile_notes: profileNotes.trim()
              })
            }
            className="rounded-md bg-gloria-accent px-5 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
          >
            {store ? 'Save' : 'Add store'}
          </button>
        </div>
      </div>
    </div>
  )
}
