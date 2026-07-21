import { ClientDirectory } from '@/lib/clients/types'
import { oracleClientDirectory } from '@/lib/clients/providers/oracle'

/**
 * Client directory source. Backed only by the Skyline ERP (Oracle). If Oracle
 * is unreachable, searchClients throws, the API returns an error, and the UI
 * falls back to free-text client names — reporting is never blocked.
 */
export function getClientDirectory(): ClientDirectory {
  return oracleClientDirectory
}
