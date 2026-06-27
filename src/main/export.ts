import { app, dialog, BrowserWindow, shell } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { getReportData } from './repositories/reports'
import { getStatement, getStatementAccount } from './repositories/statements'
import { getRoyaltyInvoice, listApprovedUnsent, markInvoicesSent } from './repositories/royalties'
import { getStore } from './repositories/stores'
import { getStockReconciliation } from './repositories/stock-recon'
import * as XLSX from 'xlsx'
import { formatZar } from '../shared/defaults'
import { renderReportHtml } from '../shared/report-html'
import { renderStatementHtml } from '../shared/statement-html'
import { renderRoyaltyInvoiceHtml } from '../shared/invoice-html'
import type {
  ReportType,
  ExportResult,
  ReportData,
  BatchExportSummary,
  EmailDraftSummary
} from '../shared/types'

function buildHtml(type: ReportType, period: string): { data: ReportData; html: string } {
  const data = getReportData(type, period)
  return { data, html: renderReportHtml(data) }
}

function defaultFileName(data: ReportData, ext: string): string {
  const slug = data.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
  return `${slug}-${data.period}.${ext}`
}

function htmlDataUrl(html: string): string {
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html)
}

export async function exportReportHtml(
  type: ReportType,
  period: string
): Promise<ExportResult> {
  const { data, html } = buildHtml(type, period)
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export report as HTML',
    defaultPath: join(app.getPath('documents'), defaultFileName(data, 'html')),
    filters: [{ name: 'HTML', extensions: ['html'] }]
  })
  if (canceled || !filePath) return { saved: false }
  try {
    await writeFile(filePath, html, 'utf-8')
    return { saved: true, path: filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function exportReportPdf(
  type: ReportType,
  period: string
): Promise<ExportResult> {
  const { data, html } = buildHtml(type, period)
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export report as PDF',
    defaultPath: join(app.getPath('documents'), defaultFileName(data, 'pdf')),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return { saved: false }

  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } })
  try {
    await win.loadURL(htmlDataUrl(html))
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
    })
    await writeFile(filePath, pdf)
    return { saved: true, path: filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    win.destroy()
  }
}

// --- Statement of Account exports ---

function statementHtml(storeId: number): { name: string; html: string } {
  const v = getStatement(storeId)
  return { name: v.storeName, html: renderStatementHtml(v) }
}
function stmtFileName(name: string, ext: string): string {
  return `Statement-of-Account-${name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}.${ext}`
}

export async function exportStatementPdf(storeId: number): Promise<ExportResult> {
  const { name, html } = statementHtml(storeId)
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export statement as PDF',
    defaultPath: join(app.getPath('documents'), stmtFileName(name, 'pdf')),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return { saved: false }
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } })
  try {
    await win.loadURL(htmlDataUrl(html))
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
    })
    await writeFile(filePath, pdf)
    return { saved: true, path: filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    win.destroy()
  }
}

export async function printStatement(storeId: number): Promise<ExportResult> {
  const { name, html } = statementHtml(storeId)
  const win = new BrowserWindow({
    width: 820,
    height: 1000,
    title: `Statement of Account — ${name}`,
    autoHideMenuBar: true,
    webPreferences: { sandbox: false }
  })
  await win.loadURL(htmlDataUrl(html))
  win.webContents.print({ printBackground: true }, () => {})
  return { saved: true }
}

// --- Royalty invoice exports (GJC template) ---

function invoiceHtml(id: number): { name: string; html: string } | null {
  const inv = getRoyaltyInvoice(id)
  if (!inv) return null
  const account = getStatementAccount(inv.store_id)
  return { name: `${inv.storeName}-${inv.period}`, html: renderRoyaltyInvoiceHtml(inv, account) }
}

