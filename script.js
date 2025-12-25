const SHEET_ID = "1_k26vVuaX1vmKN6-cY3-33YAn0jVAsgIM7vLm0YrMyE";
const SHEET_NAME = "Sheet1";
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

const $ = (id) => document.getElementById(id);
const now = () => new Date();

// Opdater dag+dato i header med ønsket format
function updateDate(d = new Date()) {
  const formatted = d.toLocaleDateString("da-DK", {
    weekday: "long", day: "numeric", month: "long"
  });
  const el = $("currentDate");
  if (el) el.textContent = formatted;
}

// Behandling af data fra sheets baseret på din struktur
function processData(rows) {
  const daysMap = {};

  rows.forEach((r, index) => {
    if (!r.Aktivitet && !r.Tid) return; // Spring tomme rækker over

    const day = rows[0].Dag || "Ukendt Dag"; // Dagen er i cellen A1
    const tid = r.Tid || "—"; // Tid starter fra A3-A15
    const slut = r.Slut || "—"; // Slut starter fra B3-B15
    const aktivitet = r.Aktivitet || "Ukendt Aktivitet"; // Aktivitet starter fra C3-C15
    const sted = r.Sted || "Ukendt Sted"; // Sted starter fra D3-D15
    const tilmelding = r.Tilmelding === "TRUE" ? "✔️" : "❌"; // Flueben = TRUE
    const aflyst = r.Aflyst === "TRUE"; // Flueben = TRUE

    // Initialiser dagsgruppen
    if (!daysMap[day]) {
      daysMap[day] = [];
    }

    // Tilføj aktivitet til dagsgruppen
    daysMap[day].push({
      tid,
      slut,
      aktivitet,
      sted,
      tilmelding,
      aflyst
    });
  });

  return daysMap; // Returner grupperede aktiviteter
}

// Render aktiviteter som dag-inddelt liste
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
      titleDiv.textContent = item.aktivitet;
      row.appendChild(titleDiv);

      // Sted
      const placeDiv = document.createElement("div");
      placeDiv.className = "place";
      placeDiv.textContent = item.sted;
      row.appendChild(placeDiv);

      // Tilmelding
      const signupDiv = document.createElement("div");
      signupDiv.className = "signup";
      signupDiv.textContent = `Tilmelding: ${item.tilmelding}`;
      row.appendChild(signupDiv);

      // Hvis aflyst
      if (item.aflyst) {
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

// Hent data fra Google Sheets og processér det
async function fetchActivities() {
  setStatus("Henter aktiviteter...");
  showMessage("");

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json(); // Data fra Google Sheets som JSON
    const processed = processData(data); // Processér data baseret på ny struktur
    renderActivities(processed); // Render data på siden
    setStatus("Opdateret");
    if ($("lastUpdated")) $("lastUpdated").innerText = new Date().toLocaleString("da-DK");
  } catch (err) {
    console.error("Fejl ved hent:", err);
    setStatus("Kunne ikke hente data");
    showMessage("Kunne ikke hente aktiviteter.");
  }
}

// Vises statusmeddelelser
function setStatus(text) {
  if ($("status")) $("status").innerText = text;
}

function showMessage(txt) {
  if ($("message")) $("message").innerText = txt || "";
}

// Initialiser dato, og hent aktiviteter
updateDate();
fetchActivities();
setInterval(updateDate, 60 * 1000); // Opdater dato hvert minut
