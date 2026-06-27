# Cafe Studio — Complete App Overview

Technical and functional documentation for the **Cafe Studio** desktop application:
the back-office system for **Gloria Jean's Coffee South Africa** that consolidates the
Head Office (franchise company, GJC SA) and each store into one local app.

> For a non-technical, step-by-step guide, see **[USER_MANUAL.md](USER_MANUAL.md)**.

---

## 1. What it is

A single Windows desktop app that replaces a folder full of spreadsheets. It holds, in
one local database:

- Each store's **monthly figures** (turnover, purchases, transactions, royalties, the 1% due to Australia, consumption).
- A monthly **admin checklist** (month-end tasks).
- **Cash-up / petty-cash** purchases and daily reconciliation against payout vouchers.
- **Creditors & Debtors** — kept separately for Head Office and each store.
- **Payroll** and **Stock takes**, per entity.
- A **document archive** with AI extraction of receipts/invoices.
- **Reports** (Head Office / Franchise / Australia packs) for printing, PDF or HTML.

### Core design principles
1. **Head Office vs Store separation.** The Head Office (the franchise company) and each store are modelled as **separate entities/ledgers**. Creditors, debtors, payroll and stock takes all carry an entity dimension (`entity_store_id`: `NULL`/`0` = Head Office, otherwise a store id). This makes intercompany balances correct on both sides (a store owing Head Office is a Head Office debtor *and* a store creditor).
2. **Totals are computed from line items.** The app never trusts a spreadsheet's "total" cell — it re-sums the underlying lines. This makes it **immune to formula errors in the source spreadsheets** (see §9, Audit).
3. **Local-first & private.** All data is stored locally in SQLite. The only thing ever sent off the machine is a document you explicitly choose to read with AI.
4. **Idempotent imports.** Every importer can be re-run safely — it refreshes imported rows without creating duplicates, and never touches manual entries.

---

## 2. Technology stack

| Layer | Technology |
|---|---|
| Shell | **Electron 33** (main + preload + renderer processes) |
| UI | **React 18** + **TypeScript** + **Tailwind CSS** |
| Build / dev | **electron-vite**; packaged with **electron-builder** |
| Database | **SQLite** via **better-sqlite3** (synchronous, in the main process) |
| Spreadsheets | **xlsx** (SheetJS) for reading `.xlsx`/`.xls` |
| AI extraction | **@anthropic-ai/sdk** — Claude vision, model `claude-opus-4-8`, forced tool output for structured JSON |
| Secrets | Electron **safeStorage** (OS-level encryption) for the API key |

### Process model
- **Main process** (`src/main`) owns the database, file system, dialogs, importers and AI calls.
- **Preload** (`src/preload`) exposes a typed, namespaced bridge as `window.gloria.*` (contextIsolation on).
- **Renderer** (`src/renderer`) is the React UI; it never touches the DB or fs directly — only via IPC.

---

## 3. Project structure

```
gloria/
├─ src/
│  ├─ main/
│  │  ├─ index.ts                 App/window lifecycle
│  │  ├─ db.ts                    SQLite open + migrations (user_version)
│  │  ├─ ipc.ts                   All ipcMain handlers
│  │  ├─ repositories/            Data access (one file per domain)
│  │  │  ├─ stores.ts             Stores + monthly_store_data
│  │  │  ├─ tasks.ts              Month-end tasks
│  │  │  ├─ documents.ts          Document archive
│  │  │  ├─ cash.ts               Cash-up payouts + declarations
│  │  │  ├─ ledger.ts             Creditors & debtors
│  │  │  ├─ stock.ts              Stock takes
│  │  │  ├─ payroll.ts            Payroll
│  │  │  └─ reports.ts            Report aggregation
│  │  └─ services/
│  │     ├─ import-archive.ts     One-click archive import (sales/VAT/consumption/stock)
│  │     ├─ import-ledgers.ts     Creditors Schedule import
│  │     ├─ import-cash.ts        AI cash-up slip import
│  │     ├─ extract.ts            Claude document extraction
│  │     └─ apikey.ts             Encrypted API-key storage
│  ├─ preload/index.ts            window.gloria.* bridge
│  ├─ renderer/src/
│  │  ├─ App.tsx                  Page router + layout
│  │  ├─ navigation.ts            Sidebar items / PageId
│  │  ├─ pages/                   One component per module
│  │  └─ components/              Shared UI
│  └─ shared/
│     ├─ types.ts                 Types shared main↔renderer
│     ├─ defaults.ts              Seed data, formatZar()
│     └─ report-html.ts           Printable report template
├─ USER_MANUAL.md
├─ APP_OVERVIEW.md  (this file)
└─ release/                       Packaged installers
```

---

## 4. Data model (SQLite)

