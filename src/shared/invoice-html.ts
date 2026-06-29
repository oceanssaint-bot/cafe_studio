import { formatZar, periodLabel } from './defaults'
import { GLORIA_BRAND, brandCss, brandFontLink, brandHeader, type Brand } from './brand'
import type { RoyaltyInvoice, StatementAccount } from './types'

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function fmtDate(d: string): string {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(d)
  if (!m) return d
  return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-ZA', { dateStyle: 'long' })
}

/**
 * Renders a royalty TAX INVOICE in the active brand's identity: branded header,
 * line items (Royalties Fee + Marketing Fee with Amount / VAT / Total), grand
 * total and banking details.
 */
export function renderRoyaltyInvoiceHtml(
  inv: RoyaltyInvoice,
  account: StatementAccount | null,
  brand: Brand = GLORIA_BRAND
): string {
  const r = inv
  const royVat = Math.round(r.royalty_fee * 0.15 * 100) / 100
  const mktVat = Math.round(r.marketing_fee * 0.15 * 100) / 100
  const invoiceNo = r.invoice_no || `GJ-ROY-${account?.customer_code || r.store_id}-${r.period}`
  const custName = account?.customer_name || r.storeName

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>Tax Invoice ${esc(invoiceNo)} — ${esc(r.storeName)}</title>
${brandFontLink(brand)}
<style>${brandCss(brand)}
  .cust{margin:22px 0;font-size:13.5px;line-height:1.55;}
  .sect td{background:var(--surface);font-weight:700;color:var(--ink);font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;}
  .bank{margin-top:26px;font-size:12.5px;color:var(--ink);padding:12px 16px;line-height:1.6;}
  .bank b{color:var(--ink);}
</style></head><body><div class="sheet">
  ${brandHeader(
    brand,
    'Tax Invoice',
    `Invoice No: <b>${esc(invoiceNo)}</b><br>Invoice Date: <b>${esc(fmtDate(r.invoice_date))}</b><br>Period: ${esc(periodLabel(r.period))}`
  )}

  <div class="cust">
    <div class="lbl">Bill To</div>
    <strong>${esc(custName)}</strong><br>
    ${account?.address ? esc(account.address) + '<br>' : ''}
    ${account?.customer_code ? 'Customer Code: ' + esc(account.customer_code) + '<br>' : ''}
    ${account?.vat_no ? 'VAT: ' + esc(account.vat_no) : ''}
  </div>

  <table>
    <thead><tr><th>Description</th><th class="num">Amount</th><th class="num">VAT</th><th class="num">Total</th></tr></thead>
    <tbody>
      <tr class="sect"><td colspan="4">${esc(r.storeName)} — ${esc(periodLabel(r.period))} (Turnover ${formatZar(r.turnover)})</td></tr>
      <tr><td>Royalties Fee ${r.rate}%</td><td class="num">${formatZar(r.royalty_fee)}</td><td class="num">${formatZar(royVat)}</td><td class="num">${formatZar(r.royalty_fee + royVat)}</td></tr>
      <tr><td>Marketing Fee 2.5%</td><td class="num">${formatZar(r.marketing_fee)}</td><td class="num">${formatZar(mktVat)}</td><td class="num">${formatZar(r.marketing_fee + mktVat)}</td></tr>
    </tbody>
    <tfoot>
      <tr><td>Total</td><td class="num">${formatZar(r.royalty_fee + r.marketing_fee)}</td><td class="num">${formatZar(r.vat)}</td><td class="num">${formatZar(r.total_incl)}</td></tr>
    </tfoot>
  </table>

  <div class="bank panel">
    <b>Banking Details</b><br>
    ${esc(brand.bank.name)} · ${esc(brand.bank.bank)} · Branch Code: ${esc(brand.bank.branch)} · Account Number: ${esc(brand.bank.account)}<br>
    Reference: ${esc(account?.customer_code || r.storeName)} — ${esc(invoiceNo)}
  </div>
</div></body></html>`
}
