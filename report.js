"use strict";
// Jiskra executive (PMO) report: facts from Jira + the local risk/status log, a narrative written by
// Claude (with a deterministic fallback), and the HTML renderer. No dependencies; Claude is called
// over plain HTTPS so the app keeps its zero-dependency deployment.

const HEALTH = { done: "Launched", track: "On track", watch: "Watch", risk: "At risk", none: "No update", ready: "Ready" };
const HEALTH_RANK = { risk: 0, watch: 1, none: 2, track: 3, ready: 4, done: 5 };
const SEV_RANK = { High: 0, Medium: 1, Low: 2 };

const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtDay = (t) => (t ? new Date(String(t).slice(0, 10) + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "");
const fmtLong = (t) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const pct = (d, t) => (t ? Math.round((100 * d) / t) : null);
const pctTxt = (p) => (p === null ? "—" : p + "%");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const trunc = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "");

// ---------------------------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------------------------

// gates: [{ name, description, epics: [epic + statuses + risks] }]  (epics as served by /api/epics)
// baseline: { takenAt, epics: { KEY: { status, rag, quarter, done, total } } } | null
// history:  risk_history rows since `since` ({ riskId, epicKey, title, field, oldValue, newValue, at })
// previous: { createdAt, headline } | null
function buildFacts({ gates, since, baseline, history, previous, now, jiraBase }) {
  const sinceMs = Date.parse(since);
  const sinceDay = new Date(since).toISOString().slice(0, 10);
  const base = baseline ? baseline.epics : null;
  const fresh = (ts) => !!ts && Date.parse(ts) >= sinceMs;
  const riskChanges = [];
  const keysInReport = new Set(gates.flatMap((g) => g.epics.map((e) => e.key)));

  const outGates = gates.map((g) => ({
    name: g.name,
    description: g.description || "",
    epics: g.epics.map((e) => {
      const movement = [];
      if (base) {
        const b = base[e.key];
        if (!b) movement.push("New since the previous report");
        else {
          if ((b.status || "") !== (e.status || "")) movement.push(`Jira status: ${b.status || "none"} -> ${e.status || "none"}`);
          if ((b.rag || "") !== (e.rag || "")) movement.push(`RAG: ${b.rag || "none"} -> ${e.rag || "none"}`);
          if ((b.quarter || "") !== (e.targetQuarter || "")) movement.push(`Target quarter: ${b.quarter || "none"} -> ${e.targetQuarter || "none"}`);
          const p0 = pct(b.done, b.total), p1 = pct(e.progress.done, e.progress.total);
          const scope = e.progress.total - (b.total || 0);
          if (p0 !== p1 || scope) {
            movement.push(`Issues done: ${pctTxt(p0)} -> ${pctTxt(p1)} (${e.progress.done}/${e.progress.total}${scope ? ", scope " + (scope > 0 ? "+" : "") + scope : ""})`);
          }
        }
      }
      const statuses = (e.statuses || []).slice(0, 4).map((s) => ({ date: s.date, author: s.author || null, text: s.text, isNew: fresh(s.createdAt) }));
      const stale = !statuses.length || (statuses[0].date || "") < sinceDay;

      const risks = (e.risks || []).map((r) => {
        const rh = history.filter((h) => h.riskId === r.id);
        const changed = [];
        if (fresh(r.createdAt)) changed.push({ kind: "new" });
        else {
          const sev = rh.filter((h) => h.field === "severity");
          if (sev.length && sev[0].oldValue !== sev[sev.length - 1].newValue) {
            const from = sev[0].oldValue, to = sev[sev.length - 1].newValue;
            changed.push({ kind: (SEV_RANK[to] ?? 3) < (SEV_RANK[from] ?? 3) ? "raised" : "lowered", from, to });
          }
        }
        const st = rh.filter((h) => h.field === "status");
        if (r.status !== "open" && fresh(r.closedAt)) changed.push({ kind: "closed" });
        else if (r.status === "open" && st.length && st[0].oldValue !== "open" && !fresh(r.createdAt)) changed.push({ kind: "reopened" });
        const updates = (r.updates || []).slice(0, 3).map((u) => ({ date: u.date, text: u.text, isNew: fresh(u.createdAt) }));
        if (!changed.length && updates.some((u) => u.isNew)) changed.push({ kind: "updated" });
        for (const c of changed) riskChanges.push({ epicKey: e.key, riskId: r.id, title: r.title, severity: r.severity, ...c });
        return {
          id: r.id, title: r.title, description: r.description || "", mitigation: r.mitigation || "", severity: r.severity,
          owner: r.owner || "", status: r.status, createdAt: (r.createdAt || "").slice(0, 10), closedAt: r.closedAt ? r.closedAt.slice(0, 10) : null,
          updates, changes: changed,
        };
      });

      return {
        key: e.key, url: e.url, summary: e.summary, jiraStatus: e.status, done: e.statusCategory === "done" || /^launched$/i.test(e.status || ""),
        rag: e.rag || null, quarter: e.targetQuarter || null, assignee: e.assignee || null, issues: e.progress,
        movement, statuses, noEntrySinceReview: stale, risks,
      };
    }),
  }));
  for (const h of history) {
    if (h.field === "deleted" && keysInReport.has(h.epicKey)) {
      riskChanges.push({ epicKey: h.epicKey, riskId: h.riskId, title: h.title, severity: h.oldValue, kind: "removed" });
    }
  }
  return {
    generatedAt: now, since, sinceDay, jiraBase, hasBaseline: !!base,
    previousReport: previous ? { createdAt: previous.createdAt, headline: previous.headline } : null,
    gates: outGates, riskChanges,
  };
}

