// ======= KONFIGURATION =======
const SHEET_ID = "1XChIeVNQqWM4OyZ6oe8bh2M9e6H14bMkm7cpVfXIUN8";
const SHEET_NAME = "Sheet1";
const MINISITE_URL = "https://dit-minisite-eksempel.example"; // RET TIL DIN minisite / GitHub Pages
const QR_API = (text) => `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(text)}`;
// Opensheet endpoint (praktisk til demo). Til produktion: overvej Google Apps Script/Sheets API.
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

// ======= HELPERS =======
const $ = (id) => document.getElementById(id);
const formatTime = (d) => d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
const now = () => new Date();
const setStatus = (text) => { if ($("status")) $("status").innerText = text; };
const showMessage = (txt) => { if ($("message")) $("message").innerText = txt || ""; };

// Gem/call cache
function saveCache(data) {
  try { localStorage.setItem("trt_cache", JSON.stringify({ ts: Date.now(), data })); } catch (e) {}
}
function loadCache() {
  try { const raw = localStorage.getItem("trt_cache"); if (!raw) return null; return JSON.parse(raw); } catch(e){ return null; }
}

// Parse tidstrenge robustt
function parseHM(str) {
  if (!str) return null;
  // Ryd op: fjerne anførselstegn og whitespace
  const s = String(str).replace(/"/g, "").trim();
  // Match formats like HH:MM eller H:MM (24 timers)
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = parseInt(m[1],10), mm = parseInt(m[2],10);
  if (isNaN(hh) || isNaN(mm)) return null;
  return { hh, mm };
}

// ======= HARD-RELOAD / POLLING TIL ÆNDRINGER ====
const POLL_INTERVAL_MS = 60 * 1000; // poll hvert 60s (juster om nødvendigt)
const STORAGE_KEY = "trt_last_snapshot_v1";
const RELOAD_GRACE_MS = 10 * 1000; // undgå reload-loop

function nowTs() { return Date.now(); }

async function pollForChanges() {
  try {
    // Tilføj cache-buster på fetch for at sikre frisk respons
    const fetchUrl = url + (url.includes("?") ? "&" : "?") + "_=" + nowTs();
    const res = await fetch(fetchUrl, { cache: "no-store" });
    if (!res.ok) {
      console.warn("Poll: fetch returned", res.status);
      return;
    }
    const data = await res.json();

    // Snapshot af det hentede (til sammenligning). Hvis sheet er meget stort, brug evt. en kort hash eller felt sammenligning.
    const snapshot = JSON.stringify(data);

    const last = localStorage.getItem(STORAGE_KEY);

    if (last && last !== snapshot) {
      console.log("Ændring i sheet registreret — laver hård reload");
      triggerHardReload();
      return;
    }

    // Gem snapshot hvis vi ikke havde noget før
    if (!last) {
      try { localStorage.setItem(STORAGE_KEY, snapshot); } catch (e) {}
    }

  } catch (err) {
    console.error("Poll-fejl:", err);
    // Ignorer fejl — prøver igen næste interval
  }
}

function triggerHardReload() {
  const lastReload = parseInt(localStorage.getItem("trt_last_reload_ts") || "0", 10);
  if (Date.now() - lastReload < RELOAD_GRACE_MS) {
    console.log("Reload afvist pga. grace window");
    return;
  }
  localStorage.setItem("trt_last_reload_ts", String(Date.now()));

  // Byg ny URL med cache-busting param 'r'
  // Bevar eksisterende søgeparametre (undgår at akkumulere r=)
  const urlObj = new URL(window.location.href);
  urlObj.searchParams.set("r", String(nowTs()));
  // Replace for at undgå ekstra entry i historik
  window.location.replace(urlObj.toString());
}

// ======= HENT OG RENDER AKTIVITETER =======
async function fetchActivities() {
  setStatus("Henter aktiviteter…");
  showMessage("");
  try {
    const res = await fetch(url, {cache: "no-store"});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Ugyldigt format fra sheet");

    // Gem i cache
    saveCache(data);
    setStatus("Opdateret");
    if ($("lastUpdated")) $("lastUpdated").innerText = new Date().toLocaleString("da-DK");
    renderActivities(processData(data));

    // Opdatér snapshot også så poll ser den nyeste version (undgår reload umiddelbart efter fetch)
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

// Ryd op i data: parse tider, sorter, filtrer til i dag
function processData(rows) {
  const today = new Date();
  const processed = [];

  rows.forEach(r => {
    // Forventede kolonnenavne: Tid (start) => r.Tid, Slut => r.Slut, Aktivitet, Sted, Tilmelding
    const startParsed = parseHM(r.Tid);
    const endParsed = parseHM(r.Slut);

    if (!startParsed || !endParsed) return;

    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startParsed.hh, startParsed.mm);
    let end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endParsed.hh, endParsed.mm);

    // Hvis end ligger før start => antag næste dag (overnight)
    if (end < start) {
      end.setDate(end.getDate() + 1);
    }

    processed.push({
      raw: r,
      start,
      end,
      aktivitet: (r.Aktivitet || "").replace(/"/g,"").trim(),
      sted: (r.Sted || "").replace(/"/g,"").trim(),
      tilmelding: (r.Tilmelding || "").toLowerCase().trim()
    });
  });

  // Kun aktiviteter der ikke allerede er slut (med lille buffer)
  const nowTime = now();
  const upcomingToday = processed.filter(p => p.end > new Date(nowTime.getFullYear(), nowTime.getMonth(), nowTime.getDate() - 1, 0, 0));

  // Sort på starttid
  upcomingToday.sort((a,b) => a.start - b.start);

  return upcomingToday;
}

// Rendre DOM
function renderActivities(list) {
  const table = $("activities");
  if (!table) return;
  table.innerHTML = "";

  const nowTime = now();

  // Find current aktivitet (hvis nogen) og næste
  let current = null;
  let next = null;
  for (const item of list) {
    if (item.start <= nowTime && item.end >= nowTime) {
      current = item;
      break;
    }
  }
  if (!current) {
    next = list.find(item => item.start > nowTime);
  } else {
    const idx = list.indexOf(current);
    next = list[idx + 1] || null;
  }

  // Vis op til 12 kommende (inkl. nuværende)
  const display = list.slice(0, 12);
  for (const item of display) {
    const tr = document.createElement("tr");
    if (item === current) tr.classList.add("current");

    const timeTd = document.createElement("td");
    timeTd.className = "time-col";
    timeTd.textContent = `${formatTime(item.start)} - ${formatTime(item.end)}`;

    const actTd = document.createElement("td");
    actTd.textContent = item.aktivitet || "—";

    const placeTd = document.createElement("td");
    placeTd.textContent = item.sted || "—";

    const signTd = document.createElement("td");
    if (item.tilmelding === "ja") {
      signTd.textContent = "Ring";
      signTd.className = "signup ja";
    } else if (item.tilmelding === "nej" || item.tilmelding === "nej.") {
      signTd.textContent = "Nej";
      signTd.className = "signup nej";
    } else {
      signTd.textContent = item.tilmelding || "-";
    }

    tr.appendChild(timeTd);
    tr.appendChild(actTd);
    tr.appendChild(placeTd);
    tr.appendChild(signTd);
    table.appendChild(tr);
  }

  // Opdater "Næste aktivitet" kort
  const nextCard = $("nextCard");
  const countdownEl = $("countdown");
  if (nextCard) {
    const signupEl = nextCard.querySelector(".signup");
    if (current) {
      nextCard.querySelector(".time").textContent = `${formatTime(current.start)} - ${formatTime(current.end)}`;
      nextCard.querySelector(".activity").textContent = current.aktivitet;
      nextCard.querySelector(".place").textContent = current.sted;
      if (current.tilmelding === "ja") { signupEl.textContent = "Tilmelding: JA (Ring)"; signupEl.className = "signup ja"; }
      else if (current.tilmelding === "nej") { signupEl.textContent = "Tilmelding: NEJ"; signupEl.className = "signup nej"; }
      else { signupEl.textContent = current.tilmelding || ""; signupEl.className = "signup"; }
      startCountdown(current.end, "Slutter om: ", countdownEl);
    } else if (next) {
      nextCard.querySelector(".time").textContent = `${formatTime(next.start)} - ${formatTime(next.end)}`;
      nextCard.querySelector(".activity").textContent = next.aktivitet;
      nextCard.querySelector(".place").textContent = next.sted;
      if (next.tilmelding === "ja") { signupEl.textContent = "Tilmelding: JA (Ring)"; signupEl.className = "signup ja"; }
      else if (next.tilmelding === "nej") { signupEl.textContent = "Tilmelding: NEJ"; signupEl.className = "signup nej"; }
      else { signupEl.textContent = next.tilmelding || ""; signupEl.className = "signup"; }
      startCountdown(next.start, "Starter om: ", countdownEl);
    } else {
      nextCard.querySelector(".time").textContent = "--:--";
      nextCard.querySelector(".activity").textContent = "Ingen flere aktiviteter i dag";
      nextCard.querySelector(".place").textContent = "";
      if (signupEl) signupEl.textContent = "";
      if (countdownEl) countdownEl.textContent = "";
      stopCountdown();
    }
  }

  // Opdater QR + link hvis elementer findes
  const qr = $("qr");
  const minisiteLink = $("minisiteLink");
  if (minisiteLink) minisiteLink.href = MINISITE_URL;
  if (qr) qr.src = QR_API(MINISITE_URL);
}

// Nulstil tabel
function clearActivities() {
  if ($("activities")) $("activities").innerHTML = "";
  const nc = $("nextCard");
  if (nc) {
    const activityEl = nc.querySelector(".activity");
    const timeEl = nc.querySelector(".time");
    if (activityEl) activityEl.textContent = "Ingen data";
    if (timeEl) timeEl.textContent = "--:--";
  }
  if ($("countdown")) $("countdown").textContent = "";
}

// Nedtælling
let countdownInterval = null;
function startCountdown(targetDate, prefix, el) {
  stopCountdown();
  if (!el) return;
  function tick() {
    const d = targetDate - new Date();
    if (d <= 0) {
      el.textContent = prefix + "0 min";
      stopCountdown();
      return;
    }
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

// ====== Live ur ======
function startClock() {
  setInterval(() => {
    if ($("clock")) $("clock").innerText = formatTime(new Date());
  }, 1000);
  if ($("clock")) $("clock").innerText = formatTime(new Date());
}

// ====== UI events ======
if ($("refreshBtn")) $("refreshBtn").addEventListener("click", () => fetchActivities());
if ($("fsBtn")) $("fsBtn").addEventListener("click", () => {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
});

// ====== STARTUP: hent data, start clock, start poll ======
// Hent og render første gang
fetchActivities();
startClock();

// Auto-opdater DOM hvert 60s (kan ændres)
setInterval(fetchActivities, 60 * 1000);

// Start polling for ændringer og hård reload hvis ændret
pollForChanges(); // første gang
setInterval(pollForChanges, POLL_INTERVAL_MS);
