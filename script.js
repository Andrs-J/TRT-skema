// ======= KONFIGURATION =======
const SHEET_ID = "1XChIeVNQqWM4OyZ6oe8bh2M9e6H14bMkm7cpVfXIUN8";
const SHEET_NAME = "Sheet1";
const MINISITE_URL = "https://dit-minisite-eksempel.example"; // RET TIL DIN minisite
const QR_API = (text) => `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(text)}`;
// Opensheet endpoint (praktisk til demo). Til produktion: overvej Google Apps Script/Sheets API.
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

// ======= HELPERS =======
const $ = (id) => document.getElementById(id);
const formatTime = (d) => d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
const now = () => new Date();
const setStatus = (text) => { $("status").innerText = text; };
const showMessage = (txt) => { $("message").innerText = txt || ""; };

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

// Hent og behandle data
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
    $("lastUpdated").innerText = new Date().toLocaleString("da-DK");
    renderActivities(processData(data));

  } catch (err) {
    console.error("Fejl ved hent:", err);
    setStatus("Offline / hent fejlede");
    const cached = loadCache();
    if (cached && cached.data) {
      showMessage("Viser senest hentede data (offline).");
      renderActivities(processData(cached.data));
      $("lastUpdated").innerText = new Date(cached.ts).toLocaleString("da-DK");
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
    // next = activity after current
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
    signupEl.textContent = "";
    countdownEl.textContent = "";
    stopCountdown();
  }

  // Opdater QR + link
  const qr = $("qr");
  const minisiteLink = $("minisiteLink");
  minisiteLink.href = MINISITE_URL;
  qr.src = QR_API(MINISITE_URL);
}

// Nulstil tabel
function clearActivities() {
  $("activities").innerHTML = "";
  $("nextCard").querySelector(".activity").textContent = "Ingen data";
  $("nextCard").querySelector(".time").textContent = "--:--";
  $("countdown").textContent = "";
}

// Nedtælling
let countdownInterval = null;
function startCountdown(targetDate, prefix, el) {
  stopCountdown();
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
    $("clock").innerText = formatTime(new Date());
  }, 1000);
  $("clock").innerText = formatTime(new Date());
}

// ====== UI events ======
$("refreshBtn").addEventListener("click", () => fetchActivities());
$("fsBtn").addEventListener("click", () => {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen();
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
});

// Auto refresh
fetchActivities();
startClock();
// Opdater hvert 60s (kan sættes til 120s)
setInterval(fetchActivities, 60 * 1000);
