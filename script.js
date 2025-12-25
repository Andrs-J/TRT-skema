// script.js - fix til rendering med past-aktiviteter og klokkeslæt i topbar
const SHEET_ID = "1XChIeVNQqWM4OyZ6oe8bh2M9e6H14bMkm7cpVfXIUN8";
const SHEET_NAME = "Sheet1";
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

const $ = (id) => document.getElementById(id);
const formatTime = (d) => d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });

function updateClock() {
  const stickyClock = $("stickyClock");
  if (stickyClock) stickyClock.textContent = formatTime(new Date());
}
setInterval(updateClock, 1000);

async function fetchActivities() {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderActivities(groupByDay(data));
  } catch (err) {
    console.error("Fejl ved hent:", err);
  }
}

function groupByDay(data) {
  const grouped = {};
  data.forEach((item) => {
    const date = item.Dato || "2025-12-25"; // Brug en dato-kolonne fra sheet'et
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  });
  return grouped;
}

function renderActivities(days) {
  const container = $("activitiesContainer");
  if (!container) return;

  container.innerHTML = "";
  const now = new Date();

  Object.keys(days).forEach((date) => {
    const dayRow = document.createElement("div");
    dayRow.className = "day-section";

    const header = document.createElement("h2");
    header.className = "day-header";
    header.textContent = new Date(date).toLocaleDateString("da-DK", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
    });
    dayRow.appendChild(header);

    days[date].forEach((activity) => {
      const row = document.createElement("div");
      const activityEnd = parseHM(activity.Slut);
      const activityEndDate = new Date(date);
      activityEndDate.setHours(activityEnd.hh, activityEnd.mm);

      row.className = "activity-row";
      if (activityEndDate < now) row.classList.add("past");

      const title = document.createElement("div");
      title.className = "activity-title";
      title.textContent = activity.Aktivitet || "Ingen aktivitet";

      const time = document.createElement("div");
      time.className = "activity-time";
      time.textContent = `${activity.Tid} - ${activity.Slut}`;

      row.appendChild(title);
      row.appendChild(time);
      dayRow.appendChild(row);
    });

    container.appendChild(dayRow);
  });
}

function parseHM(str) {
  const parts = str.split(":");
  return { hh: parseInt(parts[0], 10), mm: parseInt(parts[1], 10) };
}

// Startup
document.addEventListener("DOMContentLoaded", () => {
  fetchActivities();
  updateClock();
});
