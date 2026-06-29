# Gloria Admin — Engineering & Build Log

A running record of **how this system is built, why, and how we got here** — so if anything
goes wrong we know exactly where we are and how to recover. Newest entries at the top of the
Session Log. See also [USER_MANUAL.md](USER_MANUAL.md) and [APP_OVERVIEW.md](APP_OVERVIEW.md).

---

## 1. How to run / recover (the essentials)

```bash
npm install            # one-time
npm run typecheck      # tsc (node + web) — run before building
npm run build          # production build into out/  (dev verification)
# launch the built app directly (most reliable):
node_modules\electron\dist\electron.exe .
npm run dist           # package the .exe — ONLY at hand-over (see gotchas)
```

- **Live database:** `%APPDATA%\gloria-admin\gloria.db` (shared by dev + packaged app).
- **Backups:** `C:\Users\Oceans\Desktop\gloria-data-backup\gloria-LIVE-*.db` — copy the live DB here before any risky change. To restore: close the app, copy a backup over the live DB.
- **Admin archive (source files):** `C:\Users\Oceans\Desktop\gloria\2026` (4,739 files).

## 2. Hard-won gotchas (READ before debugging)

| Symptom | Cause | Fix |
|---|---|---|
| App launches with **no window** | `ELECTRON_RUN_AS_NODE=1` set in env | `Remove-Item Env:\ELECTRON_RUN_AS_NODE` before launching. (We *use* that flag deliberately to run seed/catalog scripts as node with the right better-sqlite3 ABI.) |
| Bulk file op **hangs for minutes** | Desktop is **OneDrive Files-On-Demand**; reading file *content* hydrates every placeholder | **Never read content in bulk.** Classify via `statSync` metadata only. |
| `electron-vite preview` "entry point required" | shell cwd drifted into a subfolder | `Set-Location` to project root; launch the built electron directly. |
| Seeding DB from a script fails to load better-sqlite3 | plain node has wrong ABI | run via `ELECTRON_RUN_AS_NODE=1 electron.exe script.js` |
| `.exe` build each change | wastes time/tokens while iterating | only `npm run dist` at hand-over. |

## 3. Data model — migration history (`src/main/db.ts`, tracked by `user_version`)

- v1 app_meta · v2 tasks · v3 stores · v4 monthly_store_data · v5 store-name reconcile
- v6 cash_payouts + cash_declarations (Cash-Up) · v7 ledger_items (Creditors/Debtors)
- v8 consumption + store profile + stock_takes + payroll
- v9 turnover_daily (POS) · **v10** cash_payouts.kind adds `invoice` · **v11** `file_catalog`

## 4. Patterns that make processing & data easy (reuse these)

- **Importers** walk a folder, match files by filename regex, parse xlsx with *keyword-based column detection* (robust to layout drift), and are **idempotent** (clear `source='import'` rows then re-insert; manual rows preserved). Header search scans the **whole sheet** (sheets often have blank leading rows).
- **Entity dimension** `entity_store_id` (NULL/0 = Head Office) on ledgers/stock/payroll — keeps Head Office and each store as separate books.
- **Totals from line items**, never from a spreadsheet's total cell → immune to source formula errors (e.g. the Feb-2025 R113k total bug the app silently corrects).
- **File Catalog** (`file_catalog`) is the registry of every archive file; `ingested`/`module` columns mark which files have been parsed into a module. Re-runs are incremental (skip unchanged by size+mtime).
- **Standalone scripts** (cash seed, catalog run) live in the session scratchpad and run via Electron-as-Node for observable, non-blocking bulk operations.

## 5. The 2026 archive — forensic map (13 departments, 4,739 files, 689.7 MB)

