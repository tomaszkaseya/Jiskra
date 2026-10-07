# Jiskra — Deployment Guide

Single-process Node.js app, **no npm dependencies, no build step**. Runtime: **Node 22.5+**
(uses the built-in `node:sqlite`; Node 24 LTS or newer recommended).

```
node server.js
```

## Configuration — environment variables

All configuration comes from environment variables; a local `config.json` is only a
development fallback and is not needed in a deployment.

| Variable | Required | Secret | Example / notes |
|---|---|---|---|
| `JIRA_BASE_URL` | yes | no | `https://kaseya.atlassian.net` |
| `JIRA_EMAIL` | yes | no | account the API token belongs to |
| `JIRA_TOKEN` | yes | **yes** | Atlassian API token → Secrets Manager |
| `JIRA_TARGET_QUARTER_FIELD` | yes | no | `customfield_14106` |
| `JIRA_RAG_FIELD` | no | no | `customfield_14707` |
| `PROJECTS` | yes | no | comma-separated Jira project keys, e.g. `ONP,OA` |
| `GATES` | yes | no | comma-separated gate numbers, e.g. `3,4,5` |
| `GATE_DESCRIPTIONS` | no | no | JSON, e.g. `{"3":"Project start → Sep 2026"}` |
| `PORT` | no | no | default `4777` |
| `DATA_DIR` | no | no | default `./data` — point at the persistent volume |
| `AUTH_ENABLED` | yes | no | `true` in any deployment |
| `AUTH_SECRET` | yes | **yes** | 32+ random bytes hex (e.g. `openssl rand -hex 32`) → Secrets Manager. Must be stable across restarts or logins drop. |
| `AUTH_TOKEN_TTL_HOURS` | no | no | default `12` |
| `AUTH_USERS` | yes* | **yes** | comma-separated `username:salt:hash` entries → Secrets Manager |

\* If `AUTH_USERS` is unset, users are read from the `users` table in the SQLite
database instead (managed on the host with `node add-user.js <user> <pass>`).

### User entries for AUTH_USERS

The app owner generates each entry locally (the password itself is never stored):

```
node add-user.js <username> <password> --print
# -> username:salt:hash        (paste into AUTH_USERS, comma-separated)
```

## Storage

- All application data (risk register, daily statuses, users) lives in one SQLite file:
  `$DATA_DIR/jiskra.db` (WAL mode — expect `-wal`/`-shm` siblings).
- Mount a **persistent EBS volume** at `DATA_DIR`. **Do not use EFS/NFS** — SQLite's
  file locking is unreliable there and can corrupt the database.
- Encryption at rest: use an encrypted volume (KMS). Passwords are stored as salted
  scrypt hashes; no Jira credentials are ever written to the database.
- Backup: periodically copy `jiskra.db` to S3 (daily is plenty). A consistent copy can
  be taken with `sqlite3 jiskra.db ".backup backup.db"` or by copying while the app is
  idle.
- On first start the app auto-migrates legacy `data/db.json` / `data/users.json` files
  into SQLite and renames them to `*.migrated`.

## Topology & network

- **Run exactly one instance.** State is a local SQLite file; two instances would
  corrupt each other's view. No horizontal scaling, no rolling deploys with overlap
  (stop old, start new).
- Terminate TLS in front (ALB / reverse proxy) — **HTTPS is mandatory**; the login
  token is a bearer credential. The app itself listens on plain HTTP on `PORT`.
- Outbound HTTPS (443) to the Jira Cloud instance (`JIRA_BASE_URL`) must be allowed.
- Health check: `GET /` returns the UI (200) without authentication; everything under
  `/api/` except `/api/login` requires a valid JWT.

## Minimal Dockerfile

```dockerfile
FROM node:24-alpine
WORKDIR /app
COPY server.js add-user.js ./
COPY public ./public
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 4777
CMD ["node", "server.js"]
```
