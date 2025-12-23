// script.js - komplet fil: henter sheet, viser aktiviteter som rækker,
// markerer forbi-aktiviteter (fade + "Afsluttet ..."), poller og hård-reloader ved ændring.
//
// Ændr POLL_INTERVAL_MS for hyppigere/ sjældnere check.
// Hvis du vil have andre tekster/formater, justér formatDelta().

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
    // Gem snapshot så poll ikke reload'er umiddelbart efter vi har hentet
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

// Ryd op i data: parse tider, sorter, filtrer til i dag
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
  // Inkluder aktiviteter som slutter senere end midnat i går (så man får også sene aktiviteter)
  const upcoming = processed.filter(p => p.end > new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate()-1,0,0));
  // Sortér på starttid stigende
  upcoming.sort((a,b) => a.start - b.start);
  return upcoming;
}

// ======= RENDER (RÆKKE-LAYOUT) =======
// Viser først kommende/aktuelle aktiviteter, og efterfølgende forbi-aktiviteter
function renderActivities(list) {
  const container = $("activities");
  if (!container) return;
  container.innerHTML = "";

  const nowTime = now();

  // Del list i to: upcoming (end > now) og past (end <= now)
  const upcoming = [];
  const past = [];
  for (const item of list) {
    if (item.end.getTime() > nowTime.getTime()) upcoming.push(item);
    else past.push(item);
  }

  // Helper: create row element for et item
  function createRow(item, isPastFlag) {
    const row = document.createElement("div");
    row.className = "activity-row";
    if (isPastFlag) row.classList.add("past");

    // Tid
    const timeDiv = document.createElement("div");
    timeDiv.className = "time";
    timeDiv.textContent = `${formatTime(item.start)} - ${formatTime(item.end)}`;
    row.appendChild(timeDiv);

    // Titel + sted
    const tp = document.createElement("div");
    tp.className = "title-place";
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = item.aktivitet || "—";
    const place = document.createElement("div");
    place.className = "place";
    place.textContent = item.sted || "";
    tp.appendChild(title);
    tp.appendChild(place);
    row.appendChild(tp);

    // Meta: tilmelding + countdown/afsluttet
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

  // Render upcoming først (inkl. aktuelle), behold rækkefølge
  upcoming.forEach(item => {
    const row = createRow(item, false);
    // marker nuværende aktivitet (start <= now <= end)
    if (item.start.getTime() <= nowTime.getTime() && item.end.getTime() >= nowTime.getTime()) {
      row.classList.add("current");
    }
    container.appendChild(row);
  });

  // Render past til sidst (så de ikke fylder toppen)
  past.forEach(item => {
    const row = createRow(item, true);
    container.appendChild(row);
  });

  // Start/Opdater countdown displays (og sæt/ fjern past-klasse dynamisk)
  updateAllCountdowns();
}

// Opdaterer alle countdown-elementer på siden (kører regelmæssigt)
// Viser "Slutter om:", "Starter om:" eller "Afsluttet for X siden" og sætter .past
function updateAllCountdowns() {
  const els = document.querySelectorAll(".activity-row .countdown");
  const nowMs = Date.now();
  els.forEach(el => {
    const start = parseInt(el.dataset.start, 10);
    const end = parseInt(el.dataset.end, 10);
    if (isNaN(start) || isNaN(end)) { el.textContent = ""; return; }

    const row = el.closest(".activity-row");

    if (nowMs >= start && nowMs <= end) {
      // Aktiv nu
      const diff = end - nowMs;
      el.textContent = `Slutter om: ${formatDelta(diff)}`;
      if (row && row.classList.contains("past")) row.classList.remove("past");
      if (row) {
        // markér current hvis ønsket (hjælper visuel opmærksomhed)
        if (!row.classList.contains("current")) {
          // fjern current fra andre rækker først (så kun én kan være current)
          document.querySelectorAll(".activity-row.current").forEach(r => r.classList.remove("current"));
          row.classList.add("current");
        }
      }
    } else if (nowMs < start) {
      // Ikke startet endnu
      const diff = start - nowMs;
      el.textContent = `Starter om: ${formatDelta(diff)}`;
      if (row && row.classList.contains("past")) row.classList.remove("past");
      if (row && row.classList.contains("current")) row.classList.remove("current");
    } else {
      // Allerede slut
      const diff = nowMs - end;
      el.textContent = `Afsluttet for ${formatDelta(diff)} siden`;
      if (row && !row.classList.contains("past")) row.classList.add("past");
      if (row && row.classList.contains("current")) row.classList.remove("current");
    }
  });
}

// Hjælper: formater ms til "X t Y min" eller "Z min"
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

// STARTUP & INTERVALS
fetchActivities();
startClock();
setInterval(fetchActivities, 60 * 1000);      // Opdater DOM hvert minut
setInterval(updateAllCountdowns, 1000);       // Opdater countdowns hvert sekund
pollForChanges();
setInterval(pollForChanges, POLL_INTERVAL_MS);
