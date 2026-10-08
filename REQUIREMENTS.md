# Jiskra — Requirements

Name: **Ji**ra + ri**sk** + st**a**tus ("jiskra" = *spark* in Czech/Polish).
Formerly "Jiriskstellation".

Status: v1 implemented (2026-10-06). Section 6 is the planned next step.

## 1. Purpose

A lightweight tool for running daily scrum-of-scrums gate reviews across multiple Jira
projects. Jira holds the epics and their delivery metadata; this tool adds what Jira
lacks: a per-epic daily status log and a simple risk tracker, kept entirely outside Jira.

## 2. Context and domain model

- Delivery is organized in **NPI gates** (currently gates 3, 4, 5; gates 2 and 6 exist
  in some projects and may be added).
- An epic belongs to a gate via a **Jira label** following the convention
  `<PROJECT_KEY>-G<N>` (e.g. `ONP-G3`, `OA-G4`).
- Each epic has a **Target Launch Quarter** — a Jira single-select custom field
  (`customfield_14106`, values like `2026-Q2`).
- Epics come from multiple Jira projects (currently `ONP` and `OA`).

## 3. Functional requirements (implemented in v1)

### 3.1 Gate views
- One tab per configured gate. Selecting a tab loads, live from Jira, all epics across
  the configured projects that carry that gate's label.
- Epics are grouped by project and show: key (link to Jira), summary, Jira status
  (color-coded by status category), RAG status (a colored dot read from the Jira
  "Operating Status" select field, `customfield_14707` — configurable as
  `jira.ragField`; an unset field shows a grey dot meaning "not started"), target
  launch quarter, open-risk count, and the date of the most recent local status update.
- Filters: by target launch quarter; "only epics with open risks".
- Two switchable views per gate (choice remembered per browser):
  - **Table (default)**: a matrix of epics (rows, grouped by project) × target launch
    quarters (columns). The cell at the epic's quarter shows a progress bar with
    done/total counts of the epic's child issues (done = Jira status category "Done"),
    mirroring the Jira "Issues Count" dashboard. A footer row totals each quarter.
    Clicking a row expands the same status/risk detail panel as in the list view.
  - **List**: epic cards grouped by project, with the progress bar inline.
- The selected tab is remembered between visits (per browser).

### 3.2 Daily status log (local, per epic)
- Add an entry with: date (defaults to today), optional reporter name, free text.
- Entries are listed newest-first and can be edited in place or deleted.
- Intended use: during the daily review, one entry per epic per day as given by the team.

### 3.3 Risk tracker (local, per epic)
- Create a risk with: title (required), description/impact, mitigation plan,
  severity (High/Medium/Low), owner.
- A risk is `open` or `closed`; closing stamps the close date, reopening clears it.
  Closed risks stay visible (struck through) for history.
- Risks can be edited in place (all fields) or deleted. Open risks surface as a
  warning badge on the epic row.
- Each risk has its own **update log**: dated free-text entries (e.g. mitigation
  progress reported at the daily), listed newest-first, editable and deletable.
- Deliberately simple — no workflow, no sync to Jira.

### 3.4 User management
- A "Users" page (modal) lists accounts and lets any signed-in user add a user, reset a
  password (same form) or delete a user. No roles — it is a 2–3 person tool.
- Guards: cannot delete your own account or the last remaining user; passwords min 8
  characters. When accounts come from the `AUTH_USERS` env var, the page is read-only
  (the API refuses changes with an explanatory error).

### 3.5 Executive report
- The "Report" button downloads one standalone, self-contained HTML file covering
  **all configured gates** (fetched fresh from Jira on click) — shareable by email or
  printable to PDF, no Jiskra access needed by the reader.
- One section per gate (each starts on a new page when printed), containing: KPI tiles
  (epic count, % of child issues done, open risks by severity), an epic table (RAG dot,
  quarter, Jira status, progress, open-risk count, latest daily status note) and an
  open-risk register (severity-sorted, with mitigation, owner and the latest risk
  update). Links point back to Jira.

