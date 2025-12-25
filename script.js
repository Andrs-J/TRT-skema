const SHEET_ID = "1_k26vVuaX1vmKN6-cY3-33YAn0jVAsgIM7vLm0YrMyE";
const SHEET_NAME = "Uge 1";
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

const $ = (id) => document.getElementById(id);
const formatTime = (d) => d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
const now = () => new Date();

// Opdater dag+dato i header
function updateDate() {
  const d = new Date();
  const formatted = d.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" });
  const el = $("currentDate");
  if (el) el.textContent = formatted;
}

// HENT + PROCESS DATA
async function fetchActivities() {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  renderActivities(processData(data));
}

function processData(rows) {
  const activitiesByDay = {};

  rows.forEach(r => {
    const day = r.Dag || ""; // Google Sheets kolonne for 'Dag'
    if (!activitiesByDay[day]) activitiesByDay[day] = [];

    const startParsed = parseHM(r["Tid"]);
    const endParsed = parseHM(r["Slut"]);
    if (!startParsed || !endParsed) return;

    activitiesByDay[day].push({
      aktivitet: r["Aktivitet"] || "Ukendt aktivitet",
      sted: r["Sted"] || "Ukendt sted",
      tid: `${formatTime(new Date(0, 0, 0, startParsed.hh, startParsed.mm))} - ${formatTime(new Date(0, 0, 0, endParsed.hh, endParsed.mm))}`,
      tilmelding: r["Tilmelding"] === "TRUE" ? "✔️" : "❌",
      aflyst: r["Aflyst"] === "TRUE"
    });
  });

  return activitiesByDay;
}

function parseHM(str) {
  if (!str) return null;
  const [hh, mm] = str.split(":").map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;
  return { hh, mm };
}

// Render / vis aktiviteter
function renderActivities(data) {
  const container = $("activities");
  if (!container) return;

  container.innerHTML = ""; // Ryd tidligere indhold

  Object.keys(data).forEach(day => {
    const section = document.createElement("div");
    section.className = "day-section";

    const title = document.createElement("h2");
    title.className = "day-title";
    title.textContent = day;
    section.appendChild(title);

    data[day].forEach(activity => {
      const row = document.createElement("div");
      row.className = "activity-row";

      const timeDiv = document.createElement("div");
      timeDiv.className = "time";
      timeDiv.textContent = activity.tid;
      row.appendChild(timeDiv);

      const titleDiv = document.createElement("div");
      titleDiv.className = "title";
      titleDiv.textContent = activity.aktivitet;
      row.appendChild(titleDiv);

      const placeDiv = document.createElement("div");
      placeDiv.className = "place";
      placeDiv.textContent = activity.sted;
      row.appendChild(placeDiv);

      const signupDiv = document.createElement("div");
      signupDiv.className = "signup";
      signupDiv.textContent = `Tilmelding: ${activity.tilmelding}`;
      row.appendChild(signupDiv);

      if (activity.aflyst) {
        const cancelledDiv = document.createElement("div");
        cancelledDiv.className = "cancelled-label";
        cancelledDiv.textContent = "Aflyst";
        row.classList.add("cancelled");
        row.appendChild(cancelledDiv);
      }

      section.appendChild(row);
    });

    container.appendChild(section);
  });
}

// STARTUP
updateDate();
fetchActivities();
