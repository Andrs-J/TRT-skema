const $ = (id) => document.getElementById(id);
const formatTime = (d) => d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
const now = () => new Date();
const setStatus = (text) => { if ($("status")) $("status").innerText = text; };
const showMessage = (txt) => { if ($("message")) $("message").innerText = txt || ""; };

function saveCache(data) {
  try {
    localStorage.setItem("trt_cache", JSON.stringify({ ts: Date.now(), data }));
  } catch (e) {}
}
function loadCache() {
  try {
    const raw = localStorage.getItem("trt_cache");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function parseHM(str) {
  const m = str.match(/(\d{1,2}):(\d{1,2})/);
  if (!m) return null;
  return { hh: parseInt(m[1], 10), mm: parseInt(m[2], 10) };
}

function nowTs() {
  return Date.now();
}

async function pollForChanges() {}
function triggerHardReload() {}

// Opdater dag+dato i header
function updateDate() {
  const d = new Date();
  const formatted = d.toLocaleDateString("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const currentDate = $("currentDate");
  if (currentDate) {
    currentDate.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
}

// Dynamisk tilføj dag og dato for dag 2
function addDayHeaderForTomorrow() {
  const container = document.getElementById("activities");
  if (!container) {
    console.error("Container ikke fundet: activities");
    return;
  }

  // Beregn dato for i morgen
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const formattedDate = tomorrow.toLocaleDateString("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  // Opret header for næste dag
  const dayHeader = document.createElement("div");
  dayHeader.className = "day-header";
  dayHeader.textContent = `${formattedDate.charAt(0).toUpperCase()}${formattedDate.slice(1)}`;

  // Tilføj den nye header til aktiviteterne
  container.appendChild(dayHeader);
}

// HENT + PROCESS DATA (Placeholder for at sikre eksisterende funktioner ikke påvirkes)
async function fetchActivities() {}

// Render / vis rækker (Placeholder for eksisterende funktioner)
function renderActivities(list) {}

// Start clock og datoopdatering
document.addEventListener("DOMContentLoaded", () => {
  updateDate(); // Opdater dagens dato i headeren
  addDayHeaderForTomorrow(); // Tilføj dag og dato for i morgen
});