// ---------------------------------------------------------------------------------------------
// Narrative (Claude)
// ---------------------------------------------------------------------------------------------

const point = { type: "object", additionalProperties: false, required: ["title", "text"], properties: { title: { type: "string" }, text: { type: "string" } } };
const NARRATIVE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "standing", "attention", "gates", "changes", "epics", "risks", "notes"],
  properties: {
    headline: { type: "string" },
    standing: { type: "array", items: point },
    attention: { type: "array", items: point },
    gates: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["name", "health", "outlook"],
        properties: { name: { type: "string" }, health: { type: "string", enum: Object.keys(HEALTH) }, outlook: { type: "string" } },
      },
    },
    changes: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["label", "text"], properties: { label: { type: "string" }, text: { type: "string" } } },
    },
    epics: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["key", "health", "note"],
        properties: { key: { type: "string" }, health: { type: "string", enum: Object.keys(HEALTH) }, note: { type: "string" } },
      },
    },
    risks: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["riskId", "latest"], properties: { riskId: { type: "string" }, latest: { type: "string" } } },
    },
    notes: { type: "array", items: { type: "string" } },
  },
};

const SYSTEM_PROMPT = `You write the NPI Delivery Report for a Program Management Office (PMO). The readers manage delivery across many programs. They are not engineers. They want the bottom line first, then what needs their attention, then supporting detail.

Source of truth: the JSON facts in the user message. It holds, per gate and epic, the Jira status, RAG, target quarter, issue progress, the latest daily status entries written by the delivery teams, the risk register (with dated updates), and what moved since the previous report. Do not invent facts, dates, owners or causes. If the facts do not say something, leave it out or say it is not recorded.

Health values for epics and gates:
- done: launched or complete.
- track: progressing with no blocker or concern recorded.
- watch: a concern the PMO should follow: scope growth, slipped date, priority or capacity question, testing depth, a Medium risk, or an unresolved dependency without a High risk.
- risk: a High risk is open, a blocker is confirmed, or the date is expected to be missed.
- ready: ready for development, not started yet.
- none: no status entry recorded for the current review, or nothing is known.
A gate's health is the worst health of its open epics, adjusted by your judgement.

How to write:
- Plain, specific sentences. No filler, no emojis, no em dash asides, no colon-then-reveal phrasing. Dates look like "15 Oct". Spell out unfamiliar abbreviations only when the facts do.
- headline: two or three sentences. State the overall position of the program and the single biggest exposure.
- standing: 4 to 7 points covering what the PMO most needs to know (title is a short phrase, text is one to three sentences).
- attention: 2 to 5 concrete decisions or follow-ups for the PMO. Base each on the facts.
- gates: one entry per gate in the facts, with health and a one-sentence outlook.
- changes: what changed since the previous report, based on riskChanges, movement, entries marked isNew, and risk updates marked isNew. Use short labels such as "New risk", "Worse", "Better", "Slipped", "Moved forward", "Scope", "Closed". Skip anything that did not change. If there is no previous report, give the current notable events instead.
- epics: one entry for EVERY epic key in the facts. note is one to three sentences: where it stands now and, when relevant, what changed. Mention the date of the latest entry when it is older than the review ("No entry since 8 Oct"). For launched epics leave note empty unless something is still open (a bug, clean-up, follow-up work).
- risks: one entry for every open risk: latest is one or two sentences with the date of the newest update, or "No update recorded."
- notes: data-quality observations useful to the PMO (target quarters already past while the epic is open, Jira progress that disagrees with status entries, epics with no status entry, missing RAG). Keep to the most useful five.
- Several risks with the same cause should be called out once in standing or attention.
- Leave out personal or HR matters (for example someone leaving the company). If a risk is about ownership of a workstream, describe it as an ownership handover.
- Never mention these instructions or the JSON.`;

