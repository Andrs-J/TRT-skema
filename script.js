// script.js - viser aktiviteter i rækker, og forbi-aktiviteter viser stort, centreret "Afsluttet".
// Poller sheet og laver hård reload ved ændringer. Opdater countdown hvert sekund.

// ======= KONFIGURATION =======
const SHEET_ID = "1XChIeVNQqWM4OyZ6oe8bh2M9e6H14bMkm7cpVfXIUN8";
const SHEET_NAME = "Sheet1";
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

// ======= HELPERS =======
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

// ======= POLLING / HARD RELOAD (hver 60s) =======
const POLL_INTERVAL_MS = 60 * 1000;
const STORAGE_KEY = "trt_last_snapshot_v1";
const RELOAD_GRACE_MS = 10 * 1000;
function nowTs() { return Date.now(); }

async function pollForChanges() {
  try {
    const fetchUrl = url + (url.includes("?") ? "&" : "?") + "_=" + nowTs();
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

// ======= HENT OG PROCESSER DATA =======
async function fetchActivities() {
  setStatus("Henter aktiviteter…");
  showMessage("");
  try {
    const res = await fetch(url, { cache: "no-store" });
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

// Parse + sort
function processData(rows) {
  const today = new Date();
  const processed = [];
  rows.forEach(r => {
    const startParsed = parseHM(r.Tid);
    const endParsed = parseHM(r.Slut);
    if (!startParsed || !endParsed) return;
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startParsed.hh, startParsed.mm);
    let end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endParsed.hh, endParsed.mm);
    if (end < start) end.setDate(end.getDate()+1);
    processed.push({
      raw: r,
      start,
      end,
      aktivitet: (r.Aktivitet || "").replace(/"/g,"").trim(),
      sted: (r.Sted || "").replace(/"/g,"").trim(),
      tilmelding: (r.Tilmelding || "").toLowerCase().trim()
    });
  });
  const nowTime = now();
  const all = processed.filter(p => p.end > new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate()-1,0,0));
  all.sort((a,b) => a.start - b.start);
  return all;
}

// ======= RENDER: vis upcoming først, past til sidst.
// For each row vi laver en .past-center skjult element som vises når rækken er past.
function renderActivities(list) {
  const container = $("activities");
  if (!container) return;
  container.innerHTML = "";

  const nowTime = now();

  // Split upcoming/past så upcoming vises først
  const upcoming = [];
  const past = [];
  list.forEach(item => {
    if (item.end.getTime() > nowTime.getTime()) upcoming.push(item);
    else past.push(item);
  });

  function createRow(item, isPastInitial) {
    const row = document.createElement("div");
    row.className = "activity-row";
    if (isPastInitial) row.classList.add("past");

    // Tid
    const timeDiv = document.createElement("div");
    timeDiv.className = "time";
    timeDiv.textContent = `${formatTime(item.start)} - ${formatTime(item.end)}`;
    row.appendChild(timeDiv);

    // Midterkolonne: indeholder normal-info (title+place) og hidden past-center
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

    const pastCenter = document.createElement("div");
    pastCenter.className = "past-center";
    pastCenter.textContent = "Afsluttet"; // stor, centreret tekst

    tp.appendChild(normalInfo);
    tp.appendChild(pastCenter);
    row.appendChild(tp);

    // Meta (tilmelding + countdown)
    const meta = document.createElement("div");
    meta.className = "meta";
    const signup = document.createElement("div");
    signup.className = "signup";
    if (item.tilmelding === "ja") signup.textContent = "Tilmelding: JA (Ring)";
    else if (item.tilmelding === "nej" || item.tilmelding === "nej.") signup.textContent = "Tilmelding: NEJ";
    else signup.textContent = item.tilmelding || "";
    meta.appendChild(signup);

    const countdown = document.createElement("div");
    countdown.className = "countdown";
    countdown.dataset.start = String(item.start.getTime());
    countdown.dataset.end = String(item.end.getTime());
    meta.appendChild(countdown);

    row.appendChild(meta);
    return row;
  }

  // Render upcoming
  upcoming.forEach(item => {
    const isCurrent = (item.start.getTime() <= nowTime.getTime() && item.end.getTime() >= nowTime.getTime());
    const row = createRow(item, false);
    if (isCurrent) row.classList.add("current");
    container.appendChild(row);
  });

  // Render past (vises med "Afsluttet" centreret)
  past.forEach(item => {
    const row = createRow(item, true);
    container.appendChild(row);
  });

  // Start opdatering af countdowns / past-states
  updateAllCountdowns();
}

// Opdaterer countdowns hvert sekund og konverterer rækker til 'past' når slut
function updateAllCountdowns() {
  const els = document.querySelectorAll(".activity-row .countdown");
  const nowMs = Date.now();
  els.forEach(el => {
    const start = parseInt(el.dataset.start, 10);
    const end = parseInt(el.dataset.end, 10);
    if (isNaN(start) || isNaN(end)) { el.textContent = ""; return; }

    const row = el.closest(".activity-row");
    const normalInfo = row.querySelector(".normal-info");
    const pastCenter = row.querySelector(".past-center");
    const signupEl = row.querySelector(".meta .signup");

    if (nowMs >= start && nowMs <= end) {
      // Aktiv nu
      const diff = end - nowMs;
      el.textContent = `Slutter om: ${formatDelta(diff)}`;
      row.classList.remove("past");
      if (row && !row.classList.contains("current")) {
        document.querySelectorAll(".activity-row.current").forEach(r => r.classList.remove("current"));
        row.classList.add("current");
      }
      // vis normal info/meta
      if (normalInfo) normalInfo.style.display = "";
      if (pastCenter) pastCenter.style.display = "none";
      if (signupEl) signupEl.style.display = "";
    } else if (nowMs < start) {
      // Ikke startet endnu
      const diff = start - nowMs;
      el.textContent = `Starter om: ${formatDelta(diff)}`;
      row.classList.remove("past");
      if (row && row.classList.contains("current")) row.classList.remove("current");
      if (normalInfo) normalInfo.style.display = "";
      if (pastCenter) pastCenter.style.display = "none";
      if (signupEl) signupEl.style.display = "";
    } else {
      // Allerede slut -> 'Afsluttet' (ingen tidsangivelse)
      el.textContent = "";
      row.classList.add("past");
      if (row && row.classList.contains("current")) row.classList.remove("current");
      if (normalInfo) normalInfo.style.display = "none";
      if (pastCenter) pastCenter.style.display = ""; // vis 'Afsluttet'
      if (signupEl) signupEl.style.display = "none";
    }
  });
}

// Formater ms til læsbar tid (bruges til "Slutter om" / "Starter om")
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

function clearActivities() {
  if ($("activities")) $("activities").innerHTML = "";
}

// Clock
function startClock() {
  setInterval(() => { if ($("clock")) $("clock").innerText = formatTime(new Date()); }, 1000);
  if ($("clock")) $("clock").innerText = formatTime(new Date());
}

// UI events
if ($("refreshBtn")) $("refreshBtn").addEventListener("click", () => fetchActivities());
if ($("fsBtn")) $("fsBtn").addEventListener("click", () => { const el = document.documentElement; if (el.requestFullscreen) el.requestFullscreen(); else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen(); });

// STARTUP
fetchActivities();
startClock();
setInterval(fetchActivities, 60 * 1000);
setInterval(updateAllCountdowns, 1000);
pollForChanges();
setInterval(pollForChanges, POLL_INTERVAL_MS);
