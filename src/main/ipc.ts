import { app, ipcMain, shell } from 'electron'
import { getDbStatus } from './db'
import {
  listTasks,
  createTask,
  updateTask,
  setTaskStatus,
  deleteTask,
  getTaskStats,
  listPeriods
} from './repositories/tasks'
import {
  listStores,
  getMonthlyData,
  saveMonthlyData,
  createStore,
  updateStore,
  setBillingEmail
} from './repositories/stores'
import { importArchiveDialog } from './services/import-archive'
import { importTurnoverDialog } from './services/import-turnover'
import { getTurnoverView } from './repositories/turnover'
import { catalogArchiveDialog } from './services/catalog-import'
import { getCatalogStats, searchCatalog } from './repositories/catalog'
import {
  generateRoyalties,
  getRoyaltyView,
  setRoyaltyPaid,
  setRoyaltyInvoiceNo,
  setStoreRoyaltyRate,
  listPendingInvoices,
  setRoyaltyApproved,
  approveAllRoyalties,
  listApprovedUnsent
} from './repositories/royalties'
import { importStatementsDialog } from './services/import-statements'
import { listStatementStores, getStatement, syncStatementRoyalties } from './repositories/statements'
import { importPurchasesDialog } from './services/import-purchases'
import {
  listPurchaseStores,
  listPurchasePeriods,
  getStorePurchaseView
} from './repositories/purchases'
import { importStaffHoursDialog } from './services/import-staff-hours'
import { importAusDialog } from './services/import-aus'
import { getAusAccount } from './repositories/aus'
import { importStockSheetsDialog } from './services/import-stock-sheets'
import { importStockInvoicesDialog } from './services/import-stock-invoices'
import { getStockReconciliation } from './repositories/stock-recon'
import { getStoreOverview, listStorePeriods } from './repositories/store-overview'
import { listStaff, upsertStaff, deleteStaff, syncStaffFromPayroll } from './repositories/staff'
import { getAlerts } from './repositories/alerts'
import { listMenuItems, upsertMenuItem, deleteMenuItem, getRecipe, setRecipe } from './repositories/menu'
import { getStoreTrends } from './repositories/trends'
import {
  listStockItems,
  upsertStockItem,
  receiveStock,
  recordWaste,
  recordCount,
  listMovements,
  getStockSummary
} from './repositories/stock-control'
import { exportStorePack, importStorePack } from './services/store-pack'
import {
  getCashUp,
  addPayout,
  updatePayout,
  deletePayout,
  setDeclaration
} from './repositories/cash'
import { importCashSlips } from './services/import-cash'
import {
  getLedgerView,
  listLedgerEntities,
  addLedgerItem,
  updateLedgerItem,
  markPaid,
  deleteLedgerItem
} from './repositories/ledger'
import { importLedgersDialog } from './services/import-ledgers'
import { listStockTakes, upsertStockTake, deleteStockTake } from './repositories/stock'
import { getPayroll, addPayroll, updatePayroll, deletePayroll } from './repositories/payroll'
import { getReportData } from './repositories/reports'
import {
  exportReportHtml,
  exportReportPdf,
  printReport,
  exportStatementPdf,
  printStatement,
  exportInvoicePdf,
  printInvoice,
  exportApprovedInvoices,
  emailApprovedInvoices,
  exportStockReconExcel
} from './export'
import { searchAll } from './repositories/search'
import { recentActivity } from './repositories/activity'
import { backupDatabase, restoreDatabase } from './backup'
import {
  listDocuments,
  getDocument,
  applyDocument,
  deleteDocument
} from './repositories/documents'
import {
  uploadDocuments,
  reextractDocument,
  previewDocument,
  openDocumentFile
} from './services/ingest'
import { getApiKeyStatus, setApiKey, clearApiKey } from './services/apikey'
import type {
  AppInfo,
  CatalogQuery,
  CreateTaskInput,
  UpdateTaskInput,
  SaveMonthlyStoreInput,
  ReportType,
  ApplyDocumentInput,
  CreateStoreInput,
  UpdateStoreInput,
  CashPayoutInput,
  CashDeclaration,
  LedgerKind,
  LedgerItemInput,
  StockTakeInput,
  PayrollInput
} from '../shared/types'