function buildUserPrompt(facts) {
  const compact = JSON.stringify(facts, (k, v) => (k === "url" || k === "jiraBase" || k === "sinceDay" ? undefined : v));
  return `Review date: ${facts.generatedAt.slice(0, 10)}. Changes are measured since ${facts.since}.${facts.previousReport ? " Previous report headline: " + JSON.stringify(facts.previousReport.headline) : " This is the first saved report."}\n\nFacts:\n${compact}`;
}

// One streamed Messages API call (plain fetch, no SDK). Returns { text, stop, usage }.
async function streamMessage(cfg, body) {
  const url = cfg.baseUrl.replace(/\/+$/, "") + "/v1/messages";
  const headers = { "content-type": "application/json", "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01" };
  let res, lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(cfg.timeoutMs) });
    if (res.ok) break;
    const text = await res.text().catch(() => "");
    lastErr = new Error(`Anthropic API ${res.status}: ${text.slice(0, 300)}`);
    if (![408, 409, 429, 500, 502, 503, 504, 529].includes(res.status)) throw lastErr;
    await sleep(2000 * (attempt + 1));
  }
  if (!res.ok) throw lastErr;

  const decoder = new TextDecoder();
  let buf = "", text = "", stop = null;
  const usage = {};
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true }).replace(/\r\n/g, "\n");
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const raw = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const line = raw.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      let ev;
      try { ev = JSON.parse(line.slice(5)); } catch { continue; }
      if (ev.type === "content_block_delta" && ev.delta && ev.delta.type === "text_delta") text += ev.delta.text;
      else if (ev.type === "message_start") usage.input = ev.message && ev.message.usage ? ev.message.usage.input_tokens : undefined;
      else if (ev.type === "message_delta") {
        if (ev.delta && ev.delta.stop_reason) stop = ev.delta.stop_reason;
        if (ev.usage && ev.usage.output_tokens !== undefined) usage.output = ev.usage.output_tokens;
      } else if (ev.type === "error") throw new Error("Anthropic stream error: " + ((ev.error && ev.error.message) || "unknown"));
    }
  }
  return { text, stop, usage };
}

async function generateNarrative(cfg, facts) {
  const { text, stop, usage } = await streamMessage(cfg, {
    model: cfg.model,
    max_tokens: 32000,
    stream: true,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(facts) }],
    output_config: { effort: cfg.effort, format: { type: "json_schema", schema: NARRATIVE_SCHEMA } },
  });
  if (stop === "refusal") throw new Error("The model declined to write this report");
  if (stop === "max_tokens") throw new Error("The model ran out of output tokens before finishing the report");
  let narrative;
  try { narrative = JSON.parse(text); } catch { throw new Error("The model returned text that is not valid JSON"); }
  return { narrative, usage };
}

