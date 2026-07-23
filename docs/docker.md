# Docker

The app ships as a Linux container built from the Next.js **standalone** output
(`output: 'standalone'` in `next.config.mjs`), so the runtime image contains only
`server.js` plus the traced dependencies.

## Oracle in the container (important)

On the Windows host the client directory is queried through **32-bit PowerShell +
the Oracle ODBC driver**, because the only Oracle client installed there is 32-bit
and 64-bit Node cannot load it in-process.

Inside the container that transport does not exist — and it is not needed. The image
installs the **64-bit Oracle Instant Client (Basic Lite)**, so the app uses the native
`node-oracledb` driver in Thick mode (required for Oracle 11g). That is both simpler and
faster: connections are **pooled**, with none of the ~2 s process-spawn cost per query.

Transport selection lives in `lib/clients/provider.ts`:

| Where | Transport | Provider |
| --- | --- | --- |
| Windows host | 32-bit PowerShell + ODBC | `providers/oracle-odbc.ts` |
| Linux container | native `node-oracledb` (pooled) | `providers/oracle-node.ts` |

It auto-detects by `process.platform`; the image also sets `CLIENTS_DRIVER=oracledb`
explicitly. Override with `CLIENTS_DRIVER=odbc|oracledb` if needed.

## Build & run

`.env` is **not** baked into the image (it is in `.dockerignore`); it is read at
container start via `env_file`. Keep `.env` next to `docker-compose.yml`.

```bash
docker compose build
docker compose up -d
docker compose logs -f
```

The container listens on 3000 and is published on host **3009**, matching the port the
app used when run directly — so the existing Cloudflare tunnel config keeps working.

Without compose:

```bash
docker build -t report-settimanale .
docker run -d --name report-settimanale -p 3009:3000 --env-file .env \
  -e CLIENTS_DRIVER=oracledb report-settimanale
```

## Requirements for the host running the container

- Outbound network to **`SRVSKY:1521`** (client directory). Bridge networking is enough;
  no `--network host` required.
- Outbound HTTPS to `login.microsoftonline.com` and `graph.microsoft.com` (auth + visit
  storage in SharePoint).
- `.env` must set `AUTH_URL=https://report.fecitalia.it` — behind the Cloudflare tunnel
  the container sees an internal host, so host auto-detection would build wrong
  redirect URLs.

## Troubleshooting

Check `docker compose logs -f`; client-directory failures are logged by `[api/clients]`.
Remember the client field always accepts free text, so a directory outage degrades
gracefully instead of blocking reporting.

- **`DPI-1047` / cannot locate Oracle Client** — the Instant Client layer failed to
  install or `LD_LIBRARY_PATH` is wrong. Rebuild the image; verify
  `/opt/oracle/instantclient` exists inside it.
- **`ORA-12154` / TNS errors** — `ORACLE_CONNECT_STRING`, or the container cannot reach
  SRVSKY. Test with `docker exec -it report-settimanale sh` then check connectivity.
- **`ORA-01017`** — wrong `ORACLE_USER` / `ORACLE_PASSWORD`.

## Notes

- The Instant Client download URL in the `Dockerfile` always pulls the current Basic Lite
  release; a 19c/21c/23ai client connects fine to an 11.2 database.
- The container runs as a non-root user (`nextjs`, uid 1001).
- To update: `docker compose build --no-cache && docker compose up -d`.
