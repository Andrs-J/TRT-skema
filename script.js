// script.js - opdateret så "Tilmelding:" forbliver neutral og kun status (JA/NEJ) farves.
// Opdater/fuldskærm-knapper er fjernet.

const SHEET_ID = "1_k26vVuaX1vmKN6-cY3-33YAn0jVAsgIM7vLm0YrMyE";
const SHEET_NAME = "Sheet1";
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

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

// Polling/hard reload
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

// Opdater dag+dato i header
function updateDate() {
  const d = new Date();
  
  // Ugedag, dato, måned og år sættes manuelt
  const weekday = d.toLocaleDateString("da-DK", { weekday: "long" });
  const day = d.getDate(); // Får dato
  const month = d.toLocaleDateString("da-DK", { month: "long" });
  const year = d.getFullYear(); // Får år
  
  // Kombinér til ønsket format
  const formatted = `${weekday} - ${day} ${month} ${year}`;
  
  // Opdater `currentDate` i HTML
  const el = $("currentDate");
  if (el) el.textContent = formatted;
}

// HENT + PROCESS DATA
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

// Render / vis rækker
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

    const timeDiv = document.createElement("div");
    timeDiv.className = "time";
    timeDiv.textContent = `${formatTime(item.start)} - ${formatTime(item.end)}`;
    row.appendChild(timeDiv);

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
    pastCenter.textContent = "Afsluttet";

    tp.appendChild(normalInfo);
    tp.appendChild(pastCenter);
    row.appendChild(tp);

    const meta = document.createElement("div");
    meta.className = "meta";

    // Tilmelding: split i label + status. Label neutral, status farvet.
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
      // ukendt tekst - vis pænt
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
    meta.appendChild(countdown);

    row.appendChild(meta);
    return row;
  }

  upcoming.forEach(item => {
    const isCurr = (item.start.getTime() <= nowTime.getTime() && item.end.getTime() >= nowTime.getTime());
    const row = createRow(item, false);
    if (isCurr) row.classList.add("current");
    container.appendChild(row);
  });

  past.forEach(item => {
    const row = createRow(item, true);
    container.appendChild(row);
  });

  updateAllCountdowns();
}

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

    if (nowMs >= start && nowMs <= end) {
      const diff = end - nowMs;
      el.textContent = `Slutter om: ${formatDelta(diff)}`;
      row.classList.remove("past");
      row.classList.add("current");
      if (signupEl) signupEl.style.opacity = "";
      if (normalInfo) normalInfo.style.opacity = "";
      if (pastCenter) pastCenter.style.display = "none";
    } else if (nowMs < start) {
      const diff = start - nowMs;
      el.textContent = `Starter om: ${formatDelta(diff)}`;
      row.classList.remove("past");
      row.classList.remove("current");
      if (signupEl) signupEl.style.opacity = "";
      if (normalInfo) normalInfo.style.opacity = "";
      if (pastCenter) pastCenter.style.display = "none";
    } else {
      el.textContent = "";
      row.classList.add("past");
      row.classList.remove("current");
      if (signupEl) signupEl.style.opacity = "0.7";
      if (normalInfo) normalInfo.style.opacity = "0.8";
      if (pastCenter) pastCenter.style.display = "";
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
setInterval(updateDate, 60 * 1000); // opdaterer dato hvert minut (nok til midnat-change)
fetchActivities();
startClock();
setInterval(fetchActivities, 60 * 1000);
setInterval(updateAllCountdowns, 1000);
pollForChanges();
setInterval(pollForChanges, POLL_INTERVAL_MS);
