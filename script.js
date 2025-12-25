const SHEET_ID = "1_k26vVuaX1vmKN6-cY3-33YAn0jVAsgIM7vLm0YrMyE";
const SHEET_NAME = "Sheet1";
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

const $ = (id) => document.getElementById(id);
const now = () => new Date();
const setStatus = (text) => { if ($("status")) $("status").innerText = text; };
const showMessage = (txt) => { if ($("message")) $("message").innerText = txt || ""; };

// Opdater dag+dato i header med ønsket format
function updateDate(d = new Date()) {
  const formatted = d.toLocaleDateString("da-DK", {
    weekday: "long", day: "numeric", month: "long",
  });
  const customFormat = formatted.replace(" den ", " d. ").replace(/,\s?\d+$/, "");
  const el = $("currentDate");
  if (el) el.textContent = customFormat;
}

// Behandling af data fra sheets
function processData(rows) {
  const daysMap = {};

  rows.forEach(r => {
    const day = r.Dag || ""; // Dag, f.eks. Mandag, Tirsdag osv.

    if (!daysMap[day]) daysMap[day] = [];

    daysMap[day].push({
      tid: r.Tid,
      slut: r.Slut,
      aktivitet: r.Aktivitet,
      sted: r.Sted,

      // Fortolk checkbox-værdier
      tilmelding: r.Tilmelding === true ? "✔️" : "❌",
      aflyst: r.Aflyst === true ? "✔️" : "❌"
    });
  });

  // Sortér aktiviteter indenfor hver dag
  Object.keys(daysMap).forEach(day => {
    daysMap[day].sort((a, b) => new Date(`1970-01-01T${a.tid}`) - new Date(`1970-01-01T${b.tid}`));
  });

  return daysMap;
}

// Render aktiviteter som dag-opdelte sektioner
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

    data[day].forEach(item => {
      const row = document.createElement("div");
      row.className = "activity-row";

      // Tid
      const timeDiv = document.createElement("div");
      timeDiv.className = "time";
      timeDiv.textContent = `${item.tid} - ${item.slut}`;
      row.appendChild(timeDiv);

      // Aktivitet
      const titleDiv = document.createElement("div");
      titleDiv.className = "title";
      titleDiv.textContent = item.aktivitet || "—";
      row.appendChild(titleDiv);

      // Sted
      const placeDiv = document.createElement("div");
      placeDiv.className = "place";
      placeDiv.textContent = item.sted || "";
      row.appendChild(placeDiv);

      // Tilmelding
      const signupDiv = document.createElement("div");
      signupDiv.className = "signup";
      const tilmeldingIcon = document.createElement("span");
      tilmeldingIcon.className = "checkbox";
      tilmeldingIcon.textContent = item.tilmelding;
      signupDiv.appendChild(tilmeldingIcon);
      row.appendChild(signupDiv);

      // Aflyst
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

// Hent data fra Google Sheets og render aktiviteter
async function fetchActivities() {
  try {
    setStatus("Henter aktiviteter…");
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const processed = processData(data);
    renderActivities(processed);
  } catch (err) {
    console.error("Fejl ved hent:", err);
    setStatus("Offline / hent fejlede");
  }
}

// Initialisering
updateDate();
setInterval(updateDate, 60 * 1000); // Opdater dato hvert minut
fetchActivities();
setInterval(fetchActivities, 60 * 1000); // Hent aktiviteter hvert minut