export async function exportInvoicePdf(id: number): Promise<ExportResult> {
  const r = invoiceHtml(id)
  if (!r) return { saved: false, error: 'Invoice not found.' }
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export invoice as PDF',
    defaultPath: join(app.getPath('documents'), `Tax-Invoice-${r.name.replace(/[^a-z0-9]+/gi, '-')}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (canceled || !filePath) return { saved: false }
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } })
  try {
    await win.loadURL(htmlDataUrl(r.html))
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
    })
    await writeFile(filePath, pdf)
    return { saved: true, path: filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    win.destroy()
  }
}

/** Opens the invoice in a preview window (the user can print/save from there). */
/**
 * Batch-exports every approved-but-unsent royalty invoice as a PDF into a folder
 * the user picks, marks them sent, and opens the folder ready to attach to email.
 */
export async function exportApprovedInvoices(): Promise<BatchExportSummary> {
  const pending = listApprovedUnsent()
  if (pending.length === 0) return { ok: true, count: 0, folder: '' }
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose a folder to export the approved invoices into',
    properties: ['openDirectory', 'createDirectory']
  })
  if (canceled || filePaths.length === 0) return { ok: false, cancelled: true, count: 0, folder: '' }
  const folder = filePaths[0]
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } })
  const done: number[] = []
  try {
    for (const inv of pending) {
      const r = invoiceHtml(inv.id)
      if (!r) continue
      await win.loadURL(htmlDataUrl(r.html))
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
      })
      const safe = `Tax-Invoice-${r.name.replace(/[^a-z0-9]+/gi, '-')}.pdf`
      await writeFile(join(folder, safe), pdf)
      done.push(inv.id)
    }
    markInvoicesSent(done)
    shell.openPath(folder)
    return { ok: true, count: done.length, folder }
  } catch (err) {
    markInvoicesSent(done)
    return { ok: false, error: err instanceof Error ? err.message : String(err), count: done.length, folder }
  } finally {
    win.destroy()
  }
}

/**
 * Exports every approved-unsent invoice to a folder, marks them sent, then opens
 * a pre-filled draft in the default mail app for each store that has a billing
 * email (the user attaches the PDF, already waiting in the opened folder).
 */
export async function emailApprovedInvoices(): Promise<EmailDraftSummary> {
  const pending = listApprovedUnsent()
  if (pending.length === 0)
    return { ok: true, exported: 0, drafted: 0, folder: '', missingEmail: [] }
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Choose a folder for the invoice PDFs (then drafts will open in your mail app)',
    properties: ['openDirectory', 'createDirectory']
  })
  if (canceled || filePaths.length === 0)
    return { ok: false, cancelled: true, exported: 0, drafted: 0, folder: '', missingEmail: [] }
  const folder = filePaths[0]
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } })
  const done: number[] = []
  const missingEmail: string[] = []
  let drafted = 0
  try {
    for (const inv of pending) {
      const full = getRoyaltyInvoice(inv.id)
      const r = invoiceHtml(inv.id)
      if (!r || !full) continue
      await win.loadURL(htmlDataUrl(r.html))
      const pdf = await win.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 }
      })
      await writeFile(join(folder, `Tax-Invoice-${r.name.replace(/[^a-z0-9]+/gi, '-')}.pdf`), pdf)
      done.push(inv.id)

      const store = getStore(full.store_id)
      const email = store?.billing_email?.trim()
      if (email) {
        const subject = `Gloria Jeans Tax Invoice — ${inv.periodLabel}`
        const body =
          `Dear ${inv.storeName},\n\n` +
          `Please find attached your tax invoice for ${inv.periodLabel} ` +
          `(Royalties + Marketing), total ${formatZar(inv.total_incl)}.\n\n` +
          `The PDF is in: ${folder}\n\n` +
          `Kind regards,\nGloria Jeans South Africa`
        await shell.openExternal(
          `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
        )
        drafted++
      } else {
        missingEmail.push(inv.storeName)
      }
    }
    markInvoicesSent(done)
    shell.openPath(folder)
    return { ok: true, exported: done.length, drafted, folder, missingEmail: [...new Set(missingEmail)] }
  } catch (err) {
    markInvoicesSent(done)
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      exported: done.length,
      drafted,
      folder,
      missingEmail: [...new Set(missingEmail)]
    }
  } finally {
    win.destroy()
  }
}

export async function printInvoice(id: number): Promise<ExportResult> {
  const r = invoiceHtml(id)
  if (!r) return { saved: false, error: 'Invoice not found.' }
  const win = new BrowserWindow({
    width: 860,
    height: 1000,
    title: `Tax Invoice — ${r.name}`,
    autoHideMenuBar: true,
    webPreferences: { sandbox: false }
  })
  await win.loadURL(htmlDataUrl(r.html))
  return { saved: true }
}

/** Exports the updated stock take as an Excel workbook (item detail + unmatched). */
export async function exportStockReconExcel(asOf?: string): Promise<ExportResult> {
  const v = getStockReconciliation(asOf)
  if (!v.hasData) return { saved: false, error: 'No stock data imported yet.' }
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export updated stock take',
    defaultPath: join(app.getPath('documents'), `GJC SA Stock Sheet - UPDATED ${v.asOf}.xlsx`),
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (canceled || !filePath) return { saved: false }
  try {
    const head = [
      'Code',
      'Stock Item',
      'Retail Price',
      `Opening (${v.baselineDate})`,
      'Sold Out',
      'Remaining Qty',
      'Rand Value',
      'Status'
    ]
    const body = v.rows.map((r) => [
      r.code,
      r.name,
      r.price,
      r.counted ? r.opening : '(blank)',
      r.sold,
      r.remaining,
      r.value,
      r.status === 'not-counted' ? 'VERIFY - not counted' : r.status === 'oversold' ? 'VERIFY - sold > count' : ''
    ])
    body.push([])
    body.push(['', 'REMAINING STOCK VALUE', '', '', '', '', v.totals.remainingValue, ''])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([head, ...body]), 'Updated Stock')
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Unmatched invoice item', 'Value'], ...v.unmatched.map((u) => [u.name, u.value])]),
      'Unmatched'
    )
    XLSX.writeFile(wb, filePath)
    return { saved: true, path: filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Opens the report in a window and triggers the system print dialog. */
export async function printReport(type: ReportType, period: string): Promise<ExportResult> {
  const { data, html } = buildHtml(type, period)
  const win = new BrowserWindow({
    width: 820,
    height: 1000,
    title: `${data.title} — ${data.periodLabel}`,
    autoHideMenuBar: true,
    webPreferences: { sandbox: false }
  })
  await win.loadURL(htmlDataUrl(html))
  win.webContents.print({ printBackground: true }, () => {
    // Leave the window open as a print preview; the user closes it.
  })
  return { saved: true }
}
