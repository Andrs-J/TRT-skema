// script.js - Dynamisk status baseret på klokkeslæt: "Afsluttet", "Igang", "Starter snart" eller "Afventer".

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
  const hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
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
  const formatted = d.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const text = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  const el = $("currentDate");
  if (el) el.textContent = text;
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
    const processed = {
        Mandag: [],
        Tirsdag: []
    };

    rows.forEach(r => {
        // Processér data for Mandag fra kolonner A, B, C, D
        const startMonday = parseHM(r.A); // Kolonne A = Starttid Mandag
        const endMonday = parseHM(r.B); // Kolonne B = Sluttid Mandag
        if (startMonday && endMonday) {
            const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startMonday.hh, startMonday.mm);
            const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endMonday.hh, endMonday.mm);
            if (end < start) end.setDate(end.getDate() + 1); // Håndtér slut næste dag, hvis slut < start
            processed.Mandag.push({
                aktivitet: (r.C || "").trim(), // Kolonne C = Aktivitet
                sted: (r.D || "").trim(), // Kolonne D = Sted
                start,
                end
            });
        }

        // Processér data for Tirsdag fra kolonner F, G, H, I
        const startTuesday = parseHM(r.F); // Kolonne F = Starttid Tirsdag
        const endTuesday = parseHM(r.G); // Kolonne G = Sluttid Tirsdag
        if (startTuesday && endTuesday) {
            const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, startTuesday.hh, startTuesday.mm); // +1 for næste dag
            const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, endTuesday.hh, endTuesday.mm);
            if (end < start) end.setDate(end.getDate() + 1); // Håndtér slut næste dag, hvis slut < start
            processed.Tirsdag.push({
                aktivitet: (r.H || "").trim(), // Kolonne H = Aktivitet
                sted: (r.I || "").trim(), // Kolonne I = Sted
                start,
                end
            });
        }
    });

    // Sortér aktiviteter for hver dag ud fra starttidspunkt
    processed.Mandag.sort((a, b) => a.start - b.start);
    processed.Tirsdag.sort((a, b) => a.start - b.start);

    return processed;
}

// Render / vis rækker
function renderActivities(dataByDay) {
    const container = $("activities");
    if (!container) return;

    container.innerHTML = ""; // Ryd eksisterende indhold

    // Render aktiviteter for hver dag
    Object.keys(dataByDay).forEach(day => {
        const daySection = document.createElement("div");
        daySection.className = "day-section";

        const dayTitle = document.createElement("h2");
        dayTitle.textContent = day; // F.eks. "Mandag" eller "Tirsdag"
        daySection.appendChild(dayTitle);

        const activities = dataByDay[day];
        activities.forEach(item => {
            const row = createRow(item);
            daySection.appendChild(row);
        });

        container.appendChild(daySection);
    });

    updateAllCountdowns();
}

  function createRow(item) {
    const row = document.createElement("div");
    row.className = "activity-row";

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

    tp.appendChild(normalInfo);
    row.appendChild(tp);

    // Dynamisk status
    const meta = document.createElement("div");
    meta.className = "meta";
    const nowMs = Date.now();

    let status = "";
    if (nowMs >= item.end.getTime()) {
        status = "Afsluttet";
    } else if (nowMs >= item.start.getTime()) {
        status = "Igang";
    } else if (item.start.getTime() - nowMs <= 30 * 60 * 1000) {
        status = "Starter snart";
    } else {
        status = "Afventer";
    }

    const statusDiv = document.createElement("div");
    statusDiv.className = "status";
    statusDiv.textContent = status;

    meta.appendChild(statusDiv);
    row.appendChild(meta);

    return row;
}

  upcoming.forEach(item => {
    const row = createRow(item, false);
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
    if (nowMs >= start && nowMs <= end) {
      const diff = end - nowMs;
      el.textContent = `Slutter om: ${formatDelta(diff)}`;
      row.classList.add("current");
    } else if (nowMs < start) {
      const diff = start - nowMs;
      el.textContent = `Starter om: ${formatDelta(diff)}`;
      row.classList.remove("current");
    } else {
      el.textContent = "";
      row.classList.remove("current");
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

// STARTUP: Initialiser date, clock, data og polls
updateDate();
setInterval(updateDate, 60 * 1000); // Opdaterer dato hvert minut (nok til midnat-change)
fetchActivities();
startClock();
setInterval(fetchActivities, 60 * 1000);
setInterval(updateAllCountdowns, 1000);
pollForChanges();
setInterval(pollForChanges, POLL_INTERVAL_MS);
