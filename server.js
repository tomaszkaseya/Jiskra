// Jiskra (Jira + risk + status) - gate review & risk tracker on top of Jira epics.
// Run: node server.js   (Node 22.5+, no dependencies; data in SQLite via node:sqlite)
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

// --- Configuration: environment variables override config.json ---
const FILE_CONFIG = (() => {
  const p = path.join(__dirname, "config.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {};
})();
const env = process.env;
const CONFIG = {
  jira: {
    baseUrl: env.JIRA_BASE_URL || FILE_CONFIG.jira?.baseUrl,
    email: env.JIRA_EMAIL || FILE_CONFIG.jira?.email,
    token: env.JIRA_TOKEN || FILE_CONFIG.jira?.token,
    targetQuarterField: env.JIRA_TARGET_QUARTER_FIELD || FILE_CONFIG.jira?.targetQuarterField,
    ragField: env.JIRA_RAG_FIELD || FILE_CONFIG.jira?.ragField,
  },
  projects: env.PROJECTS ? env.PROJECTS.split(",").map((s) => s.trim()).filter(Boolean) : FILE_CONFIG.projects || [],
  gates: env.GATES ? env.GATES.split(",").map((s) => s.trim()).filter(Boolean) : FILE_CONFIG.gates || [],
  gateDescriptions: env.GATE_DESCRIPTIONS ? JSON.parse(env.GATE_DESCRIPTIONS) : FILE_CONFIG.gateDescriptions || {},
  port: Number(env.PORT || FILE_CONFIG.port || 4777),
  auth: {
    enabled: env.AUTH_ENABLED ? env.AUTH_ENABLED === "true" : FILE_CONFIG.auth?.enabled || false,
    secret: env.AUTH_SECRET || FILE_CONFIG.auth?.secret,
    tokenTtlHours: Number(env.AUTH_TOKEN_TTL_HOURS || FILE_CONFIG.auth?.tokenTtlHours || 12),
    // AUTH_USERS: "user:salt:hash,user2:salt:hash" (hex salt/hash from add-user.js --print)
    users: env.AUTH_USERS || null,
  },
};
if (!CONFIG.jira.baseUrl || !CONFIG.jira.email || !CONFIG.jira.token) {
  console.error("Missing Jira configuration (JIRA_BASE_URL / JIRA_EMAIL / JIRA_TOKEN or config.json).");
  process.exit(1);
}

const DATA_DIR = env.DATA_DIR || path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// --- SQLite ---
const db = new DatabaseSync(path.join(DATA_DIR, "jiskra.db"));
db.exec("PRAGMA journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS statuses (
    id TEXT PRIMARY KEY, epic_key TEXT NOT NULL, date TEXT, author TEXT, text TEXT,
    created_at TEXT, updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS risks (
    id TEXT PRIMARY KEY, epic_key TEXT NOT NULL, title TEXT, description TEXT,
    mitigation TEXT, severity TEXT, owner TEXT, status TEXT DEFAULT 'open',
    created_at TEXT, updated_at TEXT, closed_at TEXT
  );
  CREATE TABLE IF NOT EXISTS risk_updates (
    id TEXT PRIMARY KEY, risk_id TEXT NOT NULL, date TEXT, text TEXT, author TEXT,
    created_at TEXT, updated_at TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_statuses_epic ON statuses(epic_key);
  CREATE INDEX IF NOT EXISTS idx_risks_epic ON risks(epic_key);
  CREATE INDEX IF NOT EXISTS idx_rupd_risk ON risk_updates(risk_id);
`);

// One-time migration from the old JSON files.
migrateJson();
function migrateJson() {
  const jsonFile = path.join(DATA_DIR, "db.json");
  if (fs.existsSync(jsonFile)) {
    const hasRows = db.prepare("SELECT COUNT(*) AS n FROM statuses").get().n +
      db.prepare("SELECT COUNT(*) AS n FROM risks").get().n;
    if (!hasRows) {
      const old = JSON.parse(fs.readFileSync(jsonFile, "utf8"));
      for (const [key, rec] of Object.entries(old.epics || {})) {
        for (const s of rec.statuses || []) {
          db.prepare("INSERT OR IGNORE INTO statuses (id,epic_key,date,author,text,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
            .run(s.id, key, s.date ?? null, s.author ?? null, s.text ?? null, s.createdAt ?? null, s.updatedAt ?? null);
        }
        for (const r of rec.risks || []) {
          db.prepare("INSERT OR IGNORE INTO risks (id,epic_key,title,description,mitigation,severity,owner,status,created_at,updated_at,closed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
            .run(r.id, key, r.title ?? null, r.description ?? null, r.mitigation ?? null, r.severity ?? null, r.owner ?? null, r.status ?? "open", r.createdAt ?? null, r.updatedAt ?? null, r.closedAt ?? null);
          for (const u of r.updates || []) {
            db.prepare("INSERT OR IGNORE INTO risk_updates (id,risk_id,date,text,author,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
              .run(u.id, r.id, u.date ?? null, u.text ?? null, u.author ?? null, u.createdAt ?? null, u.updatedAt ?? null);
          }
        }
      }
      console.log("Migrated data/db.json into data/jiskra.db");
    }
    fs.renameSync(jsonFile, jsonFile + ".migrated");
  }
  const usersFile = path.join(DATA_DIR, "users.json");
  if (fs.existsSync(usersFile)) {
    for (const u of JSON.parse(fs.readFileSync(usersFile, "utf8"))) {
      db.prepare("INSERT OR REPLACE INTO users (username,salt,hash) VALUES (?,?,?)").run(u.username, u.salt, u.hash);
    }
    fs.renameSync(usersFile, usersFile + ".migrated");
    console.log("Migrated data/users.json into data/jiskra.db");
  }
}

const rowToStatus = (r) => ({ id: r.id, date: r.date, author: r.author, text: r.text, createdAt: r.created_at, updatedAt: r.updated_at ?? undefined });
const rowToUpdate = (r) => ({ id: r.id, date: r.date, text: r.text, author: r.author ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at ?? undefined });
const rowToRisk = (r) => ({
  id: r.id, title: r.title, description: r.description, mitigation: r.mitigation,
  severity: r.severity, owner: r.owner, status: r.status, createdAt: r.created_at,
  updatedAt: r.updated_at ?? undefined, closedAt: r.closed_at ?? undefined,
  updates: db.prepare("SELECT * FROM risk_updates WHERE risk_id = ? ORDER BY created_at DESC").all(r.id).map(rowToUpdate),
});
function localDataFor(epicKey) {
  return {
    statuses: db.prepare("SELECT * FROM statuses WHERE epic_key = ? ORDER BY created_at DESC").all(epicKey).map(rowToStatus),
    risks: db.prepare("SELECT * FROM risks WHERE epic_key = ? ORDER BY created_at DESC").all(epicKey).map(rowToRisk),
  };
}
const newId = () => Math.random().toString(36).slice(2, 10);

// --- Authentication (JWT, HS256; users in SQLite or AUTH_USERS env) ---
const AUTH = CONFIG.auth;
if (AUTH.enabled && !AUTH.secret) {
  AUTH.secret = crypto.randomBytes(32).toString("hex");
  if (Object.keys(FILE_CONFIG).length) {
    FILE_CONFIG.auth = Object.assign({}, FILE_CONFIG.auth, { secret: AUTH.secret });
    fs.writeFileSync(path.join(__dirname, "config.json"), JSON.stringify(FILE_CONFIG, null, 2));
    console.log("Generated auth secret and saved it to config.json");
  } else {
    console.warn("AUTH_SECRET not set - generated an ephemeral secret; tokens will not survive restarts.");
  }
}

function findUser(username) {
  if (AUTH.users) {
    for (const entry of AUTH.users.split(",")) {
      const [name, salt, hash] = entry.trim().split(":");
      if (name === username && salt && hash) return { username: name, salt, hash };
    }
    return null;
  }
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) || null;
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", AUTH.secret).update(header + "." + body).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  const parts = (token || "").split(".");
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac("sha256", AUTH.secret).update(parts[0] + "." + parts[1]).digest("base64url");
  const a = Buffer.from(parts[2]), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
}

function checkPassword(user, password) {
  const hash = crypto.scryptSync(password, Buffer.from(user.salt, "hex"), 64);
  const stored = Buffer.from(user.hash, "hex");
  return hash.length === stored.length && crypto.timingSafeEqual(hash, stored);
}

// --- Jira ---
const jiraAuthHeader = "Basic " + Buffer.from(CONFIG.jira.email + ":" + CONFIG.jira.token).toString("base64");

async function jiraGet(apiPath) {
  const res = await fetch(CONFIG.jira.baseUrl + apiPath, {
    headers: { Authorization: jiraAuthHeader, Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Jira " + res.status + ": " + (await res.text()).slice(0, 500));
  return res.json();
}

async function fetchGateEpics(gate) {
  const labels = CONFIG.projects.map((p) => `${p}-G${gate}`);
  const jql = `project in (${CONFIG.projects.join(",")}) AND issuetype = Epic AND labels in (${labels.join(",")}) ORDER BY project, key`;
  const qf = CONFIG.jira.targetQuarterField;
  const ragF = CONFIG.jira.ragField;
  const fields = ["summary", "status", "labels", "duedate", "assignee", qf, ragF].filter(Boolean).join(",");
  const data = await jiraGet(
    `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=${fields}&maxResults=200`
  );
  const epics = (data.issues || []).map((i) => ({
    key: i.key,
    project: i.key.split("-")[0],
    summary: i.fields.summary,
    status: i.fields.status ? i.fields.status.name : null,
    statusCategory: i.fields.status ? i.fields.status.statusCategory.key : null,
    labels: i.fields.labels || [],
    duedate: i.fields.duedate,
    assignee: i.fields.assignee ? i.fields.assignee.displayName : null,
    targetQuarter: qf && i.fields[qf] ? i.fields[qf].value : null,
    rag: ragF && i.fields[ragF] ? i.fields[ragF].value : null,
    url: CONFIG.jira.baseUrl + "/browse/" + i.key,
    progress: { done: 0, total: 0 },
  }));
  await addChildProgress(epics);
  return epics;
}

// Child-issue progress per epic (done/total), like Jira's "Issues Count" progress bars.
async function addChildProgress(epics) {
  if (!epics.length) return;
  const byKey = Object.fromEntries(epics.map((e) => [e.key, e]));
  const jql = `parent in (${epics.map((e) => e.key).join(",")})`;
  let pageToken = null;
  do {
    const data = await jiraGet(
      `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=status,parent&maxResults=500` +
        (pageToken ? `&nextPageToken=${encodeURIComponent(pageToken)}` : "")
    );
    for (const i of data.issues || []) {
      const parent = i.fields.parent && byKey[i.fields.parent.key];
      if (!parent) continue;
      parent.progress.total++;
      if (i.fields.status && i.fields.status.statusCategory.key === "done") parent.progress.done++;
    }
    pageToken = data.nextPageToken && !data.isLast ? data.nextPageToken : null;
  } while (pageToken);
}

// --- HTTP plumbing ---
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 1e6) reject(new Error("body too large"));
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
  });
}

// Build "SET col = ?, ..." from the allowed subset of a request body.
function updateClause(body, mapping) {
  const cols = [], vals = [];
  for (const [field, col] of Object.entries(mapping)) {
    if (field in body) { cols.push(`${col} = ?`); vals.push(body[field] ?? null); }
  }
  return { cols, vals };
}

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    // --- login (public) ---
    if (url.pathname === "/api/login" && req.method === "POST") {
      if (!AUTH.enabled) return sendJson(res, 200, { token: null, authDisabled: true });
      const { username, password } = await readBody(req);
      const user = username && findUser(username);
      if (!user || !password || !checkPassword(user, password)) {
        return sendJson(res, 401, { error: "invalid username or password" });
      }
      const ttl = AUTH.tokenTtlHours * 3600;
      const token = signToken({ sub: user.username, exp: Math.floor(Date.now() / 1000) + ttl });
      return sendJson(res, 200, { token, username: user.username });
    }

    // --- auth gate for everything else under /api/ ---
    if (AUTH.enabled && url.pathname.startsWith("/api/")) {
      const m = (req.headers.authorization || "").match(/^Bearer (.+)$/);
      if (!m || !verifyToken(m[1])) return sendJson(res, 401, { error: "unauthorized" });
    }

    // --- user management (any authenticated user; 2-3 person tool, no roles) ---
    const um = url.pathname.match(/^\/api\/users(?:\/([^/]+))?$/);
    if (um) {
      if (AUTH.users) return sendJson(res, 409, { error: "users are managed via the AUTH_USERS environment variable" });
      const uname = um[1] ? decodeURIComponent(um[1]) : null;
      if (req.method === "GET" && !uname) {
        return sendJson(res, 200, { users: db.prepare("SELECT username FROM users ORDER BY username").all().map((u) => u.username) });
      }
      if (req.method === "POST" && !uname) {
        const { username, password } = await readBody(req);
        if (!username || !/^[\w.@-]{2,64}$/.test(username)) return sendJson(res, 400, { error: "invalid username" });
        if (!password || password.length < 8) return sendJson(res, 400, { error: "password must be at least 8 characters" });
        const salt = crypto.randomBytes(16).toString("hex");
        const hash = crypto.scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex");
        const existed = !!db.prepare("SELECT 1 FROM users WHERE username = ?").get(username);
        db.prepare("INSERT INTO users (username,salt,hash) VALUES (?,?,?) ON CONFLICT(username) DO UPDATE SET salt=excluded.salt, hash=excluded.hash")
          .run(username, salt, hash);
        return sendJson(res, existed ? 200 : 201, { username, updated: existed });
      }
      if (req.method === "DELETE" && uname) {
        const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
        if (AUTH.enabled && count <= 1) return sendJson(res, 400, { error: "cannot delete the last user" });
        if (AUTH.enabled) {
          const token = (req.headers.authorization || "").match(/^Bearer (.+)$/);
          const me = token && verifyToken(token[1]);
          if (me && me.sub === uname) return sendJson(res, 400, { error: "cannot delete your own account" });
        }
        const r = db.prepare("DELETE FROM users WHERE username = ?").run(uname);
        if (!r.changes) return sendJson(res, 404, { error: "not found" });
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 405, { error: "method not allowed" });
    }

    // --- API ---
    if (url.pathname === "/api/config" && req.method === "GET") {
      return sendJson(res, 200, { gates: CONFIG.gates, gateDescriptions: CONFIG.gateDescriptions, projects: CONFIG.projects, jiraBase: CONFIG.jira.baseUrl });
    }
    if (url.pathname === "/api/epics" && req.method === "GET") {
      const gate = url.searchParams.get("gate");
      const epics = await fetchGateEpics(gate);
      for (const e of epics) Object.assign(e, localDataFor(e.key));
      return sendJson(res, 200, { epics });
    }

    const now = new Date().toISOString();

    // /api/epic/:key/risk/:riskId/update (+ /:id for PUT/DELETE) - dated updates on a risk
    const mu = url.pathname.match(/^\/api\/epic\/([A-Z0-9-]+)\/risk\/([\w-]+)\/update(?:\/([\w-]+))?$/);
    if (mu) {
      const [, , riskId, id] = mu;
      if (!db.prepare("SELECT id FROM risks WHERE id = ?").get(riskId)) {
        return sendJson(res, 404, { error: "risk not found" });
      }
      if (req.method === "POST") {
        const body = await readBody(req);
        const item = { id: newId(), createdAt: now, date: body.date ?? null, text: body.text ?? null, author: body.author ?? null };
        db.prepare("INSERT INTO risk_updates (id,risk_id,date,text,author,created_at) VALUES (?,?,?,?,?,?)")
          .run(item.id, riskId, item.date, item.text, item.author, now);
        return sendJson(res, 201, item);
      }
      if (req.method === "PUT" && id) {
        const body = await readBody(req);
        const { cols, vals } = updateClause(body, { date: "date", text: "text", author: "author" });
        const r = db.prepare(`UPDATE risk_updates SET ${[...cols, "updated_at = ?"].join(", ")} WHERE id = ? AND risk_id = ?`)
          .run(...vals, now, id, riskId);
        if (!r.changes) return sendJson(res, 404, { error: "not found" });
        return sendJson(res, 200, rowToUpdate(db.prepare("SELECT * FROM risk_updates WHERE id = ?").get(id)));
      }
      if (req.method === "DELETE" && id) {
        const r = db.prepare("DELETE FROM risk_updates WHERE id = ? AND risk_id = ?").run(id, riskId);
        if (!r.changes) return sendJson(res, 404, { error: "not found" });
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 405, { error: "method not allowed" });
    }

    // /api/epic/:key/status  |  /api/epic/:key/risk  (+ /:id for PUT/DELETE)
    const m = url.pathname.match(/^\/api\/epic\/([A-Z0-9-]+)\/(status|risk)(?:\/([\w-]+))?$/);
    if (m) {
      const [, key, kind, id] = m;

      if (req.method === "POST") {
        const body = await readBody(req);
        const item = { id: newId(), createdAt: now };
        if (kind === "status") {
          Object.assign(item, { date: body.date ?? null, author: body.author ?? null, text: body.text ?? null });
          db.prepare("INSERT INTO statuses (id,epic_key,date,author,text,created_at) VALUES (?,?,?,?,?,?)")
            .run(item.id, key, item.date, item.author, item.text, now);
        } else {
          Object.assign(item, {
            title: body.title ?? null, description: body.description ?? null, mitigation: body.mitigation ?? null,
            severity: body.severity ?? null, owner: body.owner ?? null, status: body.status || "open", updates: [],
          });
          db.prepare("INSERT INTO risks (id,epic_key,title,description,mitigation,severity,owner,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)")
            .run(item.id, key, item.title, item.description, item.mitigation, item.severity, item.owner, item.status, now);
        }
        return sendJson(res, 201, item);
      }
      if (req.method === "PUT" && id) {
        const body = await readBody(req);
        let r;
        if (kind === "status") {
          const { cols, vals } = updateClause(body, { date: "date", author: "author", text: "text" });
          r = db.prepare(`UPDATE statuses SET ${[...cols, "updated_at = ?"].join(", ")} WHERE id = ? AND epic_key = ?`)
            .run(...vals, now, id, key);
        } else {
          const { cols, vals } = updateClause(body, {
            title: "title", description: "description", mitigation: "mitigation",
            severity: "severity", owner: "owner", status: "status",
          });
          if (body.status && body.status !== "open") { cols.push("closed_at = COALESCE(closed_at, ?)"); vals.push(now); }
          if (body.status === "open") cols.push("closed_at = NULL");
          r = db.prepare(`UPDATE risks SET ${[...cols, "updated_at = ?"].join(", ")} WHERE id = ? AND epic_key = ?`)
            .run(...vals, now, id, key);
        }
        if (!r.changes) return sendJson(res, 404, { error: "not found" });
        const table = kind === "status" ? "statuses" : "risks";
        const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
        return sendJson(res, 200, kind === "status" ? rowToStatus(row) : rowToRisk(row));
      }
      if (req.method === "DELETE" && id) {
        let r;
        if (kind === "status") {
          r = db.prepare("DELETE FROM statuses WHERE id = ? AND epic_key = ?").run(id, key);
        } else {
          db.prepare("DELETE FROM risk_updates WHERE risk_id = ?").run(id);
          r = db.prepare("DELETE FROM risks WHERE id = ? AND epic_key = ?").run(id, key);
        }
        if (!r.changes) return sendJson(res, 404, { error: "not found" });
        return sendJson(res, 200, { ok: true });
      }
      return sendJson(res, 405, { error: "method not allowed" });
    }

    // --- static ---
    let file = url.pathname === "/" ? "/index.html" : url.pathname;
    const fp = path.join(PUBLIC_DIR, path.normalize(file).replace(/^(\.\.[\\/])+/, ""));
    if (fp.startsWith(PUBLIC_DIR) && fs.existsSync(fp) && fs.statSync(fp).isFile()) {
      res.writeHead(200, { "Content-Type": MIME[path.extname(fp)] || "application/octet-stream" });
      return res.end(fs.readFileSync(fp));
    }
    sendJson(res, 404, { error: "not found" });
  } catch (err) {
    sendJson(res, 500, { error: String(err.message || err) });
  }
});

server.listen(CONFIG.port, () => {
  console.log(`Jiskra running at http://localhost:${CONFIG.port}`);
});
