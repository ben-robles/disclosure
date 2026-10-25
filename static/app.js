"use strict";

const OVERALL_RULE = "The overall grade is the worst grade among your confirmed findings. It is never an average.";
const LETTER_WORD = { A: "Minor", B: "Moderate", C: "Serious", D: "Urgent", F: "Critical" };

const $ = (id) => document.getElementById(id);
const state = { sid: null, session: null, taxonomy: [], editing: null, poll: null, retaking: null };

/* ---------- small helpers ---------- */

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) { /* storage may be blocked; the app still works */ }
  return null;
}

async function api(path, opts = {}) {
  const init = { method: opts.method || "GET", headers: {} };
  if (opts.json !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(opts.json);
  }
  if (opts.form) init.body = opts.form;
  const res = await fetch(path, init);
  if (!res.ok) {
    let msg = "Something went wrong.";
    try { const j = await res.json(); if (typeof j.detail === "string") msg = j.detail; } catch (e) { /* keep default */ }
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v !== false && v !== null && v !== undefined) node.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children) if (c) node.append(c);
  return node;
}

function announce(msg) {
  const live = $("live");
  live.textContent = "";
  setTimeout(() => { live.textContent = msg; }, 50);
}

function show(node, on) { node.hidden = !on; }

/* ---------- banner (startup check) ---------- */

async function checkHealth() {
  const banner = $("banner");
  let h;
  try { h = await api("/api/health"); } catch (e) { h = { ready: false, message: "The Disclosure server is not responding.", fix: "" }; }
  if (h.local === false) {
    $("info-privacy").textContent = "Gemma 4 runs on a private Google Cloud service. Your photos are sent there for analysis and are not kept after you delete the session or the server restarts.";
  }
  banner.replaceChildren();
  if (h.ready) { show(banner, false); return; }
  banner.append(el("strong", { text: h.message }));
  if (h.fix) {
    banner.append(el("span", { text: " Open PowerShell and run:" }), el("code", { text: h.fix }));
  }
  banner.append(el("button", { type: "button", class: "secondary", text: "Check again", onclick: checkHealth }));
  show(banner, true);
}

/* ---------- routing ---------- */

const VIEWS = ["welcome", "capture", "findings", "review", "report"];

function go(view) { location.hash = "#/" + view; }

