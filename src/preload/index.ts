import { contextBridge, ipcRenderer } from 'electron'
import type {
  DbStatus,
  AppInfo,
  Task,
  TaskStats,
  CreateTaskInput,
  UpdateTaskInput,
  Store,
  MonthlyStoreData,
  SaveMonthlyStoreInput,
  CreateStoreInput,
  UpdateStoreInput,
  ImportSummary,
  CashUpData,
  CashPayout,
  CashPayoutInput,
  CashDeclaration,
  CashImportResult,
  LedgerKind,
  LedgerView,
  LedgerItem,
  LedgerItemInput,
  LedgerEntity,
  LedgerImportSummary,
  StockTake,
  StockTakeInput,
  PayrollView,
  PayrollItem,
  PayrollInput,
  PayRunLine,
  PayRunResult,
  PayRunPreviewRow,
  Payslip,
  Emp201,
  StaffHoursImportSummary,
  AusAccountView,
  AusImportSummary,
  StoreOverview,
  StorePackResult,
  Staff,
  StaffInput,
  StaffSyncSummary,
  Alert,
  TrendsView,
  MenuItem,
  MenuItemInput,
  RecipeLine,
  RecipeLineInput,
  StockItem,
  StockItemInput,
  StockMovement,
  StockSummary,
  ReceiveLine,
  CountLine,
  StockActionResult,
  StockReconView,
  StockSheetImportSummary,
  StockOutImportSummary,
  ReportType,
  ReportData,
  TurnoverView,
  TurnoverImportSummary,
  RoyaltyView,
  RoyaltyGenerateSummary,
  PendingInvoice,
  BatchExportSummary,
  EmailDraftSummary,
  StatementStoreRef,
  StatementView,
  StatementImportSummary,
  PurchaseImportSummary,
  StorePurchaseView,
  CatalogStats,
  CatalogQuery,
  CatalogImportSummary,
  FileCatalogEntry,
  ExportResult,
  SearchResults,
  ActivityItem,
  BackupResult,
  AppDocument,
  ApplyDocumentInput,
  DocDestination,
  ApiKeyStatus,
  SheetPreview
} from '../shared/types'

