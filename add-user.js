// Create or update a Jiskra user.
//   node add-user.js <username> <password>          -> writes to data/jiskra.db
//   node add-user.js <username> <password> --print  -> prints "username:salt:hash"
//                                                      for the AUTH_USERS env var
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const args = process.argv.slice(2);
const printOnly = args.includes("--print");
const [username, password] = args.filter((a) => a !== "--print");
if (!username || !password) {
  console.error("Usage: node add-user.js <username> <password> [--print]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex");

if (printOnly) {
  console.log(`${username}:${salt}:${hash}`);
  process.exit(0);
}

const { DatabaseSync } = require("node:sqlite");
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, "jiskra.db"));
db.exec("CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL)");
db.prepare("INSERT INTO users (username,salt,hash) VALUES (?,?,?) ON CONFLICT(username) DO UPDATE SET salt=excluded.salt, hash=excluded.hash")
  .run(username, salt, hash);
console.log(`Saved user '${username}' in data/jiskra.db`);
