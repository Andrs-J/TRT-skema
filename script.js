function renderActivities(list) {
  const container = $("activities");
  if (!container) return;

  container.innerHTML = "";

  const nowTime = now();

  list.forEach(item => {
    const row = document.createElement("div");
    row.className = "activity-row";

    // Tid
    const timeDiv = document.createElement("div");
    timeDiv.className = "time";
    timeDiv.textContent = `${formatTime(item.start)} - ${formatTime(item.end)}`;
    row.appendChild(timeDiv);

    // Aktivitet + sted
    const activityDiv = document.createElement("div");
    activityDiv.className = "activity-info";
    const titleDiv = document.createElement("div");
    titleDiv.className = "title";
    titleDiv.textContent = item.aktivitet;
    const placeDiv = document.createElement("div");
    placeDiv.className = "place";
    placeDiv.textContent = item.sted;
    activityDiv.appendChild(titleDiv);
    activityDiv.appendChild(placeDiv);
    row.appendChild(activityDiv);

    // Status i midten
    const statusDiv = document.createElement("div");
    statusDiv.className = "status";

    if (nowTime > item.end) {
      // Aktiviteten er afsluttet
      statusDiv.textContent = "Afsluttet";
      row.classList.add("finished"); // Fade-out for afsluttet aktivitet
    } else {
      // Tilmelding status vises
      statusDiv.textContent = `Tilmelding: ${item.tilmelding === "TRUE" ? "Ja" : "Nej"}`;
      statusDiv.classList.add(item.tilmelding === "TRUE" ? "status-yes" : "status-no");
    }

    row.appendChild(statusDiv);
    container.appendChild(row);
  });
}
