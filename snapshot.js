// Make a consistent single-file snapshot of the Jiskra database (safe while the
// server is running, despite WAL mode). Use it to seed a deployment or as a backup.
//   node snapshot.js [output-file]        default: data/jiskra-seed-<date>.db
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const dbFile = path.join(dataDir, "jiskra.db");
if (!fs.existsSync(dbFile)) {
  console.error("No database at " + dbFile);
  process.exit(1);
}
const out = process.argv[2] || path.join(dataDir, `jiskra-seed-${new Date().toISOString().slice(0, 10)}.db`);
if (fs.existsSync(out)) {
  console.error("Output file already exists: " + out);
  process.exit(1);
}

const db = new DatabaseSync(dbFile);
db.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
db.close();

const stats = new DatabaseSync(out);
const n = (t) => stats.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
console.log(`Snapshot written to ${out}`);
console.log(`  statuses: ${n("statuses")}, risks: ${n("risks")}, risk updates: ${n("risk_updates")}, users: ${n("users")}`);
stats.close();