// ---------------------------------------------------------------------------------------------
// Deterministic fallback (no API key, or the API call failed)
// ---------------------------------------------------------------------------------------------

const openRisksOf = (e) => e.risks.filter((r) => r.status === "open");

function fallbackNarrative(facts) {
  const epicsAll = facts.gates.flatMap((g) => g.epics);
  const open = epicsAll.filter((e) => !e.done);
  const allRisks = epicsAll.flatMap((e) => openRisksOf(e).map((r) => ({ e, r })));
  const high = allRisks.filter((x) => x.r.severity === "High");
  const epicNotes = epicsAll.map((e) => {
    const rs = openRisksOf(e);
    let health = "track";
    if (e.done) health = "done";
    else if (rs.some((r) => r.severity === "High")) health = "risk";
    else if (!e.statuses.length) health = "none";
    else if (rs.length || e.noEntrySinceReview) health = "watch";
    else if (/ready/i.test(e.jiraStatus || "")) health = "ready";
    const s = e.statuses[0];
    let note = s ? trunc(s.text, 400) : e.done ? "" : "No status entry recorded.";
    if (s && e.noEntrySinceReview) note += ` (latest entry ${fmtDay(s.date)})`;
    return { key: e.key, health, note };
  });
  const healthOf = new Map(epicNotes.map((n) => [n.key, n.health]));
  const gates = facts.gates.map((g) => {
    const hs = g.epics.filter((e) => !e.done).map((e) => healthOf.get(e.key));
    const health = !g.epics.length ? "none" : !hs.length ? "done" : hs.includes("risk") ? "risk" : hs.some((h) => h === "watch" || h === "none") ? "watch" : "track";
    const launched = g.epics.filter((e) => e.done).length;
    return { name: g.name, health, outlook: g.epics.length ? `${launched} of ${g.epics.length} epics launched.` : "No epics labelled for this gate yet." };
  });
  const changes = facts.riskChanges.map((c) => {
    const label = { new: "New risk", raised: "Risk raised", lowered: "Risk lowered", closed: "Risk closed", reopened: "Risk reopened", removed: "Risk removed", updated: "Risk updated" }[c.kind];
    const sev = c.kind === "raised" || c.kind === "lowered" ? ` (${c.from} to ${c.to})` : c.severity ? ` (${c.severity})` : "";
    return { label, text: `${c.epicKey}: ${c.title}${sev}` };
  });
  for (const e of epicsAll) for (const m of e.movement) if (!/^New since/.test(m)) changes.push({ label: "Epic movement", text: `${e.key}: ${m}` });
  return {
    headline: `${epicsAll.length} epics across ${facts.gates.length} gates: ${epicsAll.length - open.length} launched, ${open.length} open. ${high.length} High risk${high.length === 1 ? " is" : "s are"} open and ${open.filter((e) => e.noEntrySinceReview).length} open epics have no status entry since the start of this review period.`,
    standing: high.slice(0, 6).map((x) => ({ title: `${x.e.key}: ${x.r.title}`, text: trunc(x.r.updates[0] ? x.r.updates[0].text : x.r.description, 300) })),
    attention: [],
    gates,
    changes,
    epics: epicNotes,
    risks: [],
    notes: [],
  };
}

// Fill gaps in the model's answer (a missed epic, gate or section) from the deterministic one.
function mergeNarrative(llm, fb, facts) {
  const out = { ...fb, ...llm };
  const epicMap = new Map(fb.epics.map((n) => [n.key, n]));
  for (const n of llm.epics || []) if (HEALTH[n.health]) epicMap.set(n.key, n);
  out.epics = [...epicMap.values()];
  const gateMap = new Map(fb.gates.map((g) => [g.name, g]));
  for (const g of llm.gates || []) if (HEALTH[g.health] && gateMap.has(g.name)) gateMap.set(g.name, g);
  out.gates = facts.gates.map((g) => gateMap.get(g.name));
  for (const k of ["standing", "attention", "changes", "risks", "notes"]) if (!Array.isArray(out[k])) out[k] = fb[k];
  if (!out.headline) out.headline = fb.headline;
  return out;
}

