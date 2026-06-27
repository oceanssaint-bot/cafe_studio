import { safeStorage } from 'electron'
import { getDatabase } from '../db'
import type { ApiKeyStatus } from '../../shared/types'

// The key is stored in app_meta. When OS encryption is available the value is
// an encrypted blob (base64), otherwise it falls back to a plain string with a
// marker so we know how to read it back.
const ENC_KEY = 'anthropic_api_key_enc'
const PLAIN_KEY = 'anthropic_api_key_plain'

function metaGet(key: string): string | null {
  const row = getDatabase().prepare(`SELECT value FROM app_meta WHERE key = ?`).get(key) as
    | { value: string }
    | undefined
  return row ? row.value : null
}

function metaSet(key: string, value: string): void {
  getDatabase()
    .prepare(
      `INSERT INTO app_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    )
    .run(key, value)
}

function metaDelete(key: string): void {
  getDatabase().prepare(`DELETE FROM app_meta WHERE key = ?`).run(key)
}

export function getApiKeyStatus(): ApiKeyStatus {
  const encryptionAvailable = safeStorage.isEncryptionAvailable()
  const set = metaGet(ENC_KEY) !== null || metaGet(PLAIN_KEY) !== null
  return { set, encryptionAvailable }
}

export function setApiKey(key: string): ApiKeyStatus {
  const trimmed = key.trim()
  metaDelete(ENC_KEY)
  metaDelete(PLAIN_KEY)
  if (trimmed) {
    if (safeStorage.isEncryptionAvailable()) {
      metaSet(ENC_KEY, safeStorage.encryptString(trimmed).toString('base64'))
    } else {
      metaSet(PLAIN_KEY, trimmed)
    }
  }
  return getApiKeyStatus()
}

export function clearApiKey(): ApiKeyStatus {
  metaDelete(ENC_KEY)
  metaDelete(PLAIN_KEY)
  return getApiKeyStatus()
}

/** Returns the decrypted key for main-process use, or null if none is set. */
export function readApiKey(): string | null {
  const enc = metaGet(ENC_KEY)
  if (enc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'))
    } catch {
      return null
    }
  }
  return metaGet(PLAIN_KEY)
}
