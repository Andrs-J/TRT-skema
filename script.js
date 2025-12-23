// script.js - opdateret så nuværende aktivitet ikke vises som duplikat i kortlisten

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
    if (last && last !== snapshot) {
      triggerHardReload();
      return;
    }
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

// ======= HENT & RENDER =======
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
    renderActivities(processData(data));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
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
  const upcoming = processed.filter(p => p.end > new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate()-1,0,0));
  upcoming.sort((a,b) => a.start - b.start);
  return upcoming;
}

function renderActivities(list) {
  const nowTime = now();
  let current = null;
  let next = null;
  for (const item of list) {
    if (item.start <= nowTime && item.end >= nowTime) { current = item; break; }
  }
  if (!current) next = list.find(item => item.start > nowTime);
  else {
    const idx = list.indexOf(current);
    next = list[idx + 1] || null;
  }

  // Opdater Næste aktivitet kort (stort)
  const nextCard = $("nextCard");
  if (nextCard) {
    const timeEl = nextCard.querySelector(".time");
    const activityEl = nextCard.querySelector(".activity");
    const placeEl = nextCard.querySelector(".place");
    const signupEl = nextCard.querySelector(".signup");
    if (current) {
      if (timeEl) timeEl.textContent = `${formatTime(current.start)} - ${formatTime(current.end)}`;
      if (activityEl) activityEl.textContent = current.aktivitet || "—";
      if (placeEl) placeEl.textContent = current.sted || "";
      if (signupEl) {
        if (current.tilmelding === "ja") { signupEl.textContent = "Tilmelding: JA (Ring)"; signupEl.className = "signup ja"; }
        else if (current.tilmelding === "nej") { signupEl.textContent = "Tilmelding: NEJ"; signupEl.className = "signup nej"; }
        else { signupEl.textContent = current.tilmelding || ""; signupEl.className = "signup"; }
      }
      startCountdown(current.end, "Slutter om: ", $("countdown"));
    } else if (next) {
      if (timeEl) timeEl.textContent = `${formatTime(next.start)} - ${formatTime(next.end)}`;
      if (activityEl) activityEl.textContent = next.aktivitet || "—";
      if (placeEl) placeEl.textContent = next.sted || "";
      if (signupEl) {
        if (next.tilmelding === "ja") { signupEl.textContent = "Tilmelding: JA (Ring)"; signupEl.className = "signup ja"; }
        else if (next.tilmelding === "nej") { signupEl.textContent = "Tilmelding: NEJ"; signupEl.className = "signup nej"; }
        else { signupEl.textContent = next.tilmelding || ""; signupEl.className = "signup"; }
      }
      startCountdown(next.start, "Starter om: ", $("countdown"));
    } else {
      if (timeEl) timeEl.textContent = "--:--";
      if (activityEl) activityEl.textContent = "Ingen flere aktiviteter i dag";
      if (placeEl) placeEl.textContent = "";
      if ($("countdown")) $("countdown").textContent = "";
      stopCountdown();
    }
  }

  // Vis kommende aktiviteter som store kort.
  // VIGTIGT: hvis current findes, spring første aktivitet (current) over så den ikke vises dobbelt.
  const container = $("bigActivities");
  if (!container) return;
  container.innerHTML = "";
  const startIndex = current ? 1 : 0;
  const display = list.slice(startIndex, startIndex + 8); // maks 8 kort
  display.forEach(item => {
    const card = document.createElement("div");
    card.className = "activity-card" + ((item === current) ? " current" : "");
    const time = document.createElement("div");
    time.className = "time";
    time.textContent = `${formatTime(item.start)} - ${formatTime(item.end)}`;
    const title = document.createElement("div");
    title.className = "title";
    title.textContent = item.aktivitet || "—";
    const place = document.createElement("div");
    place.className = "place";
    place.textContent = item.sted || "";
    card.appendChild(time);
    card.appendChild(title);
    card.appendChild(place);
    container.appendChild(card);
  });
}

function clearActivities() {
  if ($("bigActivities")) $("bigActivities").innerHTML = "";
  const nc = $("nextCard");
  if (nc) {
    const activityEl = nc.querySelector(".activity");
    const timeEl = nc.querySelector(".time");
    if (activityEl) activityEl.textContent = "Ingen data";
    if (timeEl) timeEl.textContent = "--:--";
  }
  if ($("countdown")) $("countdown").textContent = "";
}

// Countdown
let countdownInterval = null;
function startCountdown(targetDate, prefix, el) {
  stopCountdown();
  if (!el) return;
  function tick() {
    const d = targetDate - new Date();
    if (d <= 0) { el.textContent = prefix + "0 min"; stopCountdown(); return; }
    const mins = Math.floor(d / 60000);
    const secs = Math.floor((d % 60000) / 1000);
    if (mins > 60) {
      const hours = Math.floor(mins / 60);
      el.textContent = `${prefix}${hours} t ${mins % 60} min`;
    } else {
      el.textContent = `${prefix}${mins} min ${secs} s`;
    }
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}
function stopCountdown() { if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } }

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
pollForChanges();
setInterval(pollForChanges, POLL_INTERVAL_MS);
