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
| `JIRA_TOKEN` | yes | **yes** | Atlassian API token → host `.env` (or a secret store) |
| `JIRA_TARGET_QUARTER_FIELD` | yes | no | `customfield_14106` |
| `JIRA_RAG_FIELD` | no | no | `customfield_14707` |
| `PROJECTS` | yes | no | comma-separated Jira project keys, e.g. `ONP,OA` |
| `GATES` | no | no | seeds the tabs on the first start of an **empty** database only, e.g. `3,4,5` (tab "Gate N", labels `<PROJECT>-G<N>`). Unnecessary when deploying a seeded `jiskra.db` — tabs live in the database and are edited in the app (Settings → Gates & projects) |
| `GATE_DESCRIPTIONS` | no | no | same seeding-only role, JSON, e.g. `{"3":"Project start → Sep 2026"}` |
| `PORT` | no | no | default `4777` |
| `DATA_DIR` | no | no | default `./data` — point at the persistent volume |
| `AUTH_ENABLED` | yes | no | `true` in any deployment |
| `AUTH_SECRET` | yes | **yes** | 32+ random bytes hex (e.g. `openssl rand -hex 32`) → host `.env`. Must be stable across restarts or logins drop. |
| `AUTH_TOKEN_TTL_HOURS` | no | no | default `12` |
| `AUTH_USERS` | no | **yes** | optional override: comma-separated `username:salt:hash` entries → host `.env` |

User accounts live in the `users` table of the SQLite database. They arrive with the
seed database (see below) and are managed in the app itself, on the **Users** page under
Settings: any signed-in user can add users, reset passwords and delete users (the last
user and your own account cannot be deleted). No shell access to the instance is needed.

`node add-user.js <user> <pass>` (run next to the app, with `DATA_DIR` set) is only a
fallback for when nobody can sign in, e.g. a deployment started with an empty database.
The password is a command-line argument, so it ends up in shell history.

`AUTH_USERS` is an alternative for when accounts must **not** be managed in the app: the
owner generates each entry locally with `node add-user.js <username> <password> --print`
(the password itself is never stored). While it is set, the database's `users` table is
ignored and the Users page is read-only.

## Storage

- All application data (risk register, daily statuses, users, tab definitions) lives in one SQLite file:
  `$DATA_DIR/jiskra.db` (WAL mode — expect `-wal`/`-shm` siblings).
- Mount a **persistent EBS volume** at `DATA_DIR`. **Do not use EFS/NFS** — SQLite's
  file locking is unreliable there and can corrupt the database.
- Encryption at rest: use an encrypted volume (KMS). Passwords are stored as salted
  scrypt hashes; no Jira credentials are ever written to the database.
- Backup: run `node snapshot.js <file>` (consistent even while the app is running) and
  ship the output to S3 — daily is plenty.
- On first start the app auto-migrates legacy `data/db.json` / `data/users.json` files
  into SQLite and renames them to `*.migrated`.

## Seeding the first deployment

The owner has been using Jiskra locally; the production database must start from their
local data (risk history, daily statuses, user accounts, tab definitions), not empty.

1. Owner runs `node snapshot.js` locally — produces a consistent single-file snapshot
   (`data/jiskra-seed-<date>.db`), safe to take while the app is running.
2. Owner hands the file over (it contains the risk register and scrypt password
   hashes — treat as internal data, no plaintext secrets).
3. Before the app's **first start**, place it on the persistent volume as
   `$DATA_DIR/jiskra.db`.
4. Start the app. Done — users log in with the same credentials they use locally.

With users and tabs seeded this way, leave `AUTH_USERS`, `GATES` and `GATE_DESCRIPTIONS`
unset: accounts are managed on the app's **Users** page and tabs under **Gates & projects**.

Take the snapshot after starting the current version of the app locally at least once, so
that the tab definitions are already in the file.

## Topology & network

- **Run exactly one instance.** State is a local SQLite file; two instances would
  corrupt each other's view. No horizontal scaling, no rolling deploys with overlap
  (stop old, start new).
- Terminate TLS in front (ALB / reverse proxy) — **HTTPS is mandatory**; the login
  token is a bearer credential. The app itself listens on plain HTTP on `PORT`.
- Outbound HTTPS (443) to the Jira Cloud instance (`JIRA_BASE_URL`) must be allowed.
- Health check: `GET /` returns the UI (200) without authentication; everything under
  `/api/` except `/api/login` requires a valid JWT.

## Dockerfile

A ready-to-use `Dockerfile` is in the repository root (node:24-alpine, copies
`server.js`, `add-user.js`, `snapshot.js` and `public/`, data volume at `/data`,
listens on 4777).