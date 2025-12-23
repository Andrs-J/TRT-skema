const SHEET_ID = "1XChIeVNQqWM4OyZ6oe8bh2M9e6H14bMkm7cpVfXIUN8";
const SHEET_NAME = "Sheet1"; // Ret hvis dit ark hedder noget andet
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

// Hent og vis aktiviteter
function fetchActivities() {
  fetch(url + '?cb=' + new Date().getTime()) // Cache-buster
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("activities");
      table.innerHTML = "";

      const now = new Date();

      data.forEach(row => {
        if (!row.Tid || !row.Slut) return;

        // Trim for at fjerne utilsigtede mellemrum
        const startStr = row.Tid.trim();
        const endStr = row.Slut.trim();

        const [startHour, startMinute] = startStr.split(":").map(Number);
        const [endHour, endMinute] = endStr.split(":").map(Number);

        if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
          console.warn("Ugyldig tid:", row);
          return;
        }

        // Lav Date-objekter for start og slut i dag
        const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
        const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);

        // Tjek om aktiviteten er i gang
        if (now < startTime || now > endTime) return;

        // Tilmelding: Ja (Ring) = rød, Nej = grøn
        let displayText = "";
        let statusClass = "";

        if (row.Tilmelding && row.Tilmelding.toLowerCase().trim() === "ja") {
          displayText = "Ja (Ring)";
          statusClass = "tilmelding-ja";
        } else if (row.Tilmelding && row.Tilmelding.toLowerCase().trim() === "nej") {
          displayText = "Nej";
          statusClass = "tilmelding-nej";
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${startStr} - ${endStr}</td>
          <td>${row.Aktivitet}</td>
          <td>${row.Sted}</td>
          <td class="${statusClass}">${displayText}</td>
        `;
        table.appendChild(tr);
      });
    })
    .catch(err => console.error("Fejl ved hentning af aktiviteter:", err));
}

// Hent første gang når siden loader
fetchActivities();

// Opdater data hvert 2. minut
setInterval(fetchActivities, 120000);

// Auto-refresh hele siden hvert 10. minut (kan justeres eller fjernes)
setInterval(() => {
  window.location.reload(true); // Hård refresh
}, 600000); // 10 minutter

// Live-ur
setInterval(() => {
  document.getElementById("clock").innerText =
    new Date().toLocaleTimeString("da-DK", {
      hour: "2-digit",
      minute: "2-digit"
    });
}, 1000);
