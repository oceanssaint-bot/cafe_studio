// Shared types used across main, preload, and renderer.

export interface DbStatus {
  ok: boolean
  path: string
  tables: string[]
  error?: string
}

export interface AppInfo {
  name: string
  version: string
  platform: string
}

// --- Month End (Scrum 02) ---

export type TaskStatus = 'pending' | 'complete'

export interface Task {
  id: number
  period: string // 'YYYY-MM'
  title: string
  notes: string
  status: TaskStatus
  created_at: string
  completed_at: string | null
}

export interface TaskStats {
  total: number
  completed: number
  percent: number // 0-100, rounded
}

export interface CreateTaskInput {
  period: string
  title: string
  notes?: string
}

export interface UpdateTaskInput {
  id: number
  title: string
  notes: string
}

// --- Stores (Scrum 03) ---

export type StoreCategory = 'head_office' | 'franchise'

export interface Store {
  id: number
  name: string
  category: StoreCategory
  include_in_australia: number // 0 | 1
  sort_order: number
  archived: number // 0 | 1
  address: string
  phone: string
  profile_notes: string
  royalty_rate: number // % (8 default, Pavilion 6)
  billing_email: string
}

export interface EmailDraftSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  exported: number
  drafted: number
  folder: string
  missingEmail: string[]
}

export interface MonthlyStoreData {
  store_id: number
  period: string // 'YYYY-MM'
  sales: number
  purchases: number
  turnover: number
  transactions: number
  royalty: number
  marketing: number
  royalty_au: number
  consumption: number
  notes: string
  updated_at: string | null
}

export interface SaveMonthlyStoreInput {
  store_id: number
  period: string
  sales: number
  purchases: number
  turnover: number
  notes: string
}

export interface CreateStoreInput {
  name: string
  category: StoreCategory
  include_in_australia: number
}

export interface UpdateStoreInput {
  id: number
  name: string
  category: StoreCategory
  include_in_australia: number
  archived: number
  address?: string
  phone?: string
  profile_notes?: string
}

// --- Stock Take (Head Office or store) ---
export interface StockTake {
  id: number
  entity_store_id: number | null
  take_date: string
  total_value: number
  item_count: number
  source: string
  created_at: string
}
export interface StockTakeInput {
  id?: number
  entity_store_id: number // 0 = Head Office
  take_date: string
  total_value: number
  item_count: number
}

// --- Payroll register ---
export interface PayrollItem {
  id: number
  entity_store_id: number | null
  period: string
  employee: string
  emp_no: string
  gross: number
  net: number
  notes: string
  source: string
  source_doc_id: number | null
  created_at: string
}
export interface StaffHoursImportSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  filesParsed: number
  storesUpdated: string[]
  employees: number
  totalGross: number
  warnings: string[]
}
export interface PayrollInput {
  id?: number
  entity_store_id: number // 0 = Head Office
  period: string
  employee: string
  emp_no: string
  gross: number
  net: number
  notes: string
}
export interface PayrollView {
  items: PayrollItem[]
  totals: { gross: number; net: number; count: number }
}

// --- Creditors & Debtors (per entity: Head Office or a store) ---

export type LedgerKind = 'creditor' | 'debtor'

/** entity_store_id of 0 in the API means Head Office (stored as NULL). */
export interface LedgerItem {
  id: number
  kind: LedgerKind
  entity_store_id: number | null // null = Head Office
  party: string // supplier (creditor) or customer/store (debtor)
  description: string
  invoice_no: string
  invoice_date: string
  total_incl: number
  vat: number
  excl_vat: number
  paid: number
  owing: number
  source: string
  created_at: string
}

export interface LedgerItemInput {
  id?: number
  kind: LedgerKind
  entity_store_id: number // 0 = Head Office
  party: string
  description: string
  invoice_no: string
  invoice_date: string
  total_incl: number
  vat: number
  excl_vat: number
  paid: number
}

export interface LedgerGroup {
  party: string
  items: LedgerItem[]
  total: number
  paid: number
  owing: number
}

export interface LedgerView {
  groups: LedgerGroup[]
  totals: { total: number; paid: number; owing: number }
}

export interface LedgerEntity {
  id: number // 0 = Head Office
  name: string
}

export interface LedgerImportSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  sourceFile: string
  creditorsHO: number
  creditorsStores: number
  debtors: number
  warnings: string[]
}

// --- Cash-Up & Payouts (petty-cash purchases reconciled to till slips) ---

