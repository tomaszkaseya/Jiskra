// Create or update a Jiskra user: node add-user.js <username> <password>
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error("Usage: node add-user.js <username> <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const dataDir = path.join(__dirname, "data");
const usersFile = path.join(dataDir, "users.json");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile, "utf8")) : [];
const salt = crypto.randomBytes(16);
const hash = crypto.scryptSync(password, salt, 64);
const user = { username, salt: salt.toString("hex"), hash: hash.toString("hex") };

const idx = users.findIndex((u) => u.username === username);
if (idx >= 0) { users[idx] = user; console.log(`Updated user '${username}'.`); }
else { users.push(user); console.log(`Added user '${username}'.`); }

fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
