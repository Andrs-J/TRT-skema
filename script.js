// script.js - Opdaterer datoformatet under titlen og viser tiden.

const SHEET_ID = "1_k26vVuaX1vmKN6-cY3-33YAn0jVAsgIM7vLm0YrMyE";
const SHEET_NAME = "Sheet1";
const url = `https://opensheet.elk.sh/${SHEET_ID}/${SHEET_NAME}`;

const $ = (id) => document.getElementById(id);
const formatTime = (d) => d.toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
const now = () => new Date();

// Opdater dato i det ønskede format (f.eks. "Torsdag d. 25. december 2025")
function updateDate() {
  const d = new Date();
  const formatted = d.toLocaleDateString("da-DK", {
    weekday: "long", 
    day: "numeric", 
    month: "long", 
    year: "numeric"
  });

  // Tilføj "d." foran dagen
  const finalFormatted = formatted.replace(" ", " d. ");

  // Vis formateret dato i day-date
  const el = $("day-date");
  if (el) el.textContent = finalFormatted;
}

// Opdater ur
function updateClock() {
  const el = $("clock");
  if (el) el.textContent = formatTime(new Date());
}

// STARTUP: Initier opdatering af dato og ur
updateDate();
updateClock();
setInterval(updateClock, 1000); // Opdaterer ur hver sekund
