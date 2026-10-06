// Jiskra (Jira + risk + status) - gate review & risk tracker on top of Jira epics.
// Run: node server.js   (Node 18+, no dependencies)
const http = require("http");
const fs = require("fs");
const path = require("path");

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, "config.json"), "utf8"));
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ epics: {} }, null, 2));

function loadDb() {
  return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
}
function saveDb(db) {
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
// Per-epic local record shape:
// db.epics[key] = { statuses: [{id,date,text,createdAt}], risks: [{id,title,description,severity,likelihood,mitigation,owner,status,createdAt,updatedAt,closedAt}] }
function epicRecord(db, key) {
  if (!db.epics[key]) db.epics[key] = { statuses: [], risks: [] };
  return db.epics[key];
}

const authHeader = "Basic " + Buffer.from(CONFIG.jira.email + ":" + CONFIG.jira.token).toString("base64");

async function jiraGet(apiPath) {
  const res = await fetch(CONFIG.jira.baseUrl + apiPath, {
    headers: { Authorization: authHeader, Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Jira " + res.status + ": " + (await res.text()).slice(0, 500));
  return res.json();
}

async function fetchGateEpics(gate) {
  const labels = CONFIG.projects.map((p) => `${p}-G${gate}`);
  const jql = `project in (${CONFIG.projects.join(",")}) AND issuetype = Epic AND labels in (${labels.join(",")}) ORDER BY project, key`;
  const qf = CONFIG.jira.targetQuarterField;
  const fields = ["summary", "status", "labels", "duedate", "assignee", qf].join(",");
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
    targetQuarter: i.fields[qf] ? i.fields[qf].value : null,
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

const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    // --- API ---
    if (url.pathname === "/api/config" && req.method === "GET") {
      return sendJson(res, 200, { gates: CONFIG.gates, projects: CONFIG.projects, jiraBase: CONFIG.jira.baseUrl });
    }
    if (url.pathname === "/api/epics" && req.method === "GET") {
      const gate = url.searchParams.get("gate");
      const epics = await fetchGateEpics(gate);
      const db = loadDb();
      for (const e of epics) {
        const rec = db.epics[e.key] || { statuses: [], risks: [] };
        e.statuses = rec.statuses;
        e.risks = rec.risks;
      }
      return sendJson(res, 200, { epics });
    }

    // /api/epic/:key/status  |  /api/epic/:key/risk  (+ /:id for PUT/DELETE)
    const m = url.pathname.match(/^\/api\/epic\/([A-Z0-9-]+)\/(status|risk)(?:\/([\w-]+))?$/);
    if (m) {
      const [, key, kind, id] = m;
      const db = loadDb();
      const rec = epicRecord(db, key);
      const list = kind === "status" ? rec.statuses : rec.risks;
      const now = new Date().toISOString();

      if (req.method === "POST") {
        const body = await readBody(req);
        const item = { id: Math.random().toString(36).slice(2, 10), createdAt: now, ...body };
        if (kind === "risk" && !item.status) item.status = "open";
        list.unshift(item);
        saveDb(db);
        return sendJson(res, 201, item);
      }
      if (req.method === "PUT" && id) {
        const item = list.find((x) => x.id === id);
        if (!item) return sendJson(res, 404, { error: "not found" });
        const body = await readBody(req);
        Object.assign(item, body, { updatedAt: now });
        if (kind === "risk" && body.status && body.status !== "open" && !item.closedAt) item.closedAt = now;
        if (kind === "risk" && body.status === "open") delete item.closedAt;
        saveDb(db);
        return sendJson(res, 200, item);
      }
      if (req.method === "DELETE" && id) {
        const idx = list.findIndex((x) => x.id === id);
        if (idx === -1) return sendJson(res, 404, { error: "not found" });
        list.splice(idx, 1);
        saveDb(db);
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