### 3.6 Data and integration rules
- Jira is **read-only**: the tool never writes to Jira.
- All local data (statuses, risks, risk updates, users) lives in a single SQLite file,
  `data/jiskra.db` (WAL mode), via the Node built-in `node:sqlite` — one file to back
  up. Legacy `data/db.json` / `data/users.json` are auto-migrated on first start and
  renamed to `*.migrated`.
- If an epic disappears from a gate (label removed), its local data is retained in the
  database and reappears if the label returns.

## 4. Non-functional requirements

- Runs locally with `node server.js` — Node 22.5+ (built-in `node:sqlite`),
  **zero npm dependencies**.
- **Authentication** (for deployed instances; off by default locally via
  `auth.enabled`): username/password accounts stored in the `users` table of
  `data/jiskra.db` with scrypt-hashed salted passwords, managed by
  `node add-user.js <user> <pass>`; deployments can instead supply accounts via the
  `AUTH_USERS` env var (`add-user.js --print` emits an entry).
  `POST /api/login` issues an HS256 JWT (signed with `auth.secret`, auto-generated
  into config.json on first run; TTL `auth.tokenTtlHours`, default 12h). All other
  `/api/*` routes require `Authorization: Bearer <token>`; the UI shows a sign-in
  screen on 401 and keeps the token in localStorage. A deployed instance must run
  behind HTTPS (reverse proxy) — the token is a bearer credential.
- The Jira API token grants the Jira access; it must never be committed (hence
  `config.json` is gitignored, as is `data/` with the user database).
- Works against Atlassian Cloud REST API v3 (`/rest/api/3/search/jql`) with basic auth
  (email + API token).
- UI: single page, no build step, responsive down to phone width, respects the OS
  light/dark theme.

## 5. Configuration

Two equivalent sources; **environment variables override `config.json`** key by key,
so a deployment needs no config file at all (see `DEPLOYMENT.md` for the full table):

| config.json | env var | Meaning |
|---|---|---|
| `jira.baseUrl` / `jira.email` / `jira.token` | `JIRA_BASE_URL` / `JIRA_EMAIL` / `JIRA_TOKEN` | Atlassian Cloud instance and API token |
| `jira.targetQuarterField` | `JIRA_TARGET_QUARTER_FIELD` | custom field id of Target Launch Quarter |
| `jira.ragField` | `JIRA_RAG_FIELD` | custom field id of the RAG / Operating Status select |
| `projects` | `PROJECTS` (comma-sep) | Jira project keys to scan |
| `gates` | `GATES` (comma-sep) | gate numbers → one tab each |
| `gateDescriptions` | `GATE_DESCRIPTIONS` (JSON) | gate time ranges shown in the UI |
| `port` | `PORT` | local HTTP port |
| — | `DATA_DIR` | where `jiskra.db` lives (default `./data`) |
| `auth.*` | `AUTH_ENABLED` / `AUTH_SECRET` / `AUTH_TOKEN_TTL_HOURS` / `AUTH_USERS` | authentication settings |

Changing configuration requires a restart. Deployment target: one instance, persistent
EBS volume for `DATA_DIR` (not EFS/NFS — SQLite locking), HTTPS in front, secrets from
AWS Secrets Manager.

## 6. Planned: generic configuration (next step — not yet implemented)

Goal: the tool must be generic and usable by anyone, with no hand-editing of JSON.

- **Settings screen in the UI** for everything in section 5: Jira base URL, email,
  API token, project keys, gates, target-quarter field.
- **First-run setup**: when no configuration exists, the app opens on the settings
  screen instead of failing; a "test connection" button validates the Jira credentials
  and lists accessible projects.
- **Configurable gate-label convention**: the `<PROJECT>-G<N>` pattern becomes a
  template (e.g. `{project}-G{gate}`) so other teams' naming schemes work.
- **Field discovery**: pick the target-quarter field from a searchable list fetched
  from Jira instead of typing a `customfield_*` id.
- Config changes apply without restarting the server; the token is stored server-side
  only (never sent back to the browser in full).
- Out of scope for now: multi-user accounts, hosting, write-back to Jira.
