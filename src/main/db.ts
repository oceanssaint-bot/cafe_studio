import { app } from 'electron'
import { join } from 'path'
import Database from 'better-sqlite3'
import type { DbStatus } from '../shared/types'
import { SEED_STORES } from '../shared/defaults'

let db: Database.Database | null = null

/**
 * Ordered list of schema migrations. Each migration's index + 1 is its
 * version number, tracked via SQLite's `user_version` pragma. Future scrums
 * append new migrations here; existing ones are never edited.
 */
const migrations: Array<(database: Database.Database) => void> = [
  // v1 (Scrum 01): foundation. Proves the database initialises and gives a
  // place to record schema metadata. Feature tables arrive in later scrums.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)
    database.prepare(
      `INSERT INTO app_meta (key, value) VALUES ('created_at', ?)
       ON CONFLICT(key) DO NOTHING`
    ).run(new Date().toISOString())
  },
  // v2 (Scrum 02): month-end tasks. Each task belongs to a month `period`
  // ('YYYY-MM') so completion is tracked per month.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        period       TEXT NOT NULL,
        title        TEXT NOT NULL,
        notes        TEXT NOT NULL DEFAULT '',
        status       TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'complete')),
        created_at   TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_period ON tasks(period);
    `)
  },
  // v3 (Scrum 03): stores and their per-month operational data.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS stores (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        name                 TEXT NOT NULL,
        category             TEXT NOT NULL
                               CHECK (category IN ('head_office', 'franchise')),
        include_in_australia INTEGER NOT NULL DEFAULT 0,
        sort_order           INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS monthly_store_data (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id   INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        period     TEXT NOT NULL,
        sales      REAL NOT NULL DEFAULT 0,
        purchases  REAL NOT NULL DEFAULT 0,
        turnover   REAL NOT NULL DEFAULT 0,
        notes      TEXT NOT NULL DEFAULT '',
        updated_at TEXT,
        UNIQUE (store_id, period)
      );

      CREATE INDEX IF NOT EXISTS idx_msd_period ON monthly_store_data(period);
    `)

    const insertStore = database.prepare(
      `INSERT INTO stores (name, category, include_in_australia, sort_order)
       VALUES (?, ?, ?, ?)`
    )
    const seed = database.transaction(() => {
      SEED_STORES.forEach((s, i) => {
        insertStore.run(s.name, s.category, s.include_in_australia, i)
      })
    })
    seed()
  },
  // v4 (Documents feature): uploaded receipts/invoices/spreadsheets and the
  // figures extracted from them.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        filename    TEXT NOT NULL,
        stored_path TEXT NOT NULL,
        mime        TEXT NOT NULL DEFAULT '',
        kind        TEXT NOT NULL DEFAULT 'other',
        supplier    TEXT NOT NULL DEFAULT '',
        doc_date    TEXT NOT NULL DEFAULT '',
        period      TEXT NOT NULL DEFAULT '',
        store_id    INTEGER REFERENCES stores(id) ON DELETE SET NULL,
        sales       REAL NOT NULL DEFAULT 0,
        purchases   REAL NOT NULL DEFAULT 0,
        turnover    REAL NOT NULL DEFAULT 0,
        vat         REAL NOT NULL DEFAULT 0,
        currency    TEXT NOT NULL DEFAULT 'ZAR',
        summary     TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'pending',
        error       TEXT NOT NULL DEFAULT '',
        task_id     INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
        created_at  TEXT NOT NULL,
        applied_at  TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
    `)
  },
  // v5 (Go-live consolidation): richer monthly figures (transactions, royalties),
  // archivable stores, and reconciliation of seeded names to the real ones.
  (database) => {
    database.exec(`
      ALTER TABLE monthly_store_data ADD COLUMN transactions INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE monthly_store_data ADD COLUMN royalty REAL NOT NULL DEFAULT 0;
      ALTER TABLE monthly_store_data ADD COLUMN marketing REAL NOT NULL DEFAULT 0;
      ALTER TABLE monthly_store_data ADD COLUMN royalty_au REAL NOT NULL DEFAULT 0;
      ALTER TABLE stores ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
    `)
    // Reconcile seeded store names to the real trading names; drop the unused
    // Express Stores (no trading data).
    const rename = database.prepare(`UPDATE stores SET name = ? WHERE name = ?`)
    rename.run('Gateway South', 'Gateway')
    rename.run('Florida Fields', 'Florida Road')
    rename.run('Lakefield Benoni', 'Lakefield')
    database.prepare(`DELETE FROM stores WHERE name = 'Express Stores'`).run()
  },
  // v6: cash-up & payouts — petty-cash purchases (from till slips) plus the
  // handwritten payout-voucher declared totals used to reconcile them.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS cash_payouts (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id      INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        period        TEXT NOT NULL,
        txn_date      TEXT NOT NULL,
        supplier      TEXT NOT NULL DEFAULT '',
        description   TEXT NOT NULL DEFAULT '',
        excl_vat      REAL NOT NULL DEFAULT 0,
        vat           REAL NOT NULL DEFAULT 0,
        incl_vat      REAL NOT NULL DEFAULT 0,
        kind          TEXT NOT NULL DEFAULT 'purchase'
                        CHECK (kind IN ('purchase','tip')),
        source_doc_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
        created_at    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cash_payouts_sp ON cash_payouts(store_id, period);

      CREATE TABLE IF NOT EXISTS cash_declarations (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id           INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        period             TEXT NOT NULL,
        txn_date           TEXT NOT NULL,
        declared_purchases REAL NOT NULL DEFAULT 0,
        declared_tips      REAL NOT NULL DEFAULT 0,
        UNIQUE (store_id, txn_date)
      );
    `)
  },
  // v7: Creditors & Debtors ledger, scoped per entity (Head Office = NULL
  // store, or a specific store such as Oceans Mall).
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS ledger_items (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        kind            TEXT NOT NULL CHECK (kind IN ('creditor','debtor')),
        entity_store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        party           TEXT NOT NULL DEFAULT '',
        description     TEXT NOT NULL DEFAULT '',
        invoice_no      TEXT NOT NULL DEFAULT '',
        invoice_date    TEXT NOT NULL DEFAULT '',
        total_incl      REAL NOT NULL DEFAULT 0,
        vat             REAL NOT NULL DEFAULT 0,
        excl_vat        REAL NOT NULL DEFAULT 0,
        paid            REAL NOT NULL DEFAULT 0,
        source          TEXT NOT NULL DEFAULT 'manual',
        created_at      TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_ledger_kind_entity
        ON ledger_items(kind, entity_store_id);
    `)
  },
  // v8: consumption on monthly data; store profile fields; HO stock takes;
  // payroll register. Completes the remaining back-office modules.
  (database) => {
    database.exec(`
      ALTER TABLE monthly_store_data ADD COLUMN consumption REAL NOT NULL DEFAULT 0;
      ALTER TABLE stores ADD COLUMN address TEXT NOT NULL DEFAULT '';
      ALTER TABLE stores ADD COLUMN phone TEXT NOT NULL DEFAULT '';
      ALTER TABLE stores ADD COLUMN profile_notes TEXT NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS stock_takes (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        take_date       TEXT NOT NULL,
        total_value     REAL NOT NULL DEFAULT 0,
        item_count      INTEGER NOT NULL DEFAULT 0,
        source          TEXT NOT NULL DEFAULT 'manual',
        created_at      TEXT NOT NULL,
        UNIQUE (entity_store_id, take_date)
      );

      CREATE TABLE IF NOT EXISTS payroll (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        period          TEXT NOT NULL,
        employee        TEXT NOT NULL DEFAULT '',
        emp_no          TEXT NOT NULL DEFAULT '',
        gross           REAL NOT NULL DEFAULT 0,
        net             REAL NOT NULL DEFAULT 0,
        notes           TEXT NOT NULL DEFAULT '',
        source_doc_id   INTEGER REFERENCES documents(id) ON DELETE SET NULL,
        created_at      TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_payroll_ep ON payroll(entity_store_id, period);
    `)
  },
  // v9: daily turnover from the POS "Turnover Reports". Normalises every store's
  // submission (GAAP TurnoverReport, Turnover_Per_Day, or AI-read PDF) into one
  // shape. `total_sales` is the turnover (excludes tips); the payment-mix columns
  // (cash/card/etc.) are only populated for Oceans Mall — franchises just need
  // the turnover total for royalties.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS turnover_daily (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id      INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        date          TEXT NOT NULL,
        cash          REAL NOT NULL DEFAULT 0,
        credit_card   REAL NOT NULL DEFAULT 0,
        accounts      REAL NOT NULL DEFAULT 0,
        cheque        REAL NOT NULL DEFAULT 0,
        non_turnover  REAL NOT NULL DEFAULT 0,
        tips          REAL NOT NULL DEFAULT 0,
        total_sales   REAL NOT NULL DEFAULT 0,
        source        TEXT NOT NULL DEFAULT 'import',
        created_at    TEXT NOT NULL,
        UNIQUE (store_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_turnover_daily_store ON turnover_daily(store_id, date);
    `)
  },
  // v10: allow a third cash_payouts kind, 'invoice' — a supplier invoice that
  // counts toward monthly purchases but is excluded from the daily slip-vs-
  // voucher reconciliation. SQLite can't alter a CHECK constraint in place, so
  // the table is rebuilt and its rows copied across.
  (database) => {
    database.exec(`
      CREATE TABLE cash_payouts_new (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id      INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        period        TEXT NOT NULL,
        txn_date      TEXT NOT NULL,
        supplier      TEXT NOT NULL DEFAULT '',
        description   TEXT NOT NULL DEFAULT '',
        excl_vat      REAL NOT NULL DEFAULT 0,
        vat           REAL NOT NULL DEFAULT 0,
        incl_vat      REAL NOT NULL DEFAULT 0,
        kind          TEXT NOT NULL DEFAULT 'purchase'
                        CHECK (kind IN ('purchase','invoice','tip')),
        source_doc_id INTEGER REFERENCES documents(id) ON DELETE SET NULL,
        created_at    TEXT NOT NULL
      );
      INSERT INTO cash_payouts_new
        SELECT id, store_id, period, txn_date, supplier, description,
               excl_vat, vat, incl_vat, kind, source_doc_id, created_at
        FROM cash_payouts;
      DROP TABLE cash_payouts;
      ALTER TABLE cash_payouts_new RENAME TO cash_payouts;
      CREATE INDEX IF NOT EXISTS idx_cash_payouts_sp ON cash_payouts(store_id, period);
    `)
  },
  // v11: universal file catalog. Every file in the admin archive is registered
  // here — classified by department/store/period/type, content-hashed (integrity
  // + de-dup), and made searchable. This is the backbone that guarantees every
  // file is tracked and nothing is missed before automation is built on top.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS file_catalog (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        path        TEXT NOT NULL UNIQUE,
        rel_path    TEXT NOT NULL,
        filename    TEXT NOT NULL,
        department  TEXT NOT NULL DEFAULT '',
        store       TEXT NOT NULL DEFAULT '',
        period      TEXT NOT NULL DEFAULT '',
        doc_type    TEXT NOT NULL DEFAULT 'other',
        ext         TEXT NOT NULL DEFAULT '',
        size        INTEGER NOT NULL DEFAULT 0,
        sha256      TEXT NOT NULL DEFAULT '',
        modified    TEXT NOT NULL DEFAULT '',
        ingested    INTEGER NOT NULL DEFAULT 0,
        module      TEXT NOT NULL DEFAULT '',
        notes       TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_filecat_dept   ON file_catalog(department);
      CREATE INDEX IF NOT EXISTS idx_filecat_store  ON file_catalog(store);
      CREATE INDEX IF NOT EXISTS idx_filecat_period ON file_catalog(period);
      CREATE INDEX IF NOT EXISTS idx_filecat_type   ON file_catalog(doc_type);
      CREATE INDEX IF NOT EXISTS idx_filecat_name   ON file_catalog(filename);
    `)
  },
  // v12: royalty ledger. Each store has a royalty_rate (8% default; Pavilion 6%).
  // royalty_invoices are auto-computed from monthly turnover:
  //   royalty_fee = turnover * rate%, marketing_fee = turnover * 2.5%,
  //   total_incl = (royalty_fee + marketing_fee) * 1.15 (VAT).
  // Paid/Unpaid is tracked per invoice. This powers statements + automation.
  (database) => {
    database.exec(`
      ALTER TABLE stores ADD COLUMN royalty_rate REAL NOT NULL DEFAULT 8;
      UPDATE stores SET royalty_rate = 6 WHERE name LIKE 'Pavilion%';

      CREATE TABLE IF NOT EXISTS royalty_invoices (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id      INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        period        TEXT NOT NULL,
        invoice_date  TEXT NOT NULL DEFAULT '',
        invoice_no    TEXT NOT NULL DEFAULT '',
        turnover      REAL NOT NULL DEFAULT 0,
        rate          REAL NOT NULL DEFAULT 8,
        royalty_fee   REAL NOT NULL DEFAULT 0,
        marketing_fee REAL NOT NULL DEFAULT 0,
        vat           REAL NOT NULL DEFAULT 0,
        total_incl    REAL NOT NULL DEFAULT 0,
        paid          INTEGER NOT NULL DEFAULT 0,
        source        TEXT NOT NULL DEFAULT 'auto',
        created_at    TEXT NOT NULL,
        UNIQUE (store_id, period)
      );
      CREATE INDEX IF NOT EXISTS idx_royalty_store ON royalty_invoices(store_id, period);
    `)
  },
  // v13: GJC Statements of Account. A per-store running debtor ledger combining
  // stock invoices + royalty invoices + payments, plus the customer header info.
  // Seeded from the existing Statement xlsx files; royalties auto-append going
  // forward. Running balance is computed on read.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS statement_accounts (
        store_id      INTEGER PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
        customer_name TEXT NOT NULL DEFAULT '',
        vat_no        TEXT NOT NULL DEFAULT '',
        address       TEXT NOT NULL DEFAULT '',
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS statement_lines (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id    INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        line_date   TEXT NOT NULL DEFAULT '',
        tx_type     TEXT NOT NULL DEFAULT 'invoice'
                      CHECK (tx_type IN ('invoice','royalty','payment','opening')),
        reference   TEXT NOT NULL DEFAULT '',
        details     TEXT NOT NULL DEFAULT '',
        debit       REAL NOT NULL DEFAULT 0,
        credit      REAL NOT NULL DEFAULT 0,
        period      TEXT NOT NULL DEFAULT '',
        source      TEXT NOT NULL DEFAULT 'import',
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_stmt_lines_store ON statement_lines(store_id, line_date);
    `)
  },
  // v14: invoice approval workflow. Royalty invoices get an `approved` flag so
  // generated invoices queue on the Dashboard for the owner to approve before
  // they're exported/emailed. Customer code (e.g. GAT02) lives on the account
  // for the printed invoice header.
  (database) => {
    database.exec(`
      ALTER TABLE royalty_invoices ADD COLUMN approved INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE statement_accounts ADD COLUMN customer_code TEXT NOT NULL DEFAULT '';
    `)
  },
  // v15: Store Purchases journal — the detailed per-store monthly purchase
  // ledger (Date / Invoice / Supplier / Description / Excl / VAT / Incl) from the
  // Store Purchases workbooks. Line-level detail for SARS, searchable & totalled.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS store_purchase_lines (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id    INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
        period      TEXT NOT NULL,
        txn_date    TEXT NOT NULL DEFAULT '',
        invoice_no  TEXT NOT NULL DEFAULT '',
        supplier    TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        excl_vat    REAL NOT NULL DEFAULT 0,
        vat         REAL NOT NULL DEFAULT 0,
        incl_vat    REAL NOT NULL DEFAULT 0,
        source      TEXT NOT NULL DEFAULT 'import',
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_purch_store ON store_purchase_lines(store_id, period);
      CREATE INDEX IF NOT EXISTS idx_purch_supplier ON store_purchase_lines(supplier);
    `)
  },
  // v16: payroll gets a `source` so imported WAGES rows (source='import-wages') can
  // be safely re-imported without wiping manually-entered payroll lines.
  (database) => {
    database.exec(`ALTER TABLE payroll ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';`)
  },
  // v17: GJC Australia account — the USD payable to Gloria Jeans International
  // (head office in Australia). Two transaction ledgers: royalties (O7103) and
  // stock (O7110). `amount_usd` is signed (+charge / -payment); `remaining_usd`
  // is the per-line outstanding where the source provides it.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS aus_account_lines (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        ledger       TEXT NOT NULL,            -- 'royalty' | 'stock'
        txn_date     TEXT NOT NULL DEFAULT '',
        txn_type     TEXT NOT NULL DEFAULT '', -- Invoice/Customer/Payment/...
        doc_no       TEXT NOT NULL DEFAULT '',
        description  TEXT NOT NULL DEFAULT '',
        amount_usd   REAL NOT NULL DEFAULT 0,
        remaining_usd REAL NOT NULL DEFAULT 0,
        source       TEXT NOT NULL DEFAULT 'import',
        created_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_aus_ledger ON aus_account_lines(ledger, txn_date);
    `)
  },
  // v18: send tracking. Once an approved royalty invoice is exported/emailed it is
  // marked `sent` so the Dashboard "ready to send" queue clears.
  (database) => {
    database.exec(`
      ALTER TABLE royalty_invoices ADD COLUMN sent INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE royalty_invoices ADD COLUMN sent_at TEXT NOT NULL DEFAULT '';
    `)
  },
  // v19: per-store billing email so approved invoices can be drafted to the
  // franchisee in the default mail app (one-click email).
  (database) => {
    database.exec(`ALTER TABLE stores ADD COLUMN billing_email TEXT NOT NULL DEFAULT '';`)
  },
  // v20: itemised stock reconciliation. `stock_sheet_lines` = the per-item Head
  // Office stock counts (GJC SA Stock Sheet); `stock_out_lines` = itemised lines
  // from the HO→store tax invoices. Updated stock = latest count − sold since
  // (matched by item). Stored raw so matching uses the current baseline.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS stock_sheet_lines (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        take_date   TEXT NOT NULL,
        code        TEXT NOT NULL DEFAULT '',
        name        TEXT NOT NULL DEFAULT '',
        price       REAL NOT NULL DEFAULT 0,
        opening_qty REAL NOT NULL DEFAULT 0,
        counted     INTEGER NOT NULL DEFAULT 1,
        source      TEXT NOT NULL DEFAULT 'import',
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sheet_date ON stock_sheet_lines(take_date);
      CREATE TABLE IF NOT EXISTS stock_out_lines (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id    INTEGER REFERENCES stores(id) ON DELETE SET NULL,
        txn_date    TEXT NOT NULL,
        invoice_no  TEXT NOT NULL DEFAULT '',
        item_name   TEXT NOT NULL DEFAULT '',
        qty         REAL NOT NULL DEFAULT 0,
        rate        REAL NOT NULL DEFAULT 0,
        amount      REAL NOT NULL DEFAULT 0,
        source      TEXT NOT NULL DEFAULT 'import',
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_out_date ON stock_out_lines(txn_date);
    `)
  },
  // v21: staff register — one clean record per employee (deduped by SA ID number),
  // separate from the month-by-month payroll. Holds the person's profile.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS staff (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id     INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        id_number    TEXT NOT NULL DEFAULT '',
        occupation   TEXT NOT NULL DEFAULT '',
        status       TEXT NOT NULL DEFAULT 'Permanent',
        dob          TEXT NOT NULL DEFAULT '',
        gender       TEXT NOT NULL DEFAULT '',
        phone        TEXT NOT NULL DEFAULT '',
        email        TEXT NOT NULL DEFAULT '',
        monthly_pay  REAL NOT NULL DEFAULT 0,
        notes        TEXT NOT NULL DEFAULT '',
        active       INTEGER NOT NULL DEFAULT 1,
        created_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_staff_store ON staff(store_id);
    `)
  },
  // v22: store-level perpetual stock. `stock_items` is the item master (cost +
  // sell price, on-hand cache, reorder level); `stock_movements` is the valued,
  // signed ledger of every change (receive / waste / count / sale / adjust).
  // On-hand = running sum of movement qty; counts post a variance adjustment.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS stock_items (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id      INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        category      TEXT NOT NULL DEFAULT '',
        unit          TEXT NOT NULL DEFAULT 'each',
        cost_price    REAL NOT NULL DEFAULT 0,
        sell_price    REAL NOT NULL DEFAULT 0,
        reorder_level REAL NOT NULL DEFAULT 0,
        on_hand       REAL NOT NULL DEFAULT 0,
        active        INTEGER NOT NULL DEFAULT 1,
        created_at    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_stockitem_store ON stock_items(store_id);
      CREATE TABLE IF NOT EXISTS stock_movements (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id    INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        item_id     INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
        txn_date    TEXT NOT NULL,
        type        TEXT NOT NULL,           -- receive | waste | count | sale | adjust
        qty         REAL NOT NULL DEFAULT 0, -- signed delta
        unit_cost   REAL NOT NULL DEFAULT 0,
        value       REAL NOT NULL DEFAULT 0, -- signed qty * unit_cost
        reason      TEXT NOT NULL DEFAULT '',
        reference   TEXT NOT NULL DEFAULT '',
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_stockmov_item ON stock_movements(item_id, txn_date);
      CREATE INDEX IF NOT EXISTS idx_stockmov_store ON stock_movements(store_id, type, txn_date);
    `)
  },
  // v23: menu + recipes. `menu_items` = sellable products (price); `recipe_lines`
  // link each menu item to the `stock_items` it consumes (qty in the stock unit),
  // so recipe cost = Σ qty×stock cost → margins, and (with units sold) theoretical
  // stock usage for variance/theft. `menu_sales` holds item-level units sold
  // (from a GAAP product-mix export) for "what sells" analytics.
  (database) => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id    INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        category    TEXT NOT NULL DEFAULT '',
        sell_price  REAL NOT NULL DEFAULT 0,
        active      INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_menu_store ON menu_items(store_id);
      CREATE TABLE IF NOT EXISTS recipe_lines (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_item_id  INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
        stock_item_id INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
        qty           REAL NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_recipe_menu ON recipe_lines(menu_item_id);
      CREATE TABLE IF NOT EXISTS menu_sales (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        store_id     INTEGER REFERENCES stores(id) ON DELETE CASCADE,
        menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
        item_name    TEXT NOT NULL DEFAULT '',
        period       TEXT NOT NULL,
        units        REAL NOT NULL DEFAULT 0,
        revenue      REAL NOT NULL DEFAULT 0,
        source       TEXT NOT NULL DEFAULT 'import',
        created_at   TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_menusales ON menu_sales(store_id, period);
    `)
  }
]

function runMigrations(database: Database.Database): void {
  const current = database.pragma('user_version', { simple: true }) as number
  for (let version = current; version < migrations.length; version++) {
    const migrate = migrations[version]
    const apply = database.transaction(() => {
      migrate(database)
      database.pragma(`user_version = ${version + 1}`)
    })
    apply()
  }
}

export function getDbPath(): string {
  return join(app.getPath('userData'), 'gloria.db')
}

export function initDatabase(): Database.Database {
  if (db) return db
  const dbPath = getDbPath()
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  return db
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialised. Call initDatabase() first.')
  return db
}

export function getDbStatus(): DbStatus {
  const path = getDbPath()
  try {
    const database = getDatabase()
    const rows = database
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
      )
      .all() as Array<{ name: string }>
    return { ok: true, path, tables: rows.map((r) => r.name) }
  } catch (err) {
    return {
      ok: false,
      path,
      tables: [],
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
