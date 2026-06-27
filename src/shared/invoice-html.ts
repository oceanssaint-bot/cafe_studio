import { formatZar, periodLabel } from './defaults'
import { GLORIA_LOGO_DATAURL } from './logo'
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
 * Renders a Gloria Jeans SA royalty TAX INVOICE in the company template:
 * company + customer header, line items (Royalties Fee + Marketing Fee with
 * Amount / VAT / Total), grand total and banking details.
 */
export function renderRoyaltyInvoiceHtml(inv: RoyaltyInvoice, account: StatementAccount | null): string {
  const r = inv
  const royVat = Math.round(r.royalty_fee * 0.15 * 100) / 100
  const mktVat = Math.round(r.marketing_fee * 0.15 * 100) / 100
  const invoiceNo = r.invoice_no || `GJ-ROY-${account?.customer_code || r.store_id}-${r.period}`
  const custName = account?.customer_name || r.storeName

  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<title>Tax Invoice ${esc(invoiceNo)} — ${esc(r.storeName)}</title>
<style>
  :root{--brown:#4b2e2e;--accent:#8b5e34;--cream:#f7f3ee;--ink:#1f2937;--muted:#6b7280;--line:#e5e7eb;}
  *{box-sizing:border-box;} body{font-family:'Segoe UI',system-ui,sans-serif;color:var(--ink);margin:0;padding:44px;background:#fff;}
  .sheet{max-width:880px;margin:0 auto;}
  .logo{height:62px;margin-bottom:12px;display:block;}
  header{display:flex;justify-content:space-between;border-bottom:3px solid var(--accent);padding-bottom:16px;}
  .co{font-size:12.5px;color:var(--muted);line-height:1.55;} .co b{color:var(--brown);font-size:16px;}
  h1{color:var(--brown);font-size:24px;margin:0;text-align:right;} .meta{font-size:13px;color:var(--muted);text-align:right;margin-top:6px;line-height:1.6;}
  .meta b{color:var(--ink);}
  .cust{margin:22px 0;font-size:13.5px;line-height:1.55;}
  .cust .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:2px;}
  table{width:100%;border-collapse:collapse;margin-top:8px;} th,td{padding:10px 14px;font-size:14px;text-align:left;}
  thead th{background:var(--brown);color:var(--cream);font-weight:600;} th.num,td.num{text-align:right;font-variant-numeric:tabular-nums;}
  .sect td{background:var(--cream);font-weight:700;color:var(--brown);font-size:12.5px;text-transform:uppercase;letter-spacing:.03em;}
  tbody td{border-bottom:1px solid var(--line);}
  tfoot td{border-top:2px solid var(--brown);font-weight:700;font-size:15px;color:var(--brown);}
  .bank{margin-top:26px;font-size:12.5px;color:#4b3a2f;background:var(--cream);border-left:4px solid var(--accent);padding:12px 16px;border-radius:4px;line-height:1.6;}
  .bank b{color:var(--brown);}
  @media print{body{padding:0;} thead th,.sect td,.bank{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
</style></head><body><div class="sheet">
  <header>
    <div><img class="logo" src="${GLORIA_LOGO_DATAURL}" alt="Gloria Jean's" /><div class="co"><b>GLORIA JEANS SOUTH AFRICA (PTY) LTD</b><br>Reg No: 2019/311650/07 · VAT No: 4470291941<br>707 Currie Road, Windermere, Durban<br>Postnet Suite 223, Private Bag X10, Musgrave Road, 4062<br>admin@gloriajeanscoffee.co.za</div></div>
    <div><h1>TAX INVOICE</h1><div class="meta">Invoice No: <b>${esc(invoiceNo)}</b><br>Invoice Date: <b>${esc(fmtDate(r.invoice_date))}</b><br>Period: ${esc(periodLabel(r.period))}</div></div>
  </header>

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

  <div class="bank">
    <b>Banking Details</b><br>
    Gloria Jeans South Africa · First National Bank · Branch Code: 250 655 · Account Number: 62861307702<br>
    Reference: ${esc(account?.customer_code || r.storeName)} — ${esc(invoiceNo)}
  </div>
</div></body></html>`
}
