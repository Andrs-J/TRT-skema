// script.js - Sørger for korrekt afsluttet markering og render alle felter
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
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  renderActivities(groupByDay(data));
}

function groupByDay(data) {
  const grouped = {};
  data.forEach((item) => {
    const date = item.Dato || "2025-12-25";
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(item);
  });
  return grouped;
}

function renderActivities(days) {
  const container = $("activitiesContainer");
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
      const endParsed = parseHM(activity.Slut);
      const endTime = new Date(date);
      endTime.setHours(endParsed.hh, endParsed.mm);

      row.className = "activity-row";
      if (now > endTime) row.classList.add("past");

      const title = document.createElement("div");
      title.className = "activity-title";
      title.textContent = activity.Aktivitet;

      const time = document.createElement("div");
      time.className = "activity-time";
      time.textContent = `${activity.Tid} - ${activity.Slut}`;

      const place = document.createElement("div");
      place.className = "activity-place";
      place.textContent = `Sted: ${activity.Sted}`;

      const signup = document.createElement("div");
      signup.className = "activity-signup";
      signup.textContent = `Tilmelding: ${activity.Tilmelding}`;
      if (activity.Tilmelding.toLowerCase() === "ja") signup.classList.add("ja");

      row.appendChild(title);
      row.appendChild(time);
      row.appendChild(place);
      row.appendChild(signup);
      dayRow.appendChild(row);
    });

    container.appendChild(dayRow);
  });
}

function parseHM(timeStr) {
  const [hh, mm] = timeStr.split(":").map(Number);
  return { hh, mm };
}

document.addEventListener("DOMContentLoaded", () => {
  fetchActivities();
  updateClock();
});
