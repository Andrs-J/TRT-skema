const SHEET_ID = "1XChIeVNQqWM4OyZ6oe8bh2M9e6H14bMkm7cpVfXIUN8";
const SHEET_NAME = "Sheet1"; // ret hvis dit ark hedder noget andet

const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    const table = document.getElementById("activities");
    table.innerHTML = "";

    data.forEach(row => {
      if (!row.Tid) return;

      const statusClass = row.Tilmelding
        ? "tilmelding-" + row.Tilmelding.toLowerCase()
        : "";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.Tid}</td>
        <td>${row.Aktivitet}</td>
        <td>${row.Sted}</td>
        <td class="${statusClass}">${row.Tilmelding || ""}</td>
      `;
      table.appendChild(tr);
    });
  });

// Ur
setInterval(() => {
  document.getElementById("clock").innerText =
    new Date().toLocaleTimeString("da-DK", {
      hour: "2-digit",
      minute: "2-digit"
    });
}, 1000);