// 'purchase' = cash till-slip purchase (reconciled to the payout voucher);
// 'invoice' = a supplier invoice (counts toward monthly purchases but is NOT
// part of the daily slip-vs-voucher reconciliation); 'tip' = staff tips.
export type CashPayoutKind = 'purchase' | 'invoice' | 'tip'

export interface CashPayout {
  id: number
  store_id: number
  period: string // 'YYYY-MM'
  txn_date: string // 'YYYY-MM-DD'
  supplier: string
  description: string
  excl_vat: number
  vat: number
  incl_vat: number
  kind: CashPayoutKind
  source_doc_id: number | null
  created_at: string
}

export interface CashPayoutInput {
  id?: number
  store_id: number
  period: string
  txn_date: string
  supplier: string
  description: string
  excl_vat: number
  vat: number
  incl_vat: number
  kind: CashPayoutKind
  source_doc_id?: number | null
}

/** A handwritten payout voucher's declared totals for one day (for reconciliation). */
export interface CashDeclaration {
  store_id: number
  period: string
  txn_date: string
  declared_purchases: number
  declared_tips: number
}

/** Per-day reconciliation row: voucher-declared total vs the summed till slips. */
export interface CashReconDay {
  txn_date: string
  slipCount: number
  slipsTotal: number // sum of purchase incl_vat
  tipsTotal: number
  declaredPurchases: number
  declaredTips: number
  variance: number // slipsTotal - declaredPurchases
  matched: boolean
}

export interface CashUpData {
  payouts: CashPayout[]
  totals: { excl: number; vat: number; incl: number; tips: number }
  recon: CashReconDay[]
}

export interface CashImportResult {
  ok: boolean
  cancelled?: boolean
  error?: string
  slips: number
  vouchers: number
  skipped: number
  warnings: string[]
}

export interface ImportSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  filesScanned: number
  storesCreated: string[]
  monthsImported: number // store/period rows touched
  turnoverTotal: number
  purchasesTotal: number
  stockTakes?: number
  years: string[]
  warnings: string[]
}

// --- Turnover Reports (daily POS) ---

export interface TurnoverDaily {
  id: number
  store_id: number
  date: string // YYYY-MM-DD
  cash: number
  credit_card: number
  accounts: number
  cheque: number
  non_turnover: number
  tips: number
  total_sales: number
  source: string
}

export interface TurnoverDailyInput {
  store_id: number
  date: string
  cash?: number
  credit_card?: number
  accounts?: number
  cheque?: number
  non_turnover?: number
  tips?: number
  total_sales: number
}

/** Monthly turnover for a store, summed from its daily POS rows. */
export interface TurnoverMonthly {
  storeName: string
  storeId: number
  cash: number
  credit_card: number
  accounts: number
  cheque: number
  non_turnover: number
  tips: number
  total_sales: number
  days: number
  hasBreakdown: boolean
}

/** One store's POS turnover vs the monthly master figure (reconciliation). */
export interface TurnoverReconRow {
  storeName: string
  storeId: number
  posTurnover: number // summed from turnover_daily
  masterTurnover: number // monthly_store_data.turnover
  difference: number // pos - master
  matches: boolean
}

export interface TurnoverView {
  period: string
  periodLabel: string
  monthly: TurnoverMonthly[]
  recon: TurnoverReconRow[]
}

export interface TurnoverImportSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  filesParsed: number
  filesAi: number
  filesFailed: number
  storeMonths: number // store/period rows touched
  totalTurnover: number
  storesCreated: string[]
  warnings: string[]
  needsApiKey?: boolean
}

// --- Royalties (auto-computed from turnover) ---

export interface RoyaltyInvoice {
  id: number
  store_id: number
  storeName: string
  period: string // YYYY-MM
  invoice_date: string
  invoice_no: string
  turnover: number
  rate: number // %
  royalty_fee: number // turnover * rate% (excl VAT)
  marketing_fee: number // turnover * 2.5% (excl VAT)
  vat: number
  total_incl: number
  paid: number // 0 | 1
  approved: number // 0 | 1
  sent: number // 0 | 1
  sent_at: string
  source: string
}

export interface RoyaltyView {
  rows: RoyaltyInvoice[]
  totals: {
    turnover: number
    royalty_fee: number
    marketing_fee: number
    vat: number
    total_incl: number
    paidTotal: number
    outstanding: number
  }
}

