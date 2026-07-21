# Client directory ("cliente visitato")

The client search is a **separate concern** from where visits are stored: visits go
to SharePoint (see [microsoft-365-backend.md](microsoft-365-backend.md)), while the
client directory that powers the autocomplete is read from the **Skyline ERP
(Oracle 11g)**.

- The endpoint `GET /api/clients` returns the **whole** directory (~1.4k rows).
- It delegates to `ClientDirectory.listClients()` (`lib/clients/types.ts`),
  implemented once by `lib/clients/providers/oracle.ts`.
- The list is fetched **once per page load** and filtered **client-side**, so typing
  is instant. Each ERP query spawns a ~2 s process, so querying per keystroke (or once
  per visit, ~15×) would be painfully slow — loading all upfront avoids that.

**Free text is always allowed.** The client field accepts any typed name; selecting
from the directory is optional. If Oracle is unreachable, the search endpoint returns
an error, the combobox shows *"Nessun cliente trovato: puoi inserirlo manualmente"*,
and reporting continues normally. Visits keep the ERP `clientId` when a directory
entry was picked, and leave it empty for free-text names.

## Oracle / Skyline provider

Reads all client names from `ANAGRAFICO_CONTI` joined with `CONTI_CLIENTI`, building the
`ragione_sociale` as `DESCRIZIONE_1 [+ ' ' + DESCRIZIONE_2]`, ordered alphabetically.
Each row's `id` is `TRIM(MASTRO)-TRIM(PARTITARIO)`. Trailing `####` display padding in
names is stripped. The result is **cached in memory** for 10 minutes
(`ORACLE_CLIENTS_TTL_MS`), with single-flight so concurrent page loads share one query.
No SQL parameters are used (the whole list is fetched; filtering happens in the browser).

### How it connects (why not node-oracledb)

Skyline is **Oracle 11g**, reachable through the **32-bit** Oracle ODBC driver
(`Oracle in OraClient11g_home1_32bit`). Node.js is **64-bit** and cannot load a 32-bit
library in-process, so a native driver (`node-oracledb`) would require installing a
separate 64-bit Oracle Instant Client on every host.

Instead — mirroring the existing **Skyline MCP server** — the provider runs each query
in a **32-bit PowerShell** child process (`C:\Windows\SysWOW64\...\powershell.exe`,
which is the 32-bit host despite the "64" in the folder name). That process opens an
ODBC connection with the 32-bit driver, binds the search term, and returns JSON on
stdout. No extra install: it reuses the Oracle client you already have.

Trade-off: each search spawns a short-lived process (~300–600 ms), so there is no
connection pooling. Fine for a debounced autocomplete; not for high-volume queries.

The search term is passed to PowerShell via an **environment variable** and bound as an
**ODBC parameter** — it is never interpolated into the SQL or the command line.

### Environment

```env
ORACLE_USER=FECITALIA
ORACLE_PASSWORD=manager
ORACLE_CONNECT_STRING=SRVSKY:1521/SKYLINE
ORACLE_OWNER=FECITALIA
# Optional overrides (defaults shown):
# ORACLE_ODBC_DRIVER=Oracle in OraClient11g_home1_32bit
# ORACLE_POWERSHELL_32=C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe
```

- `ORACLE_CONNECT_STRING` is EZConnect (`host:port/service`), used as the ODBC `DBQ`.
- `ORACLE_OWNER` is prefixed to the table names; it is sanitized to `[A-Za-z0-9_]` and
  interpolated as an identifier (schema names cannot be bind variables). Leave empty to
  use unqualified names (they resolve to the connecting user's schema).

### Requirements on the host running the app

- The **32-bit Oracle ODBC driver** installed (the existing `OraClient11g_home1_32bit`).
- Network access to `SRVSKY:1521`.
- 32-bit Windows PowerShell present (built into Windows).

### Testing the connection

With the app running on such a host:

```bash
# Signed-in request (needs a session cookie); or just use the search field in the app.
curl "http://localhost:3000/api/clients"
```

Expected: a JSON array of `{ id, name }` (the full directory). Common failures (surface
in the server log):

- `Data source name not found ... no default driver` → the `ORACLE_ODBC_DRIVER` name
  does not match an installed **32-bit** ODBC driver (check the 32-bit ODBC Data Source
  Administrator, `C:\Windows\SysWOW64\odbcad32.exe`).
- `ORA-12154` / `TNS` errors → `ORACLE_CONNECT_STRING` or network/firewall to SRVSKY.
- `ORA-01017` → wrong `ORACLE_USER` / `ORACLE_PASSWORD`.

Where the host cannot reach `SRVSKY` (e.g. a laptop off the company network), the search
simply returns nothing and the commerciale types the client name by hand.