| Department | Files | What it is | Status |
|---|---|---|---|
| Debtors | 3033 | store invoices (INVF/INVO) + GJC **Statements of Account** + delivery forms | cataloged; extraction TODO |
| Royalties SA | 538 | royalty invoices + **Royalties Breakdown** ledger (8%/2.5%, Paid/Unpaid) | cataloged; extraction in progress |
| Oceans Mall | 334 | store back-office | cash-up ingested; rest cataloged |
| Creditors Schedule | 304 | weekly schedules 2020–26 | latest ingested (balances) |
| Staff Hours | 280 | WAGES timesheets per store/month | cataloged; payroll extraction TODO |
| Store Purchases | 77 | per-store purchase ledger (Date/Inv/Supplier/Excl/VAT/Incl) | cataloged; extraction TODO |
| Store Sales | 56 | per-store sales | cataloged |
| Turnover Reports | 37 | daily POS by store | module built, parked |
| Vat Submission | 34 | Sales & Purchases Journals | purchases ingested |
| GJC Aus Account | 16 | royalty + stock transaction ledgers (USD) — the 1% to Australia | cataloged; extraction TODO |
| MONTHLY STORE SALES | 11 | master sales workbooks | ingested (turnover/royalty) |
| Head Office Stock Take | 10 | stock sheets | ingested |
| Consumption Analysis | 8 | per-item consumption | ingested |

---

## 6. Session log

### 2026-06-26 — Two-office split (Phase A: mode toggle)
- App now operates as two "offices": **Oceans Mall (Store)** and **Franchise Office (Head Office)**, toward a sellable per-store edition reporting up to HO (see memory [[two-office-split]]).
- `navigation.ts`: each nav item tagged `modes: ('store'|'franchise')[]` + `navForMode()`. `context/OfficeModeContext.tsx` (localStorage-persisted, default 'store'). Sidebar shows an office switcher + mode-filtered nav; title/subtitle change per office. `pages/StoreDashboard.tsx` (Oceans Mall overview: turnover/purchases/payroll/stock/month-end/owed-to-HO); existing `Dashboard.tsx` is the franchise dashboard. App.tsx: Ctrl+1-9 use the active mode's nav; switching office guards the active page (falls back to dashboard).
- Store nav: Dashboard, Month End, Cash-Up, Creditors/Debtors, Payroll, Stock, Turnover, Purchases, Documents, Records, Reports, Settings. Franchise nav adds Stores, Royalties, Statements, GJC Aus (no Cash-Up). UI-only, no DB change.
- **Seeding (Oceans → Store side):** `repositories/store-overview.ts` (`getStoreOverview`/`listStorePeriods`) consolidates Oceans data live from monthly_store_data + cash_payouts + payroll + royalty_invoices; StoreDashboard rewritten with a month selector (defaults to latest active month). Verified: May 2026 shows turnover R60,093.65 / purchases R22,796.17 / payroll R28,605.44 / owed-to-HO R7,256.30; June shows the R19,090 cash-up. No duplication.
- **Phase B (store→HO hand-off):** `services/store-pack.ts` — `exportStorePack` (Store dashboard "Export pack → HO" writes a JSON pack) + `importStorePack` (franchise Dashboard "Import store pack" → `saveMonthlyData` upsert, which feeds royalty generation/consolidation). Pack `{gloriaPack:1, store, period, turnover, sales, purchases, cashup, payrollGross, payrollCount}`. Round-trip verified end-to-end (export→file→import→monthly_store_data).
- **Store-mode scoping (polish):** `hooks/useStoreScope.ts` (`{storeMode, oceansId}`). In Store mode, Purchases/Cash-Up/Payroll/Stock Take/Creditors&Debtors lock to Oceans Mall (picker hidden → name label), Turnover filters to Oceans rows, and the HO stock-reconciliation panel is hidden. Franchise mode keeps all pickers. Verified live (store Payroll shows "Oceans Mall", no entity selector).
- **Reports → franchise-only:** a store doesn't generate HO/Franchise/Aus packs — it reports up via Export-pack→HO. Removed Reports from store nav; StoreDashboard quick action now "Export pack → HO". "Bills from Head Office" covered by the dashboard Owed-to-HO card + scoped Creditors&Debtors. Verified: store nav has no Reports; franchise keeps it.
- **Next (Phase C, productization, deferred):** fork Store into a standalone sellable edition + package (skip `npm run dist` until handover); remaining per-store scoping (Records/Documents show all files in store mode; a printable single-store P&L report).