export interface RoyaltyGenerateSummary {
  ok: boolean
  created: number
  updated: number
  skipped: number
  totalIncl: number
}

// --- Statements of Account (per-store debtor ledger) ---

export type StatementTxType = 'invoice' | 'royalty' | 'payment' | 'opening'

export interface StatementLine {
  id: number
  store_id: number
  line_date: string // DD.MM.YYYY as stored from source; or YYYY-MM-DD
  tx_type: StatementTxType
  reference: string
  details: string
  debit: number
  credit: number
  period: string
  source: string
  balance?: number // running balance, computed on read
}

export interface StatementAccount {
  store_id: number
  customer_name: string
  vat_no: string
  address: string
  customer_code?: string
}

/** A royalty invoice ready for the dashboard approval queue. */
export interface PendingInvoice {
  id: number
  storeName: string
  period: string
  periodLabel: string
  invoice_no: string
  total_incl: number
}

export interface StatementView {
  storeId: number
  storeName: string
  account: StatementAccount | null
  lines: StatementLine[]
  summary: { invoiced: number; paid: number; balance: number }
  periodLabel: string
}

export interface StatementStoreRef {
  storeId: number
  storeName: string
  balance: number
  lineCount: number
}

export interface StatementImportSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  filesParsed: number
  storesUpdated: string[]
  linesImported: number
  warnings: string[]
}

export interface BatchExportSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  count: number
  folder: string
}

// --- Store Purchases (detailed purchase journal) ---

export interface StorePurchaseLine {
  id: number
  store_id: number
  period: string
  txn_date: string
  invoice_no: string
  supplier: string
  description: string
  excl_vat: number
  vat: number
  incl_vat: number
  source: string
}

export interface StorePurchaseView {
  storeId: number
  storeName: string
  period: string
  periodLabel: string
  lines: StorePurchaseLine[]
  totals: { excl: number; vat: number; incl: number; count: number }
  bySupplier: Array<{ supplier: string; incl: number; count: number }>
}

export interface PurchaseImportSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  filesParsed: number
  storesUpdated: string[]
  linesImported: number
  totalIncl: number
  warnings: string[]
}

// --- Trends (time-based reports) ---

export interface TrendMonth {
  period: string
  periodLabel: string
  turnover: number
  cash: number
  card: number
  tips: number
  days: number
  purchases: number
  payroll: number
  grossEst: number // turnover − purchases − payroll
}

export interface TrendsView {
  storeId: number
  storeName: string
  firstMonth: string
  months: TrendMonth[]
  totals: {
    turnover: number
    monthsTrading: number
    avgMonth: number
    bestPeriod: string
    bestTurnover: number
    cashPct: number
  }
}

// --- Menu & recipes ---

export interface RecipeLine {
  id: number
  menu_item_id: number
  stock_item_id: number
  stockName: string
  unit: string
  qty: number
  unitCost: number
  lineCost: number
}

export interface MenuItem {
  id: number
  store_id: number | null
  name: string
  category: string
  sell_price: number
  active: number
  recipeCost: number // Σ recipe line cost
  grossProfit: number // sell_price - recipeCost
  margin: number // % of sell_price
  hasRecipe: boolean
}

export interface MenuItemInput {
  id?: number
  store_id: number
  name: string
  category: string
  sell_price: number
}

export interface RecipeLineInput {
  stock_item_id: number
  qty: number
}

// --- Stock control (perpetual store inventory) ---

export interface StockItem {
  id: number
  store_id: number | null
  name: string
  category: string
  unit: string
  cost_price: number
  sell_price: number
  reorder_level: number
  on_hand: number
  active: number
  value: number // on_hand * cost_price
  low: boolean // on_hand <= reorder_level
}

export interface StockItemInput {
  id?: number
  store_id: number
  name: string
  category: string
  unit: string
  cost_price: number
  sell_price: number
  reorder_level: number
}

export interface StockMovement {
  id: number
  item_id: number
  itemName: string
  txn_date: string
  type: string
  qty: number
  unit_cost: number
  value: number
  reason: string
  reference: string
}

export interface StockSummary {
  storeId: number
  period: string
  periodLabel: string
  stockValue: number
  itemCount: number
  lowCount: number
  receivedValue: number
  wasteValue: number
  shrinkageValue: number // unexplained loss from counts (negative variance beyond waste)
  cashupSpend: number
}

export interface ReceiveLine {
  item_id: number
  qty: number
  unit_cost: number
}

