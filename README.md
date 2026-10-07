# Jiskra

**Ji**ra + ri**sk** + st**a**tus — and "jiskra" is Czech for *spark*.

Local gate-review tool for Jira epics: one tab per NPI gate, epics pulled live from Jira,
plus a local daily-status log and risk tracker per epic (stored outside Jira).

## Run

```
copy config.example.json config.json   # then fill in your Jira details
node server.js
```

Open http://localhost:4777 (Node 22.5+, no dependencies — data lives in SQLite via the
built-in `node:sqlite`).

Deploying? See [DEPLOYMENT.md](DEPLOYMENT.md) — configuration via environment
variables, persistent volume, auth setup.

## How it works

- Epics are fetched live from Jira by gate label (`<PROJECT>-G<N>`, e.g. `ONP-G3`, `OA-G3`)
  across the projects listed in `config.json`.
- Target launch quarter comes from the Jira custom field `Target Launch Quarter`
  (`customfield_14106`).
- Daily statuses, risks and users are stored locally in `data/jiskra.db` (SQLite).
  Nothing is written back to Jira. Legacy `data/db.json` / `data/users.json` files are
  migrated automatically on first start.

## Config (`config.json`, gitignored — contains the Jira API token)

```json
{
  "jira": { "baseUrl": "...", "email": "...", "token": "...",
            "targetQuarterField": "customfield_14106", "ragField": "customfield_14707" },
  "projects": ["ONP", "OA"],
  "gates": [3, 4, 5],
  "gateDescriptions": { "3": "Project start → Sep 2026" },
  "port": 4777,
  "auth": { "enabled": true, "tokenTtlHours": 12 }
}
```

Add a project or gate by editing this file and restarting.

## Authentication (for deployments)

With `auth.enabled: true`, every `/api/*` call requires a JWT issued by
`POST /api/login`; the UI shows a sign-in screen. Manage accounts with:

```
node add-user.js <username> <password>
```

Users live in the `users` table of `data/jiskra.db` (scrypt-hashed, gitignored), or in
the `AUTH_USERS` env var for deployments (`add-user.js <user> <pass> --print` emits the
entry). The signing secret is auto-generated into `config.json` on first run (set
`AUTH_SECRET` in deployments). Run a deployed instance behind HTTPS. For local
single-user use, set `auth.enabled: false`.

All settings can also come from environment variables (they override `config.json`) —
see [DEPLOYMENT.md](DEPLOYMENT.md) for the full table.
