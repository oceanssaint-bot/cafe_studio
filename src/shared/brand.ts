import { GLORIA_LOGO_DATAURL } from './logo'

/**
 * A brand identity used to style every printed document (invoices, statements,
 * payslips, letters, reports). Swap this object — or load one per café from the
 * brand_profiles table — and all generated documents follow the brand.
 */
export interface Brand {
  name: string // trading name, e.g. "Gloria Jean's Coffees"
  legalName: string // entity on tax documents
  regNo: string
  vatNo: string
  address: string // physical
  postal: string // postal / Postnet
  email: string
  logo: string // data URL or http(s) URL
  font: string // CSS font-family stack
  fontHref: string // optional webfont <link> href ('' = none)
  colors: {
    primary: string // brand accent (rules, totals, hero blocks)
    ink: string // headings + table header
    surface: string // tinted panels / alt rows
    line: string // hairlines
    muted: string // secondary text
  }
  bank: { name: string; bank: string; branch: string; account: string }
}

/** Gloria Jean's Coffees — per the official brand guidelines (Orange / Black / White,
 *  Bone secondary, Gotham → Montserrat stand-in as Gotham is licensed). */
export const GLORIA_BRAND: Brand = {
  name: "Gloria Jean's Coffees",
  legalName: 'GLORIA JEANS SOUTH AFRICA (PTY) LTD',
  regNo: '2019/311650/07',
  vatNo: '4470291941',
  address: '707 Currie Road, Windermere, Durban',
  postal: 'Postnet Suite 223, Private Bag X10, Musgrave Road, 4062',
  email: 'admin@gloriajeanscoffee.co.za',
  logo: GLORIA_LOGO_DATAURL,
  font: "'Montserrat','Segoe UI',system-ui,Arial,sans-serif",
  fontHref: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap',
  colors: {
    primary: '#EF7D00', // GJ Orange
    ink: '#111111', // GJ Black
    surface: '#F5F0E7', // Tertiary Bone
    line: '#E7E1D6',
    muted: '#6b7280'
  },
  bank: {
    name: 'Gloria Jeans South Africa',
    bank: 'First National Bank',
    branch: '250 655',
    account: '62861307702'
  }
}

/** Webfont <link> for the brand (empty string when none). Place in <head>. */
export function brandFontLink(b: Brand): string {
  return b.fontHref
    ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link href="${b.fontHref}" rel="stylesheet" />`
    : ''
}

/** Shared document CSS: palette vars + base page/header/table chrome used by every
 *  document. Generators append only their own layout-specific rules. */
export function brandCss(b: Brand): string {
  const c = b.colors
  return `
  :root{--primary:${c.primary};--ink:${c.ink};--surface:${c.surface};--line:${c.line};--muted:${c.muted};--font:${b.font};}
  *{box-sizing:border-box;} body{font-family:var(--font);color:var(--ink);margin:0;padding:44px;background:#fff;-webkit-font-smoothing:antialiased;}
  .sheet{max-width:880px;margin:0 auto;}
  .logo{height:60px;margin-bottom:12px;display:block;}
  header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:3px solid var(--primary);padding-bottom:16px;}
  .co{font-size:12.5px;color:var(--muted);line-height:1.55;} .co b{color:var(--ink);font-size:15px;letter-spacing:.01em;}
  h1{color:var(--ink);font-size:25px;margin:0;text-align:right;font-weight:800;text-transform:uppercase;letter-spacing:.02em;}
  .meta{font-size:13px;color:var(--muted);text-align:right;margin-top:6px;line-height:1.6;} .meta b{color:var(--ink);}
  table{width:100%;border-collapse:collapse;margin-top:8px;} th,td{padding:10px 14px;font-size:14px;text-align:left;}
  thead th{background:var(--ink);color:#fff;font-weight:700;letter-spacing:.02em;} th.num,td.num{text-align:right;font-variant-numeric:tabular-nums;}
  tbody td{border-bottom:1px solid var(--line);} tbody tr.alt td{background:var(--surface);}
  tfoot td{border-top:2px solid var(--primary);font-weight:800;color:var(--ink);font-size:15px;}
  .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
  .hero{background:var(--primary);color:#fff;border-radius:6px;}
  .panel{background:var(--surface);border-left:4px solid var(--primary);border-radius:4px;}
  @media print{body{padding:0;} thead th,tfoot td,.hero,.panel,tbody tr.alt td{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}`
}

/** Standard branded header: logo + company block (left) and doc title + meta (right).
 *  `company` overrides the default company lines (e.g. a store name on a payslip). */
export function brandHeader(
  b: Brand,
  title: string,
  metaHtml: string,
  company?: string
): string {
  const co =
    company ??
    `<b>${b.legalName}</b><br>Reg No: ${b.regNo} · VAT No: ${b.vatNo}<br>${b.address}<br>${b.postal}<br>${b.email}`
  return `<header>
    <div><img class="logo" src="${b.logo}" alt="${b.name}" /><div class="co">${co}</div></div>
    <div><h1>${title}</h1><div class="meta">${metaHtml}</div></div>
  </header>`
}
