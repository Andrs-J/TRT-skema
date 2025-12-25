const SHEET_ID = "1_k26vVuaX1vmKN6-cY3-33YAn0jVAsgIM7vLm0YrMyE";
const SHEET_NAME = "Uge 1";
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

const $ = (id) => document.getElementById(id);
const now = () => new Date();

function updateDate(d = new Date()) {
  const formatted = d.toLocaleDateString("da-DK", {
    weekday: "long", day: "numeric", month: "long"
  });
  const el = $("currentDate");
  if (el) el.textContent = formatted;
}

function processData(rows) {
  const daysMap = {};

  rows.forEach(r => {
    if (!r.Aktivitet && !r.Tid) return;

    const day = rows[0].Dag || "Ukendt Dag";
    const tid = r.Tid || "—";
    const slut = r.Slut || "—";
    const aktivitet = r.Aktivitet || "Ukendt Aktivitet";
    const sted = r.Sted || "Ukendt Sted";
    const tilmelding = r.Tilmelding === "TRUE";
    const aflyst = r.Aflyst === "TRUE";

    if (!daysMap[day]) {
      daysMap[day] = [];
    }

    // Parse start og end time for status check
    const startTime = new Date(`1970-01-01T${tid}:00`);
    const endTime = new Date(`1970-01-01T${slut}:00`);

    daysMap[day].push({
      tid,
      slut,
      aktivitet,
      sted,
      tilmelding,
      aflyst,
      startTime,
      endTime
    });
  });

  return daysMap;
}

function renderActivities(data) {
  const container = $("activities");
  if (!container) return;

  container.innerHTML = "";

  Object.keys(data).forEach(day => {
    const section = document.createElement("div");
    section.className = "day-section";

    const title = document.createElement("h2");
    title.className = "day-title";
    title.textContent = day;
    section.appendChild(title);

    data[day].forEach(item => {
      const row = document.createElement("div");
      row.className = "activity-row";

      // Tid
      const timeDiv = document.createElement("div");
      timeDiv.className = "time";
      timeDiv.textContent = `${item.tid} - ${item.slut}`;
      row.appendChild(timeDiv);

      // Aktivitet og sted
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

      // Status i midten
      const statusDiv = document.createElement("div");
      statusDiv.className = "status";
      const nowTime = now();

      if (item.aflyst) {
        statusDiv.textContent = "Aflyst";
        statusDiv.classList.add("status-cancelled");
        row.classList.add("cancelled"); // Fade-out når aflyst
      } else if (nowTime > item.endTime) {
        statusDiv.textContent = "Afsluttet";
        statusDiv.classList.add("status-finished");
        row.classList.add("finished"); // Fade-out når afsluttet
      } else {
        statusDiv.textContent = `Tilmelding: ${item.tilmelding ? "Ja" : "Nej"}`;
        statusDiv.classList.add(item.tilmelding ? "status-yes" : "status-no");
      }

      row.appendChild(statusDiv);
      section.appendChild(row);
    });

    container.appendChild(section);
  });
}

async function fetchActivities() {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const processed = processData(data);
  renderActivities(processed);
}

function setStatus(text) {
  if ($("status")) $("status").innerText = text;
}

function showMessage(txt) {
  if ($("message")) $("message").innerText = txt || "";
}

// Start processen
updateDate();
fetchActivities();
setInterval(updateDate, 60 * 1000); // Opdater dato hvert minut
