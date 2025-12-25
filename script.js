// script.js - Komplet kode til Google Sheets dataintegration og fejlhåndtering
const SHEET_ID = "1_k26vVuaX1vmKN6-cY3-33YAn0jVAsgIM7vLm0YrMyE";
const SHEET_NAME = "Sheet1";
const urlBase = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

const $ = (id) => document.getElementById(id);
const formatTime = (d) => d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
const now = () => new Date();

function parseHM(str) {
  const s = String(str || "").trim();
  const parts = s.split(":");
  if (parts.length !== 2) return null;
  const [hh, mm] = parts.map((p) => parseInt(p, 10));
  return { hh, mm };
}

function updateDate() {
  const d = new Date();
  const formatted = d.toLocaleDateString("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const el = $("currentDate");
  if (el) {
    el.textContent = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }
}

async function fetchActivities() {
  const url = `${urlBase}?_=${Date.now()}`;
  try {
    console.log("API-anmodning sendt til:", url); // Log URL’en der bruges
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Fejl ved hent`);
    
    const data = await res.json();
    console.log("Modtaget data:", data); // Log hentede data
    renderActivities(data); // Fortsæt hvis data er korrekt
    
    const lastUpdated = $("lastUpdated");
    if (lastUpdated) lastUpdated.textContent = new Date().toLocaleString("da-DK");
  } catch (err) {
    console.error("Fetch-fejl:", err); // Log fuld fejl til fejlsøgning
    alert(`Kunne ikke hente aktiviteter fra Google Sheet:\n${err.message}`);
  }
}

function renderActivities(rows) {
  console.log("Data til rendering:", rows); // Log data der skal behandles
  const container = $("activities");
  if (!container) return;

  container.innerHTML = "";
  rows.forEach((row, idx) => {
    const startParsed = parseHM(row.Tid);
    const endParsed = parseHM(row.Slut);
    if (!startParsed || !endParsed) {
      console.error("Ugyldig række fundet:", row);
      return; 
    } 

    const start = new Date();
    start.setHours(startParsed.hh, startParsed.mm, 0);

    const end = new Date();
    end.setHours(endParsed.hh, endParsed.mm, 0);

    const isPast = now() > end;
    const isCurrent = now() >= start && now() <= end;

    const activityRow = document.createElement("div");
    activityRow.className = "activity-row";
    if (isPast) activityRow.classList.add("past");
    if (isCurrent) activityRow.classList.add("current");

    const timeDiv = document.createElement("div");
    timeDiv.className = "time";
    timeDiv.textContent = `${row.Tid} - ${row.Slut}`;
    activityRow.appendChild(timeDiv);

    const titlePlaceDiv = document.createElement("div");
    titlePlaceDiv.className = "title-place";

    const normalInfo = document.createElement("div");
    normalInfo.className = "normal-info";
    const titleDiv = document.createElement("div");
    titleDiv.className = "title";
    titleDiv.textContent = row.Aktivitet || "Ingen aktivitet";

    const placeDiv = document.createElement("div");
    placeDiv.className = "place";
    placeDiv.textContent = row.Sted || "Ukendt sted";

    normalInfo.appendChild(titleDiv);
    normalInfo.appendChild(placeDiv);
    titlePlaceDiv.appendChild(normalInfo);

    const pastCenterDiv = document.createElement("div");
    pastCenterDiv.className = "past-center";
    pastCenterDiv.textContent = "Afsluttet";

    if (isPast) pastCenterDiv.style.display = "block";
    else pastCenterDiv.style.display = "none";

    titlePlaceDiv.appendChild(pastCenterDiv);
    activityRow.appendChild(titlePlaceDiv);

    const meta = document.createElement("div");
    meta.className = "meta";

    const signupDiv = document.createElement("div");
    signupDiv.className = "signup";

    const labelSpan = document.createElement("span");
    labelSpan.className = "signup-label";
    labelSpan.textContent = "Tilmelding:";

    const statusSpan = document.createElement("span");
    statusSpan.className = "signup-status";
    statusSpan.textContent = ` ${row.Tilmelding}`.trim();
    if ((row.Tilmelding || "").toLowerCase() === "ja") {
      statusSpan.classList.add("ja");
    } else {
      statusSpan.classList.add("nej");
    }

    signupDiv.appendChild(labelSpan);
    signupDiv.appendChild(statusSpan);
    meta.appendChild(signupDiv);

    activityRow.appendChild(meta);
    container.appendChild(activityRow);
  });
}

function startClock() {
  setInterval(() => {
    const clock = $("clock");
    if (clock) clock.textContent = formatTime(now());
  }, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
  updateDate();
  fetchActivities();
  startClock();
});