/**
 * Registers every IPC handler the renderer can call. Called once on app ready.
 * Each channel maps to a small, typed operation; the renderer never touches
 * Node or the database directly.
 */
export function registerIpcHandlers(): void {
  // App / database status
  ipcMain.handle('db:status', () => getDbStatus())
  ipcMain.handle('app:info', (): AppInfo => ({
    name: 'Cafe Studio',
    version: app.getVersion(),
    platform: process.platform
  }))

  // Month-end tasks
  ipcMain.handle('tasks:list', (_e, period: string) => listTasks(period))
  ipcMain.handle('tasks:create', (_e, input: CreateTaskInput) => createTask(input))
  ipcMain.handle('tasks:update', (_e, input: UpdateTaskInput) => updateTask(input))
  ipcMain.handle('tasks:setStatus', (_e, id: number, complete: boolean) =>
    setTaskStatus(id, complete)
  )
  ipcMain.handle('tasks:delete', (_e, id: number) => deleteTask(id))
  ipcMain.handle('tasks:stats', (_e, period: string) => getTaskStats(period))
  ipcMain.handle('tasks:periods', () => listPeriods())

  // Stores
  ipcMain.handle('stores:list', (_e, includeArchived?: boolean) =>
    listStores(includeArchived ?? false)
  )
  ipcMain.handle('stores:create', (_e, input: CreateStoreInput) => createStore(input))
  ipcMain.handle('stores:update', (_e, input: UpdateStoreInput) => updateStore(input))
  ipcMain.handle('stores:setBillingEmail', (_e, id: number, email: string) =>
    setBillingEmail(id, email)
  )
  ipcMain.handle('stores:getData', (_e, storeId: number, period: string) =>
    getMonthlyData(storeId, period)
  )
  ipcMain.handle('stores:saveData', (_e, input: SaveMonthlyStoreInput) =>
    saveMonthlyData(input)
  )
  ipcMain.handle('import:archive', () => importArchiveDialog())

  // Cash-up & payouts
  ipcMain.handle('cash:get', (_e, storeId: number, period: string) =>
    getCashUp(storeId, period)
  )
  ipcMain.handle('cash:add', (_e, input: CashPayoutInput) => addPayout(input))
  ipcMain.handle('cash:update', (_e, input: CashPayoutInput) => updatePayout(input))
  ipcMain.handle('cash:delete', (_e, id: number) => deletePayout(id))
  ipcMain.handle('cash:declare', (_e, d: CashDeclaration) => setDeclaration(d))
  ipcMain.handle('cash:importSlips', (_e, storeId: number, period: string) =>
    importCashSlips(storeId, period)
  )

  // Creditors & Debtors ledger
  ipcMain.handle('ledger:entities', () => listLedgerEntities())
  ipcMain.handle('ledger:view', (_e, kind: LedgerKind, entityStoreId: number) =>
    getLedgerView(kind, entityStoreId)
  )
  ipcMain.handle('ledger:add', (_e, input: LedgerItemInput) => addLedgerItem(input))
  ipcMain.handle('ledger:update', (_e, input: LedgerItemInput) => updateLedgerItem(input))
  ipcMain.handle('ledger:markPaid', (_e, id: number, paid: number) => markPaid(id, paid))
  ipcMain.handle('ledger:delete', (_e, id: number) => deleteLedgerItem(id))
  ipcMain.handle('ledger:import', () => importLedgersDialog())

  // Stock takes
  ipcMain.handle('stock:list', (_e, entityStoreId: number) => listStockTakes(entityStoreId))
  ipcMain.handle('stock:upsert', (_e, input: StockTakeInput) => upsertStockTake(input))
  ipcMain.handle('stock:delete', (_e, id: number) => deleteStockTake(id))

  // Payroll
  ipcMain.handle('payroll:get', (_e, entityStoreId: number, period: string) =>
    getPayroll(entityStoreId, period)
  )
  ipcMain.handle('payroll:add', (_e, input: PayrollInput) => addPayroll(input))
  ipcMain.handle('payroll:update', (_e, input: PayrollInput) => updatePayroll(input))
  ipcMain.handle('payroll:delete', (_e, id: number) => deletePayroll(id))

  // Turnover (daily POS reports)
  ipcMain.handle('turnover:view', (_e, period: string) => getTurnoverView(period))
  ipcMain.handle('turnover:import', () => importTurnoverDialog())

  // Royalties (auto-computed from turnover)
  ipcMain.handle('royalty:generate', (_e, period?: string) => generateRoyalties(period))
  ipcMain.handle('royalty:view', (_e, period?: string, storeId?: number) =>
    getRoyaltyView(period, storeId)
  )
  ipcMain.handle('royalty:setPaid', (_e, id: number, paid: boolean) => setRoyaltyPaid(id, paid))
  ipcMain.handle('royalty:setInvoiceNo', (_e, id: number, no: string) => setRoyaltyInvoiceNo(id, no))
  ipcMain.handle('royalty:setRate', (_e, storeId: number, rate: number) =>
    setStoreRoyaltyRate(storeId, rate)
  )
  ipcMain.handle('royalty:pending', () => listPendingInvoices())
  ipcMain.handle('royalty:approvedUnsent', () => listApprovedUnsent())
  ipcMain.handle('royalty:exportApproved', () => exportApprovedInvoices())
  ipcMain.handle('royalty:emailApproved', () => emailApprovedInvoices())
  ipcMain.handle('royalty:setApproved', (_e, id: number, ok: boolean) => setRoyaltyApproved(id, ok))
  ipcMain.handle('royalty:approveAll', (_e, period?: string) => approveAllRoyalties(period))
  ipcMain.handle('royalty:exportInvoice', (_e, id: number) => exportInvoicePdf(id))
  ipcMain.handle('royalty:printInvoice', (_e, id: number) => printInvoice(id))

  // Statements of Account (per-store debtor ledger)
  ipcMain.handle('statements:list', () => listStatementStores())
  ipcMain.handle('statements:get', (_e, storeId: number) => getStatement(storeId))
  ipcMain.handle('statements:import', () => importStatementsDialog())
  ipcMain.handle('statements:syncRoyalties', (_e, storeId?: number) =>
    syncStatementRoyalties(storeId)
  )
  ipcMain.handle('statements:exportPdf', (_e, storeId: number) => exportStatementPdf(storeId))
  ipcMain.handle('statements:print', (_e, storeId: number) => printStatement(storeId))

  // Stock control (perpetual store inventory)
  ipcMain.handle('stockctl:items', (_e, storeId: number) => listStockItems(storeId))
  ipcMain.handle('stockctl:upsertItem', (_e, input) => upsertStockItem(input))
  ipcMain.handle('stockctl:receive', (_e, storeId, date, supplier, ref, lines) =>
    receiveStock(storeId, date, supplier, ref, lines)
  )
  ipcMain.handle('stockctl:waste', (_e, storeId, itemId, qty, reason, date) =>
    recordWaste(storeId, itemId, qty, reason, date)
  )
  ipcMain.handle('stockctl:count', (_e, storeId, date, counts) => recordCount(storeId, date, counts))
  ipcMain.handle('stockctl:movements', (_e, storeId: number) => listMovements(storeId))
  ipcMain.handle('stockctl:summary', (_e, storeId: number, period: string) =>
    getStockSummary(storeId, period)
  )

  // Trends (time-based reports)
  ipcMain.handle('trends:store', (_e, storeId: number) => getStoreTrends(storeId))

  // Menu & recipes
  ipcMain.handle('menu:items', (_e, storeId: number) => listMenuItems(storeId))
  ipcMain.handle('menu:upsert', (_e, input) => upsertMenuItem(input))
  ipcMain.handle('menu:delete', (_e, id: number) => deleteMenuItem(id))
  ipcMain.handle('menu:recipe', (_e, menuItemId: number) => getRecipe(menuItemId))
  ipcMain.handle('menu:setRecipe', (_e, menuItemId: number, lines) => setRecipe(menuItemId, lines))

  // Daily Command Center alerts
  ipcMain.handle('alerts:get', (_e, mode: 'store' | 'franchise', storeId: number | null, period: string) =>
    getAlerts(mode, storeId, period)
  )

  // Staff register
  ipcMain.handle('staff:list', (_e, storeId: number) => listStaff(storeId))
  ipcMain.handle('staff:upsert', (_e, input) => upsertStaff(input))
  ipcMain.handle('staff:delete', (_e, id: number) => deleteStaff(id))
  ipcMain.handle('staff:sync', (_e, storeId: number) => syncStaffFromPayroll(storeId))

  // Store overview (Store-mode dashboard)
  ipcMain.handle('store:overview', (_e, storeId: number, period: string) =>
    getStoreOverview(storeId, period)
  )
  ipcMain.handle('store:periods', (_e, storeId: number) => listStorePeriods(storeId))
  ipcMain.handle('store:exportPack', (_e, storeId: number, period: string) =>
    exportStorePack(storeId, period)
  )
  ipcMain.handle('store:importPack', () => importStorePack())

  // Stock reconciliation (updated stock take)
  ipcMain.handle('stockrecon:importSheets', () => importStockSheetsDialog())
  ipcMain.handle('stockrecon:importInvoices', () => importStockInvoicesDialog())
  ipcMain.handle('stockrecon:view', (_e, asOf?: string) => getStockReconciliation(asOf))
  ipcMain.handle('stockrecon:export', (_e, asOf?: string) => exportStockReconExcel(asOf))

  // Staff Hours → payroll
  ipcMain.handle('payroll:importHours', () => importStaffHoursDialog())

  // GJC Australia account (USD payable)
  ipcMain.handle('aus:import', () => importAusDialog())
  ipcMain.handle('aus:get', (_e, ledger?: string) => getAusAccount(ledger))

  // Store Purchases (detailed purchase journal)
  ipcMain.handle('purchases:import', () => importPurchasesDialog())
  ipcMain.handle('purchases:stores', () => listPurchaseStores())
  ipcMain.handle('purchases:periods', (_e, storeId: number) => listPurchasePeriods(storeId))
  ipcMain.handle('purchases:view', (_e, storeId: number, period: string) =>
    getStorePurchaseView(storeId, period)
  )

  // File catalog (universal archive registry)
  ipcMain.handle('catalog:stats', () => getCatalogStats())
  ipcMain.handle('catalog:search', (_e, q: CatalogQuery) => searchCatalog(q))
  ipcMain.handle('catalog:import', () => catalogArchiveDialog())
  ipcMain.handle('catalog:open', (_e, path: string) => shell.openPath(path))

  // Reports
  ipcMain.handle('reports:data', (_e, type: ReportType, period: string) =>
    getReportData(type, period)
  )
  ipcMain.handle('reports:exportHtml', (_e, type: ReportType, period: string) =>
    exportReportHtml(type, period)
  )
  ipcMain.handle('reports:exportPdf', (_e, type: ReportType, period: string) =>
    exportReportPdf(type, period)
  )
  ipcMain.handle('reports:print', (_e, type: ReportType, period: string) =>
    printReport(type, period)
  )

  // Polish: search, activity, backup/restore
  ipcMain.handle('search:all', (_e, query: string) => searchAll(query))
  ipcMain.handle('activity:recent', (_e, limit?: number) => recentActivity(limit))
  ipcMain.handle('backup:create', () => backupDatabase())
  ipcMain.handle('backup:restore', () => restoreDatabase())

  // Documents / AI import
  ipcMain.handle('documents:list', () => listDocuments())
  ipcMain.handle('documents:get', (_e, id: number) => getDocument(id))
  ipcMain.handle('documents:upload', () => uploadDocuments())
  ipcMain.handle('documents:reextract', (_e, id: number) => reextractDocument(id))
  ipcMain.handle('documents:apply', (_e, input: ApplyDocumentInput) => applyDocument(input))
  ipcMain.handle('documents:delete', (_e, id: number) => deleteDocument(id))
  ipcMain.handle('documents:preview', (_e, id: number) => previewDocument(id))
  ipcMain.handle('documents:open', (_e, id: number) => openDocumentFile(id))

  // API key
  ipcMain.handle('apikey:status', () => getApiKeyStatus())
  ipcMain.handle('apikey:set', (_e, key: string) => setApiKey(key))
  ipcMain.handle('apikey:clear', () => clearApiKey())
}
