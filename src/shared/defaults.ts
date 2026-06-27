import type { StoreCategory } from './types'

export interface SeedStore {
  name: string
  category: StoreCategory
  include_in_australia: 0 | 1
}

// The fixed set of stores. Australia reporting includes the franchise stores
// plus Oceans Mall, but excludes Express Stores and Point Waterfront.
export const SEED_STORES: SeedStore[] = [
  { name: 'Oceans Mall', category: 'head_office', include_in_australia: 1 },
  { name: 'Express Stores', category: 'head_office', include_in_australia: 0 },
  { name: 'Gateway', category: 'franchise', include_in_australia: 1 },
  { name: 'Florida Road', category: 'franchise', include_in_australia: 1 },
  { name: 'Pavilion', category: 'franchise', include_in_australia: 1 },
  { name: 'Lakefield', category: 'franchise', include_in_australia: 1 },
  { name: 'Point Waterfront', category: 'franchise', include_in_australia: 0 }
]

export const CATEGORY_LABEL: Record<StoreCategory, string> = {
  head_office: 'Head Office',
  franchise: 'Franchise'
}

// The standard month-end checklist. When a month is opened for the first time
// these are seeded as that month's tasks (the admin can then add/edit/remove).
export const DEFAULT_TASK_TITLES: string[] = [
  'Royalty Invoices',
  'VAT Submission',
  'Purchases Journal',
  'Sales Reconciliation',
  'Turnover Email Oceans Mall',
  'Turnover Email Australia',
  'Franchise Statements',
  'Consumption Analysis',
  'Creditors',
  'Debtors',
  'Google Information',
  'Stock Take',
  'GAAP Reports',
  'Staff Hours',
  'Salaries'
]

/** Current month as a 'YYYY-MM' period string. */
export function currentPeriod(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** Human label for a 'YYYY-MM' period, e.g. 'June 2026'. */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  const date = new Date(y, m - 1, 1)
  return date.toLocaleString('en-ZA', { month: 'long', year: 'numeric' })
}

/** Shift a 'YYYY-MM' period by a number of months (can be negative). */
export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number)
  const date = new Date(y, m - 1 + months, 1)
  return currentPeriod(date)
}

/** Format a number as South African Rand, e.g. 'R 12 345.67'. */
export function formatZar(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR'
  }).format(value || 0)
}
