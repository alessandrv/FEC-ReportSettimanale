# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps — install node modules
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# builder — build the Next.js standalone output
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# runner — minimal runtime + Oracle Instant Client
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    # Linux container: use the native Oracle driver, not the Windows ODBC path.
    CLIENTS_DRIVER=oracledb \
    LD_LIBRARY_PATH=/opt/oracle/instantclient

# Skyline is Oracle 11g, which node-oracledb can only reach in "thick" mode —
# that needs an Oracle Client library. Here we control the image, so we install
# the 64-bit Linux Instant Client (no 32-bit mismatch like on the Windows host).
RUN apt-get update \
 && apt-get install -y --no-install-recommends libaio1 unzip curl ca-certificates \
 && curl -fsSLo /tmp/ic.zip \
      https://download.oracle.com/otn_software/linux/instantclient/instantclient-basiclite-linuxx64.zip \
 && unzip -q /tmp/ic.zip -d /opt/oracle \
 && rm /tmp/ic.zip \
 && mv /opt/oracle/instantclient_* /opt/oracle/instantclient \
 && echo /opt/oracle/instantclient > /etc/ld.so.conf.d/oracle-instantclient.conf \
 && ldconfig \
 && apt-get purge -y --auto-remove unzip curl \
 && rm -rf /var/lib/apt/lists/*

# Next.js standalone bundle (server.js + traced node_modules)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# oracledb is loaded via dynamic import and marked external, so copy it
# explicitly in case output tracing does not pick it up.
COPY --from=deps /app/node_modules/oracledb ./node_modules/oracledb

RUN useradd -r -u 1001 -g users nextjs && chown -R nextjs:users /app
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