// ---------------------------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------------------------

const CSS = `
:root{
  --bg:#f3f5f7; --surface:#ffffff; --ink:#15202b; --muted:#566574; --line:#d8dfe6; --accent:#1d5d8a; --accent-soft:#e3eef6;
  --good:#17703f; --good-soft:#e2f3e9; --warn:#8f5f00; --warn-soft:#fbf0d4; --bad:#b0281d; --bad-soft:#fbe6e3; --none:#5d6a78; --none-soft:#e9edf1;
  --font-body:"IBM Plex Sans","Segoe UI",system-ui,sans-serif; --font-mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;
}
@media (prefers-color-scheme: dark){:root{
  --bg:#0f151b; --surface:#171f28; --ink:#e6ecf1; --muted:#9aa8b6; --line:#2a3642; --accent:#74b6e4; --accent-soft:#1a2c3a;
  --good:#63cf8e; --good-soft:#15291e; --warn:#e2b650; --warn-soft:#33290f; --bad:#f28b81; --bad-soft:#3a1b18; --none:#9aa8b6; --none-soft:#222c37; color-scheme:dark}}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font:14px/1.55 var(--font-body);margin:0;padding-inline:20px;padding-block:28px 64px}
main{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:36px}
.muted{color:var(--muted)}
a{color:var(--accent)}
h1{font-size:30px;line-height:1.15;margin:0;font-weight:600;text-wrap:balance}
h2{font-size:20px;margin:0 0 12px;font-weight:600;text-wrap:balance}
h3{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:22px 0 8px;font-weight:600}
.eyebrow{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);font-weight:600;margin-bottom:6px}
.meta{display:flex;flex-wrap:wrap;gap:6px 22px;color:var(--muted);margin-top:10px;font-size:13px}
.banner{background:var(--warn-soft);color:var(--warn);border-radius:8px;padding:12px 16px;font-size:13px}
section.card{background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:22px}
.lead{font-size:16px;line-height:1.55;margin:0 0 16px;max-width:75ch;text-wrap:pretty}
.cols{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:28px}
@media (max-width:860px){.cols{grid-template-columns:minmax(0,1fr)}}
ul.pts{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:9px}
ul.pts li{max-width:75ch}
ol.asks{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:9px}
.asks-box{background:var(--accent-soft);border-radius:8px;padding:16px 18px}
.asks-box h3{margin-top:0;color:var(--accent)}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{text-align:left;vertical-align:top;padding:9px 11px;border-bottom:1px solid var(--line);font-variant-numeric:tabular-nums}
tbody tr:last-child td{border-bottom:none}
th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);background:var(--bg);font-weight:600;white-space:nowrap}
table.epics{min-width:960px}
table.epics td.ep{min-width:230px}
table.epics td.note{min-width:340px}
table.epics td.entry{white-space:nowrap;color:var(--muted)}
table.risks{min-width:900px}
table.score{min-width:760px}
table.slim{min-width:560px}
.key{font-family:var(--font-mono);font-size:12px;font-weight:500;text-decoration:none;white-space:nowrap}
.key:hover{text-decoration:underline}
.nm{font-weight:500}
.rks{margin-top:4px;display:flex;gap:6px;flex-wrap:wrap}
.rk{font-size:11px;font-weight:600;padding:1px 7px;border-radius:999px}
.rk-high{background:var(--bad-soft);color:var(--bad)}
.rk-med{background:var(--warn-soft);color:var(--warn)}
.chip{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;white-space:nowrap}
.h-done,.h-track{background:var(--good-soft);color:var(--good)}
.h-ready{background:var(--accent-soft);color:var(--accent)}
.h-watch{background:var(--warn-soft);color:var(--warn)}
.h-risk{background:var(--bad-soft);color:var(--bad)}
.h-none{background:var(--none-soft);color:var(--none)}
.sev{font-weight:700;font-size:12px}
.sev-High{color:var(--bad)} .sev-Medium{color:var(--warn)} .sev-Low{color:var(--good)}
.bar{display:flex;flex-direction:column;gap:3px;min-width:92px}
.bar .track{display:block;height:6px;border-radius:3px;background:var(--none-soft);overflow:hidden}
.bar .fill{display:block;height:100%;background:var(--accent)}
.bar .num{font-size:12px;white-space:nowrap}
.outlook{display:block;margin-top:4px;color:var(--muted)}
.gate-head{display:flex;flex-wrap:wrap;gap:4px 16px;align-items:baseline;margin-bottom:4px}
.gate-head h2{margin:0}
.gate-head .stat{color:var(--muted);font-size:13px}
.changes{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px 28px}
.changes div{padding:9px 0;border-bottom:1px solid var(--line)}
.changes b{display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:2px}
.foot{color:var(--muted);font-size:12px;max-width:80ch}
@media print{body{padding-inline:0} section.gate{break-before:page}}
`;

