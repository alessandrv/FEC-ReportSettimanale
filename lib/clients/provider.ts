import { ClientDirectory } from '@/lib/clients/types'
import { oracleOdbcClientDirectory } from '@/lib/clients/providers/oracle-odbc'
import { oracleNodeClientDirectory } from '@/lib/clients/providers/oracle-node'

/**
 * Client directory source — always the Skyline ERP (Oracle), but the transport
 * depends on where the app runs:
 *
 * - Windows host: the only Oracle client available is 32-bit, which 64-bit Node
 *   cannot load in-process, so the query goes through 32-bit PowerShell + ODBC.
 * - Linux container: the image ships the 64-bit Oracle Instant Client, so the
 *   native pooled driver is used instead (faster, no process spawn).
 *
 * Override with CLIENTS_DRIVER=odbc|oracledb if auto-detection is wrong.
 *
 * If Oracle is unreachable, listClients throws, the API returns an error, and
 * the UI falls back to free-text client names — reporting is never blocked.
 */
export function getClientDirectory(): ClientDirectory {
  const driver = process.env.CLIENTS_DRIVER?.trim().toLowerCase()

  if (driver === 'odbc') return oracleOdbcClientDirectory
  if (driver === 'oracledb') return oracleNodeClientDirectory

  return process.platform === 'win32'
    ? oracleOdbcClientDirectory
    : oracleNodeClientDirectory
}
