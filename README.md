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

- Each tab (page) is defined by you under **Settings → Gates & projects**: a name, an
  optional description and a list of Jira labels (e.g. `ONP-G3, OA-G3`). The tab shows every
  epic carrying any of those labels, across the projects listed in `config.json`/`PROJECTS`.
  Tabs are stored in the database; add, rename, reorder or remove them in the app.
- Target launch quarter comes from the Jira custom field `Target Launch Quarter`
  (`customfield_14106`).
- Daily statuses, risks and users are stored locally in `data/jiskra.db` (SQLite).
  Nothing is written back to Jira. Legacy `data/db.json` / `data/users.json` files are
  migrated automatically on first start.

## Executive report (PMO)

**Reports** (header button) generates a one-page delivery report for the PMO: bottom line, what needs
attention, a gate scorecard, what changed since the previous report, open risks, and the status and
health of every epic. Every report is saved in the history on the same page, so you can reopen,
download or delete earlier ones.

Who writes the narrative:

- **In the app:** set `ANTHROPIC_API_KEY` (or `anthropic.apiKey` in `config.json`); the Generate button then
  asks Claude to write it (model `claude-opus-5-5`, about a minute or two). Without a key the button still
  works but produces a plain version from the latest status entries.
- **From Claude Code, no key needed:** run `/jiskra-report` in this repository. Claude Code collects the facts
  (`node report-cli.js facts`), writes the narrative, and saves it (`node report-cli.js save`) into the same history.
  This writes to the local database, so it suits the machine you run Jiskra on.

"What changed" compares against the previous saved report: risks added, raised, lowered, closed or
removed (history is recorded from the moment this feature shipped), epic progress, RAG, Jira status
and target quarter, and entries newer than the previous report.

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

`gates` / `gateDescriptions` only seed the tabs on the very first start of a new database
(each gate N becomes a tab "Gate N" with labels `<PROJECT>-G<N>`); after that, manage tabs
in the app. Add a project by editing this file (or `PROJECTS`) and restarting.

## Authentication (for deployments)

With `auth.enabled: true`, every `/api/*` call requires a JWT issued by
`POST /api/login`; the UI shows a sign-in screen. Accounts are managed in the app, on the
**Users** page under Settings (the gear icon). Only to create the very first account on an
empty database, use the CLI:

```
node add-user.js <username> <password>
```

Users live in the `users` table of `data/jiskra.db` (scrypt-hashed, gitignored), or in
the `AUTH_USERS` env var for deployments (`add-user.js <user> <pass> --print` emits the
entry; the Users page is then read-only). The signing secret is auto-generated into `config.json` on first run (set
`AUTH_SECRET` in deployments). Run a deployed instance behind HTTPS. For local
single-user use, set `auth.enabled: false`.

All settings can also come from environment variables (they override `config.json`) —
see [DEPLOYMENT.md](DEPLOYMENT.md) for the full table.
