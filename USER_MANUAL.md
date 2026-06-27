# Cafe Studio — User Manual

A simple, friendly guide to running your day-to-day admin in the Cafe Studio app.
No technical knowledge needed — if you can use a spreadsheet, you can use this.

---

## 1. Getting started

### Opening the app
- **Easiest way:** double-click **`Gloria-Admin-Portable-0.1.0.exe`**. It opens straight away — nothing to install.
- **Or install it:** run **`Gloria-Admin-Setup-0.1.0.exe`** once. It adds a desktop shortcut and a Start-menu entry.

> **First time only:** Windows may show a blue *“Windows protected your PC”* box (because the app isn’t signed with a paid certificate). Click **More info → Run anyway**. This only happens once.

### Your data is safe and private
- Everything lives **on this computer only**, in a single database file. Nothing is sent anywhere — except receipt/invoice photos you choose to read with AI (see §10).
- Make a **Backup** any time (see §11). Keep a copy somewhere safe.

---

## 2. Finding your way around

When the app opens you’ll see three things:

1. **The sidebar (left)** — your main menu. Click any item to open that page.
2. **The search bar (top)** — find any task or store fast. Click it or press **Ctrl + K**.
3. **The sun/moon button (top right)** — switch between **light and dark mode** (or press **Ctrl + D**).

**Keyboard shortcuts:** press **Ctrl + 1** to **Ctrl + 9** to jump straight to the first nine pages.

The pages, in order:

| Page | What it’s for |
|---|---|
| **Dashboard** | A quick overview of the month and recent activity. |
| **Month End** | Your monthly admin checklist. |
| **Stores** | Each store’s monthly figures and details. |
| **Cash-Up** | Daily petty-cash purchases, reconciled to till slips. |
| **Creditors & Debtors** | Who you owe, and who owes you. |
| **Payroll** | Staff pay each month. |
| **Stock Take** | Stock-take values. |
| **Documents** | Upload receipts/invoices and let the app read them. |
| **Reports** | Generate the Head Office, Franchise and Australia packs. |
| **Settings** | Preferences, backups, imports and your AI key. |

---

## 3. The fastest way to start: import your existing files

If you already keep spreadsheets, you don’t have to retype anything.

1. Go to **Settings**.
2. Under **Import from archive**, click **Choose folder & import**.
3. Pick your main admin folder (the one with all your year folders).
4. Wait a few seconds. You’ll get a summary like *“Imported 57 files… Total turnover read: R67,990,795.”*

This one button reads, for every year it finds:
- **Monthly Store Sales** workbooks → each store’s turnover, transactions, royalties, and the 1% due to Australia.
- **VAT “Sales & Purchases Journal”** → each store’s purchases.
- **Consumption Analysis** → each store’s consumption value.
- **Head Office Stock Sheets** → stock-take values.

It’s **safe to run again** whenever you update those files — it just refreshes the figures.

For **Creditors & Debtors**, there’s a separate one-click import on that page (see §7).

---

## 4. Dashboard

The home screen. At a glance:
- **Month-End Progress** — how much of this month’s checklist is done.
- **Database** — confirms your data is connected.
- **Quick actions** — jump to common pages.
- **Recent activity** — the latest things you changed. Click any item to go straight there.

---

## 5. Month End — your monthly checklist

Every month starts with the same 15 admin tasks (Royalty Invoices, VAT Submission, Creditors, Debtors, Stock Take, Salaries, and so on).

- **Tick a task** when it’s done — the progress bar updates.
- **Add a task** — type in the box and click **Add**.
- **Edit / add a note** — hover a task and click **Edit**.
- **Hide completed** — tick the box to focus on what’s left.
- **Change month** — use the **‹ June 2026 ›** arrows at the top right.

Each month keeps its own checklist, so last month’s ticks don’t affect this month.

---

## 6. Stores — each store’s monthly figures

The left list shows your stores grouped into **Head Office** and **Franchise**.

- **Pick a store**, then choose the **month** (top-right arrows).
- Enter or check **Sales**, **Purchases** and **Turnover**.
- Below that you’ll see the imported extras: **Transactions, Royalty invoiced, Marketing, Due to Australia (1%), Consumption.**
- Click **Save** when you change something.

**Managing stores:**
- **Add store** (top right) — name, category (Head Office / Franchise), whether it’s in the Australia pack, and details (address, phone, notes).
- **Edit store** (above the panel) — change any of the above, or **archive** a store that has closed (it stays in history but drops out of lists and reports). Tick **Show archived** to see them.

---

## 7. Cash-Up — petty cash, reconciled

This matches your “Payouts Cash Up” sheet: the small daily purchases (Checkers, Woolworths, etc.) paid for with cash.