export interface CountLine {
  item_id: number
  counted: number
}

export interface StockActionResult {
  ok: boolean
  error?: string
  variance?: number // for counts: net value change (negative = loss)
  lines?: number
}

// --- Daily Command Center (alerts) ---

export interface Alert {
  id: string
  severity: 'urgent' | 'warn' | 'info' | 'good'
  title: string
  detail: string
  page?: string // PageId to jump to for action
}

// --- Staff register ---

export interface Staff {
  id: number
  store_id: number | null
  name: string
  id_number: string
  occupation: string
  status: string // Permanent | Casual
  dob: string
  gender: string
  phone: string
  email: string
  monthly_pay: number
  notes: string
  active: number // 0 | 1
  bank_name: string
  bank_account: string
  tax_number: string
}

export interface StaffInput {
  id?: number
  store_id: number
  name: string
  id_number: string
  occupation: string
  status: string
  phone: string
  email: string
  monthly_pay: number
  notes: string
  active: number
  bank_name: string
  bank_account: string
  tax_number: string
}

export interface StaffSyncSummary {
  added: number
  total: number
}

// --- Payroll (pay run, payslips, statutory) ---

export interface PayslipLine {
  label: string
  amount: number
}

export interface Payslip {
  id: number
  store_id: number | null
  staff_id: number | null
  staff_name: string
  period: string
  gross: number
  paye: number
  uif: number
  other_deductions: number
  net: number
  uif_employer: number
  sdl: number
  earnings: PayslipLine[]
  deductions: PayslipLine[]
}

/** One staff member's input to a pay run. PAYE/UIF auto-calc unless given (manual override). */
export interface PayRunLine {
  staff_id: number
  gross: number
  paye?: number
  uif?: number
  other_deductions?: number
}

export interface PayRunPreviewRow {
  staff_id: number
  paye: number
  uif: number
}

export interface PayRunResult {
  ok: boolean
  period: string
  count: number
  totals: { gross: number; paye: number; uif: number; other: number; net: number }
}

export interface Emp201 {
  period: string
  periodLabel: string
  paye: number
  uifTotal: number // employee + employer
  sdl: number
  total: number
  staffCount: number
}

// --- Store monthly pack (store → Head Office hand-off) ---

export interface StorePack {
  gloriaPack: number
  store: string
  period: string
  exportedAt: string
  turnover: number
  sales: number
  purchases: number
  cashup: number
  payrollGross: number
  payrollCount: number
}

export interface StorePackResult {
  ok: boolean
  cancelled?: boolean
  error?: string
  store?: string
  period?: string
  turnover?: number
  path?: string
}

// --- Store overview (Store-mode dashboard) ---

export interface StoreOverview {
  storeId: number
  storeName: string
  period: string
  periodLabel: string
  turnover: number
  purchases: number
  cashup: number
  payrollGross: number
  payrollCount: number
  royaltyFee: number
  marketingFee: number
  owedToHO: number
}

// --- Stock reconciliation (updated stock take) ---

export interface StockReconRow {
  code: string
  name: string
  price: number
  opening: number
  counted: boolean
  sold: number
  remaining: number
  value: number // remaining (floored at 0) × price
  status: '' | 'not-counted' | 'oversold'
}

export interface StockReconView {
  hasData: boolean
  baselineDate: string
  asOf: string
  rows: StockReconRow[]
  totals: {
    openingValue: number
    soldValue: number
    remainingValue: number
    items: number
    ok: number
    notCounted: number
    oversold: number
  }
  perStore: Array<{ store: string; value: number }>
  unmatched: Array<{ name: string; value: number }>
  matchedPct: number
}

export interface StockSheetImportSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  sheets: number
  lines: number
  latestDate: string
}

export interface StockOutImportSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  files: number
  lines: number
  byStore: Array<{ store: string; lines: number }>
}

// --- GJC Australia account (USD payable to Gloria Jeans International) ---

export interface AusAccountLine {
  id: number
  ledger: string
  txn_date: string
  txn_type: string
  doc_no: string
  description: string
  amount_usd: number
  remaining_usd: number
  source: string
}

export interface AusLedgerSummary {
  ledger: string
  charged: number
  paid: number
  balance: number
  count: number
}

export interface AusAccountView {
  ledgers: AusLedgerSummary[]
  totals: { charged: number; paid: number; balance: number; count: number }
  lines: AusAccountLine[]
}

export interface AusImportSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  filesParsed: number
  linesImported: number
  balanceUsd: number
  warnings: string[]
}

