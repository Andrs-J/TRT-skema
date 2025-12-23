const SHEET_ID = "1XChIeVNQqWM4OyZ6oe8bh2M9e6H14bMkm7cpVfXIUN8";
const SHEET_NAME = "Sheet1"; // Ret hvis dit ark hedder noget andet
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}?raw=true`; // raw=true for korrekt data

// Hent og vis aktiviteter
async function fetchActivities() {
  try {
    const res = await fetch(url);
    const data = await res.json();

    // Debug: se hvad vi får fra fetch
    console.log("Data hentet:", data);

    const table = document.getElementById("activities");
    table.innerHTML = "";

    if (!Array.isArray(data)) {
      console.error("Data er ikke et array:", data);
      return;
    }

    const now = new Date();

    data.forEach(row => {
      if (!row.Tid || !row.Slut) return;

      const startStr = row.Tid.replace(/"/g, "").trim();
      const endStr = row.Slut.replace(/"/g, "").trim();

      const [startHour, startMinute] = startStr.split(":").map(Number);
      const [endHour, endMinute] = endStr.split(":").map(Number);

      const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
      const endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);

      // Vis kun aktiviteter, der endnu ikke er slut
      if (now > endTime) return;

      // Tilmelding-status
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
        <td>${row.Aktivitet.replace(/"/g, "")}</td>
        <td>${row.Sted.replace(/"/g, "")}</td>
        <td class="${statusClass}">${displayText}</td>
      `;
      table.appendChild(tr);
    });

  } catch (err) {
    console.error("Fejl ved hentning af aktiviteter:", err);
  }
}

// Første hentning når siden loader
fetchActivities();

// Opdater automatisk hvert 2. minut
setInterval(fetchActivities, 120000);

// Live-ur
setInterval(() => {
  document.getElementById("clock").innerText =
    new Date().toLocaleTimeString("da-DK", {
      hour: "2-digit",
      minute: "2-digit"
    });
}, 1000);
