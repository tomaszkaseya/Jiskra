// Generate the executive report from Claude Code instead of the Anthropic API (no API key needed).
//   node report-cli.js prompt                                  writing rules + JSON schema for the narrative
//   node report-cli.js facts <facts.json> [--since <date|ISO>] collect Jira + local data (default since: last report)
//   node report-cli.js save <facts.json> <narrative.json>      render and store the report in the history
// Uses the same config / DATA_DIR as server.js. See .claude/skills/jiskra-report/SKILL.md.
const fs = require("fs");
const report = require("./report");
const app = require("./server");

const [cmd, ...args] = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const die = (msg) => {
  console.error(msg);
  process.exit(1);
};

async function main() {
  if (cmd === "prompt") {
    console.log(report.SYSTEM_PROMPT);
    console.log("\n--- narrative JSON schema (write exactly this shape) ---\n");
    console.log(JSON.stringify(report.NARRATIVE_SCHEMA, null, 2));
    return;
  }

  if (cmd === "facts") {
    const out = args[0];
    if (!out || out.startsWith("--")) die("usage: node report-cli.js facts <facts.json> [--since <date|ISO>]");
    const last = app.db.prepare("SELECT MAX(created_at) AS t FROM reports").get().t;
    let since = flag("--since");
    if (since && /^\d{4}-\d{2}-\d{2}$/.test(since)) since = new Date(since + "T00:00:00").toISOString(); // local midnight
    since = since || last || new Date(Date.now() - 7 * 864e5).toISOString();
    if (Number.isNaN(Date.parse(since))) die("invalid --since value");
    const { facts, snapshot } = await app.collectFacts(new Date(since).toISOString());
    fs.writeFileSync(out, JSON.stringify({ facts, snapshot }));
    const epics = facts.gates.flatMap((g) => g.epics);
    console.log(`Facts written to ${out}: ${facts.gates.length} gates, ${epics.length} epics, ${facts.riskChanges.length} risk changes since ${facts.since}.`);
    console.log(facts.previousReport ? `Previous report: ${facts.previousReport.createdAt}` : "No previous report: this will be the first saved one.");
    return;
  }

  if (cmd === "save") {
    const [factsFile, narrativeFile] = args;
    if (!factsFile || !narrativeFile) die("usage: node report-cli.js save <facts.json> <narrative.json>");
    const { facts, snapshot } = JSON.parse(fs.readFileSync(factsFile, "utf8"));
    const narrative = JSON.parse(fs.readFileSync(narrativeFile, "utf8"));
    const keys = new Set(facts.gates.flatMap((g) => g.epics.map((e) => e.key)));
    const covered = new Set((narrative.epics || []).map((n) => n.key));
    const missing = [...keys].filter((k) => !covered.has(k));
    const unknown = [...covered].filter((k) => !keys.has(k));
    if (unknown.length) console.warn("Ignoring unknown epic keys in the narrative: " + unknown.join(", "));
    if (missing.length) console.warn("Epics missing from the narrative (filled from their latest status entry): " + missing.join(", "));
    const merged = report.mergeNarrative(narrative, report.fallbackNarrative(facts), facts);
    const saved = app.saveReport(facts, snapshot, merged, { ai: true, model: flag("--model") || "Claude Code" });
    console.log(`Saved report ${saved.id} (${saved.createdAt}). Open Jiskra > Reports to view it.`);
    return;
  }

  die("usage: node report-cli.js prompt | facts <facts.json> [--since <date>] | save <facts.json> <narrative.json>");
}

main().catch((e) => die(e.message));
