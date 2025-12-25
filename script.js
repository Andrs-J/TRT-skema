// script.js - Kompatibel med v20 design: håndterer sted, tilmelding og aktiviteter korrekt
const SHEET_ID = "1XChIeVNQqWM4OyZ6oe8bh2M9e6H14bMkm7cpVfXIUN8";
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
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderActivities(data);
    const lastUpdated = $("lastUpdated");
    if (lastUpdated) lastUpdated.textContent = new Date().toLocaleString("da-DK");
  } catch (err) {
    console.error("Fejl ved hent:", err);
    alert("Kunne ikke hente aktiviteter fra Google Sheet.");
  }
}

function renderActivities(rows) {
  const container = $("activities");
  if (!container) return;

  const nowTime = now();
  container.innerHTML = "";
  rows.forEach((row, idx) => {
    const startParsed = parseHM(row.Tid);
    const endParsed = parseHM(row.Slut);
    if (!startParsed || !endParsed) return;

    const start = new Date();
    start.setHours(startParsed.hh, startParsed.mm, 0);

    const end = new Date();
    end.setHours(endParsed.hh, endParsed.mm, 0);

    const isPast = nowTime > end;
    const isCurrent = nowTime >= start && nowTime <= end;

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