// --- File Catalog (universal archive registry) ---

export interface FileCatalogEntry {
  id: number
  path: string
  rel_path: string
  filename: string
  department: string
  store: string
  period: string
  doc_type: string
  ext: string
  size: number
  sha256: string
  modified: string
  ingested: number
  module: string
  notes: string
}

export interface CatalogDeptStat {
  department: string
  files: number
  ingested: number
  size: number
}

export interface CatalogStats {
  total: number
  ingested: number
  totalSize: number
  byDepartment: CatalogDeptStat[]
  byType: Array<{ doc_type: string; files: number }>
  byStore: Array<{ store: string; files: number }>
  duplicates: number
}

export interface CatalogImportSummary {
  ok: boolean
  cancelled?: boolean
  error?: string
  root: string
  scanned: number
  added: number
  updated: number
  bytes: number
  durationMs: number
}

export interface CatalogQuery {
  text?: string
  department?: string
  store?: string
  period?: string
  doc_type?: string
  limit?: number
}

// --- Reports (Scrum 04) ---

export type ReportType = 'head_office' | 'franchise' | 'australia'

export interface ReportRow {
  storeName: string
  sales: number
  purchases: number
  turnover: number
  royalty: number
  royalty_au: number
}

export interface ReportTotals {
  sales: number
  purchases: number
  turnover: number
  royalty: number
  royalty_au: number
}

export interface ReportData {
  type: ReportType
  title: string
  period: string
  periodLabel: string
  rows: ReportRow[]
  totals: ReportTotals
  generatedAt: string
}

export interface ExportResult {
  saved: boolean
  path?: string
  error?: string
}

// --- Polish (Scrum 05) ---

export interface TaskSearchResult {
  id: number
  title: string
  period: string
  status: TaskStatus
}

export interface StoreSearchResult {
  id: number
  name: string
  category: StoreCategory
}

export interface SearchResults {
  tasks: TaskSearchResult[]
  stores: StoreSearchResult[]
}

export type ActivityKind = 'task_completed' | 'store_updated'

export interface ActivityItem {
  kind: ActivityKind
  label: string
  detail: string
  when: string // ISO timestamp
  period: string
  storeId?: number
}

export interface BackupResult extends ExportResult {
  restored?: boolean
}

// --- Documents / AI import (user feature) ---

export type DocumentKind = 'receipt' | 'invoice' | 'spreadsheet' | 'other'
export type DocumentStatus = 'pending' | 'extracted' | 'applied' | 'error'

/** A document the user uploaded, with the figures extracted from it. */
export interface AppDocument {
  id: number
  filename: string
  stored_path: string
  mime: string
  kind: DocumentKind
  supplier: string
  doc_date: string // 'YYYY-MM-DD' or ''
  period: string // 'YYYY-MM'
  store_id: number | null
  sales: number
  purchases: number
  turnover: number
  vat: number
  currency: string
  summary: string
  status: DocumentStatus
  error: string
  task_id: number | null
  destination: DocDestination
  source_missing: number // 0 | 1 — hand-keyed, no original slip
  created_at: string
  applied_at: string | null
}

/** Where applying a document writes its figures. */
export type DocDestination = 'month' | 'cashup' | 'purchases'

/** Structured fields the model (or local parser) extracts from a document. */
export interface ExtractedFields {
  kind: DocumentKind
  supplier: string
  doc_date: string
  store_name: string
  sales: number
  purchases: number
  turnover: number
  vat: number
  currency: string
  summary: string
  // Cash-up extras (till slips / payout vouchers)
  cash_role?: 'till_slip' | 'payout_voucher' | 'none'
  description?: string // main item bought, e.g. "Milk"
  excl_vat?: number
  declared_tips?: number // from a handwritten payout voucher
}

/** The editable values the user confirms on the review screen before applying. */
export interface ApplyDocumentInput {
  id: number
  store_id: number | null
  period: string
  sales: number
  purchases: number
  turnover: number
  vat: number
  supplier: string
  doc_date: string
  summary: string
  task_id: number | null
  destination: DocDestination
  description: string // line description for cash-up / purchases rows
  excl_vat: number
  source_missing: boolean
}

export interface ApiKeyStatus {
  set: boolean
  encryptionAvailable: boolean
}

/** Spreadsheet preview returned for local (non-AI) review. */
export interface SheetPreview {
  sheet: string
  rows: string[][]
}
