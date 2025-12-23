// script.js - komplet fil med robust detection af "Aflyst" kolonne + aflysningsårsag,
// neutral "Tilmelding:" label med farvet status, automatisk date-update (henter nyt ved datoskifte)
// Opdater/fuldskærm-knapper er fjernet.

const SHEET_ID = "1XChIeVNQqWM4OyZ6oe8bh2M9e6H14bMkm7cpVfXIUN8";
const SHEET_NAME = "Sheet1";
const urlBase = `https://opensheet.elk.sh/${SHEET_ID}/`;

// Hjælpefunktioner
const $ = (id) => document.getElementById(id);
const formatTime = (d) => d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
const now = () => new Date();
const setStatus = (text) => { if ($("status")) $("status").innerText = text; };
const showMessage = (txt) => { if ($("message")) $("message").innerText = txt || ""; };

function saveCache(data) { try { localStorage.setItem("trt_cache", JSON.stringify({ ts: Date.now(), data })); } catch (e) {} }
function loadCache() { try { const raw = localStorage.getItem("trt_cache"); if (!raw) return null; return JSON.parse(raw); } catch(e){ return null; } }

function parseHM(str) {
  if (!str) return null;
  const s = String(str).replace(/"/g, "").trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = parseInt(m[1],10), mm = parseInt(m[2],10);
  if (isNaN(hh) || isNaN(mm)) return null;
  return { hh, mm };
}

// Polling / hard reload
const POLL_INTERVAL_MS = 60 * 1000;
const STORAGE_KEY = "trt_last_snapshot_v1";
const RELOAD_GRACE_MS = 10 * 1000;
function nowTs() { return Date.now(); }

async function pollForChanges(sheetName = SHEET_NAME) {
  try {
    const fetchUrl = urlBase + encodeURIComponent(sheetName) + (sheetName.includes("?") ? "&" : "?") + "_=" + nowTs();
    const res = await fetch(fetchUrl, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const snapshot = JSON.stringify(data);
    const last = localStorage.getItem(STORAGE_KEY);
    if (last && last !== snapshot) { triggerHardReload(); return; }
    if (!last) try { localStorage.setItem(STORAGE_KEY, snapshot); } catch(e) {}
  } catch (err) { console.error("Poll-fejl:", err); }
}
function triggerHardReload() {
  const lastReload = parseInt(localStorage.getItem("trt_last_reload_ts") || "0", 10);
  if (Date.now() - lastReload < RELOAD_GRACE_MS) return;
  localStorage.setItem("trt_last_reload_ts", String(Date.now()));
  const urlObj = new URL(window.location.href);
  urlObj.searchParams.set("r", String(nowTs()));
  window.location.replace(urlObj.toString());
}

// Opdater dag+dato i header - hent nye aktiviteter ved dataskifte
function updateDate() {
  const d = new Date();
  const formatted = d.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const text = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  const el = $("currentDate");
  if (el) el.textContent = text;

  const todayKey = d.toISOString().slice(0,10);
  if (window.__trt_last_date !== todayKey) {
    window.__trt_last_date = todayKey;
    // Hent nye aktiviteter når datoen skifter
    fetchActivities();
  }
}

// HENT + PROCESS DATA (med robust kolonne-detection for aflyst/årsag)
async function fetchActivities(sheetName = SHEET_NAME) {
  setStatus("Henter aktiviteter…");
  showMessage("");
  const fetchUrl = urlBase + encodeURIComponent(sheetName) + (sheetName.includes("?") ? "&" : "?") + "_=" + nowTs();
  try {
    const res = await fetch(fetchUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Ugyldigt format fra sheet");
    saveCache(data);
    setStatus("Opdateret");
    if ($("lastUpdated")) $("lastUpdated").innerText = new Date().toLocaleString("da-DK");
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
    renderActivities(processData(data));
  } catch (err) {
    console.error("Fejl ved hent:", err);
    setStatus("Offline / hent fejlede");
    const cached = loadCache();
    if (cached && cached.data) {
      showMessage("Viser senest hentede data (offline).");
      renderActivities(processData(cached.data));
      if ($("lastUpdated")) $("lastUpdated").innerText = new Date(cached.ts).toLocaleString("da-DK");
    } else {
      showMessage("Kunne ikke hente aktiviteter, og der er ingen cache.");
      clearActivities();
    }
  }
}

// processData: finder dynamisk kolonner der matcher "aflyst" / "årsag" og parser rækker
function processData(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  // Find keys fra sheet (brug første række)
  const sample = rows[0];
  const keys = Object.keys(sample || {});

  // Best-fit detection for aflyst og årsag
  let aflystKey = null;
  let reasonKey = null;
  keys.forEach(k => {
    const kl = String(k).toLowerCase();
    if (!aflystKey && /aflyst|cancel|canceled|cancelled|annull|annuler/i.test(kl)) aflystKey = k;
    if (!reasonKey && /årsag|arsag|grund|reason|cause|motivation|motiv/i.test(kl)) reasonKey = k;
  });

  console.info("TRT: fundne kolonne-keys:", keys);
  console.info("TRT: aflystKey =", aflystKey, ", reasonKey =", reasonKey);

  const today = new Date();
  const processed = [];

  rows.forEach((r, idx) => {
    const startParsed = parseHM(r.Tid);
    const endParsed = parseHM(r.Slut);
    if (!startParsed || !endParsed) return;

    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startParsed.hh, startParsed.mm);
    let end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endParsed.hh, endParsed.mm);
    if (end < start) end.setDate(end.getDate() + 1);

    // Læs aflyst-værdien via det fundne nøgle-navn (hvis nogen)
    let rawAflyst = "";
    if (aflystKey && typeof r[aflystKey] !== "undefined" && r[aflystKey] !== null) {
      rawAflyst = String(r[aflystKey]).trim().toLowerCase();
    }
    const isCancelled = ["ja", "ja.", "aflyst", "cancelled", "canceled", "true"].includes(rawAflyst);

    // Læs årsag via reasonKey (hvis fundet)
    let rawReason = "";
    if (reasonKey && typeof r[reasonKey] !== "undefined" && r[reasonKey] !== null) {
      rawReason = String(r[reasonKey]).trim();
    }

    processed.push({
      raw: r,
      start,
      end,
      aktivitet: (r.Aktivitet || r.aktivitet || "").toString().replace(/"/g,"").trim(),
      sted: (r.Sted || r.sted || "").toString().replace(/"/g,"").trim(),
      tilmelding: (r.Tilmelding || r.tilmelding || "").toString().toLowerCase().trim(),
      cancelled: isCancelled,
      cancelReason: rawReason
    });

    console.debug(`TRT: række ${idx+1} - aktivitet: "${r.Aktivitet || r.aktivitet}", aflystRaw: "${rawAflyst}", cancelled: ${isCancelled}, reason: "${rawReason}"`);
  });

  const nowTime = now();
  const all = processed.filter(p => p.end > new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate()-1,0,0));
  all.sort((a,b) => a.start - b.start);

  const cancelledCount = all.filter(p => p.cancelled).length;
  if (cancelledCount > 0) {
    showMessage(`Der er ${cancelledCount} aflyste aktiviteter.`);
  } else {
    showMessage("");
  }

  return all;
}

// Render / vis rækker (inkl. cancelled)
function renderActivities(list) {
  const container = $("activities");
  if (!container) return;
  container.innerHTML = "";

  const nowTime = now();
  const upcoming = [], past = [];
  list.forEach(item => {
    if (item.end.getTime() > nowTime.getTime()) upcoming.push(item);
    else past.push(item);
  });

  function createRow(item, isPastInitial) {
    const row = document.createElement("div");
    row.className = "activity-row";
    if (isPastInitial) row.classList.add("past");
    if (item.cancelled) row.classList.add("cancelled");

    // Tid
    const timeDiv = document.createElement("div");
    timeDiv.className = "time";
    timeDiv.textContent = `${formatTime(item.start)} - ${formatTime(item.end)}`;
    row.appendChild(timeDiv);

    // Midte: title/place, cancel-center & reason
    const tp = document.createElement("div");
    tp.className = "title-place";

    const normalInfo = document.createElement("div");
    normalInfo.className = "normal-info";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = item.aktivitet || "—";
    const place = document.createElement("div");
    place.className = "place";
    place.textContent = item.sted || "";
    normalInfo.appendChild(title);
    normalInfo.appendChild(place);

    const cancelCenter = document.createElement("div");
    cancelCenter.className = "cancel-center";
    cancelCenter.textContent = "Aflyst";

    const cancelReason = document.createElement("div");
    cancelReason.className = "cancel-reason";
    cancelReason.textContent = item.cancelReason || "";
    if (!item.cancelled) cancelReason.style.display = "none";

    tp.appendChild(normalInfo);
    tp.appendChild(cancelCenter);
    tp.appendChild(cancelReason);
    row.appendChild(tp);

    // Meta: tilmelding + countdown (gem countdown hvis cancelled)
    const meta = document.createElement("div");
    meta.className = "meta";

    const signup = document.createElement("div");
    signup.className = "signup";

    const labelSpan = document.createElement("span");
    labelSpan.className = "signup-label";
    labelSpan.textContent = "Tilmelding:";

    const statusSpan = document.createElement("span");
    statusSpan.className = "signup-status";

    const t = (item.tilmelding || "").trim();
    if (t === "ja") {
      statusSpan.textContent = " JA (Ring)";
      statusSpan.classList.add("ja");
    } else if (t === "nej" || t === "nej.") {
      statusSpan.textContent = " NEJ";
      statusSpan.classList.add("nej");
    } else if (t) {
      statusSpan.textContent = " " + (t.charAt(0).toUpperCase() + t.slice(1));
    } else {
      statusSpan.textContent = "";
    }

    signup.appendChild(labelSpan);
    signup.appendChild(statusSpan);
    meta.appendChild(signup);

    const countdown = document.createElement("div");
    countdown.className = "countdown";
    countdown.dataset.start = String(item.start.getTime());
    countdown.dataset.end = String(item.end.getTime());
    if (item.cancelled) countdown.style.display = "none";
    meta.appendChild(countdown);

    row.appendChild(meta);
    return row;
  }

  // Render upcoming først
  upcoming.forEach(item => {
    const isCurr = (item.start.getTime() <= nowTime.getTime() && item.end.getTime() >= nowTime.getTime());
    const row = createRow(item, false);
    if (isCurr) row.classList.add("current");
    container.appendChild(row);
  });

  // Past til sidst
  past.forEach(item => {
    const row = createRow(item, true);
    container.appendChild(row);
  });

  updateAllCountdowns();
}

// Opdater countdowns, håndter cancelled/past/current
function updateAllCountdowns() {
  const els = document.querySelectorAll(".activity-row .countdown");
  const nowMs = Date.now();
  els.forEach(el => {
    const start = parseInt(el.dataset.start, 10);
    const end = parseInt(el.dataset.end, 10);
    if (isNaN(start) || isNaN(end)) { el.textContent = ""; return; }

    const row = el.closest(".activity-row");
    const signupEl = row.querySelector(".meta .signup");
    const normalInfo = row.querySelector(".normal-info");
    const pastCenter = row.querySelector(".past-center");
    const cancelCenter = row.querySelector(".cancel-center");

    // Hvis cancelled: vis aflyst-tilstand, ingen countdown
    if (row.classList.contains("cancelled")) {
      el.textContent = "";
      el.style.display = "none";
      if (signupEl) signupEl.style.opacity = "0.6";
      if (normalInfo) normalInfo.style.opacity = "0.85";
      if (cancelCenter) cancelCenter.style.display = "";
      if (pastCenter) pastCenter.style.display = "none";
      row.classList.remove("current");
      return;
    } else {
      el.style.display = "";
    }

    if (nowMs >= start && nowMs <= end) {
      const diff = end - nowMs;
      el.textContent = `Slutter om: ${formatDelta(diff)}`;
      row.classList.remove("past");
      row.classList.add("current");
      if (signupEl) signupEl.style.opacity = "";
      if (normalInfo) normalInfo.style.opacity = "";
      if (pastCenter) pastCenter.style.display = "none";
      if (cancelCenter) cancelCenter.style.display = "none";
    } else if (nowMs < start) {
      const diff = start - nowMs;
      el.textContent = `Starter om: ${formatDelta(diff)}`;
      row.classList.remove("past");
      row.classList.remove("current");
      if (signupEl) signupEl.style.opacity = "";
      if (normalInfo) normalInfo.style.opacity = "";
      if (pastCenter) pastCenter.style.display = "none";
      if (cancelCenter) cancelCenter.style.display = "none";
    } else {
      // past
      el.textContent = "";
      row.classList.add("past");
      row.classList.remove("current");
      if (signupEl) signupEl.style.opacity = "0.7";
      if (normalInfo) normalInfo.style.opacity = "0.8";
      if (pastCenter) pastCenter.style.display = "";
      if (cancelCenter) cancelCenter.style.display = "none";
    }
  });
}

function formatDelta(ms) {
  if (ms <= 0) return "0 min";
  const mins = Math.floor(ms / 60000);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem === 0 ? `${hours} t` : `${hours} t ${rem} min`;
  }
  return `${mins} min`;
}

function clearActivities() { if ($("activities")) $("activities").innerHTML = ""; }

function startClock() {
  setInterval(() => { if ($("clock")) $("clock").innerText = formatTime(new Date()); }, 1000);
  if ($("clock")) $("clock").innerText = formatTime(new Date());
}

// STARTUP: initialiser date, clock, data og polls
updateDate();
setInterval(updateDate, 60 * 1000);
fetchActivities();
startClock();
setInterval(fetchActivities, 60 * 1000);
setInterval(updateAllCountdowns, 1000);
pollForChanges();
setInterval(pollForChanges, POLL_INTERVAL_MS);
