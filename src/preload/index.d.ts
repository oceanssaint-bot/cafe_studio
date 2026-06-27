import type { GloriaApi } from './index'

declare global {
  interface Window {
    gloria: GloriaApi
  }
}

export {}
