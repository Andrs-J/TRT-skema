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
    if (!r.Aktivitet && !r.Tid) return; // Spring tomme rækker over

    const day = rows[0].Dag || "Ukendt Dag"; // Dagen er i cellen A1
    const tid = r.Tid || "—"; // Tid starter fra A3-A15
    const slut = r.Slut || "—"; // Slut starter fra B3-B15
    const aktivitet = r.Aktivitet || "Ukendt Aktivitet"; // Aktivitet starter fra C3-C15
    const sted = r.Sted || "Ukendt Sted"; // Sted starter fra D3-D15
    const tilmelding = r.Tilmelding === "TRUE"; // Flueben = TRUE
    const aflyst = r.Aflyst === "TRUE"; // Flueben = TRUE

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

  return daysMap; // Returner grupperede aktiviteter
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
      titleDiv.textContent = item.aktivitet;
      row.appendChild(titleDiv);

      const placeDiv = document.createElement("div");
      placeDiv.className = "place";
      placeDiv.textContent = item.sted;
      row.appendChild(placeDiv);

      const signupDiv = document.createElement("div");
      signupDiv.className = "signup";
      if (item.tilmelding) {
        signupDiv.innerHTML = '<span class="signup-yes">JA</span>'; // Rød for JA
      } else {
        signupDiv.innerHTML = '<span class="signup-no">NEJ</span>'; // Grøn for NEJ
      }
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