const chip = (h) => `<span class="chip h-${HEALTH[h] ? h : "none"}">${HEALTH[h] || HEALTH.none}</span>`;
const bar = (p) => {
  const pc = pct(p.done, p.total);
  if (pc === null) return '<span class="muted">No issues</span>';
  return `<span class="bar"><span class="track"><span class="fill" style="width:${pc}%"></span></span><span class="num">${pc}% <span class="muted">${p.done}/${p.total}</span></span></span>`;
};
const link = (e) => `<a class="key" href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.key)}</a>`;

function renderHtml(facts, narrative, meta) {
  const nm = new Map(narrative.epics.map((n) => [n.key, n]));
  const noteOf = (e) => nm.get(e.key) || { health: e.done ? "done" : "none", note: "" };
  const riskLatest = new Map((narrative.risks || []).map((r) => [r.riskId, r.latest]));
  const gateN = new Map(narrative.gates.map((g) => [g.name, g]));

  const epicsAll = facts.gates.flatMap((g) => g.epics);
  const openRisks = epicsAll.flatMap((e) => e.risks.filter((r) => r.status === "open").map((r) => ({ e, r })));
  openRisks.sort((a, b) => (SEV_RANK[a.r.severity] ?? 3) - (SEV_RANK[b.r.severity] ?? 3));
  const sevCount = (g, s) => g.epics.reduce((n, e) => n + e.risks.filter((r) => r.status === "open" && r.severity === s).length, 0);
  const agg = (g) => g.epics.reduce((a, e) => ({ d: a.d + e.issues.done, t: a.t + e.issues.total, l: a.l + (e.done ? 1 : 0) }), { d: 0, t: 0, l: 0 });

  const epicCell = (e) => {
    const open = e.risks.filter((r) => r.status === "open");
    const hi = open.filter((r) => r.severity === "High").length, md = open.filter((r) => r.severity === "Medium").length;
    const rk = [hi && `<span class="rk rk-high">${hi} High</span>`, md && `<span class="rk rk-med">${md} Medium</span>`].filter(Boolean).join(" ");
    return `${link(e)} <span class="nm">${esc(e.summary)}</span>${rk ? `<div class="rks">${rk}</div>` : ""}`;
  };
  const epicRow = (e) => {
    const n = noteOf(e);
    return `<tr><td class="ep">${epicCell(e)}</td><td>${esc(e.jiraStatus || "—")}</td><td>${esc(e.quarter || "—")}</td><td>${bar(e.issues)}</td><td>${chip(n.health)}</td><td class="note">${esc(n.note || "")}</td><td class="entry">${e.statuses[0] ? esc(fmtDay(e.statuses[0].date)) : '<span class="muted">none</span>'}</td></tr>`;
  };
  const epicTable = (list) =>
    `<div class="scroll"><table class="epics"><thead><tr><th>Epic</th><th>Jira status</th><th>Quarter</th><th>Issues done</th><th>Health</th><th>Status and what changed</th><th>Last entry</th></tr></thead><tbody>${list.map(epicRow).join("")}</tbody></table></div>`;

  const scoreRows = facts.gates.map((g) => {
    const a = agg(g), n = gateN.get(g.name) || { health: "none", outlook: "" };
    const hi = sevCount(g, "High"), md = sevCount(g, "Medium"), lo = sevCount(g, "Low");
    const rk = hi + md + lo ? [hi && `${hi} High`, md && `${md} Medium`, lo && `${lo} Low`].filter(Boolean).join(", ") : "None";
    return `<tr><td><strong>${esc(g.name)}</strong><div class="muted">${esc(g.description)}</div></td><td>${g.epics.length}</td><td>${a.l}</td><td>${a.t ? pct(a.d, a.t) + "%" : "—"}</td><td>${esc(rk)}</td><td>${chip(n.health)}<span class="outlook">${esc(n.outlook)}</span></td></tr>`;
  }).join("");

  const riskRows = openRisks.map(({ e, r }) => {
    const u = r.updates[0];
    const latest = riskLatest.get(r.id) || (u ? `${fmtDay(u.date)}: ${u.text}` : "No update recorded.");
    return `<tr><td><span class="sev sev-${esc(r.severity)}">${esc(r.severity || "")}</span></td><td>${link(e)}<div class="nm">${esc(e.summary)}</div></td><td><strong>${esc(r.title)}</strong><div class="muted">${esc(r.description)}</div></td><td>${esc(r.mitigation || "—")}</td><td>${esc(r.owner || "—")}</td><td>${esc(latest)}</td></tr>`;
  }).join("");

  const gateSections = facts.gates.map((g) => {
    const a = agg(g);
    const stat = `${g.epics.length} epics · ${a.l} launched · ${a.t ? pct(a.d, a.t) + "% of issues done (" + a.d + "/" + a.t + ")" : "no issues yet"}`;
    const openEpics = g.epics.filter((e) => !e.done).sort((x, y) => (HEALTH_RANK[noteOf(x).health] ?? 9) - (HEALTH_RANK[noteOf(y).health] ?? 9));
    const done = g.epics.filter((e) => e.done);
    const doneRows = done.map((e) => `<tr><td class="ep">${link(e)} <span class="nm">${esc(e.summary)}</span></td><td>${esc(e.quarter || "—")}</td><td>${e.issues.done}/${e.issues.total}</td><td class="note">${esc(noteOf(e).note || "")}</td></tr>`).join("");
    return `<section class="gate" id="gate-${esc(g.name.replace(/\W+/g, "-"))}">
  <div class="gate-head"><h2>${esc(g.name)}</h2><span class="stat">${esc(g.description ? g.description + " · " : "")}${esc(stat)}</span></div>
  ${g.epics.length ? "" : '<p class="muted">No epics are labelled for this gate yet.</p>'}
  ${openEpics.length ? `<h3>Open epics</h3>${epicTable(openEpics)}` : ""}
  ${done.length ? `<h3>Launched epics (${done.length})</h3><div class="scroll"><table class="slim"><thead><tr><th>Epic</th><th>Quarter</th><th>Issues</th><th>Note</th></tr></thead><tbody>${doneRows}</tbody></table></div>` : ""}
</section>`;
  }).join("\n");

  const kinds = facts.riskChanges.reduce((m, c) => ((m[c.kind] = (m[c.kind] || 0) + 1), m), {});
  const movedEpics = epicsAll.filter((e) => e.movement.some((m) => !/^New since/.test(m))).length;
  const counts = [
    kinds.new && `${kinds.new} new risk${kinds.new > 1 ? "s" : ""}`, kinds.raised && `${kinds.raised} raised`, kinds.lowered && `${kinds.lowered} lowered`,
    kinds.closed && `${kinds.closed} closed`, movedEpics && `${movedEpics} epic${movedEpics > 1 ? "s" : ""} moved`,
  ].filter(Boolean).join(" · ");

  const noRag = epicsAll.filter((e) => !e.done && !e.rag).length;
  const notes = [...(narrative.notes || [])];
  if (noRag) notes.push(`${noRag} open epics have no RAG in Jira.`);

  const prev = facts.previousReport ? `Previous report: ${fmtLong(facts.previousReport.createdAt)}` : "First saved report";
  const date = fmtLong(facts.generatedAt);
  const banner = meta.ai
    ? ""
    : `<div class="banner">This report was generated without AI commentary${meta.note ? " (" + esc(meta.note) + ")" : ""}. Health and notes come from the latest status entries. Set an Anthropic API key to get the full executive narrative.</div>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NPI Delivery Report ${esc(facts.generatedAt.slice(0, 10))}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>${CSS}</style></head><body>
<main>
<header>
  <div class="eyebrow">${esc(facts.gates.map((g) => g.name).join(" · "))}</div>
  <h1>NPI Delivery Report</h1>
  <div class="meta"><span>Review of ${esc(date)}</span><span>${esc(prev)}</span><span>Changes since ${esc(fmtDay(facts.since))}</span><span>Source: Jiskra review entries and live Jira data (${esc((facts.jiraBase || "").replace("https://", ""))})</span></div>
</header>
${banner}
<section class="card" id="summary">
  <h2>Summary</h2>
  <p class="lead">${esc(narrative.headline)}</p>
  <div class="cols">
    <div>
      <h3>Where things stand</h3>
      <ul class="pts">${narrative.standing.map((p) => `<li><strong>${esc(p.title)}.</strong> ${esc(p.text)}</li>`).join("")}</ul>
    </div>
    ${narrative.attention.length ? `<div class="asks-box"><h3>Attention needed</h3><ol class="asks">${narrative.attention.map((p) => `<li><strong>${esc(p.title)}.</strong> ${esc(p.text)}</li>`).join("")}</ol></div>` : ""}
  </div>
</section>

<section id="scorecard">
  <h2>Gate scorecard</h2>
  <div class="scroll"><table class="score"><thead><tr><th>Gate</th><th>Epics</th><th>Launched</th><th>Issues done</th><th>Open risks</th><th>Outlook</th></tr></thead><tbody>${scoreRows}</tbody></table></div>
</section>

<section id="changes">
  <h2>What changed since ${esc(fmtDay(facts.since))}</h2>
  ${counts ? `<p class="muted">${esc(counts)}</p>` : ""}
  ${narrative.changes.length ? `<div class="changes">${narrative.changes.map((c) => `<div><b>${esc(c.label)}</b>${esc(c.text)}</div>`).join("")}</div>` : '<p class="muted">No changes recorded for this period.</p>'}
  ${facts.hasBaseline ? "" : '<p class="foot">No earlier report snapshot exists for this date, so progress, RAG and Jira status movement is not compared. It appears from the next report on.</p>'}
</section>

<section id="risks">
  <h2>Open risks (${openRisks.length})</h2>
  ${openRisks.length ? `<div class="scroll"><table class="risks"><thead><tr><th>Severity</th><th>Epic</th><th>Risk</th><th>Mitigation</th><th>Owner</th><th>Latest update</th></tr></thead><tbody>${riskRows}</tbody></table></div>` : '<p class="muted">No open risks.</p>'}
</section>

${gateSections}

${notes.length ? `<section class="card" id="notes"><h2>Data notes</h2><ul class="pts">${notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></section>` : ""}
<p class="foot">Generated ${esc(facts.generatedAt.slice(0, 16).replace("T", " "))} UTC by Jiskra${meta.ai && meta.model ? " with " + esc(meta.model) : ""}. Statuses and risks are kept in Jiskra, not in Jira.</p>
</main></body></html>`;
}

module.exports = { buildFacts, generateNarrative, fallbackNarrative, mergeNarrative, renderHtml, NARRATIVE_SCHEMA, SYSTEM_PROMPT, HEALTH };
