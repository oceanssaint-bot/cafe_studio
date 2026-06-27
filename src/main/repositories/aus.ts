import { getDatabase } from '../db'
import type { AusAccountLine, AusAccountView, AusLedgerSummary } from '../../shared/types'

function round2(n: number): number {
  return Math.round((n || 0) * 100) / 100
}

/** The GJC Australia account: per-ledger and combined charged / paid / balance (USD). */
export function getAusAccount(ledger?: string): AusAccountView {
  const db = getDatabase()
  const where = ledger && ledger !== 'all' ? 'WHERE ledger = ?' : ''
  const params = ledger && ledger !== 'all' ? [ledger] : []
  const lines = db
    .prepare(`SELECT * FROM aus_account_lines ${where} ORDER BY txn_date, id`)
    .all(...params) as AusAccountLine[]

  const summaries = db
    .prepare(
      `SELECT ledger,
              SUM(CASE WHEN amount_usd > 0 THEN amount_usd ELSE 0 END) AS charged,
              SUM(CASE WHEN amount_usd < 0 THEN -amount_usd ELSE 0 END) AS paid,
              SUM(amount_usd) AS balance,
              COUNT(*) AS count
       FROM aus_account_lines GROUP BY ledger ORDER BY ledger`
    )
    .all() as Array<{ ledger: string; charged: number; paid: number; balance: number; count: number }>

  const ledgers: AusLedgerSummary[] = summaries.map((s) => ({
    ledger: s.ledger,
    charged: round2(s.charged),
    paid: round2(s.paid),
    balance: round2(s.balance),
    count: s.count
  }))
  const totals = ledgers.reduce(
    (a, l) => ({
      charged: round2(a.charged + l.charged),
      paid: round2(a.paid + l.paid),
      balance: round2(a.balance + l.balance),
      count: a.count + l.count
    }),
    { charged: 0, paid: 0, balance: 0, count: 0 }
  )
  return { ledgers, totals, lines }
}
