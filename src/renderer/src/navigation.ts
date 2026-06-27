export type PageId =
  | 'dashboard'
  | 'month-end'
  | 'stores'
  | 'cash-up'
  | 'ledgers'
  | 'payroll'
  | 'staff'
  | 'stock'
  | 'stock-control'
  | 'menu'
  | 'trends'
  | 'turnover'
  | 'purchases'
  | 'royalties'
  | 'statements'
  | 'gjc-aus'
  | 'documents'
  | 'records'
  | 'reports'
  | 'settings'

/** The two "offices" the app can operate as. */
export type OfficeMode = 'store' | 'franchise'

export interface NavItem {
  id: PageId
  label: string
  icon: string
  description: string
  /** Which office(s) this page belongs to. */
  modes: OfficeMode[]
}

/** Nav items for the active office, in sidebar order. */
export function navForMode(mode: OfficeMode): NavItem[] {
  return NAV_ITEMS.filter((i) => i.modes.includes(mode))
}

// Order here is the order shown in the sidebar.
export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '▤',
    description: 'Month-end progress at a glance.',
    modes: ['store', 'franchise']
  },
  {
    id: 'month-end',
    label: 'Month End',
    icon: '✓',
    description: 'Track and complete monthly admin tasks.',
    modes: ['store', 'franchise']
  },
  {
    id: 'stores',
    label: 'Stores',
    icon: '⌂',
    description: 'Store information and monthly data.',
    modes: ['franchise']
  },
  {
    id: 'cash-up',
    label: 'Cash-Up',
    icon: '₵',
    description: 'Daily cash purchases (payouts) reconciled to till slips.',
    modes: ['store']
  },
  {
    id: 'ledgers',
    label: 'Creditors & Debtors',
    icon: '⇄',
    description: 'Who you owe and who owes you — Head Office and per store.',
    modes: ['store', 'franchise']
  },
  {
    id: 'payroll',
    label: 'Payroll',
    icon: '☺',
    description: 'Staff pay per month — Head Office and per store.',
    modes: ['store', 'franchise']
  },
  {
    id: 'staff',
    label: 'Staff',
    icon: '👤',
    description: 'Employee register — one profile per person (ID, role, pay, status).',
    modes: ['store', 'franchise']
  },
  {
    id: 'stock-control',
    label: 'Stock',
    icon: '📦',
    description: 'Live stock — receive, count, wastage, value, loss & theft watch.',
    modes: ['store']
  },
  {
    id: 'menu',
    label: 'Menu',
    icon: '☕',
    description: 'Menu items + recipes → cost, margin and what sells (vs stock).',
    modes: ['store']
  },
  {
    id: 'trends',
    label: 'Trends',
    icon: '📈',
    description: 'Time-based performance — turnover, mix & profit since opening.',
    modes: ['store']
  },
  {
    id: 'stock',
    label: 'Stock Take',
    icon: '▣',
    description: 'Head Office stock-take snapshots and reconciliation.',
    modes: ['franchise']
  },
  {
    id: 'turnover',
    label: 'Turnover',
    icon: '↗',
    description: 'Daily POS turnover by store, reconciled to the monthly figures.',
    modes: ['store', 'franchise']
  },
  {
    id: 'purchases',
    label: 'Purchases',
    icon: '🛒',
    description: 'Per-store purchase journal — Oceans Mall for SARS, others for record-keeping.',
    modes: ['store', 'franchise']
  },
  {
    id: 'royalties',
    label: 'Royalties',
    icon: '%',
    description: 'Auto-calculated royalty invoices per store, with paid tracking.',
    modes: ['franchise']
  },
  {
    id: 'statements',
    label: 'Statements',
    icon: '☰',
    description: 'Per-store Statement of Account — invoices, royalties, payments, balance.',
    modes: ['franchise']
  },
  {
    id: 'gjc-aus',
    label: 'GJC Aus',
    icon: '🌏',
    description: 'Australia account — royalty & stock owed to Gloria Jeans International (USD).',
    modes: ['franchise']
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: '🗎',
    description: 'Upload receipts, invoices and spreadsheets to fill data automatically.',
    modes: ['store', 'franchise']
  },
  {
    id: 'records',
    label: 'Records',
    icon: '🗄',
    description: 'Every archived file — classified, searchable and backed up.',
    modes: ['store', 'franchise']
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: '▦',
    description: 'Generate Head Office, Franchise and Australia packs.',
    modes: ['franchise']
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: '⚙',
    description: 'Application preferences and database.',
    modes: ['store', 'franchise']
  }
]
