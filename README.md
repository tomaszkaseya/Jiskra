# Jiskra

**Ji**ra + ri**sk** + st**a**tus — and "jiskra" is Czech for *spark*.

Local gate-review tool for Jira epics: one tab per NPI gate, epics pulled live from Jira,
plus a local daily-status log and risk tracker per epic (stored outside Jira).

## Run

```
copy config.example.json config.json   # then fill in your Jira details
node server.js
```

Open http://localhost:4777 (Node 18+, no dependencies).

## How it works

- Epics are fetched live from Jira by gate label (`<PROJECT>-G<N>`, e.g. `ONP-G3`, `OA-G3`)
  across the projects listed in `config.json`.
- Target launch quarter comes from the Jira custom field `Target Launch Quarter`
  (`customfield_14106`).
- Daily statuses and risks are stored locally in `data/db.json`, keyed by epic key.
  Nothing is written back to Jira.

## Config (`config.json`, gitignored — contains the Jira API token)

```json
{
  "jira": { "baseUrl": "...", "email": "...", "token": "...", "targetQuarterField": "customfield_14106" },
  "projects": ["ONP", "OA"],
  "gates": [3, 4, 5],
  "port": 4777
}
```

Add a project or gate by editing this file and restarting.
