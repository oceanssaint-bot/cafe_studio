import { app, dialog } from 'electron'
import { writeFile, readFile } from 'fs/promises'
import { join } from 'path'
import { getStoreOverview } from '../repositories/store-overview'
import { findOrCreateByName, saveMonthlyData } from '../repositories/stores'
import type { StorePack, StorePackResult } from '../../shared/types'

const PACK_VERSION = 1

/** Store side: bundle a month's figures into a portable pack file to send to Head Office. */
export async function exportStorePack(storeId: number, period: string): Promise<StorePackResult> {
  const ov = getStoreOverview(storeId, period)
  const pack: StorePack = {
    gloriaPack: PACK_VERSION,
    store: ov.storeName,
    period: ov.period,
    exportedAt: new Date().toISOString(),
    turnover: ov.turnover,
    sales: ov.turnover,
    purchases: ov.purchases,
    cashup: ov.cashup,
    payrollGross: ov.payrollGross,
    payrollCount: ov.payrollCount
  }
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export monthly pack for Head Office',
    defaultPath: join(
      app.getPath('documents'),
      `${ov.storeName.replace(/[^a-z0-9]+/gi, '-')}-${period}-pack.json`
    ),
    filters: [{ name: 'Gloria store pack', extensions: ['json'] }]
  })
  if (canceled || !filePath) return { ok: false, cancelled: true }
  try {
    await writeFile(filePath, JSON.stringify(pack, null, 2), 'utf-8')
    return { ok: true, path: filePath, store: pack.store, period: pack.period, turnover: pack.turnover }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** Head Office side: import a franchisee's pack → upsert their monthly figures (feeds royalties). */
export async function importStorePack(): Promise<StorePackResult> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import a store monthly pack',
    properties: ['openFile'],
    filters: [{ name: 'Gloria store pack', extensions: ['json'] }]
  })
  if (canceled || filePaths.length === 0) return { ok: false, cancelled: true }
  try {
    const pack = JSON.parse(await readFile(filePaths[0], 'utf-8')) as StorePack
    if (!pack || pack.gloriaPack !== PACK_VERSION || !pack.store || !pack.period)
      return { ok: false, error: 'Not a valid Gloria store pack file.' }
    const store = findOrCreateByName(pack.store)
    saveMonthlyData({
      store_id: store.id,
      period: pack.period,
      sales: pack.sales ?? pack.turnover ?? 0,
      purchases: pack.purchases ?? 0,
      turnover: pack.turnover ?? 0,
      notes: `Imported from ${pack.store} pack (${new Date(pack.exportedAt).toLocaleDateString('en-ZA')})`
    })
    return { ok: true, store: store.name, period: pack.period, turnover: pack.turnover ?? 0 }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}
