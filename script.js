const SHEET_ID = "1_k26vVuaX1vmKN6-cY3-33YAn0jVAsgIM7vLm0YrMyE";
const SHEET_NAME = "Sheet1";
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

  rows.forEach((r, index) => {
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

    daysMap[day].push({
      tid,
      slut,
      aktivitet,
      sted,
      tilmelding,
      aflyst
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

      const timeDiv = document.createElement("div");
      timeDiv.className = "time";
      timeDiv.textContent = `${item.tid} - ${item.slut}`;
      row.appendChild(timeDiv);

      const activityDiv = document.createElement("div");
      activityDiv.className = "activity-place";
      const titleDiv = document.createElement("div");
      titleDiv.className = "title";
      titleDiv.textContent = item.aktivitet;
      const placeDiv = document.createElement("div");
      placeDiv.className = "place";
      placeDiv.textContent = item.sted;
      activityDiv.appendChild(titleDiv);
      activityDiv.appendChild(placeDiv);
      row.appendChild(activityDiv);

      const signupDiv = document.createElement("div");
      signupDiv.className = "signup";
      signupDiv.textContent = `Tilmelding: ${item.tilmelding ? "Ja" : "Nej"}`;
      signupDiv.classList.add(item.tilmelding ? "signup-yes" : "signup-no");
      row.appendChild(signupDiv);

      if (item.aflyst) {
        const cancelledDiv = document.createElement("div");
        cancelledDiv.className = "cancelled";
        cancelledDiv.textContent = "Aflyst";
        row.classList.add("cancelled");
        row.appendChild(cancelledDiv);
      }

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

updateDate();
fetchActivities();
setInterval(updateDate, 60 * 1000);
