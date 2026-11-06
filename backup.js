// Push a consistent snapshot of the Jiskra database to a private GitHub repository.
//   node backup.js [--reason <text>]     manual / cron run
// Also used by server.js: automatically after every saved report and once a day.
// The snapshot is a full copy of statuses, risks, risk history, reports, users and
// tabs (same consistent VACUUM INTO as snapshot.js, safe while the app runs) — so
// the target repository MUST be private (password hashes, internal risk data).
//
// Configuration (environment variables override config.json):
//   BACKUP_REPO   / backup.repo    "owner/name" of a PRIVATE repository
//   BACKUP_TOKEN  / backup.token   GitHub token with Contents read+write on it
//                                  (fallback for local use: `gh auth token`)
//   BACKUP_KEEP   / backup.keep    snapshots to keep, oldest are pruned (default 30, 0 = unlimited)
//   BACKUP_BRANCH / backup.branch  default: the repository's default branch
//   BACKUP_ON_REPORT / backup.onReport  push after every saved report (default true)
//   BACKUP_DAILY  / backup.daily   push once a day while the server runs (default true)
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const FILE = /^jiskra-\d{4}-\d{2}-\d{2}T\d{4}\.db$/; // backup filenames, sortable by name

function backupConfig() {
  const env = process.env;
  const fileConfig = (() => {
    try { return JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8")); }
    catch { return {}; }
  })();
  let token = env.BACKUP_TOKEN || fileConfig.backup?.token || null;
  if (!token) {
    // Local convenience: reuse the GitHub CLI login. Not available in deployments.
    try { token = require("child_process").execSync("gh auth token", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null; }
    catch { /* gh not installed or not logged in */ }
  }
  return {
    repo: env.BACKUP_REPO || fileConfig.backup?.repo || null,
    token,
    keep: Number(env.BACKUP_KEEP || fileConfig.backup?.keep || 30),
    branch: env.BACKUP_BRANCH || fileConfig.backup?.branch || null,
    onReport: env.BACKUP_ON_REPORT ? env.BACKUP_ON_REPORT === "true" : fileConfig.backup?.onReport !== false,
    daily: env.BACKUP_DAILY ? env.BACKUP_DAILY === "true" : fileConfig.backup?.daily !== false,
    dataDir: env.DATA_DIR || path.join(__dirname, "data"),
  };
}

async function api(cfg, method, urlPath, body) {
  return fetch("https://api.github.com" + urlPath, {
    method,
    headers: {
      Authorization: "Bearer " + cfg.token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "jiskra-backup",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function requirePrivateRepo(cfg) {
  const res = await api(cfg, "GET", `/repos/${cfg.repo}`);
  if (!res.ok) throw new Error(`repository ${cfg.repo} not accessible (${res.status})`);
  const info = await res.json();
  if (!info.private && process.env.BACKUP_ALLOW_PUBLIC !== "true") {
    throw new Error(`${cfg.repo} is public — backups contain the risk register and password hashes. Make the repository private or set BACKUP_ALLOW_PUBLIC=true to override.`);
  }
}

// Upload one file via the Contents API. Handles a same-minute collision (422: needs
// the existing blob's sha to overwrite) and an empty repository with a custom branch (409).
async function putFile(cfg, filePath, content64, message) {
  const url = `/repos/${cfg.repo}/contents/${encodeURIComponent(filePath)}`;
  const attempt = (extra) => api(cfg, "PUT", url, { message, content: content64, ...(cfg.branch ? { branch: cfg.branch } : {}), ...extra });
  let res = await attempt();
  if (res.status === 422) {
    const existing = await api(cfg, "GET", url + (cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : ""));
    if (existing.ok) res = await attempt({ sha: (await existing.json()).sha });
  } else if (res.status === 409 && cfg.branch) {
    res = await api(cfg, "PUT", url, { message, content: content64 }); // empty repo: first push creates the default branch
  }
  if (!res.ok) throw new Error(`GitHub rejected ${filePath} (${res.status}): ${(await res.text()).slice(0, 300)}`);
}

// Delete the oldest backups beyond cfg.keep.
async function pruneOld(cfg) {
  if (!cfg.keep) return 0;
  const res = await api(cfg, "GET", `/repos/${cfg.repo}/contents` + (cfg.branch ? `?ref=${encodeURIComponent(cfg.branch)}` : ""));
  if (!res.ok) throw new Error(`GitHub listing failed (${res.status})`);
  const list = await res.json();
  const files = (Array.isArray(list) ? list : [list]).filter((f) => FILE.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
  const excess = files.slice(0, Math.max(0, files.length - cfg.keep));
  for (const f of excess) {
    const del = await api(cfg, "DELETE", `/repos/${cfg.repo}/contents/${encodeURIComponent(f.name)}`, {
      message: `Prune old backup ${f.name}`, sha: f.sha, ...(cfg.branch ? { branch: cfg.branch } : {}),
    });
    if (!del.ok) console.warn(`Could not prune ${f.name} (${del.status})`);
  }
  return excess.length;
}

// Take a consistent snapshot and push it. Returns { file, size, pruned } or
// { skipped, reason } when there is nothing worth backing up (fresh empty database —
// also protects the backup history from a newly configured second machine).
async function runBackup(reason) {
  const cfg = backupConfig();
  if (!cfg.repo) throw new Error("no backup repository configured (BACKUP_REPO or backup.repo in config.json)");
  if (!cfg.token) throw new Error("no GitHub token (BACKUP_TOKEN, backup.token in config.json, or `gh auth token`)");
  const dbFile = path.join(cfg.dataDir, "jiskra.db");
  if (!fs.existsSync(dbFile)) throw new Error("no database at " + dbFile);

  const file = `jiskra-${new Date().toISOString().slice(0, 16).replace(":", "")}.db`;
  const tmp = path.join(cfg.dataDir, `.backup-tmp-${process.pid}.db`);
  const db = new DatabaseSync(dbFile);
  let rows;
  try {
    const n = (t) => db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
    rows = n("statuses") + n("risks") + n("reports");
    db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  } finally { db.close(); }
  try {
    if (!rows) return { skipped: true, reason: "database is empty (no statuses, risks or reports yet) — nothing to back up" };
    const size = fs.statSync(tmp).size;
    if (size > 20 * 1024 * 1024) throw new Error(`snapshot is ${Math.round(size / 1e6)} MB — the GitHub Contents API tops out around 25 MB; prune old reports or switch to S3`);
    await requirePrivateRepo(cfg);
    await putFile(cfg, file, fs.readFileSync(tmp).toString("base64"), `Backup ${file.slice(7, -3).replace("T", " ")}${reason ? ` (${reason})` : ""}`);
    const pruned = await pruneOld(cfg);
    return { file, size, pruned };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const reason = args.includes("--reason") ? args[args.indexOf("--reason") + 1] : "manual";
  runBackup(reason).then(
    (r) => {
      if (r.skipped) console.log("Backup skipped: " + r.reason);
      else console.log(`Backup pushed to ${backupConfig().repo}: ${r.file} (${Math.round(r.size / 1024)} KB)${r.pruned ? `, pruned ${r.pruned} old snapshot(s)` : ""}`);
    },
    (e) => { console.error("Backup failed: " + e.message); process.exit(1); },
  );
}
module.exports = { backupConfig, runBackup };