// The single, typed surface the renderer is allowed to touch. Everything is
// funnelled through IPC so the renderer never holds a Node or DB handle.
const api = {
  getDbStatus: (): Promise<DbStatus> => ipcRenderer.invoke('db:status'),
  getAppInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  tasks: {
    list: (period: string): Promise<Task[]> => ipcRenderer.invoke('tasks:list', period),
    create: (input: CreateTaskInput): Promise<Task> =>
      ipcRenderer.invoke('tasks:create', input),
    update: (input: UpdateTaskInput): Promise<Task> =>
      ipcRenderer.invoke('tasks:update', input),
    setStatus: (id: number, complete: boolean): Promise<Task> =>
      ipcRenderer.invoke('tasks:setStatus', id, complete),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('tasks:delete', id),
    stats: (period: string): Promise<TaskStats> =>
      ipcRenderer.invoke('tasks:stats', period),
    periods: (): Promise<string[]> => ipcRenderer.invoke('tasks:periods')
  },
  stores: {
    list: (includeArchived?: boolean): Promise<Store[]> =>
      ipcRenderer.invoke('stores:list', includeArchived),
    create: (input: CreateStoreInput): Promise<Store> =>
      ipcRenderer.invoke('stores:create', input),
    update: (input: UpdateStoreInput): Promise<Store> =>
      ipcRenderer.invoke('stores:update', input),
    getData: (storeId: number, period: string): Promise<MonthlyStoreData> =>
      ipcRenderer.invoke('stores:getData', storeId, period),
    saveData: (input: SaveMonthlyStoreInput): Promise<MonthlyStoreData> =>
      ipcRenderer.invoke('stores:saveData', input),
    setBillingEmail: (id: number, email: string): Promise<void> =>
      ipcRenderer.invoke('stores:setBillingEmail', id, email)
  },
  importArchive: (): Promise<ImportSummary> => ipcRenderer.invoke('import:archive'),
  cash: {
    get: (storeId: number, period: string): Promise<CashUpData> =>
      ipcRenderer.invoke('cash:get', storeId, period),
    add: (input: CashPayoutInput): Promise<CashPayout> => ipcRenderer.invoke('cash:add', input),
    update: (input: CashPayoutInput): Promise<void> => ipcRenderer.invoke('cash:update', input),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('cash:delete', id),
    declare: (d: CashDeclaration): Promise<void> => ipcRenderer.invoke('cash:declare', d),
    importSlips: (storeId: number, period: string): Promise<CashImportResult> =>
      ipcRenderer.invoke('cash:importSlips', storeId, period)
  },
  ledger: {
    entities: (): Promise<LedgerEntity[]> => ipcRenderer.invoke('ledger:entities'),
    view: (kind: LedgerKind, entityStoreId: number): Promise<LedgerView> =>
      ipcRenderer.invoke('ledger:view', kind, entityStoreId),
    add: (input: LedgerItemInput): Promise<LedgerItem> => ipcRenderer.invoke('ledger:add', input),
    update: (input: LedgerItemInput): Promise<void> => ipcRenderer.invoke('ledger:update', input),
    markPaid: (id: number, paid: number): Promise<void> =>
      ipcRenderer.invoke('ledger:markPaid', id, paid),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('ledger:delete', id),
    import: (): Promise<LedgerImportSummary> => ipcRenderer.invoke('ledger:import')
  },
  stock: {
    list: (entityStoreId: number): Promise<StockTake[]> =>
      ipcRenderer.invoke('stock:list', entityStoreId),
    upsert: (input: StockTakeInput): Promise<void> => ipcRenderer.invoke('stock:upsert', input),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('stock:delete', id)
  },
  payroll: {
    get: (entityStoreId: number, period: string): Promise<PayrollView> =>
      ipcRenderer.invoke('payroll:get', entityStoreId, period),
    add: (input: PayrollInput): Promise<PayrollItem> => ipcRenderer.invoke('payroll:add', input),
    update: (input: PayrollInput): Promise<void> => ipcRenderer.invoke('payroll:update', input),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('payroll:delete', id),
    importHours: (): Promise<StaffHoursImportSummary> => ipcRenderer.invoke('payroll:importHours')
  },
  payrun: {
    staff: (storeId: number): Promise<Array<{ id: number; name: string; monthly_pay: number; dob: string }>> =>
      ipcRenderer.invoke('payrun:staff', storeId),
    run: (storeId: number, period: string, lines: PayRunLine[]): Promise<PayRunResult> =>
      ipcRenderer.invoke('payrun:run', storeId, period, lines),
    preview: (lines: PayRunLine[]): Promise<PayRunPreviewRow[]> =>
      ipcRenderer.invoke('payrun:preview', lines),
    slips: (storeId: number, period: string): Promise<Payslip[]> =>
      ipcRenderer.invoke('payrun:slips', storeId, period),
    periods: (storeId: number): Promise<string[]> => ipcRenderer.invoke('payrun:periods', storeId),
    emp201: (storeId: number, period: string): Promise<Emp201> =>
      ipcRenderer.invoke('payrun:emp201', storeId, period),
    exportPayslip: (id: number): Promise<ExportResult> =>
      ipcRenderer.invoke('payrun:exportPayslip', id),
    printPayslip: (id: number): Promise<ExportResult> => ipcRenderer.invoke('payrun:printPayslip', id),
    exportBatch: (storeId: number, period: string): Promise<BatchExportSummary> =>
      ipcRenderer.invoke('payrun:exportBatch', storeId, period)
  },
  aus: {
    get: (ledger?: string): Promise<AusAccountView> => ipcRenderer.invoke('aus:get', ledger),
    import: (): Promise<AusImportSummary> => ipcRenderer.invoke('aus:import')
  },
  alerts: {
    get: (mode: 'store' | 'franchise', storeId: number | null, period: string): Promise<Alert[]> =>
      ipcRenderer.invoke('alerts:get', mode, storeId, period)
  },
  trends: {
    store: (storeId: number): Promise<TrendsView> => ipcRenderer.invoke('trends:store', storeId)
  },
  menu: {
    items: (storeId: number): Promise<MenuItem[]> => ipcRenderer.invoke('menu:items', storeId),
    upsert: (input: MenuItemInput): Promise<number> => ipcRenderer.invoke('menu:upsert', input),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('menu:delete', id),
    recipe: (menuItemId: number): Promise<RecipeLine[]> => ipcRenderer.invoke('menu:recipe', menuItemId),
    setRecipe: (menuItemId: number, lines: RecipeLineInput[]): Promise<void> =>
      ipcRenderer.invoke('menu:setRecipe', menuItemId, lines)
  },
  stockControl: {
    items: (storeId: number): Promise<StockItem[]> => ipcRenderer.invoke('stockctl:items', storeId),
    upsertItem: (input: StockItemInput): Promise<StockItem> =>
      ipcRenderer.invoke('stockctl:upsertItem', input),
    receive: (storeId: number, date: string, supplier: string, ref: string, lines: ReceiveLine[]): Promise<StockActionResult> =>
      ipcRenderer.invoke('stockctl:receive', storeId, date, supplier, ref, lines),
    waste: (storeId: number, itemId: number, qty: number, reason: string, date: string): Promise<StockActionResult> =>
      ipcRenderer.invoke('stockctl:waste', storeId, itemId, qty, reason, date),
    count: (storeId: number, date: string, counts: CountLine[]): Promise<StockActionResult> =>
      ipcRenderer.invoke('stockctl:count', storeId, date, counts),
    movements: (storeId: number): Promise<StockMovement[]> =>
      ipcRenderer.invoke('stockctl:movements', storeId),
    summary: (storeId: number, period: string): Promise<StockSummary> =>
      ipcRenderer.invoke('stockctl:summary', storeId, period)
  },
  staff: {
    list: (storeId: number): Promise<Staff[]> => ipcRenderer.invoke('staff:list', storeId),
    upsert: (input: StaffInput): Promise<Staff> => ipcRenderer.invoke('staff:upsert', input),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('staff:delete', id),
    sync: (storeId: number): Promise<StaffSyncSummary> => ipcRenderer.invoke('staff:sync', storeId)
  },
  store: {
    overview: (storeId: number, period: string): Promise<StoreOverview> =>
      ipcRenderer.invoke('store:overview', storeId, period),
    periods: (storeId: number): Promise<string[]> => ipcRenderer.invoke('store:periods', storeId),
    exportPack: (storeId: number, period: string): Promise<StorePackResult> =>
      ipcRenderer.invoke('store:exportPack', storeId, period),
    importPack: (): Promise<StorePackResult> => ipcRenderer.invoke('store:importPack')
  },
  stockRecon: {
    importSheets: (): Promise<StockSheetImportSummary> => ipcRenderer.invoke('stockrecon:importSheets'),
    importInvoices: (): Promise<StockOutImportSummary> => ipcRenderer.invoke('stockrecon:importInvoices'),
    view: (asOf?: string): Promise<StockReconView> => ipcRenderer.invoke('stockrecon:view', asOf),
    export: (asOf?: string): Promise<ExportResult> => ipcRenderer.invoke('stockrecon:export', asOf)
  },
  turnover: {
    view: (period: string): Promise<TurnoverView> => ipcRenderer.invoke('turnover:view', period),
    import: (): Promise<TurnoverImportSummary> => ipcRenderer.invoke('turnover:import')
  },
  royalty: {
    generate: (period?: string): Promise<RoyaltyGenerateSummary> =>
      ipcRenderer.invoke('royalty:generate', period),
    view: (period?: string, storeId?: number): Promise<RoyaltyView> =>
      ipcRenderer.invoke('royalty:view', period, storeId),
    setPaid: (id: number, paid: boolean): Promise<void> =>
      ipcRenderer.invoke('royalty:setPaid', id, paid),
    setInvoiceNo: (id: number, no: string): Promise<void> =>
      ipcRenderer.invoke('royalty:setInvoiceNo', id, no),
    setRate: (storeId: number, rate: number): Promise<void> =>
      ipcRenderer.invoke('royalty:setRate', storeId, rate),
    setMarketingRate: (storeId: number, rate: number): Promise<void> =>
      ipcRenderer.invoke('royalty:setMarketingRate', storeId, rate),
    pending: (): Promise<PendingInvoice[]> => ipcRenderer.invoke('royalty:pending'),
    approvedUnsent: (): Promise<PendingInvoice[]> => ipcRenderer.invoke('royalty:approvedUnsent'),
    exportApproved: (): Promise<BatchExportSummary> => ipcRenderer.invoke('royalty:exportApproved'),
    emailApproved: (): Promise<EmailDraftSummary> => ipcRenderer.invoke('royalty:emailApproved'),
    setApproved: (id: number, ok: boolean): Promise<void> =>
      ipcRenderer.invoke('royalty:setApproved', id, ok),
    approveAll: (period?: string): Promise<number> => ipcRenderer.invoke('royalty:approveAll', period),
    exportInvoice: (id: number): Promise<ExportResult> =>
      ipcRenderer.invoke('royalty:exportInvoice', id),
    printInvoice: (id: number): Promise<ExportResult> => ipcRenderer.invoke('royalty:printInvoice', id)
  },
  statements: {
    list: (): Promise<StatementStoreRef[]> => ipcRenderer.invoke('statements:list'),
    get: (storeId: number): Promise<StatementView> => ipcRenderer.invoke('statements:get', storeId),
    import: (): Promise<StatementImportSummary> => ipcRenderer.invoke('statements:import'),
    syncRoyalties: (storeId?: number): Promise<{ added: number }> =>
      ipcRenderer.invoke('statements:syncRoyalties', storeId),
    exportPdf: (storeId: number): Promise<ExportResult> =>
      ipcRenderer.invoke('statements:exportPdf', storeId),
    print: (storeId: number): Promise<ExportResult> => ipcRenderer.invoke('statements:print', storeId)
  },
  purchases: {
    import: (): Promise<PurchaseImportSummary> => ipcRenderer.invoke('purchases:import'),
    stores: (): Promise<Array<{ storeId: number; storeName: string }>> =>
      ipcRenderer.invoke('purchases:stores'),
    periods: (storeId: number): Promise<string[]> => ipcRenderer.invoke('purchases:periods', storeId),
    view: (storeId: number, period: string): Promise<StorePurchaseView> =>
      ipcRenderer.invoke('purchases:view', storeId, period)
  },
  catalog: {
    stats: (): Promise<CatalogStats> => ipcRenderer.invoke('catalog:stats'),
    search: (q: CatalogQuery): Promise<FileCatalogEntry[]> => ipcRenderer.invoke('catalog:search', q),
    import: (): Promise<CatalogImportSummary> => ipcRenderer.invoke('catalog:import'),
    open: (path: string): Promise<string> => ipcRenderer.invoke('catalog:open', path)
  },
  reports: {
    data: (type: ReportType, period: string): Promise<ReportData> =>
      ipcRenderer.invoke('reports:data', type, period),
    exportHtml: (type: ReportType, period: string): Promise<ExportResult> =>
      ipcRenderer.invoke('reports:exportHtml', type, period),
    exportPdf: (type: ReportType, period: string): Promise<ExportResult> =>
      ipcRenderer.invoke('reports:exportPdf', type, period),
    print: (type: ReportType, period: string): Promise<ExportResult> =>
      ipcRenderer.invoke('reports:print', type, period)
  },
  search: (query: string): Promise<SearchResults> => ipcRenderer.invoke('search:all', query),
  activity: (limit?: number): Promise<ActivityItem[]> =>
    ipcRenderer.invoke('activity:recent', limit),
  backup: {
    create: (): Promise<BackupResult> => ipcRenderer.invoke('backup:create'),
    restore: (): Promise<BackupResult> => ipcRenderer.invoke('backup:restore')
  },
  documents: {
    list: (): Promise<AppDocument[]> => ipcRenderer.invoke('documents:list'),
    get: (id: number): Promise<AppDocument> => ipcRenderer.invoke('documents:get', id),
    upload: (): Promise<AppDocument[]> => ipcRenderer.invoke('documents:upload'),
    reextract: (id: number): Promise<AppDocument> =>
      ipcRenderer.invoke('documents:reextract', id),
    apply: (input: ApplyDocumentInput): Promise<AppDocument> =>
      ipcRenderer.invoke('documents:apply', input),
    addManual: (kind: AppDocument['kind'], destination: DocDestination): Promise<AppDocument> =>
      ipcRenderer.invoke('documents:addManual', kind, destination),
    remove: (id: number): Promise<void> => ipcRenderer.invoke('documents:delete', id),
    preview: (id: number): Promise<SheetPreview | null> =>
      ipcRenderer.invoke('documents:preview', id),
    open: (id: number): Promise<void> => ipcRenderer.invoke('documents:open', id)
  },
  apikey: {
    status: (): Promise<ApiKeyStatus> => ipcRenderer.invoke('apikey:status'),
    set: (key: string): Promise<ApiKeyStatus> => ipcRenderer.invoke('apikey:set', key),
    clear: (): Promise<ApiKeyStatus> => ipcRenderer.invoke('apikey:clear')
  }
}

export type GloriaApi = typeof api

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('gloria', api)
} else {
  // Fallback for the (disabled) non-isolated case.
  // @ts-ignore - define on window
  window.gloria = api
}
