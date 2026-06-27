import { app, dialog } from 'electron'
import { copyFile, rm } from 'fs/promises'
import { join } from 'path'
import { getDatabase, getDbPath, closeDatabase } from './db'
import type { BackupResult } from '../shared/types'

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Writes a single-file copy of the database to a user-chosen location. */
export async function backupDatabase(): Promise<BackupResult> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Backup database',
    defaultPath: join(app.getPath('documents'), `gloria-backup-${todayStamp()}.db`),
    filters: [{ name: 'SQLite database', extensions: ['db'] }]
  })
  if (canceled || !filePath) return { saved: false }

  try {
    // Fold the WAL into the main file so the copy is complete and consistent.
    getDatabase().pragma('wal_checkpoint(TRUNCATE)')
    await copyFile(getDbPath(), filePath)
    return { saved: true, path: filePath }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Replaces the live database with a chosen backup file, then relaunches the
 * app so the new data is loaded cleanly. Asks for confirmation first.
 */
export async function restoreDatabase(): Promise<BackupResult> {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Restore database from backup',
    properties: ['openFile'],
    filters: [{ name: 'SQLite database', extensions: ['db'] }]
  })
  if (canceled || filePaths.length === 0) return { saved: false }
  const source = filePaths[0]

  const { response } = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Cancel', 'Restore and restart'],
    defaultId: 1,
    cancelId: 0,
    title: 'Restore database',
    message: 'Replace all current data with this backup?',
    detail: 'The application will restart. This cannot be undone.'
  })
  if (response !== 1) return { saved: false }

  try {
    const dbPath = getDbPath()
    closeDatabase()
    // Remove WAL/SHM side files so the restored DB is authoritative.
    await rm(`${dbPath}-wal`, { force: true })
    await rm(`${dbPath}-shm`, { force: true })
    await copyFile(source, dbPath)

    app.relaunch()
    app.exit(0)
    return { saved: true, restored: true, path: source }
  } catch (err) {
    return { saved: false, error: err instanceof Error ? err.message : String(err) }
  }
}
