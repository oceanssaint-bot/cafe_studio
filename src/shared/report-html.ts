import { formatZar } from './defaults'
import type { ReportData, ReportType } from './types'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A plain-language explanation of what each pack contains, for any reader. */
const PACK_NOTE: Record<ReportType, string> = {
  head_office:
    'This pack covers the Head Office stores. It shows each store’s turnover and purchases for the month, the royalty invoiced, and the 1% due to Australia.',
  franchise:
    'This pack covers all franchise stores. It shows each store’s turnover and purchases for the month, the royalty invoiced, and the 1% due to Australia.',
  australia:
    'This is the Australia pack. It covers only the stores reported to Australia and shows the turnover used to calculate the 1% royalty due to Australia.'
}

/**
 * Renders a report as a complete, self-contained HTML document. Designed to be
 * readable by anyone — accountant or store staff: a clear heading, the key
 * numbers up front in plain language, then a simple table that adds up.
 */
export function renderReportHtml(data: ReportData): string {
  const generated = new Date(data.generatedAt).toLocaleString('en-ZA', {
    dateStyle: 'long',
    timeStyle: 'short'
  })

  const rows = data.rows
    .map(
      (r, i) => `
        <tr${i % 2 ? ' class="alt"' : ''}>
          <td class="store">${escapeHtml(r.storeName)}</td>
          <td class="num">${formatZar(r.turnover)}</td>
          <td class="num">${formatZar(r.purchases)}</td>
          <td class="num">${formatZar(r.royalty)}</td>
          <td class="num">${formatZar(r.royalty_au)}</td>
        </tr>`
    )
    .join('')

  const card = (label: string, value: string, accent = false): string => `
    <div class="card${accent ? ' accent' : ''}">
      <div class="card-label">${label}</div>
      <div class="card-value">${value}</div>
    </div>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.title)} — ${escapeHtml(data.periodLabel)}</title>
<style>
  :root { --brown:#4b2e2e; --accent:#8b5e34; --cream:#f7f3ee; --ink:#1f2937; --muted:#6b7280; --line:#e5e7eb; }
  * { box-sizing: border-box; }
  body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; color:var(--ink); margin:0; padding:40px; background:#fff; -webkit-font-smoothing:antialiased; }
  .sheet { max-width: 920px; margin: 0 auto; }

  header { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:3px solid var(--accent); padding-bottom:18px; }
  .brand { color:var(--accent); font-size:12px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
  h1 { color:var(--brown); font-size:30px; margin:6px 0 2px; line-height:1.1; }
  .period { color:var(--muted); font-size:17px; }
  .generated { color:var(--muted); font-size:12px; text-align:right; }

  .note { background:var(--cream); border-left:4px solid var(--accent); padding:12px 16px; margin:22px 0; font-size:14px; color:#4b3a2f; border-radius:4px; }

  .cards { display:flex; gap:14px; margin:22px 0; }
  .card { flex:1; border:1px solid var(--line); border-radius:10px; padding:14px 16px; }
  .card.accent { background:var(--brown); border-color:var(--brown); }
  .card.accent .card-label { color:#e7d8cf; }
  .card.accent .card-value { color:#fff; }
  .card-label { font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); }
  .card-value { font-size:22px; font-weight:700; color:var(--brown); margin-top:4px; font-variant-numeric:tabular-nums; }

  h2 { font-size:14px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); margin:26px 0 8px; }
  table { width:100%; border-collapse:collapse; }
  th, td { padding:11px 14px; font-size:14.5px; text-align:left; }
  thead th { background:var(--brown); color:var(--cream); font-weight:600; }
  th.num, td.num { text-align:right; font-variant-numeric:tabular-nums; }
  tbody tr.alt { background:var(--cream); }
  tbody td.store { font-weight:600; }
  tbody tr td { border-bottom:1px solid var(--line); }
  tfoot td { border-top:2px solid var(--brown); font-weight:700; font-size:15px; padding-top:13px; }
  tfoot td.label { color:var(--brown); }

  footer { margin-top:30px; padding-top:14px; border-top:1px solid var(--line); color:#9ca3af; font-size:12px; display:flex; justify-content:space-between; }
  @media print { body { padding:0; } .sheet { max-width:none; } .note { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .card.accent, thead th { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style>
</head>
<body>
  <div class="sheet">
    <header>
      <div>
        <div class="brand">Gloria Jean's Coffee SA</div>
        <h1>${escapeHtml(data.title)}</h1>
        <div class="period">${escapeHtml(data.periodLabel)}</div>
      </div>
      <div class="generated">Generated<br>${escapeHtml(generated)}</div>
    </header>

    <div class="note">${PACK_NOTE[data.type]}</div>

    <div class="cards">
      ${card('Total turnover', formatZar(data.totals.turnover), true)}
      ${card('Total purchases', formatZar(data.totals.purchases))}
      ${card('Royalties invoiced', formatZar(data.totals.royalty))}
      ${card('Due to Australia (1%)', formatZar(data.totals.royalty_au))}
    </div>

    <h2>Breakdown by store</h2>
    <table>
      <thead>
        <tr>
          <th>Store</th>
          <th class="num">Turnover</th>
          <th class="num">Purchases</th>
          <th class="num">Royalty</th>
          <th class="num">To Australia</th>
        </tr>
      </thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#9ca3af;padding:24px">No stores in this pack.</td></tr>`}</tbody>
      <tfoot>
        <tr>
          <td class="label">Total (${data.rows.length} store${data.rows.length === 1 ? '' : 's'})</td>
          <td class="num">${formatZar(data.totals.turnover)}</td>
          <td class="num">${formatZar(data.totals.purchases)}</td>
          <td class="num">${formatZar(data.totals.royalty)}</td>
          <td class="num">${formatZar(data.totals.royalty_au)}</td>
        </tr>
      </tfoot>
    </table>

    <footer>
      <span>Cafe Studio</span>
      <span>${escapeHtml(data.periodLabel)} · ${escapeHtml(data.title)}</span>
    </footer>
  </div>
</body>
</html>`
}