The schema is versioned through a **migrations array** in `src/main/db.ts`, tracked by SQLite's `user_version`. Current version: **v8** — **10 tables**.

| Table | Purpose | Key columns |
|---|---|---|
| `app_meta` | Key/value app state | `key`, `value` |
| `tasks` | Month-end checklist | `period` (YYYY-MM), `title`, `done`, `note` |
| `stores` | Store master | `name`, `category` (head_office/franchise), `in_australia_pack`, `archived`, `address`, `phone`, `profile_notes` |
| `monthly_store_data` | Per store, per month | `store_id`, `period`, `sales`, `purchases`, `turnover`, `transactions`, `royalty`, `marketing`, `royalty_au`, `consumption`, `note` |
| `documents` | Uploaded files + extraction | `filename`, `store_id`, `period`, `status`, extracted fields, archived path |
| `cash_payouts` | Petty-cash purchase lines | `store_id`, `period`, `date`, `supplier`, `description`, `excl_vat`, `vat`, `incl` |
| `cash_declarations` | Daily payout-voucher totals | `store_id`, `date`, `declared_total`, `declared_tips` |
| `ledger_items` | Creditors & debtors | `kind` (creditor/debtor), `entity_store_id` (NULL=HO), `party`, `invoice_no`, `total_incl`, `vat`, `excl_vat`, `paid`, `source` |
| `stock_takes` | Stock-take snapshots | `entity_store_id` (NULL=HO), `take_date`, `total_value`, `item_count`, `source` |
| `payroll` | Pay per employee/month | `entity_store_id` (NULL=HO), `period`, `employee`, `emp_no`, `gross`, `net`, `note` |

### The entity dimension
`ledger_items`, `stock_takes` and `payroll` use `entity_store_id` where **`NULL` (API value `0`) = Head Office**, and any other value is a store id. Repositories translate API `0` → SQL `entity_store_id IS NULL`.

### Where the database lives
`%APPDATA%\gloria-admin\gloria.db` — shared by the dev build and the packaged exe. Backups are plain copies of this single file.

---

## 5. Modules (the 10 pages)

Each page lives in `src/renderer/src/pages/`. Keyboard shortcuts **Ctrl+1…9** jump to the first nine; Settings is reached by clicking.

| # | Page | Summary |
|---|---|---|
| 1 | **Dashboard** | Month-end progress %, DB status, quick actions, recent activity feed. |
| 2 | **Month End** | Per-month task list (seeded with 15 standard tasks), add/edit/complete/note, hide-completed, progress bar. |
| 3 | **Stores** | Store list grouped HO/Franchise; per store/month figures + the imported extras; add/edit/archive; profile fields (address/phone/notes). |
| 4 | **Cash-Up** | Per store/month petty-cash purchase lines + automatic totals; **daily reconciliation** of summed till slips vs the payout voucher's declared total (match / mismatch + variance); AI slip reader. |
| 5 | **Creditors & Debtors** | Entity selector (HO + each store) × Creditors/Debtors tabs; grouped by party, sorted by amount owed; totals (invoiced/paid/outstanding); mark-paid; import. |
| 6 | **Payroll** | Entity × month employee register (gross/net) with totals; manual entry (AI payslip path available via Documents). |
| 7 | **Stock Take** | Entity stock-take snapshots (date/value/items); latest highlighted; manual add + archive import. |
| 8 | **Documents** | Upload receipts/invoices/spreadsheets; AI extraction; review → apply to store figures/tasks; original archived. |
| 9 | **Reports** | Head Office / Franchise / Australia packs; summary cards + per-store breakdown; Print / PDF / HTML export. |
| 10 | **Settings** | Dark mode; AI API key (encrypted); Import from archive; backup/restore DB; keyboard-shortcut reference; about. |

Top bar everywhere: **search** (Ctrl+K) and **dark/light toggle** (Ctrl+D).

---

## 6. Importers

All importers walk a chosen folder, match files by filename pattern, parse with **keyword-based column detection** (robust to varying layouts), and are **idempotent**.

### 6.1 Archive import — `import-archive.ts` (Settings → Import from archive)
Recognises four file families anywhere under the chosen folder:

| File pattern | Reads → writes |
|---|---|
| `…MONTHLY STORE SALES <year>.xlsx` | Section headers in column A (Turnover / Transactions / Royalties Due to Aus / Royalties Invoiced) → `turnover`, `transactions`, `royalty_au`, `royalty` per store/month. |
| `…Sales & Purchases Journal- <Month> <Year>.xlsx` | Sales sheet, store rows summed by name → store `purchases`. |
| `…Consumption Analysis <Month> <Year>.xlsx` | Per item, `retail price × store qty` summed per store → `consumption`. Scans the **whole sheet** for the header (sheets have blank leading rows). |
| `…Stock Sheet - DD.MM.YYYY.xlsx` | Sum of the "Rand Value" column (excluding the Total row) → a `stock_takes` snapshot for Head Office. |

