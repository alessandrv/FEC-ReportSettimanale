import { spawn } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@/lib/types'
import { ClientDirectory } from '@/lib/clients/types'

/*
 * Skyline (Oracle 11g) is reachable only through the 32-bit Oracle ODBC driver.
 * Node is 64-bit and cannot load a 32-bit library in-process, so — exactly like
 * the Skyline MCP server — we run the query in a 32-bit PowerShell child process
 * that talks to the DB over ODBC and returns JSON on stdout.
 *
 * The full client directory (~1.4k rows, ~70 KB) is fetched in one query and
 * cached in memory; the UI filters it client-side. This avoids paying the
 * process-spawn cost (~2 s) on every keystroke or every visit added.
 */

const DEFAULT_PS32 =
  'C:\\Windows\\SysWOW64\\WindowsPowerShell\\v1.0\\powershell.exe'
const DEFAULT_DRIVER = 'Oracle in OraClient11g_home1_32bit'
const TIMEOUT_MS = 30_000
const CACHE_TTL_MS = Number(process.env.ORACLE_CLIENTS_TTL_MS) || 600_000

interface SkylineConfig {
  driver: string
  dbq: string
  user: string
  password: string
  owner: string
  powershell: string
}

function getConfig(): SkylineConfig {
  const user = process.env.ORACLE_USER?.trim()
  const password = process.env.ORACLE_PASSWORD?.trim()
  const dbq = process.env.ORACLE_CONNECT_STRING?.trim()

  if (!user || !password || !dbq) {
    throw new Error(
      'Missing Oracle configuration: ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING'
    )
  }

  return {
    user,
    password,
    dbq,
    // Sanitized — interpolated into SQL as a schema identifier (cannot be bound).
    owner: (process.env.ORACLE_OWNER ?? '').replace(/[^A-Za-z0-9_]/g, ''),
    driver: process.env.ORACLE_ODBC_DRIVER?.trim() || DEFAULT_DRIVER,
    powershell: process.env.ORACLE_POWERSHELL_32?.trim() || DEFAULT_PS32,
  }
}

function buildListSql(owner: string): string {
  const prefix = owner ? `${owner}.` : ''

  return `
    SELECT DISTINCT
      TRIM(a.MASTRO) || '-' || TRIM(a.PARTITARIO) AS id,
      TRIM(a.DESCRIZIONE_1) ||
        CASE WHEN TRIM(a.DESCRIZIONE_2) IS NOT NULL
             THEN ' ' || TRIM(a.DESCRIZIONE_2) ELSE '' END AS ragione_sociale
    FROM ${prefix}ANAGRAFICO_CONTI a
    JOIN ${prefix}CONTI_CLIENTI c
      ON c.MASTRO = a.MASTRO AND c.PARTITARIO = a.PARTITARIO
    ORDER BY ragione_sociale
  `.trim()
}

// PowerShell script (runs in the 32-bit host, invoked with -File). The SQL is
// passed via an env var; it contains no user input (the whole list is fetched).
const PS_SCRIPT = `$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
try {
  $cs = "Driver={" + $env:SKY_DRIVER + "};DBQ=" + $env:SKY_DBQ + ";Uid=" + $env:SKY_USER + ";Pwd=" + $env:SKY_PASS + ";"
  $conn = New-Object System.Data.Odbc.OdbcConnection
  $conn.ConnectionString = $cs
  $conn.Open()
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = $env:SKY_SQL
  $reader = $cmd.ExecuteReader()
  $rows = [System.Collections.Generic.List[object]]::new()
  while ($reader.Read()) {
    $id = if ($reader.IsDBNull(0)) { '' } else { $reader.GetValue(0).ToString().Trim() }
    $name = if ($reader.IsDBNull(1)) { '' } else { $reader.GetValue(1).ToString().Trim() }
    $rows.Add(@{ id = $id; name = $name })
  }
  $reader.Close(); $conn.Close()
  if ($rows.Count -eq 0) {
    [Console]::Out.Write('[]')
  } else {
    $json = @($rows) | ConvertTo-Json -Compress -Depth 5
    if ($rows.Count -eq 1) { $json = '[' + $json + ']' }
    [Console]::Out.Write($json)
  }
} catch {
  [Console]::Error.Write($_.Exception.Message)
  exit 1
}`

// Materialize the script to a temp .ps1 once per process. Piping it via stdin
// (`-Command -`) is unreliable for multi-line scripts, so we invoke with -File.
let scriptPathPromise: Promise<string> | null = null
function getScriptPath(): Promise<string> {
  if (!scriptPathPromise) {
    const path = join(tmpdir(), 'report-settimanale-skyline-clients.ps1')
    scriptPathPromise = writeFile(path, PS_SCRIPT, 'utf8')
      .then(() => path)
      .catch((error) => {
        scriptPathPromise = null
        throw error
      })
  }
  return scriptPathPromise
}

async function runQuery(config: SkylineConfig, sql: string): Promise<string> {
  const scriptPath = await getScriptPath()

  return new Promise((resolve, reject) => {
    const child = spawn(
      config.powershell,
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      {
        windowsHide: true,
        env: {
          ...process.env,
          SKY_DRIVER: config.driver,
          SKY_DBQ: config.dbq,
          SKY_USER: config.user,
          SKY_PASS: config.password,
          SKY_SQL: sql,
        },
      }
    )

    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    const timer = setTimeout(() => {
      child.kill()
      reject(new Error('Skyline query timed out'))
    }, TIMEOUT_MS)

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`))
      }
    })

    child.stdin.end()
  })
}

// Strip ERP display noise: trailing "####" padding and surrounding whitespace.
function cleanName(name: string): string {
  return name.replace(/[#\s]+$/g, '').trim()
}

async function fetchAllClients(): Promise<Client[]> {
  const config = getConfig()
  const output = await runQuery(config, buildListSql(config.owner))

  let rows: Array<{ id?: string; name?: string }>
  try {
    rows = JSON.parse(output)
  } catch {
    throw new Error('Unexpected response from Skyline query')
  }

  return rows
    .map((row) => ({ id: String(row.id ?? ''), name: cleanName(String(row.name ?? '')) }))
    .filter((client) => client.name.length > 0)
}

interface CacheEntry {
  clients: Client[]
  expiresAt: number
}

let cache: CacheEntry | null = null
let inflight: Promise<Client[]> | null = null

export const oracleClientDirectory: ClientDirectory = {
  async listClients(): Promise<Client[]> {
    if (cache && cache.expiresAt > Date.now()) {
      return cache.clients
    }

    // Single-flight: concurrent callers share one process spawn.
    if (!inflight) {
      inflight = fetchAllClients()
        .then((clients) => {
          cache = { clients, expiresAt: Date.now() + CACHE_TTL_MS }
          return clients
        })
        .finally(() => {
          inflight = null
        })
    }

    return inflight
  },
}
