import { dialog } from 'electron'
import { extractWithClaude, mimeFor, isSpreadsheet } from './extract'
import { addPayout, setDeclaration } from '../repositories/cash'
import { currentPeriod } from '../../shared/defaults'
import type { CashImportResult } from '../../shared/types'

function periodOf(date: string, fallback: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(date)
  return m ? `${m[1]}-${m[2]}` : fallback
}

/**
 * Opens a picker for till-slip / payout-voucher photos, reads each with Claude,
 * and posts till slips as cash-purchase lines and vouchers as the day's
 * declared totals (for reconciliation) — all against the chosen store.
 */
export async function importCashSlips(
  storeId: number,
  period: string
): Promise<CashImportResult> {
  const result: CashImportResult = {
    ok: true,
    slips: 0,
    vouchers: 0,
    skipped: 0,
    warnings: []
  }

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose till-slip / payout-voucher photos to read',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Images & PDF', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'] }]
  })
  if (canceled || filePaths.length === 0) return { ...result, ok: false, cancelled: true }

  for (const file of filePaths) {
    if (isSpreadsheet(file)) {
      result.skipped++
      continue
    }
    try {
      const f = await extractWithClaude(file, mimeFor(file))
      const date = f.doc_date || ''
      const p = periodOf(date, period || currentPeriod())

      if (f.cash_role === 'payout_voucher') {
        setDeclaration({
          store_id: storeId,
          period: p,
          txn_date: date || `${p}-01`,
          declared_purchases: f.purchases || 0,
          declared_tips: f.declared_tips || 0
        })
        result.vouchers++
      } else {
        // Treat anything else readable as a till-slip cash purchase.
        const incl = f.purchases || 0
        if (incl <= 0) {
          result.skipped++
          continue
        }
        addPayout({
          store_id: storeId,
          period: p,
          txn_date: date || `${p}-01`,
          supplier: f.supplier,
          description: f.description || '',
          excl_vat: f.excl_vat || (f.vat ? incl - f.vat : 0),
          vat: f.vat || 0,
          incl_vat: incl,
          kind: 'purchase'
        })
        result.slips++
      }
    } catch (err) {
      result.warnings.push(`${file.split(/[\\/]/).pop()}: ${err instanceof Error ? err.message : err}`)
    }
  }
  return result
}
