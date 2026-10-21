---
name: jiskra-report
description: Generate the Jiskra executive (PMO) delivery report from Claude Code and save it in the Reports history. Use when the user asks to generate, refresh or write the PMO / executive / NPI delivery report. No Anthropic API key needed.
---

# Generate the Jiskra executive report

The report has three steps. Claude Code writes the narrative (step 2); the scripts do the data and
rendering. Run commands from the repository root, one bare command per call.

1. **Collect the facts** (read-only Jira calls plus the local statuses and risks). Pick a scratch
   directory for the files; do not write them into the repository.

   `node report-cli.js facts <scratch>/facts.json`

   It measures "what changed" since the previous saved report. For another period, add `--since 2026-10-06`.
   Print what the user should know: number of epics, risk changes, previous report date.

2. **Write the narrative.**
   - Run `node report-cli.js prompt`. It prints the writing rules and the JSON schema. Follow both exactly.
   - Read `<scratch>/facts.json` (`facts` holds gates, epics, status entries, risks, movement and risk changes).
   - Write `<scratch>/narrative.json`. It needs one `epics` entry for every epic key and one `risks` entry for every open risk.
   - Use only what the facts say. If something is unclear (for example a status entry that contradicts Jira), say it in `notes` instead of guessing.
   - Anything you know from conversation with the user that is not in the facts (for example a meeting) must not go into the report unless the user says to include it. Suggest they add it to Jiskra as a status entry or risk update first.

3. **Save it.** Only after the user has had a chance to review the narrative if they asked to; otherwise save directly.

   `node report-cli.js save <scratch>/facts.json <scratch>/narrative.json`

   This renders the HTML, stores it in the Reports history of the Jiskra database and records the
   epic snapshot used as the baseline for the next report. Tell the user the report is under
   **Reports** in the app.

Notes:
- Saving writes to the live database (`data/jiskra.db`, or `DATA_DIR`). Do not run `save` for test runs; use a copy of the database via `DATA_DIR`.
- The in-app Generate button does the same thing through the Anthropic API when `ANTHROPIC_API_KEY` is configured. Reports from either path land in the same history.
