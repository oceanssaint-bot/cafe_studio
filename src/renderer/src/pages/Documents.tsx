import { useCallback, useEffect, useState } from 'react'
import DocumentReview from './documents/DocumentReview'
import Spinner from '../components/Spinner'
import { useNav } from '../context/NavContext'
import { useActivity } from '../context/ActivityContext'
import { formatZar } from '../../../shared/defaults'
import type { AppDocument, Store, ApiKeyStatus } from '../../../shared/types'

const STATUS_STYLES: Record<AppDocument['status'], string> = {
  pending: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  extracted: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  applied: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
}

const STATUS_LABEL: Record<AppDocument['status'], string> = {
  pending: 'Pending',
  extracted: 'Needs review',
  applied: 'Applied',
  error: 'Error'
}

export default function Documents(): JSX.Element {
  const { navigate } = useNav()
  const { run } = useActivity()
  const [docs, setDocs] = useState<AppDocument[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [keyStatus, setKeyStatus] = useState<ApiKeyStatus | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    const list = await window.gloria.documents.list()
    setDocs(list)
    setSelectedId((id) => id ?? list[0]?.id ?? null)
  }, [])

  useEffect(() => {
    refresh()
    window.gloria.stores.list().then(setStores)
    window.gloria.apikey.status().then(setKeyStatus)
  }, [refresh])

  // Live elapsed-seconds counter so the user can see the AI read is actually working.
  useEffect(() => {
    if (!uploading) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [uploading])

  async function upload(): Promise<void> {
    setUploading(true)
    const created = await run('Reading document(s) with AI', () => window.gloria.documents.upload())
    setUploading(false)
    if (!created) return
    await refresh()
    if (created.length > 0) setSelectedId(created[0].id)
  }

  async function remove(id: number): Promise<void> {
    await window.gloria.documents.remove(id)
    setSelectedId((cur) => (cur === id ? null : cur))
    refresh()
  }

  const selected = docs.find((d) => d.id === selectedId) ?? null

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gloria-brown dark:text-gloria-cream">
            Documents
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Upload receipts, invoices and spreadsheets — figures are read out and filled in for you.
          </p>
        </div>
        <button
          type="button"
          onClick={upload}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
        >
          {uploading && <Spinner />}
          {uploading ? 'Reading…' : 'Upload files'}
        </button>
      </header>

      {uploading && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-gloria-accent/40 bg-gloria-accent/5 px-4 py-3">
          <Spinner className="h-5 w-5 text-gloria-accent" />
          <div>
            <p className="text-sm font-medium text-gloria-brown dark:text-gloria-cream">
              Reading your document(s) with AI… {elapsed}s
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Claude is extracting the figures — this usually takes 20–60 seconds. Keep the app open; you
              can carry on working elsewhere.
            </p>
          </div>
        </div>
      )}

      {keyStatus && !keyStatus.set && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          Add an Anthropic API key in{' '}
          <button
            type="button"
            onClick={() => navigate({ page: 'settings' })}
            className="font-semibold underline"
          >
            Settings
          </button>{' '}
          to read receipts and invoices automatically. Spreadsheets work without a key.
        </div>
      )}

      {docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-12 text-center dark:border-slate-700 dark:bg-slate-800/40">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No documents yet. Click <span className="font-medium">Upload files</span> to add receipts,
            invoices (images/PDF) or spreadsheets.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[18rem_1fr]">
          {/* Document list */}
          <ul className="space-y-1.5">
            {docs.map((d) => {
              const active = d.id === selectedId
              const total = d.sales + d.purchases + d.turnover
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={[
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      active
                        ? 'border-gloria-accent bg-white dark:bg-slate-800'
                        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800'
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                        {d.supplier || d.filename}
                      </span>
                      <span
                        className={[
                          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium',
                          STATUS_STYLES[d.status]
                        ].join(' ')}
                      >
                        {STATUS_LABEL[d.status]}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                      <span className="truncate">{d.doc_date || d.kind}</span>
                      {total > 0 && <span className="shrink-0">{formatZar(total)}</span>}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Review panel */}
          {selected ? (
            <div>
              <DocumentReview
                key={selected.id}
                doc={selected}
                stores={stores}
                onApplied={refresh}
                onChanged={refresh}
              />
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => remove(selected.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Delete document
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Select a document to review.</p>
          )}
        </div>
      )}
    </div>
  )
}