### 6.2 Ledger import — `import-ledgers.ts` (Creditors & Debtors → Import from schedule)
Finds the **latest** `Creditors Schedule- DD.MM.YYYY.xlsx` and maps its sheets:
- `Creditors` → Head Office creditors.
- `<Store> Creditors` (e.g. *Oceans Mall Creditors*) → that store's creditors.
- `<Store> Debtors` → Head Office debtors with `party` = the store.

Also reads `Oceans Mall Payment Recon.xlsx` (Supplier | Invoice | Total | Paid | Owing) for paid balances. Header detection requires a row to have **both** an amount/total column **and** a key column (creditor/invoice/date) — this skips sheet *title* rows that merely contain the word "creditors".

### 6.3 AI imports
- **Documents** — receipts/invoices/PDFs → extracted fields for review.
- **Cash-Up** — `import-cash.ts` reads till-slip and payout-voucher photos, posting purchase lines and the day's declared total.

---

## 7. AI document extraction

`src/main/services/extract.ts` calls Claude (`claude-opus-4-8`) with the document image and a **forced tool call**, so the response is always structured JSON (supplier, date, amounts, store hint, cash role, etc.). Spreadsheets are parsed locally and need no AI.

- The **API key** is entered in Settings and stored **encrypted** via Electron `safeStorage` (`apikey.ts`) — never in plain text, never committed.
- Without a key, image/PDF reading shows a friendly prompt; all spreadsheet imports and manual entry continue to work.

---

## 8. Reports

`src/shared/report-html.ts` renders a **self-contained HTML document** used for Print, PDF and HTML export, and mirrored by the in-app preview (`Reports.tsx`). Each pack (`head_office` / `franchise` / `australia`) gets:
- A branded header with title, period and generated-date.
- A **plain-language note** explaining what the pack covers.
- Four **summary cards** (Total Turnover, Purchases, Royalties, Due to Australia).
- A **per-store breakdown** table (Turnover / Purchases / Royalty / To Australia) with a totals row that ties to the cards.

The Australia pack includes only stores flagged `in_australia_pack`. Report figures are aggregated in `reports.ts` from `monthly_store_data`.

---

## 9. Data integrity & audit

A full reconciliation was run against the source spreadsheets (2026-06-24). The app's figures were compared to **each sheet's own totals**:

- ✅ Australia 1% royalty — matches for every store.
- ✅ All 8 imported stock takes — tie to the cent.
- ✅ Head Office creditors (R36,749.88) and store debtors (e.g. Gateway R274,675.82) — exact.
- ✅ Consumption — `Σ(price × qty)` equals each sheet's own Total rows.

Two findings of note:
- **Bug fixed (our code):** the consumption importer originally searched only the first few rows for the header, but those sheets carry blank leading rows, so it had imported **zero**. It now scans the whole sheet. (The ledger header search was hardened the same way.)
- **Error in a source spreadsheet:** in `MONTHLY STORE SALES 2025`, the **February total cell** omits two stores and is **R113,328 short**. Because the app re-sums the store lines, **it reports the correct figure** — a concrete example of principle §1.2.

---

## 10. Build, run & package

```bash
npm install            # one-time

npm run dev            # hot-reloading dev app (electron-vite)
npm run typecheck      # tsc for node + web projects (no emit)
npm run build          # production build into out/
npm run dist           # build + electron-builder → release/*.exe
```

Outputs in `release/`:
- `Gloria-Admin-Portable-0.1.0.exe` — runs without installing.
- `Gloria-Admin-Setup-0.1.0.exe` — NSIS installer (desktop + Start-menu shortcuts).

### Operational notes
- **`ELECTRON_RUN_AS_NODE`** must **not** be set in the environment, or the app launches as plain Node and shows no window. Clear it before launching.
- If `electron-vite preview` complains about an entry point, ensure the shell's working directory is the project root and launch the built app directly via `node_modules\electron\dist\electron.exe .`.
- Code signing is skipped (no paid certificate), so Windows SmartScreen warns once on first run.

---

## 11. Known limitations & roadmap

- **Payroll & document vault** are built, but the per-employee **timesheet** workbooks are not yet auto-parsed — pay is entered manually or via payslip-photo AI.
- **VAT submission** is not yet its own formal return report — the underlying sales/purchase figures are captured and available in reports.
- **GAAP sales cash-up (Z-read)** reports are uploaded by the user at month-end and seeded then, by design.
- Reports currently cover the three packs; additional management dashboards (trends, year-on-year) are candidates for a future iteration.

---

*Cafe Studio — internal back-office system for Gloria Jean's Coffee South Africa. v0.1.0.*
