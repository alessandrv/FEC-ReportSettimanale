import type oracledb from 'oracledb'
import type { Connection, Pool } from 'oracledb'
import { Client } from '@/lib/types'
import { ClientDirectory } from '@/lib/clients/types'
import { cachedClients } from '@/lib/clients/cache'
import { buildListSql, cleanName, getOwner } from '@/lib/clients/sql'

/*
 * CONTAINER (Linux) transport.
 *
 * Uses the native node-oracledb driver. Oracle 11g requires Thick mode (Thin
 * mode only supports DB 12.1+), which needs an Oracle Client library matching
 * Node's architecture — the Docker image installs the 64-bit Linux Instant
 * Client, so unlike the Windows host there is no 32-bit mismatch here.
 *
 * Pooled, so there is none of the per-query process-spawn cost the Windows
 * ODBC/PowerShell transport pays.
 */

interface OracleConfig {
  user: string
  password: string
  connectString: string
  libDir?: string
}

function getConfig(): OracleConfig {
  const user = process.env.ORACLE_USER?.trim()
  const password = process.env.ORACLE_PASSWORD?.trim()
  const connectString = process.env.ORACLE_CONNECT_STRING?.trim()

  if (!user || !password || !connectString) {
    throw new Error(
      'Missing Oracle configuration: ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING'
    )
  }

  return {
    user,
    password,
    connectString,
    // Optional: the image puts the Instant Client on the loader path, so this
    // is normally unnecessary.
    libDir: process.env.ORACLE_CLIENT_LIB_DIR?.trim() || undefined,
  }
}

let oracledbModule: typeof oracledb | null = null
let thickInitDone = false
let poolPromise: Promise<Pool> | null = null

async function getOracledb(config: OracleConfig): Promise<typeof oracledb> {
  if (!oracledbModule) {
    oracledbModule = (await import('oracledb')).default
  }

  if (!thickInitDone) {
    try {
      oracledbModule.initOracleClient(config.libDir ? { libDir: config.libDir } : {})
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Ignore "already initialized" (module init can race under HMR).
      if (!/already been initialized|NJS-077/i.test(message)) {
        throw error
      }
    }
    thickInitDone = true
  }

  return oracledbModule
}

async function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const config = getConfig()
      const db = await getOracledb(config)

      return db.createPool({
        user: config.user,
        password: config.password,
        connectString: config.connectString,
        poolMin: 0,
        poolMax: 4,
        poolTimeout: 60,
      })
    })().catch((error) => {
      poolPromise = null
      throw error
    })
  }

  return poolPromise
}

interface ClientRow {
  ID: string | number
  RAGIONE_SOCIALE: string
}

async function fetchAllClients(): Promise<Client[]> {
  const config = getConfig()
  const db = await getOracledb(config)
  const pool = await getPool()

  let connection: Connection | undefined

  try {
    connection = await pool.getConnection()

    const result = await connection.execute<ClientRow>(
      buildListSql(getOwner()),
      {},
      { outFormat: db.OUT_FORMAT_OBJECT }
    )

    return (result.rows ?? [])
      .map((row) => ({
        id: String(row.ID ?? ''),
        name: cleanName(String(row.RAGIONE_SOCIALE ?? '')),
      }))
      .filter((client) => client.name.length > 0)
  } finally {
    if (connection) {
      try {
        await connection.close()
      } catch {
        // ignore close errors
      }
    }
  }
}

export const oracleNodeClientDirectory: ClientDirectory = {
  listClients(): Promise<Client[]> {
    return cachedClients(fetchAllClients)
  },
}
