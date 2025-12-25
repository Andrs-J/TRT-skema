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
    const day = r.Dag || "";

    if (!daysMap[day]) daysMap[day] = [];

    daysMap[day].push({
      tid: r.Tid,
      slut: r.Slut,
      aktivitet: r.Aktivitet,
      sted: r.Sted,
      tilmelding: r.Tilmelding === "TRUE" ? "✔️" : "❌",
      aflyst: r.Aflyst === "TRUE" ? "✔️" : "❌"
    });
  });

  Object.keys(daysMap).forEach(day => {
    daysMap[day].sort((a, b) => new Date(`1970-01-01T${a.tid}`) - new Date(`1970-01-01T${b.tid}`));
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

      const titleDiv = document.createElement("div");
      titleDiv.className = "title";
      titleDiv.textContent = item.aktivitet || "—";
      row.appendChild(titleDiv);

      const placeDiv = document.createElement("div");
      placeDiv.className = "place";
      placeDiv.textContent = item.sted || "";
      row.appendChild(placeDiv);

      const signupDiv = document.createElement("div");
      signupDiv.className = "signup";
      const tilmeldingIcon = document.createElement("span");
      tilmeldingIcon.className = "checkbox";
      tilmeldingIcon.textContent = item.tilmelding;
      signupDiv.appendChild(tilmeldingIcon);
      row.appendChild(signupDiv);

      const aflystDiv = document.createElement("div");
      aflystDiv.className = "cancelled";
      const aflystIcon = document.createElement("span");
      aflystIcon.className = "checkbox";
      aflystIcon.textContent = item.aflyst;
      aflystDiv.appendChild(aflystIcon);
      row.appendChild(aflystDiv);

      section.appendChild(row);
    });

    container.appendChild(section);
  });
}

async function fetchActivities() {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  renderActivities(processData(data));
}

updateDate();
fetchActivities();
