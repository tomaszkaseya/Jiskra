// Reports page: generate the executive (PMO) report, browse the saved history, view / download / delete.
// Loaded before the main script; uses its globals ($, esc, api, CFG, PAGE) only when called.
let REPORTS = [];
let REPORT_ID = null;
let REPORT_BUSY = false;

const reportWhen = t => new Date(t).toLocaleString("en-GB", {day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"});
const reportDay = t => new Date(t).toLocaleDateString("sv"); // YYYY-MM-DD in local time
const reportOnPage = () => PAGE === "reports" && !!$("#reportList");

async function renderReports(){
  const ai = (CFG && CFG.reportAi) || {};
  $("#content").className = "";
  $("#content").innerHTML = `<div class="rpage">
    <div class="spanel">
      <h2>Executive report</h2>
      <p class="hint">A summary for the PMO: bottom line, what needs attention, what changed, open risks and the status of every epic.
        Each report is saved in the history below.</p>
      <form class="rform" id="reportForm">
        <label>Show changes since <input type="date" id="reportSince" required></label>
        <button class="primary" id="reportGo">Generate report</button>
      </form>
      <p class="hint" id="reportHint">${ai.enabled
        ? `The narrative is written by ${esc(ai.model)}. It takes one to two minutes.`
        : "No Anthropic API key is configured, so this button builds a plain version from the latest status entries. For the full narrative, run /jiskra-report in Claude Code, or set ANTHROPIC_API_KEY on the server."}</p>
      <div class="msg" id="reportMsg"></div>
    </div>
    <div class="spanel"><h2>History</h2><div id="reportList" class="loading">Loading…</div></div>
    <div id="reportView"></div>
  </div>`;
  $("#reportForm").onsubmit = generateReport;
  await loadReports();
  if(reportOnPage() && REPORTS.length && !REPORTS.some(r => r.id === REPORT_ID)) REPORT_ID = null;
  if(reportOnPage() && REPORT_ID) openReport(REPORT_ID, false);
}

async function loadReports(){
  try{
    REPORTS = (await api("/api/reports")).reports;
  }catch(e){
    if($("#reportList")) $("#reportList").innerHTML = `<div class="error">${esc(e.message)}</div>`;
    return;
  }
  if(!reportOnPage()) return;
  const since = $("#reportSince");
  since.value = reportDay(REPORTS.length ? REPORTS[0].createdAt : Date.now() - 7*864e5);
  renderReportList();
}

function renderReportList(){
  const box = $("#reportList");
  box.className = "";
  if(!REPORTS.length){
    box.innerHTML = '<div class="empty">No reports yet. Generate the first one above.</div>';
    return;
  }
  box.innerHTML = `<table class="rlist"><thead><tr><th>Generated</th><th>Changes since</th><th>Written by</th><th>Summary</th><th></th></tr></thead><tbody>${
    REPORTS.map(r => {
      const s = r.stats || {};
      return `<tr class="${r.id === REPORT_ID ? "sel" : ""}">
        <td>${esc(reportWhen(r.createdAt))}</td>
        <td>${esc(new Date(r.since).toLocaleDateString("en-GB", {day:"numeric", month:"short"}))}</td>
        <td>${r.ai ? esc(r.model || "AI") : `<span class="badge" title="${esc(r.note || "")}">Plain</span>`}</td>
        <td><div class="headline">${esc(r.headline || "")}</div>
          <div class="hint">${s.epics ?? "?"} epics · ${s.launched ?? "?"} launched · ${s.openRisks ?? "?"} open risks (${s.highRisks ?? "?"} High)</div></td>
        <td class="actions">
          <button class="ghost" data-view="${esc(r.id)}">View</button>
          <button class="ghost" data-dl="${esc(r.id)}">Download</button>
          <button class="ghost" data-del="${esc(r.id)}">Delete</button>
        </td></tr>`;
    }).join("")}</tbody></table>`;
  box.querySelectorAll("[data-view]").forEach(b => b.onclick = () => openReport(b.dataset.view, true));
  box.querySelectorAll("[data-dl]").forEach(b => b.onclick = () => downloadReport(b.dataset.dl));
  box.querySelectorAll("[data-del]").forEach(b => b.onclick = () => deleteReport(b.dataset.del));
}

async function openReport(id, scroll){
  REPORT_ID = id;
  if(!reportOnPage()) return;
  renderReportList();
  const view = $("#reportView");
  view.innerHTML = '<div class="loading">Loading report…</div>';
  try{
    const r = await api("/api/reports/" + encodeURIComponent(id));
    if(!reportOnPage() || REPORT_ID !== id) return;
    view.innerHTML = `<div class="rview">
      <div class="rview-bar"><strong>Report of ${esc(reportWhen(r.createdAt))}</strong>
        <span class="spacer"></span>
        <button class="ghost" id="rvDownload">Download</button>
        <button class="ghost" id="rvClose">Close</button></div>
      <iframe id="rvFrame" title="Executive report" sandbox="allow-popups allow-popups-to-escape-sandbox"></iframe>
    </div>`;
    $("#rvFrame").srcdoc = r.html;
    $("#rvDownload").onclick = () => saveHtml(r.html, r.createdAt);
    $("#rvClose").onclick = () => { REPORT_ID = null; view.innerHTML = ""; renderReportList(); };
    if(scroll) view.scrollIntoView({behavior:"smooth", block:"start"});
  }catch(e){
    view.innerHTML = `<div class="error">${esc(e.message)}</div>`;
  }
}

function saveHtml(html, createdAt){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], {type:"text/html"}));
  a.download = `jiskra-report-${reportDay(createdAt)}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function downloadReport(id){
  try{
    const r = await api("/api/reports/" + encodeURIComponent(id));
    saveHtml(r.html, r.createdAt);
  }catch(e){ reportMsg(e.message, false); }
}

async function deleteReport(id){
  if(!confirm("Delete this report? The next report will compare against the one before it.")) return;
  try{
    await api("/api/reports/" + encodeURIComponent(id), {method:"DELETE"});
    if(REPORT_ID === id){ REPORT_ID = null; if($("#reportView")) $("#reportView").innerHTML = ""; }
    await loadReports();
  }catch(e){ reportMsg(e.message, false); }
}

function reportMsg(text, ok){
  const m = $("#reportMsg");
  if(!m) return;
  m.textContent = text;
  m.className = "msg " + (ok ? "ok" : "err");
}

async function generateReport(ev){
  ev.preventDefault();
  if(REPORT_BUSY) return;
  const last = REPORTS[0];
  const day = $("#reportSince").value;
  // Left on the default (the previous report's day): use the exact time so nothing is double counted.
  const since = last && day === reportDay(last.createdAt) ? last.createdAt : new Date(day + "T00:00:00").toISOString();
  REPORT_BUSY = true;
  const btn = $("#reportGo");
  btn.disabled = true; btn.textContent = "Generating…";
  reportMsg("Reading Jira and the review log" + (CFG.reportAi && CFG.reportAi.enabled ? ", then writing the narrative. This takes one to two minutes." : "…"), true);
  try{
    const r = await api("/api/reports", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({since})});
    if(reportOnPage()){
      reportMsg(r.ai ? "Report saved." : "Report saved without AI commentary" + (r.note ? " (" + r.note + ")." : "."), true);
      await loadReports();
      openReport(r.id, true);
    }
  }catch(e){
    reportMsg(e.message, false);
  }finally{
    REPORT_BUSY = false;
    const b = $("#reportGo");
    if(b){ b.disabled = false; b.textContent = "Generate report"; }
  }
}
