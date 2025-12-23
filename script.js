const SHEET_ID = "1XChIeVNQqWM4OyZ6oe8bh2M9e6H14bMkm7cpVfXIUN8";
const SHEET_NAME = "Sheet1"; // Ret hvis dit ark hedder noget andet
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

function fetchActivities() {
  fetch(url)
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("activities");
      table.innerHTML = "";

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      data.forEach(row => {
        if (!row.Tid) return;

        // Konverter tid fra Sheet til minutter
        const [hour, minute] = row.Tid.split(":").map(Number);
        const activityMinutes = hour * 60 + minute;

        // Spring aktiviteten over, hvis den allerede er startet/færdig
        if (activityMinutes < currentMinutes) return;

        // Tilmelding: Ja (Ring) = rød, Nej = grøn
        let displayText = "";
        let statusClass = "";

        if (row.Tilmelding && row.Tilmelding.toLowerCase() === "ja") {
          displayText = "Ja (Ring)";
          statusClass = "tilmelding-ja";
        } else if (row.Tilmelding && row.Tilmelding.toLowerCase() === "nej") {
          displayText = "Nej";
          statusClass = "tilmelding-nej";
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${row.Tid}</td>
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

// Opdater automatisk hvert 2. minut (120000 ms)
setInterval(fetchActivities, 120000);

// Ur
setInterval(() => {
  document.getElementById("clock").innerText =
    new Date().toLocaleTimeString("da-DK", {
      hour: "2-digit",
      minute: "2-digit"
    });
}, 1000);
