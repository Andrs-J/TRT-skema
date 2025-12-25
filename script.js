const SHEET_ID = "1_k26vVuaX1vmKN6-cY3-33YAn0jVAsgIM7vLm0YrMyE";
const SHEET_NAME = "Uge1";
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

const $ = (id) => document.getElementById(id);
const formatTime = (d) => d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
const now = () => new Date();
const setStatus = (text) => { if ($("status")) $("status").innerText = text; };
const showMessage = (txt) => { if ($("message")) $("message").innerText = txt || ""; };

// Behandling af data baseret på den angivne struktur
function parseHM(str) {
  if (!str) return null;
  const s = String(str).replace(/"/g, "").trim();
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = parseInt(m[1], 10), mm = parseInt(m[2], 10);
  if (isNaN(hh) || isNaN(mm)) return null;
  return { hh, mm };
}

function processData(rows) {
  const today = new Date();
  const activities = [];

  rows.forEach((r, i) => {
    const startParsed = parseHM(r.Tid);
    const endParsed = parseHM(r.Slut);

    if (!startParsed || !endParsed) return; // Spring over rækker med manglende tider

    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startParsed.hh, startParsed.mm);
    let end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endParsed.hh, endParsed.mm);
    if (end < start) end.setDate(end.getDate() + 1); // Hvis sluttidspunkt er på næste dag

    activities.push({
      start,
      end,
      aktivitet: r.Aktivitet || "Ukendt Aktivitet",
      sted: r.Sted || "Ukendt Sted",
      tilmelding: r.Tilmelding === "TRUE", // Flueben (TRUE/FALSE)
      aflyst: r.Aflyst === "TRUE" // Flueben (TRUE/FALSE)
    });
  });

  // Returnér sorteret liste med geparset tid
  activities.sort((a, b) => a.start - b.start);
  return activities;
}

// Render aktiviteter til DOM
function renderActivities(list) {
  const container = $("activities");
  if (!container) return;

  container.innerHTML = ""; // Ryd eksisterende indhold
  const nowTime = now();

  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "activity-row";

    // Tid
    const timeDiv = document.createElement("div");
    timeDiv.className = "time";
    timeDiv.textContent = `${formatTime(item.start)} - ${formatTime(item.end)}`;
    row.appendChild(timeDiv);

    // Aktivitet + sted
    const activityDiv = document.createElement("div");
    activityDiv.className = "activity-info";
    const titleDiv = document.createElement("div");
    titleDiv.className = "title";
    titleDiv.textContent = item.aktivitet;
    const placeDiv = document.createElement("div");
    placeDiv.className = "place";
    placeDiv.textContent = item.sted;
    activityDiv.appendChild(titleDiv);
    activityDiv.appendChild(placeDiv);
    row.appendChild(activityDiv);

    // Status midt i rækken
    const statusDiv = document.createElement("div");
    statusDiv.className = "status";

    if (item.aflyst) {
      statusDiv.textContent = "Aflyst";
      row.classList.add("cancelled");
      statusDiv.classList.add("status-cancelled");
    } else if (nowTime > item.end) {
      statusDiv.textContent = "Afsluttet";
      row.classList.add("past");
      statusDiv.classList.add("status-finished");
    } else {
      statusDiv.textContent = `Tilmelding: ${item.tilmelding ? "Ja" : "Nej"}`;
      statusDiv.classList.add(item.tilmelding ? "status-yes" : "status-no");
    }

    row.appendChild(statusDiv);
    container.appendChild(row);
  });
}

// Start funktion for at hente data
async function fetchActivities() {
  setStatus("Henter aktiviteter...");
  showMessage("");

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const processed = processData(data); // Processér data
    renderActivities(processed); // Render til skærmen
    setStatus("Opdateret");
    if ($("lastUpdated")) $("lastUpdated").innerText = new Date().toLocaleString("da-DK");
  } catch (err) {
    console.error("Fejl ved hent:", err);
    setStatus("Kunne ikke hente data");
    showMessage("Ingen data tilgængelig.");
  }
}

updateDate(); // Opdater dato i header
fetchActivities(); // Hent aktiviteter
setInterval(updateDate, 60 * 1000); // Opdater dato hvert minut
