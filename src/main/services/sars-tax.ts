/**
 * South African PAYE / UIF / SDL engine — 2025/26 tax year (1 Mar 2025–28 Feb 2026).
 * Monthly PAYE uses SARS's annualisation method (gross × 12 → tax tables → less
 * rebates → ÷ 12). A pure module so the tables are easy to update each year.
 */

// Annual tax brackets: [upperLimit, baseTax, marginalRate, lowerThreshold]
const BRACKETS: Array<[number, number, number, number]> = [
  [237100, 0, 0.18, 0],
  [370500, 42678, 0.26, 237100],
  [512800, 77362, 0.31, 370500],
  [673000, 121475, 0.36, 512800],
  [857900, 179147, 0.39, 673000],
  [1817000, 251258, 0.41, 857900],
  [Infinity, 644489, 0.45, 1817000]
]

const PRIMARY_REBATE = 17235 // under 65
const SECONDARY_REBATE = 9444 // 65–74 (additional)
const TERTIARY_REBATE = 3145 // 75+ (additional)

const UIF_RATE = 0.01
const UIF_MONTHLY_CEILING = 17712 // remuneration cap → max R177.12 each side
const SDL_RATE = 0.01

function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

function annualTax(annual: number): number {
  for (const [upper, base, rate, lower] of BRACKETS) {
    if (annual <= upper) return base + (annual - lower) * rate
  }
  return 0
}

function rebateForAge(age: number): number {
  let r = PRIMARY_REBATE
  if (age >= 65) r += SECONDARY_REBATE
  if (age >= 75) r += TERTIARY_REBATE
  return r
}

/** Monthly PAYE for a given monthly gross + age (annualised SARS method). */
export function computePaye(monthlyGross: number, age = 30): number {
  if (monthlyGross <= 0) return 0
  const annual = monthlyGross * 12
  const tax = Math.max(0, annualTax(annual) - rebateForAge(age))
  return round2(tax / 12)
}

/** Employee UIF: 1% of gross, capped at the monthly remuneration ceiling. */
export function computeUif(monthlyGross: number): number {
  return round2(Math.min(Math.max(monthlyGross, 0), UIF_MONTHLY_CEILING) * UIF_RATE)
}

/** Employer SDL: 1% of gross (only payable once annual payroll > R500k). */
export function computeSdl(monthlyGross: number): number {
  return round2(Math.max(monthlyGross, 0) * SDL_RATE)
}

/** Age in years from a YYYY-MM-DD date of birth (0 → default 30 used by callers). */
export function ageFromDob(dob: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob)
  if (!m) return 30
  const birth = new Date(+m[1], +m[2] - 1, +m[3])
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--
  return age > 0 && age < 120 ? age : 30
}
