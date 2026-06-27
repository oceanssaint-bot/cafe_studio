import { useEffect, useState } from 'react'
import PagePlaceholder from '../components/PagePlaceholder'
import { useTheme } from '../context/ThemeContext'
import { useActivity } from '../context/ActivityContext'
import { formatZar } from '../../../shared/defaults'
import type { AppInfo, DbStatus, ApiKeyStatus, ImportSummary, Store } from '../../../shared/types'

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'Ctrl + 1…9', action: 'Switch between pages' },
  { keys: 'Ctrl + K', action: 'Search tasks and stores' },
  { keys: 'Ctrl + D', action: 'Toggle dark mode' }
]

export default function Settings(): JSX.Element {
  const { theme, toggle } = useTheme()
  const { run } = useActivity()
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [busy, setBusy] = useState<null | 'backup' | 'restore'>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [keyStatus, setKeyStatus] = useState<ApiKeyStatus | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [keyMsg, setKeyMsg] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportSummary | null>(null)

  useEffect(() => {
    window.gloria.getAppInfo().then(setInfo).catch(() => setInfo(null))
    window.gloria.getDbStatus().then(setStatus).catch(() => setStatus(null))
    window.gloria.apikey.status().then(setKeyStatus).catch(() => setKeyStatus(null))
  }, [])

  async function saveKey(): Promise<void> {
    if (!keyInput.trim()) return
    const status = await window.gloria.apikey.set(keyInput.trim())
    setKeyStatus(status)
    setKeyInput('')
    setKeyMsg('Key saved.')
  }

  async function clearKey(): Promise<void> {
    const status = await window.gloria.apikey.clear()
    setKeyStatus(status)
    setKeyMsg('Key removed.')
  }

  async function runImport(): Promise<void> {
    setImporting(true)
    setImportResult(null)
    const result = await run('Importing from archive', () => window.gloria.importArchive())
    if (result) setImportResult(result)
    setImporting(false)
  }

  async function backup(): Promise<void> {
    setBusy('backup')
    setMessage(null)
    const res = await run('Backing up database', () => window.gloria.backup.create())
    if (res?.error) setMessage(`Backup failed: ${res.error}`)
    else if (res?.saved && res.path) setMessage(`Backed up to ${res.path}`)
    else if (res) setMessage('Backup cancelled.')
    setBusy(null)
  }

  async function restore(): Promise<void> {
    setBusy('restore')
    setMessage(null)
    // On success the app relaunches, so this only returns on cancel/error.
    const res = await run('Restoring database', () => window.gloria.backup.restore())
    if (res?.error) setMessage(`Restore failed: ${res.error}`)
    else if (res && !res.saved) setMessage('Restore cancelled.')
    setBusy(null)
  }

  return (
    <PagePlaceholder title="Settings" description="Application preferences and database.">
      {/* Appearance */}
      <Card title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Dark mode</p>
            <p className="text-xs text-slate-400">Currently {theme}. Toggle with Ctrl+D.</p>
          </div>
          <button
            type="button"
            onClick={toggle}
            className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown"
          >
            {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          </button>
        </div>
      </Card>

      {/* AI document reading */}
      <Card title="Document reading (AI)">
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          To read receipts and invoices automatically, paste an Anthropic API key. It is stored
          {keyStatus?.encryptionAvailable ? ' encrypted ' : ' '}on this computer only and used to
          send documents to Claude for extraction. Spreadsheets are read locally and need no key.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={keyStatus?.set ? '•••••••• (key saved)' : 'sk-ant-…'}
            className="min-w-[16rem] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
          />
          <button
            type="button"
            onClick={saveKey}
            disabled={!keyInput.trim()}
            className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
          >
            Save key
          </button>
          {keyStatus?.set && (
            <button
              type="button"
              onClick={clearKey}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Remove
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {keyStatus?.set ? 'A key is saved. ' : 'No key saved. '}
          {keyMsg}
          {keyStatus && !keyStatus.encryptionAvailable && (
            <span className="text-amber-600">
              {' '}
              OS encryption unavailable — the key is stored as plain text.
            </span>
          )}
        </p>
      </Card>

      {/* Bulk import from archive */}
      <Card title="Import from archive">
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Pull your existing spreadsheets into the app in one go. Point it at your admin folder and
          it reads every yearly “Monthly Store Sales” workbook (turnover, transactions, royalties)
          and every VAT “Sales &amp; Purchases Journal” (store purchases), creating stores as needed.
          Safe to re-run — it refreshes the figures.
        </p>
        <button
          type="button"
          onClick={runImport}
          disabled={importing}
          className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
        >
          {importing ? 'Importing…' : 'Choose folder & import'}
        </button>
        {importResult && !importResult.cancelled && (
          <div className="mt-3 rounded-md bg-emerald-50 px-4 py-3 text-xs text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
            <p className="font-medium">Imported {importResult.filesScanned} files.</p>
            <ul className="mt-1 space-y-0.5">
              <li>Years: {importResult.years.join(', ') || '—'}</li>
              <li>Store/month figures updated: {importResult.monthsImported}</li>
              <li>Total turnover read: {formatZar(importResult.turnoverTotal)}</li>
              <li>Total purchases read: {formatZar(importResult.purchasesTotal)}</li>
              {!!importResult.stockTakes && <li>Stock takes imported: {importResult.stockTakes}</li>}
              {importResult.storesCreated.length > 0 && (
                <li>Stores added: {importResult.storesCreated.join(', ')}</li>
              )}
              {importResult.warnings.length > 0 && (
                <li className="text-amber-600">{importResult.warnings.length} warning(s)</li>
              )}
            </ul>
          </div>
        )}
        {importResult?.cancelled && (
          <p className="mt-2 text-xs text-slate-400">Import cancelled.</p>
        )}
      </Card>

      {/* Billing emails */}
      <BillingEmailsCard />

      {/* Database backup */}
      <Card title="Database">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={backup}
            disabled={busy !== null}
            className="rounded-md bg-gloria-accent px-4 py-2 text-sm font-medium text-white hover:bg-gloria-brown disabled:opacity-50"
          >
            {busy === 'backup' ? 'Backing up…' : 'Backup database'}
          </button>
          <button
            type="button"
            onClick={restore}
            disabled={busy !== null}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {busy === 'restore' ? 'Restoring…' : 'Restore from backup'}
          </button>
          {message && (
            <span className="ml-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {message}
            </span>
          )}
        </div>
        <p className="mt-2 break-all text-xs text-slate-400">{status?.path}</p>
      </Card>

      {/* Keyboard shortcuts */}
      <Card title="Keyboard shortcuts">
        <dl className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between text-sm">
              <dt className="text-slate-600 dark:text-slate-300">{s.action}</dt>
              <dd>
                <kbd className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {s.keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* About */}
      <Card title="About">
        <dl className="space-y-1.5 text-sm">
          <Row label="Application" value={info?.name ?? '—'} />
          <Row label="Version" value={info?.version ?? '—'} />
          <Row label="Platform" value={info?.platform ?? '—'} />
        </dl>
      </Card>
    </PagePlaceholder>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-3 text-sm font-semibold text-gloria-brown dark:text-gloria-cream">
        {title}
      </h3>
      {children}
    </section>
  )
}

function BillingEmailsCard(): JSX.Element {
  const [stores, setStores] = useState<Store[]>([])
  const [saved, setSaved] = useState<number | null>(null)

  useEffect(() => {
    window.gloria.stores.list(false).then(setStores).catch(() => setStores([]))
  }, [])

  async function save(id: number, email: string): Promise<void> {
    await window.gloria.stores.setBillingEmail(id, email)
    setSaved(id)
    setTimeout(() => setSaved((s) => (s === id ? null : s)), 1500)
  }

  return (
    <Card title="Billing emails">
      <p className="mb-3 text-xs text-slate-400">
        Where each store&apos;s royalty invoice is emailed from the Dashboard “Export &amp; email”.
      </p>
      <div className="space-y-2">
        {stores.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <span className="w-40 shrink-0 truncate text-sm text-slate-600 dark:text-slate-300">
              {s.name}
            </span>
            <input
              type="email"
              defaultValue={s.billing_email}
              placeholder="billing@store.co.za"
              onBlur={(e) => save(s.id, e.target.value)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-gloria-accent focus:outline-none dark:border-slate-600 dark:bg-slate-900"
            />
            <span className="w-12 shrink-0 text-xs text-emerald-600">
              {saved === s.id ? 'Saved' : ''}
            </span>
          </div>
        ))}
        {stores.length === 0 && <p className="text-sm text-slate-400">No stores yet.</p>}
      </div>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  )
}