async function route() {
  let view = (location.hash.replace(/^#\//, "") || "welcome");
  if (!VIEWS.includes(view)) view = "welcome";
  stopPolling();
  if (view !== "welcome") {
    if (!state.sid) { go("welcome"); return; }
    try { await refresh(); } catch (e) { forgetSession(); go("welcome"); return; }
  }
  for (const v of VIEWS) show($("view-" + v), v === view);
  await RENDER[view]();
  const h1 = document.querySelector(`#view-${view} h1`);
  if (h1) h1.focus();
  window.scrollTo(0, 0);
}

async function refresh() {
  state.session = await api("/api/session/" + state.sid);
  return state.session;
}

function forgetSession() {
  store("disclosure.sid", null);
  state.sid = null;
  state.session = null;
}

/* ---------- welcome ---------- */

async function renderWelcome() {
  const saved = store("disclosure.sid");
  let canResume = false;
  if (saved) {
    try {
      const s = await api("/api/session/" + saved);
      state.sid = saved;
      state.session = s;
      canResume = s.photos.length > 0;
      if (s.zip) $("zip").value = s.zip;
    } catch (e) { forgetSession(); }
  }
  show($("btn-resume"), canResume);
}

async function startReport() {
  const zip = $("zip").value.trim();
  try {
    if (state.sid) {
      await api("/api/session/" + state.sid, { method: "PATCH", json: { zip: zip || null } });
    } else {
      const r = await api("/api/session", { method: "POST", json: { zip: zip || null } });
      state.sid = r.id;
      store("disclosure.sid", r.id);
    }
    go("capture");
  } catch (e) {
    announce(e.message);
    alert(e.message);
  }
}

/* ---------- capture ---------- */

function photoAlt(p, i) {
  return p.analyzed && p.state === "graded" ? `Photo ${i + 1}: ${p.label}` : `Photo ${i + 1}`;
}

function renderThumbs() {
  const list = $("thumbs");
  list.replaceChildren();
  state.session.photos.forEach((p, i) => {
    list.append(el("li", {}, el("img", { src: `/api/photo/${p.id}/image`, alt: photoAlt(p, i) })));
  });
}

async function renderCapture() {
  renderThumbs();
  const s = state.session;
  const waiting = s.photos.filter((p) => p.status === "uploaded").length;
  $("btn-analyze").disabled = waiting === 0;
  show($("nudge"), false);
  show($("upload-error"), false);
  show($("btn-to-findings"), s.photos.some((p) => p.analyzed));
  const busy = s.counts.pending + s.counts.processing > 0;
  show($("progress-wrap"), busy);
  if (busy) startPolling();
}

async function uploadFiles(files) {
  const err = $("upload-error");
  show(err, false);
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    try {
      await api(`/api/session/${state.sid}/photos`, { method: "POST", form });
    } catch (e) {
      err.textContent = e.message;
      show(err, true);
      break;
    }
  }
  await refresh();
  await renderCapture();
  if (!err.hidden) return;
  show($("nudge"), true);
  announce("Photo added. Add another angle of this problem, or press Analyze.");
}

async function analyze() {
  $("btn-analyze").disabled = true;
  await api(`/api/session/${state.sid}/analyze`, { method: "POST" });
  await refresh();
  show($("progress-wrap"), true);
  state.prog = null;
  startPolling();
}

function stopPolling() {
  if (state.poll) { clearInterval(state.poll); state.poll = null; }
  if (state.draw) { clearInterval(state.draw); state.draw = null; }
}

function startPolling() {
  stopPolling();
  tick();
  state.poll = setInterval(tick, 2000);
  state.draw = setInterval(drawProgress, 500);
}

// The server only says how many photos are done. Between those counts the bar moves by an estimate
// built from how long the finished photos took, so it keeps pace without ever claiming a photo is done.
const DEFAULT_STEP_MS = 12000;

function stepMs() {
  const recent = state.prog.steps.slice(-5);
  if (!recent.length) return DEFAULT_STEP_MS;
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Math.min(120000, Math.max(3000, mean));
}

function drawProgress() {
  const p = state.prog;
  if (!p || !p.total) return;
  const elapsed = Date.now() - p.since;
  const part = elapsed <= 0 ? 0 : 0.95 * (1 - Math.exp((-2 * elapsed) / stepMs()));
  const pct = ((p.done + part) / p.total) * 100;
  $("progress-fill").style.width = pct + "%";
  document.querySelector("#view-capture .bar").setAttribute("aria-valuenow", String(Math.round(pct)));
}

function trackProgress(st) {
  const now = Date.now();
  if (!state.prog) state.prog = { done: st.done, since: now, steps: [], total: st.analyzing_total };
  const p = state.prog;
  p.total = st.analyzing_total;
  if (st.done > p.done) {
    p.steps.push((now - p.since) / (st.done - p.done));
    p.done = st.done;
    p.since = now;
  }
}

async function tick() {
  let st;
  try { st = await api(`/api/session/${state.sid}/status`); } catch (e) { return; }
  const total = st.analyzing_total;
  const current = Math.min(st.done + 1, total);
  if (st.active) {
    const text = `Analyzing ${current} of ${total}`;
    if ($("progress-text").textContent !== text) announce(text);
    $("progress-text").textContent = text;
    trackProgress(st);
    drawProgress();
    show($("progress-wrap"), true);
  } else {
    stopPolling();
    state.prog = null;
    announce("Analysis finished.");
    go("findings");
  }
}

/* ---------- findings ---------- */

function gradeBadge(f) {
  const g = f.grade;
  return el("span", { class: `grade g-${g.worst}`, "aria-label": g.aria },
    el("span", { class: "letter", "aria-hidden": "true", text: g.text }),
    el("span", { "aria-hidden": "true", text: g.word }));
}

function dl(rows) {
  const node = el("dl");
  for (const [k, v] of rows) if (v) node.append(el("dt", { text: k }), el("dd", { text: v }));
  return node;
}

function card(p, i) {
  const img = el("img", { src: `/api/photo/${p.id}/image`, alt: photoAlt(p, i) });
  if (!p.analyzed) {
    return el("li", { class: "card guard" }, img, el("p", { text: "Analyzing…" }));
  }
  const guard = p.state !== "graded";
  const node = el("li", { class: "card" + (guard ? " guard" : "") + (p.confirmed ? " confirmed" : "") }, img);

  if (p.confirmed) node.append(el("span", { class: "tag", text: "✓ Confirmed — in report" }));
  node.append(el("h2", { text: p.label }));
  if (p.grade) node.append(gradeBadge(p));
  if (p.message) node.append(el("p", { class: "guard-msg", text: p.message }));
  if (p.state === "graded") {
    node.append(dl([
      ["Urgency", p.urgency_label],
      ["What we see", p.reason],
      ["Estimated cost", p.cost ? `${p.cost.text} (avg ${p.cost.avg_text})` : ""],
      ["Recommended pro", p.pro],
    ]));
    node.append(el("p", { class: "small", text: "Estimate — varies by region and contractor." }));
    if (p.edited) node.append(el("p", { class: "small", text: "Edited by you." }));
    if (p.evaluation) node.append(el("p", { text: p.evaluation }));
  } else if (p.state === "cant_tell") {
    node.append(dl([["What we see", p.reason], ["Recommended pro", p.pro]]));
  }

  const actions = el("div", { class: "row" });
  if (p.can_confirm) {
    actions.append(el("button", {
      type: "button", class: p.confirmed ? "secondary" : "primary",
      text: p.confirmed ? "Unconfirm" : "Confirm",
      onclick: () => confirmFinding(p, !p.confirmed),
    }));
  }
  if (p.can_edit) actions.append(el("button", { type: "button", class: "secondary", text: "Edit", onclick: () => openEdit(p) }));
  node.append(actions);
  const second = el("div", { class: "row" });
  if (p.needs_retake) second.append(el("button", { type: "button", class: "primary", text: "Retake", onclick: () => startRetake(p) }));
  if (p.needs_retry) second.append(el("button", { type: "button", class: "primary", text: "Retry", onclick: () => retry(p) }));
  second.append(el("button", { type: "button", class: "danger", text: "Delete", onclick: () => remove(p) }));
  node.append(second);
  return node;
}

async function renderFindings() {
  const list = $("cards");
  list.replaceChildren(...state.session.photos.map(card));
  const analyzing = state.session.photos.some((p) => !p.analyzed);
  if (analyzing && state.session.counts.pending + state.session.counts.processing > 0) {
    stopPolling();
    state.poll = setInterval(async () => { await refresh(); await renderFindings(); }, 2000);
  }
}

async function confirmFinding(p, confirmed) {
  await api(`/api/photo/${p.id}/confirm`, { method: "POST", json: { confirmed } });
  announce(confirmed ? "Finding confirmed." : "Finding unconfirmed.");
  await refresh();
  await renderFindings();
}

async function remove(p) {
  if (!confirm("Delete this photo and its finding?")) return;
  await api(`/api/photo/${p.id}`, { method: "DELETE" });
  announce("Photo deleted.");
  await refresh();
  await renderFindings();
}

async function retry(p) {
  await api(`/api/photo/${p.id}/retry`, { method: "POST" });
  await refresh();
  go("capture");
}

function startRetake(p) {
  state.retaking = p.id;
  $("retake-file").click();
}

async function finishRetake(file) {
  const oldId = state.retaking;
  state.retaking = null;
  if (!file || !oldId) return;
  const form = new FormData();
  form.append("file", file);
  try {
    await api(`/api/session/${state.sid}/photos`, { method: "POST", form });
    await api(`/api/photo/${oldId}`, { method: "DELETE" });
    await api(`/api/session/${state.sid}/analyze`, { method: "POST" });
    go("capture");
  } catch (e) {
    alert(e.message);
  }
}

/* ---------- edit dialog ---------- */

function openEdit(p) {
  state.editing = p;
  const sel = $("edit-type");
  sel.replaceChildren(...state.taxonomy.map((d) => el("option", { value: d.id, text: d.label })));
  sel.value = p.defect_type === "unclear" ? state.taxonomy[0].id : p.defect_type;
  $("edit-sev").value = String(p.severity);
  $("dlg-edit").showModal();
}

async function saveEdit(ev) {
  ev.preventDefault();
  const p = state.editing;
  $("dlg-edit").close();
  if (!p) return;
  try {
    await api(`/api/photo/${p.id}/finding`, { method: "PATCH", json: { defect_type: $("edit-type").value, severity: Number($("edit-sev").value) } });
    announce("Finding updated. Confirm it again to include it in the report.");
  } catch (e) { alert(e.message); }
  await refresh();
  await renderFindings();
}

/* ---------- review ---------- */

function overallNode(letter) {
  const box = $("overall");
  box.replaceChildren();
  if (!letter) {
    box.append(el("p", { text: "No graded findings yet. Confirm at least one finding, or get a licensed home inspector." }));
    return;
  }
  box.append(el("span", { text: "Overall grade " }),
    el("span", { class: `grade g-${letter}`, "aria-label": `Overall grade ${letter}, ${LETTER_WORD[letter]}` },
      el("span", { class: "letter", "aria-hidden": "true", text: letter }),
      el("span", { "aria-hidden": "true", text: LETTER_WORD[letter] })));
}

async function renderReview() {
  const s = state.session;
  const confirmed = s.photos.filter((p) => p.confirmed);
  overallNode(s.overall);
  $("rule").textContent = OVERALL_RULE;
  const groups = new Map();
  for (const f of confirmed) {
    if (!groups.has(f.section_key)) groups.set(f.section_key, { heading: f.section, items: [] });
    groups.get(f.section_key).items.push(f);
  }
  const box = $("groups");
  box.replaceChildren();
  [...groups.entries()].sort((a, b) => a[0] - b[0]).forEach(([, g]) => {
    const ul = el("ul");
    for (const f of g.items) {
      const grade = f.grade ? `Grade ${f.grade.text} (${f.grade.word})` : "No grade — get an inspector";
      ul.append(el("li", { text: `${f.label}: ${grade}. ${f.reason}` }));
    }
    box.append(el("div", { class: "group" }, el("h2", { text: g.heading }), ul));
  });
  const pending = s.photos.length - confirmed.length;
  $("review-note").textContent = pending > 0
    ? `${pending} photo${pending === 1 ? " is" : "s are"} not confirmed and will not be in the report.`
    : "";
  $("btn-make-report").disabled = confirmed.length === 0;
  show($("report-error"), false);
}

async function makeReport() {
  const btn = $("btn-make-report");
  btn.disabled = true;
  try {
    await api(`/api/session/${state.sid}/report`, { method: "POST" });
    go("report");
  } catch (e) {
    $("report-error").textContent = e.message;
    show($("report-error"), true);
    btn.disabled = false;
  }
}

/* ---------- report + quote ---------- */

async function renderReport() {
  const base = `/api/session/${state.sid}/report.pdf`;
  $("pdf").src = `${base}?t=${Date.now()}`;
  $("btn-download").href = `${base}?download=1`;
}

function openQuote() {
  const graded = state.session.photos.filter((p) => p.confirmed && p.pro);
  const worst = graded.sort((a, b) => (b.grade ? "ABCDF".indexOf(b.grade.worst) : -1) - (a.grade ? "ABCDF".indexOf(a.grade.worst) : -1))[0];
  $("quote-body").textContent = worst
    ? `Recommended professional: ${worst.pro}. This is a demo: no request is actually sent.`
    : "Recommended professional: Licensed home inspector. This is a demo: no request is actually sent.";
  show($("quote-sent"), false);
  $("btn-quote-send").disabled = false;
  $("dlg-quote").showModal();
}

async function deleteSession() {
  if (!confirm("Delete this session? Your photos, findings and report will be erased.")) return;
  await api("/api/session/" + state.sid, { method: "DELETE" });
  forgetSession();
  go("welcome");
}

/* ---------- boot ---------- */

const RENDER = {
  welcome: renderWelcome, capture: renderCapture, findings: renderFindings,
  review: renderReview, report: renderReport,
};

async function boot() {
  state.sid = store("disclosure.sid");
  $("info-rule").textContent = OVERALL_RULE;

  $("btn-info").addEventListener("click", () => $("dlg-info").showModal());
  document.querySelectorAll("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

  $("btn-start").addEventListener("click", startReport);
  $("btn-resume").addEventListener("click", () => go("capture"));
  $("btn-photo").addEventListener("click", () => $("file").click());
  $("file").addEventListener("change", async (ev) => {
    const files = [...ev.target.files];
    ev.target.value = "";
    if (files.length) await uploadFiles(files);
  });
  $("btn-analyze").addEventListener("click", analyze);
  $("btn-to-findings").addEventListener("click", () => go("findings"));
  $("btn-add-more").addEventListener("click", () => go("capture"));
  $("btn-to-review").addEventListener("click", () => go("review"));
  $("retake-file").addEventListener("change", async (ev) => {
    const f = ev.target.files[0];
    ev.target.value = "";
    await finishRetake(f);
  });
  $("edit-form").addEventListener("submit", saveEdit);
  $("btn-back-findings").addEventListener("click", () => go("findings"));
  $("btn-make-report").addEventListener("click", makeReport);
  $("btn-back-review").addEventListener("click", () => go("review"));
  $("btn-quote").addEventListener("click", openQuote);
  $("btn-quote-send").addEventListener("click", () => { show($("quote-sent"), true); $("btn-quote-send").disabled = true; });
  $("btn-delete").addEventListener("click", deleteSession);
  window.addEventListener("hashchange", route);

  try { state.taxonomy = await api("/api/taxonomy"); } catch (e) { state.taxonomy = []; }
  checkHealth();
  if (!location.hash) location.hash = "#/welcome"; else route();
}

boot();