1. Pick the **store** and **month** at the top.
2. **Add a line** at the bottom of the table: date, supplier, description, the VAT and the total. Click **Add**.
3. The **totals** (cash purchases, VAT, tips) add up automatically.

**The reconciliation** (lower table) is the important bit:
- For each day it compares the **sum of your till slips** to the **declared total on the handwritten payout voucher**.
- Type the voucher’s declared amount into **Voucher declared** (and tips).
- The app shows a green **✓ matches** if they tie up, or a red **mismatch** with the exact difference if they don’t.

**Reading slips automatically:** click **Read slips (AI)**, choose the photos, and the app reads each one — posting till slips as purchase lines and payout vouchers as the day’s declared total (needs an AI key, see §10).

---

## 8. Creditors & Debtors — who you owe, who owes you

Head Office and each store are kept as **separate books** (so the store owing Head Office shows up correctly on both sides).

1. Choose the **Entity** (Head Office, Oceans Mall, or any store).
2. Switch between the **Creditors** tab (who that entity owes) and the **Debtors** tab (who owes that entity).
3. You’ll see suppliers/debtors grouped together, sorted by who is owed the most, with **Total invoiced / Paid / Outstanding** up top.
4. Expand any supplier to see the individual invoices.
5. Hover an invoice to **mark paid** (or **unpay**) or remove it.

**Import:** click **Import from schedule**, choose your admin folder, and it reads your **latest Creditors Schedule** (Head Office creditors, the Oceans Mall creditors sheet, and each store’s debtors) plus the **Oceans Mall Payment Recon** for paid balances. Safe to re-run whenever your schedule updates.

---

## 9. Payroll & Stock Take

**Payroll** — pick the entity and month, then add each employee’s **gross** and **net** pay. The totals add up at the top. (You can also read payslip photos in Documents.)

**Stock Take** — pick the entity (usually Head Office). Add a stock-take **date** and its **value**, or import your **GJC SA Stock Sheet** files via Settings → Import from archive. The latest value is highlighted.

---

## 10. Documents — let the app read your receipts & invoices

Turn a pile of photos into figures.

1. Go to **Documents** and click **Upload files** (images, PDFs or spreadsheets).
2. Each one is read and shown for you to **check**: supplier, date, store, amounts.
3. Correct anything if needed, choose the **store** and **month**, then click **Apply** — the figures are added to that store, and (optionally) a note is attached to a month-end task. The original file is kept in the archive.

**To read images/PDFs you need an AI key** (spreadsheets work without one):
- Go to **Settings → Document reading (AI)**.
- Paste your **Anthropic API key** and click **Save key**. It’s stored **encrypted on this computer only**.
- Without a key, you’ll get a friendly reminder; spreadsheets still import fine.

---

## 11. Reports — the packs you send out

Go to **Reports** and choose a pack:
- **Head Office Pack**, **Franchise Pack**, or **Australia Pack** (which only includes the stores reported to Australia).
- Pick the **month**.

You’ll see a clean report with **big summary numbers** (Total Turnover, Purchases, Royalties, To Australia) and a **store-by-store breakdown** that adds up.

Then:
- **Print View** — opens it ready to print.
- **Export PDF** — saves a PDF you can email.
- **Export HTML** — saves a web-page version.

Every export has a short note explaining what the pack covers, so anyone reading it understands it.

---

## 12. Backups & restore

Your data matters — back it up regularly.

- **Settings → Database → Backup database** — saves a single `.db` file. Keep it somewhere safe (a USB stick or cloud drive).
- **Restore from backup** — loads a backup file and restarts the app. *This replaces all current data*, so it asks you to confirm first.

---

## 13. Handy tips

- **Search anything:** press **Ctrl + K**, type a store or task name, click the result.
- **Dark or light:** **Ctrl + D**.
- **Re-import any time:** the imports just refresh the numbers — they won’t create duplicates.
- **The app fixes spreadsheet mistakes:** it adds up the actual store lines itself, so if a total in your spreadsheet was wrong, the app still shows the correct number.

---

## 14. Quick answers

**Do I need internet?** Only to read receipt/invoice photos with AI. Everything else works offline.

**Is my data private?** Yes — it stays on this computer. Only documents you choose to read with AI are sent to Claude for that reading.

**I changed a spreadsheet — do I retype it here?** No. Just re-run the relevant import (Settings, or the Creditors & Debtors page).

**Something looks wrong.** Restore your latest backup (Settings → Restore), or re-run the import. Your backups are your safety net.

**Where is my data stored?** In a single SQLite file on this PC. Use the Backup button to copy it.

---

*Cafe Studio — built for Gloria Jean’s Coffee South Africa.*
