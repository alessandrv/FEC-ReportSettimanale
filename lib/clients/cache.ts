import { Client } from '@/lib/types'

/**
 * In-memory cache for the client directory, shared by whichever Oracle
 * transport is active. The directory is ~1.4k rows and changes rarely, so it is
 * fetched once and filtered client-side. Single-flight ensures concurrent page
 * loads share one query instead of each paying the connection cost.
 */
const CACHE_TTL_MS = Number(process.env.ORACLE_CLIENTS_TTL_MS) || 600_000

interface CacheEntry {
  clients: Client[]
  expiresAt: number
}

let cache: CacheEntry | null = null
let inflight: Promise<Client[]> | null = null

export function cachedClients(fetcher: () => Promise<Client[]>): Promise<Client[]> {
  if (cache && cache.expiresAt > Date.now()) {
    return Promise.resolve(cache.clients)
  }

  if (!inflight) {
    inflight = fetcher()
      .then((clients) => {
        cache = { clients, expiresAt: Date.now() + CACHE_TTL_MS }
        return clients
      })
      .finally(() => {
        inflight = null
      })
  }

  return inflight
}