### 2026-06-26 — Stock Reconciliation (updated stock take)
- **Migration v20:** `stock_sheet_lines` (itemised HO stock counts) + `stock_out_lines` (itemised HO→store invoice lines).
- Importers `services/import-stock-sheets.ts` (GJC SA Stock Sheet files; date from filename) + `import-stock-invoices.ts` (INV* tax invoices under Debtors; itemised # | Item | Qty | Rate | Amount). Repo `repositories/stock-recon.ts` matches invoice lines → stock items by **name-token overlap + Rate≈Retail Price** at query time, against the latest baseline count; excludes non-stock (Swarm Rewards, Royalty Fees, Pamphlets, Uniform).
- **Stock Take page** gains an "Updated Stock Take — Head Office" panel: import buttons, **as-of date picker** (roll the count forward to any date), summary cards, item table with red negatives + "not counted"/"sold > count" status, and **Export to Excel** (`exportStockReconExcel`).
- Formula = last count − sold since (HO not restocking; `+ purchases in` term reserved for future). Verified live: baseline 31.10.2025 → 26.06.2026, **opening R640,456 − sold R251,110 = remaining R456,622**, 97% matched, 19/108 flagged verify.
- Gotcha fixed: Gateway invoices are `INVG-####` (hyphen) — file filter widened to `^inv[a-z]*[-\s]?\d`.
- **DB now at v20 / 19 tables.**

### 2026-06-25 — Phase 4b (Staff Hours + GJC Aus) + Phase 6 (send automation)
- **Staff Hours → Payroll** (migration v16: `payroll.source`). Importer `services/import-staff-hours.ts` reads each WAGES workbook's **SUMMARY** sheet (gross = the Total column before "Deductions"; net = the last Total). "Import staff hours" button on the Payroll page. Imported **91 files → 450 staff-months, gross R2,807,276** (Florida/Oceans/Pavilion/Head Office). Re-import safe (source='import-wages', never wipes manual rows).
- **GJC Australia Account** (migration v17: `aus_account_lines`). Importer `services/import-aus.ts` parses the two USD transaction ledgers (royalty O7103, stock O7110) by header keyword; repo `repositories/aus.ts`; new **GJC Aus** page (Ctrl+12) with charged/paid/balance cards + royalty/stock filter. **80 transactions → net US$96,625 owed** (royalty −$29,980, stock +$126,605).
- **Phase 6 — send automation** (migration v18: `royalty_invoices.sent`+`sent_at`). Dashboard now has a **"Ready to send"** queue (approved & unsent) with **"Export all to folder (PDF)"** → `exportApprovedInvoices()` batch-renders each invoice PDF into a chosen folder, marks them sent, and opens the folder ready to email. Repo `listApprovedUnsent`/`markInvoicesSent`.
- Verified: approve→ready-to-send works in UI; PDF pipeline (DB query → printToPDF → writeFile) confirmed writing a real 31.5 KB invoice PDF. (Native folder-picker can't be driven by the test harness, but the mechanism is proven.)
- **One-click email** (migration v19: `stores.billing_email`). Dashboard "Ready to send" now has **Export to folder** + **Export & email**; the latter (`emailApprovedInvoices`) exports each PDF, marks sent, opens the folder, and opens a pre-filled draft in the default mail app (`shell.openExternal` mailto) for every store with a billing email — reporting any stores missing one. Billing emails are edited in **Settings → Billing emails** (`stores:setBillingEmail`, save on blur). Verified: email saves and persists (Gateway North). mailto/folder launch not triggered in automation (would open the mail client), but mechanism is standard.
- **DB now at v19 / 17 tables.**

### 2026-06-25 — Phase 4b: Store Purchases journal + address fix + SARS rule
- **HO address** completed with the Postnet postal line on invoices + statements: 707 Currie Road, Windermere, Durban / Postnet Suite 223, Private Bag X10, Musgrave Road, 4062.
- **BUSINESS RULE (memory [[oceans-mall-only-sars]]):** only **Oceans Mall** is SARS/VAT-submitted; other stores' purchases are invoicing/record-keeping only — do not over-build per-store SARS.
- Migration **v15**: `store_purchase_lines` (Date/Invoice/Supplier/Description/Excl/VAT/Incl). Importer `services/import-purchases.ts` + repo `repositories/purchases.ts` + **Purchases** page (Ctrl+9, store+period pickers, totals, supplier detail). Imported **77 files, 4,535 lines, R11,671,720** (Florida R3.44m, Pavilion R4.18m, Oceans R4.05m).
- **Bug fixed:** store matching used the absolute path, which contains the Windows username "Oceans" → everything mis-mapped to Oceans Mall. Fixed to match on the path **relative to the chosen root** (applies to any path-based store detection).

### 2026-06-25 — Invoice generator + Dashboard approval queue
- Migration **v14**: `royalty_invoices.approved` flag + `statement_accounts.customer_code`.
- **Invoice generator** `shared/invoice-html.ts` renders a GJC royalty TAX INVOICE in the official template (logo, company header, Bill To, Royalties Fee + Marketing Fee with Amount/VAT/Total, grand total, banking details). Export/preview via `export.ts` (`exportInvoicePdf`/`printInvoice` = clean preview window, no auto-print).
- **Logo:** extracted Gloria Jean's logo (`xl/media/image1.png`, 626×169) from the official template xlsx → `shared/logo.ts` (base64 data URL) → embedded in invoices + statements (self-contained HTML/PDF).
- **HO address corrected** to **707 Currie Road, Windermere, Durban** (was the template's stale "190 Florida Road") — applies to all invoices.
- **Dashboard approval queue:** generated royalty invoices (approved=0) auto-list on the Dashboard with View / Approve / Approve-all. Repo `royalties.ts`: listPendingInvoices, setRoyaltyApproved, approveAllRoyalties, getRoyaltyInvoice.
- Verified: Gateway South May-2026 invoice renders with logo + correct address; totals R42,662.84 + VAT R6,399.43 = **R49,062.27**.
- **Disk gotcha:** hit ENOSPC mid-edit (Desktop on OneDrive, only ~2.7 GB free). Freed ~3 GB by clearing `release/`, `%LOCALAPPDATA%\electron-builder\Cache` (27 MB) and `\electron\Cache` (219 MB), and trimming old DB backups to the latest 3.

### 2026-06-25 — Phase 5: GJC Statements of Account
- Migration **v13**: `statement_accounts` (customer header) + `statement_lines` (per-store debtor ledger: invoice/royalty/payment, debit/credit; running balance computed on read).
- Importer `services/import-statements.ts` parses the GJC Statement xlsx (header → customer/VAT/address + Account Summary; table → Date/Transaction/Details/Debit/Credit lines; classifies payment vs royalty vs invoice). Idempotent per store.
- Repo `repositories/statements.ts`: `getStatement` (running balance + summary), `listStatementStores`, `syncStatementRoyalties` (auto-appends royalty-ledger invoices for periods AFTER the last imported line — no duplication).
- Generator `shared/statement-html.ts` + `export.ts` (Print / Export PDF) in the GJC layout. **Statements** page (Ctrl+10): store tabs + Account Summary cards + ledger + export.
- **Reconciled to the cent:** Florida R533,027.84 (47 lines), Pavilion R433,767.71 (50), Lakefield R78,057.54 (19, incl R302,180 payments). Verified via standalone `stmt-run.js` then in the UI. (Older combined "Statements of Accounts (Pavilion, Florida)" file is skipped — different format.)

### 2026-06-25 — Phase 4: Royalty ledger (automation keystone)
- Migration **v12**: `stores.royalty_rate` (8% default, **Pavilion 6%**) + `royalty_invoices` table.
- `repositories/royalties.ts`: **auto-computes** royalty invoices from monthly turnover — royalty = turnover×rate%, marketing = turnover×2.5%, +15% VAT; idempotent per (store,period); preserves Paid flag. Verified formula vs the Royalties Breakdown ledgers (Gateway South Jan-2021 → R31,539.49 ✓) and vs master (Gateway South May-2026 royalty R32,505.02 ✓).
- **Royalties** page (Ctrl+9): generate this-month/all-months, summary cards, per-invoice Paid/Unpaid toggle. Generated **329 invoices = R7,885,513.15**.
- Added BUILD_LOG.md (this file) at the user's request — persistent engineering trail.

### 2026-06-25 — Phase 1–3: Universal File Catalog + full forensic audit
- Inventoried the entire `2026` folder (13 departments, 4,739 files). Sampled every department's format down to the cell.
- Built the **File Catalog** (migration v11 `file_catalog`): walker/classifier (`services/catalog-import.ts`), repo (`repositories/catalog.ts`), IPC `catalog:*`, preload `window.gloria.catalog`, and the **Records** page (Ctrl+10) — searchable by department/store/period/type, click-to-open.
- **Discovered OneDrive hydration** problem (content hashing hung 4+ min); switched to metadata-only fingerprint → all 4,739 files catalog in ~2s. Made re-runs incremental.
- Verified: 4,739 files / 689.7 MB cataloged; search confirmed (e.g. "Florida" → royalty invoices, timesheets, correctly tagged).

### 2026-06-25 — Reporting + Cash-Up wiring + statement explanation
- Wired the Oceans Mall Cash-Up purchases total (R18,689.40) into the report packs (non-destructive add; reflects automatically).
- Explained the GJC Statements of Account (running debtor ledger per store) and the auto-update plan.

### 2026-06-24/25 — Oceans Mall Cash-Up seeded
- Read all 63 `oceans_mall` photos by vision; seeded 53 cash purchases (R8,758.75) + 4 EFT invoices (R9,930.65) + 19 vouchers. Added cash_payouts.kind `invoice` (v10) so invoices count in purchases but are excluded from the daily slip-vs-voucher reconciliation. 13/19 days reconcile to the cent.

### 2026-06-24 — Remaining back-office modules + money audit
- Built Consumption, Payroll, Stock Take, store profile, royalties/Australia in Reports (v8). Turnover module (v9, parked).
- Full reconciliation audit: fixed a consumption importer header bug (imported zero); found a Feb-2025 source-spreadsheet total error of R113,328 that the app corrects.

### Earlier — Go-live
- Imported 7 years of real data from the archive (master sales, VAT journals). Cash-Up & Payouts module. Creditors & Debtors module (HO vs store separation).

---

## 7. Roadmap (next)

- **Phase 4 — Structured extraction:** parse financial files into module tables, each reconciled to known balances. Start with **Royalties Breakdown → royalty ledger (Paid/Unpaid)** — the keystone for statements + automation. Then Store Purchases, Debtors invoices, Staff Hours, GJC Aus Account.
- **Phase 5 — GJC Statements:** per-store running ledger + Statement of Account generator (exact layout).
- **Phase 6 — Automation:** auto-calc royalties → create invoices → dashboard reminders to export & email, once all stores' reports are in.

### 2026-06-27 — Staff register (v21)
- Migration v21: `staff` table (one profile per person: name, id_number, occupation, status, dob, gender, phone, email, monthly_pay, notes, active).
- Repo `repositories/staff.ts`: list/upsert/delete + `syncStaffFromPayroll` (dedupes by SA ID number, most-frequent name variant, ≥6 months = Permanent) + `deriveFromIdNumber` (DOB + gender from SA ID). New **Staff** page (store nav, Ctrl+6) with Sync-from-timesheets, add/edit modal, scoped to Oceans in store mode.
- Seeded Oceans Mall: 9 staff. Fixed source-data issues — Menzi's ID (redacted) had a stray "Okuhle" name row; "Alungile Gogela" was labelled "(Casual)". Corrected the 4 core staff to exact names by ID per the user (Ntombikayise Ndlovu, Ntombizonke Priscilla Khambula, Menzi Rodger Mbanda, Alungile Gogela — all Permanent, Team Member).
- DB now at v21 / 21 tables.

### 2026-06-27 — Daily Command Center (alerts engine)
- `repositories/alerts.ts` `getAlerts(mode, storeId, period)` computes live "needs attention" alerts from real data, mode-aware. Store: turnover not captured, cash-up behind (>2 days), owed-to-HO (unpaid royalty invoices), month-end open. Franchise: invoices to approve, ready-to-send, royalties not generated this period, stores not reported, owed-to-Australia. Severity urgent/warn/info/good.
- `components/AlertsPanel.tsx` renders a "Needs attention today" panel (severity dots, clickable → jumps to the action page) at the top of both dashboards. IPC `alerts:get`, preload `alerts.get`.
- Gotcha fixed: alerts query used `tasks.done`; the column is `status='complete'`.
- Verified live both offices: store shows 4 (turnover/cash-up/owed/month-end); franchise shows 4 (send/generate/not-reported/Australia).

### 2026-06-27 — Stock Control (v22) + GAAP daily turnover seeding
- **Migration v22:** `stock_items` (master: cost/sell price, reorder, on_hand cache) + `stock_movements` (valued signed ledger: receive/waste/count/sale/adjust). `repositories/stock-control.ts`: list/upsert items, receiveStock (stock-in from supplier invoices, updates cost), recordWaste (reason + value), recordCount (posts variance vs system on-hand, net negative = loss/theft to investigate), getStockSummary (value, low, received, waste, shrinkage, cash-up spend), listMovements.
- New store-only **Stock** page (`StockControl.tsx`, Ctrl+7) with Receive/Count/Waste/+Item modals + 6 money cards. Existing HO "Stock Take" now franchise-only. Preload namespace `stockControl` (kept separate from stock-take `stock`).
- **Seeded Oceans item catalog: 108 items** from the latest HO stock sheet (names + cost prices), on_hand 0 (set by counts).
- **GAAP daily turnover seeded:** found 40 GAAP TurnoverReports; the existing `import-turnover` misses the variant with no "Total Sales" column + generic "GLORIA JEANS" node, so seeded via a robust parser (store from filename, total = cash+card+accounts+cheque) → **1,082 daily rows for Oceans, R3.7m, 2024–2026** into `turnover_daily`. Multi-store files (32) skipped (need node split).
- Note: GAAP TurnoverReports are daily **payment-mix** totals, NOT product-level — "what sells / menu analytics" still needs a product-mix export (not in the archive). Stock value reconciles once counts are entered.
- DB now at v22 / 23 tables.

### 2026-06-27 — Menu & recipes (v23, Phase 1)
- **Migration v23:** `menu_items` (sellable products + price), `recipe_lines` (menu_item → stock_item + qty; the menu↔stock bridge), `menu_sales` (item-level units/revenue, ready for a GAAP product-mix export).
- `repositories/menu.ts`: recipe costing (cost = Σ line qty × stock cost_price) → gross profit + margin%; list/upsert/delete items, get/set recipe. New store-only **Menu** page (Ctrl+8) with a recipe builder linked to the 108 stock items + live cost/GP/margin.
- **Phase 2 (needs uploads):** AI-extract menu + ingredient sheets (PDF/photos → menu_items + recipes); import GAAP **product-mix** export → `menu_sales`; then menu-engineering matrix (popularity×profitability), theoretical-vs-actual stock variance (precise theft), and the monthly Menu Performance report.
- Theft analytics already live via the Stock page Loss/Theft card (count shrinkage); theoretical-vs-actual sharpens once recipes + product sales land.
- DB now at v23 / 26 tables.

### 2026-06-27 — Menu seeded from the GJ recipe book (real data)
- Found structured menu/recipe data in the archive: `Oceans Mall/Recipes_Menu_Items_Gloria_Jeans_2023-03-14_Sorted_by_Menu_Item_.xls` (full recipe book), `Oceans Mall/Menus/` (GJ Drinks/Food PDFs + drinks-screen mp4), `Debtors/.../menu_listing_report*.csv` (price lists). No AI needed — parsed the xls directly.
- Recipe book format: item header row (code | name | first-ingredient code|name|unit|qty|unit-cost|line-cost), continuation rows for more ingredients, then a `Selling : X … Total Cost` summary row per item.
- Seeded Oceans: **598 menu items, 2,819 recipe lines**; ingredients matched to existing stock by normalised name, else auto-created (294 new) → Oceans stock now 402 items. Menu page computes cost/GP/margin live (avg 52%).
- Source quirks (real, user can tidy): retail merchandise mixed in (mugs/siphons), R0-price modifiers ("Add Chicken", "Brown Sugar") → 0%/negative margin, one placeholder (Baby Chino R999). Auto-create also duplicated some HO-sheet items under recipe naming (mergeable later).
- Still needed for "what sells": a GAAP **product-mix / sales-by-item** export → `menu_sales` → menu-engineering matrix + theoretical-vs-actual variance + monthly Menu Performance report.

### 2026-06-27 — Trends (time-based reports, live off historical data)
- `repositories/trends.ts` `getStoreTrends(storeId)`: monthly series from `turnover_daily` (turnover, cash/card mix, trading days) joined with monthly_store_data (purchases) + payroll (gross); per-month operating margin = turnover − purchases − payroll; totals = all-time turnover, months trading, avg/month, best month, cash%.
- New store-only **Trends** page (Ctrl+9): all-time cards, monthly turnover bar chart, per-month table. IPC `trends:store`, preload `trends.store`.
- Verified live: Oceans **R1,969,790 all-time across 23 months since 2023-08**, best Dec 2025 (R176,435), 77% card. June 2026 = R0 (fills at month-end per plan).
- Note: the GAAP seed's reported R3.7m was inflated by overlapping source files; the deduped DB total is R1.97m (trends is correct).
- Item-level "what sells" deferred to future (needs GAAP product-mix export); time-based turnover/profit trends are live now.

### 2026-06-27 — v1 QA / polish audit
- **Dead-code sweep:** tsc with `--noUnusedLocals --noUnusedParameters` across web+node → renderer spotless; one unused param in `import-archive.ts` (importConsumption `summary`) removed. No orphaned pages/components/repos. IPC fully wired — every `ipcMain.handle` has a preload caller and vice-versa (0 dead, 0 missing). No console.log/debugger, no TODO/FIXME, only 2 legitimate @ts-ignore.
- **Functional bug fixed:** in-app GAAP turnover importer (`import-turnover.ts`) required a "Total Sales" column + store-named node; the real GAAP files have neither, so monthly imports silently did nothing. `parseGAAP` now detects the header by Cash+Credit-Card, computes total = cash+card+acc+cheque when there's no Total column, and falls back to the filename's store when the node is generic. (Matches the seeder that loaded the 1,082 historical rows.)
- **Verified:** typecheck clean, build clean, smoke-test clicking every page in BOTH offices → zero runtime errors. App at DB v23 / 26 tables.
- Codebase: 90 source files, tight and disciplined — no significant dead code or overwritten-feature residue found.

### 2026-06-27 — Rebrand to "Cafe Studio" + first GitHub commit
- Renamed the app **Gloria Admin → Cafe Studio** in all user-visible spots (window title, app:info, index.html, report/statement footers) + electron-builder config (appId com.cafestudio.app, productName, shortcut/artifact names) + docs (README/USER_MANUAL/APP_OVERVIEW/docs/scrums). **Kept package.json `name`="gloria-admin"** on purpose so dev `app.getName()` → `%APPDATA%\gloria-admin` is unchanged and the live DB is preserved (renaming it would orphan all seeded data). Data verified intact after rename (menu 598, stock 402, turnover 696, staff 8, DB v23).
- **First git commit + push:** repo https://github.com/oceanssaint-bot/cafe_studio (main, commit 6bf911e, 112 files). `.gitignore` excludes node_modules/out/release AND all private business data: `2026/`, `oceans_mall/`, `gloria-data-backup/`, `*.db`, and `BUILD_LOG.md` (contains a staff ID number + rand figures). Verified remote has 0 private files.
- gh CLI not installed; plain git push worked (credentials cached). When packaging later, the .exe uses productName "Cafe Studio" → fresh userData; copy the gloria-admin DB across at handover if data should carry.

### 2026-06-27 — Processing feedback + error surfacing (app-wide)
- New global system: `context/ActivityContext.tsx` (`run(label, fn)` wraps any async op), `components/ActivityToaster.tsx` (bottom-right live spinners with elapsed-seconds + dismissible red error toasts), `components/Spinner.tsx`. Mounted in main.tsx/App.tsx. One wrap per call site = automatic "working… Ns" indicator + error toast — scales to any future op.
- Documents (AI read): rich inline banner with live elapsed seconds ("Reading… 12s, usually 20–60s, keep app open") + spinner button. Verified live: banner + button + toaster all show during a real read.
- Routed the slow ops through `run()`: archive import + backup/restore (Settings), turnover/purchases/payroll/statements/Aus imports, stock-recon import/export, royalty export+email & store-pack import (Dashboard), store-pack export (StoreDashboard), report exports.
- Bug fixed: `extractWithClaude` had NO timeout → a slow API call hung the UI indefinitely (seen at 253s). Added `timeout 120s, maxRetries 1` so it fails into a clear error toast instead of spinning forever.

### 2026-06-27 — Full payroll: SARS engine, payslips, pay run, EMP201 (v24)
- **SARS tax engine** `services/sars-tax.ts` — 2025/26 PAYE (annualised, brackets + age rebates + threshold), UIF (1% capped at R17,712/mo), SDL (1%), age-from-DOB. Pure module, tables easy to update yearly.
- **Migration v24:** staff gain `bank_name/bank_account/tax_number`; new `payslips` table (one per staff/period: gross, paye, uif, other, net, employer uif + sdl, earnings/deductions JSON; UNIQUE staff+period so re-runs update).
- **Pay run** `repositories/payroll-run.ts` — `runPayroll` computes PAYE/UIF/SDL/net per active staff and stores payslips; `payRunStaff` (prefill gross from staff monthly_pay), `listPayslips`, `getEmp201` (PAYE + total UIF + SDL).
- **Payslip PDF** `shared/payslip-html.ts` (BCEA: employer, employee, earnings, deductions, NET, employer contributions) + `export.ts` exportPayslipPdf / printPayslip / exportPayslipsBatch (folder of all PDFs). Staff page extended with bank/tax inputs.
- **UI** `PayRunPanel.tsx` on the Payroll page (store mode): period, editable gross per staff, "Run payroll" → SARS calc, EMP201 cards, per-payslip View/PDF, Export-all.
- **Verified:** pay run on the 4 Oceans staff — PAYE R0 (all below R95,750 threshold, correct), UIF 1%, EMP201 total R858.18. Computed nets matched the timesheet nets to the cent (Menzi R7,556.55, Ndlovu R7,600.17). Payslip PDF renders.
- **Remaining (next):** IRP5 annual certificates, leave accrual/balances, EFT bank file, and splitting earnings (Sunday/OT/PH) from the timesheets instead of a single Basic line.
- DB now at v24 / 27 tables.

### 2026-06-27 — Payroll manual fallback + resilience note
- Pay run is now **fully manual-capable**: PAYE, UIF and Other deductions are editable per employee with a live net; "Auto-calc PAYE/UIF" (SARS) just *fills* them and you can override any figure before saving. `PayRunLine` gained optional `paye`/`uif` (manual wins, else auto); added `previewPayroll`/`payrun:preview`.
- Resilience: only the **document image/PDF reader** uses the Anthropic API. Everything else — SARS calc, pay run, payslips, all spreadsheet imports, reports, dashboards — runs **100% offline/local**, so an API outage never blocks payroll or data entry. Manual entry exists for Payroll, Staff, Stock, Menu, Cash-Up, Creditors/Debtors.

### 2026-06-29 — Document capture: type + destination + "original missing" flag (v25)
- AI handwriting is unreliable, so the reader now has full manual control. Migration v25: `documents.destination` ('month'|'cashup'|'purchases') + `documents.source_missing` (hand-keyed, no original slip).
- DocumentReview: "Apply these figures to" selector (store month totals / cash-up petty-cash purchase / store purchases journal) + a description field + a "⚠ Original receipt missing (hand-keyed)" checkbox that still applies but flags for audit. `applyDocument` routes to the chosen destination (monthly_store_data / cash_payouts / store_purchase_lines) and stamps the flag into the note.
- "Add by hand" button on Documents creates a manual entry (no file/AI, source_missing=1, status 'extracted') for pure keyboard capture; ⚠ badge shows on flagged docs in the list. Extract prompt nudged to read handwriting.
- Seeded new Oceans cash-up from oceans_mall: 25/06 (Checkers 110.94, PNA 67.70), 28/06 (Woolworths 137.48 + Checkers 498.87 — voucher only, FLAGGED no slip), Pastry Shack invoice 24/06 R1,478. 26–27 June already present (idempotent skip). Note: an existing 27/06 Checkers R397.88 row has VAT R48.94 vs slip R27.72 — to verify.
