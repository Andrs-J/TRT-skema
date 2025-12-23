const SHEET_ID = "1XChIeVNQqWM4OyZ6oe8bh2M9e6H14bMkm7cpVfXIUN8";
const SHEET_NAME = "Sheet1"; // Ret hvis dit ark hedder noget andet
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

function fetchActivities() {
  fetch(url + '?cb=' + new Date().getTime())
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("activities");
      table.innerHTML = "";

      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      data.forEach(row => {
        if (!row.Tid || !row.Slut) return; // Tjek både start og slut

        // Konverter start og slut til minutter
        const [startHour, startMinute] = row.Tid.split(":").map(Number);
        const [endHour, endMinute] = row.Slut.split(":").map(Number);

        const startMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        // Vis kun aktiviteten, hvis vi er mellem start og slut
        if (currentMinutes < startMinutes || currentMinutes > endMinutes) return;

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
          <td>${row.Tid} - ${row.Slut}</td>
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

// Auto-refresh siden hvert 1. minut (60000 ms)
setInterval(() => {
  window.location.reload(true); // true tvinger hard reload i nogle browsere
}, 60000); // 1 minut

// Ur
setInterval(() => {
  document.getElementById("clock").innerText =
    new Date().toLocaleTimeString("da-DK", {
      hour: "2-digit",
      minute: "2-digit"
    });
}, 1000);
