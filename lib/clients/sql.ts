/**
 * Shared query + row shaping for the Skyline (Oracle) client directory.
 * Used by both transports: the Windows 32-bit ODBC/PowerShell provider and the
 * native node-oracledb provider used inside the Linux container.
 */

/** Schema owner, sanitized — it is interpolated as a SQL identifier (cannot be bound). */
export function getOwner(): string {
  return (process.env.ORACLE_OWNER ?? '').replace(/[^A-Za-z0-9_]/g, '')
}

/** Full client directory, ordered. No parameters: the whole list is fetched. */
export function buildListSql(owner: string): string {
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

/** Strip ERP display noise: trailing "####" padding and surrounding whitespace. */
export function cleanName(name: string): string {
  return name.replace(/[#\s]+$/g, '').trim()
}
