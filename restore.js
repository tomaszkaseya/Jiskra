// Seed a new Jiskra instance from the private GitHub backup repository: download the
// newest snapshot and install it as the local jiskra.db (statuses, risks, reports,
// users, tabs — everything). Run it BEFORE the first `node server.js` on a new machine.
//   node restore.js            download the newest snapshot into DATA_DIR
//   node restore.js --force    overwrite a jiskra.db that already has data
// Uses the same configuration as backup.js (BACKUP_REPO / backup.token / gh auth token).
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { backupConfig } = require("./backup");

const FILE = /^jiskra-\d{4}-\d{2}-\d{2}T\d{4}\.db$/; // same pattern as backup.js; newest = max name

async function api(cfg, urlPath, accept) {
  return fetch("https://api.github.com" + urlPath, {
    headers: {
      Authorization: "Bearer " + cfg.token,
      Accept: accept || "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "jiskra-restore",
    },
  });
}

// true when the file exists and holds any statuses/risks/reports/users (or is unreadable).
function existingHasData(p) {
  let db;
  try { db = new DatabaseSync(p); } catch { return true; } // not a database — never clobber silently
  try {
    const n = (t) => { try { return db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n; } catch { return 0; } };
    return n("statuses") + n("risks") + n("reports") + n("users") > 0;
  } finally { db.close(); }
}

async function runRestore() {
  const cfg = backupConfig();
  if (!cfg.repo) throw new Error("no backup repository configured (BACKUP_REPO or backup.repo in config.json)");
  if (!cfg.token) throw new Error("no GitHub token (BACKUP_TOKEN, backup.token in config.json, or `gh auth token`)");
  if (!fs.existsSync(cfg.dataDir)) fs.mkdirSync(cfg.dataDir, { recursive: true });
  const target = path.join(cfg.dataDir, "jiskra.db");
  const force = process.argv.includes("--force");
  if (fs.existsSync(target) && existingHasData(target) && !force) {
    throw new Error(`${target} already has data — pass --force to overwrite it`);
  }

  const res = await api(cfg, `/repos/${cfg.repo}/contents` + (cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : ""));
  if (!res.ok) throw new Error(`could not list ${cfg.repo} (${res.status})`);
  const list = await res.json();
  const newest = (Array.isArray(list) ? list : [list]).filter((f) => FILE.test(f.name)).sort((a, b) => b.name.localeCompare(a.name))[0];
  if (!newest) throw new Error(`no snapshots (jiskra-*.db) found in ${cfg.repo}`);

  // Raw download (the plain download_url of a private repo carries a short-lived token).
  const raw = await api(cfg, `/repos/${cfg.repo}/contents/${encodeURIComponent(newest.name)}`, "application/vnd.github.raw");
  if (!raw.ok) throw new Error(`download of ${newest.name} failed (${raw.status})`);
  const bytes = Buffer.from(await raw.arrayBuffer());
  if (bytes.length !== newest.size) throw new Error(`download of ${newest.name} is incomplete (${bytes.length} of ${newest.size} bytes)`);

  const tmp = path.join(cfg.dataDir, `.restore-tmp-${process.pid}.db`);
  fs.writeFileSync(tmp, bytes);
  let db;
  try { db = new DatabaseSync(tmp); } catch (e) { fs.rmSync(tmp, { force: true }); throw new Error(`downloaded ${newest.name} is not a valid SQLite database: ${e.message}`); }
  try {
    const n = (t) => { try { return db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n; } catch { return 0; } };
    console.log(`Restored ${newest.name} (${Math.round(bytes.length / 1024)} KB) from ${cfg.repo} → ${target}`);
    console.log(`  statuses: ${n("statuses")}, risks: ${n("risks")}, risk updates: ${n("risk_updates")}, reports: ${n("reports")}, users: ${n("users")}, tabs: ${n("tabs")}`);
  } finally { db.close(); }
  fs.renameSync(tmp, target);
  return { file: newest.name, target };
}

if (require.main === module) {
  runRestore().then(
    () => console.log("Done — now run `node server.js`."),
    (e) => { console.error("Restore failed: " + e.message); process.exit(1); },
  );
}
module.exports = { runRestore };

