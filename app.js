// -------------------- ELEMENTS --------------------
const splash = document.getElementById("splash-screen");
const fab = document.getElementById("fab");
const inputOverlay = document.getElementById("inputOverlay");
const inputMenu = document.getElementById("inputMenu");
const saveBtn = document.getElementById("saveBtn");
const cancelBtn = document.getElementById("cancelBtn");
const inputValue = document.getElementById("inputValue");
const RPEValue = document.getElementById("RPE");
const clearAll = document.getElementById("clearAll");

const measurementPage = document.getElementById("measurementPage");
const graphPage = document.getElementById("graphPage");
const historyPage = document.getElementById("historyPage");
const tileContainer = document.getElementById("tileContainer");
const historyContainer = document.getElementById("historyContainer");

const navGraph = document.getElementById("navGraph");
const navMeasure = document.getElementById("navMeasure");
const navHistory = document.getElementById("navHistory");

let glucoseChart = null;

// -------------------- SPLASH --------------------
setTimeout(() => {
  if (splash) {
    splash.style.opacity = 0;
    setTimeout(() => {
      if (splash && splash.parentNode) splash.parentNode.removeChild(splash);
    }, 800);
  }
}, 2000);

// -------------------- STORAGE HELPERS --------------------
function getTodayKey() {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
}

function getDataObject() {
  // Ensure we always return an object
  try {
    const raw = localStorage.getItem("peaklogData");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    // If it's an array or other type, reset to empty object
    return {};
  } catch (e) {
    console.warn("Corrupt peaklogData in localStorage, resetting.", e);
    return {};
  }
}

function saveDataObject(obj) {
  localStorage.setItem("peaklogData", JSON.stringify(obj));
}

// Ensure today's array exists and is an array
function ensureTodayArray() {
  const data = getDataObject();
  const today = getTodayKey();
  if (!Array.isArray(data[today])) {
    data[today] = [];
    saveDataObject(data);
  }
  return data;
}

// -------------------- ADD ENTRY --------------------
function saveEntry() {
  const valueRaw = (inputValue && inputValue.value || "").trim();
  const rpeRaw = (RPEValue && RPEValue.value || "").trim();

  if (!valueRaw || !rpeRaw) {
    alert("Please enter both Value and RPE!");
    return;
  }

  let value = parseFloat(valueRaw);
  const RPE = parseFloat(rpeRaw);

  if (isNaN(value) || isNaN(RPE)) {
    alert("Invalid numbers entered.");
    return;
  }

  // Convert glucose mg/dL → mmol/L (user enters mg/dL)
  value = (value / 18);
  // Round to 2 decimals
  value = Math.round(value * 100) / 100;

  const entry = {
    value,
    RPE,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  };

  const data = getDataObject();
  const today = getTodayKey();

  if (!Array.isArray(data[today])) data[today] = [];
  data[today].push(entry);
  saveDataObject(data);

  // Clear inputs & close popup
  if (inputValue) inputValue.value = "";
  if (RPEValue) RPEValue.value = "";
  if (inputOverlay) inputOverlay.classList.add("hidden");

  // Refresh UI
  loadTiles();
  updateGraph();
  loadHistory();
}

// -------------------- LOAD TILES (today) --------------------
function loadTiles() {
  const data = getDataObject();
  const today = getTodayKey();
  const arr = Array.isArray(data[today]) ? data[today] : [];

  tileContainer.innerHTML = "";
  if (arr.length === 0) {
    tileContainer.innerHTML = "<p style='color:#777;'>No entries yet today.</p>";
    return;
  }

  // Render newest first, but compute correct original index for deletion
  for (let revIndex = arr.length - 1; revIndex >= 0; revIndex--) {
    const entry = arr[revIndex];
    const originalIndex = revIndex; // index within arr
    const displayIndex = arr.length - 1 - revIndex; // position in reversed order (not used)

    const tile = document.createElement("div");
    tile.className = "tile " + getGlucoseColor(entry.value);
    tile.innerHTML = `
      <div class="tile-content">
        <div><strong>${entry.value}</strong> mmol/L</div>
        <div>RPE: ${entry.RPE}</div>
        <div class="time">${entry.time}</div>
      </div>
      <button class="tile-delete" data-idx="${originalIndex}">X</button>
    `;
    tileContainer.appendChild(tile);
  }

  // Attach event listeners for deletes (use delegation-friendly fresh bindings)
  tileContainer.querySelectorAll(".tile-delete").forEach(btn => {
    btn.removeEventListener("click", onTileDelete);
    btn.addEventListener("click", onTileDelete);
  });
}

function onTileDelete(e) {
  const idx = parseInt(e.currentTarget.getAttribute("data-idx"), 10);
  if (Number.isNaN(idx)) return;
  const data = getDataObject();
  const today = getTodayKey();
  if (!Array.isArray(data[today])) return;
  // remove item at idx
  data[today].splice(idx, 1);
  saveDataObject(data);
  loadTiles();
  updateGraph();
  loadHistory();
}

// -------------------- DELETE ALL --------------------
if (clearAll) {
  clearAll.addEventListener("click", () => {
    if (confirm("Delete ALL data?")) {
      localStorage.removeItem("peaklogData");
      loadTiles();
      updateGraph();
      loadHistory();
    }
  });
}

// -------------------- GRAPH --------------------
function updateGraph() {
  const data = getDataObject();
  const today = getTodayKey();
  const arr = Array.isArray(data[today]) ? data[today] : [];

  const labels = arr.map(e => e.time);
  const values = arr.map(e => e.value);

  const ctx = document.getElementById("glucoseChart");
  if (!ctx) return;

  if (glucoseChart) {
    try { glucoseChart.destroy(); } catch (e) { /* ignore */ }
  }

  glucoseChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Glucose (mmol/L)",
        data: values,
        borderColor: "#ff3d00",
        backgroundColor: "rgba(255,61,0,0.12)",
        tension: 0.3,
        pointRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { color: "#fff" } }
      },
      scales: {
        x: { ticks: { color: "#ccc" }, grid: { color: "#222" } },
        y: { ticks: { color: "#ccc" }, grid: { color: "#222" }, beginAtZero: false }
      }
    }
  });
}

// -------------------- HISTORY --------------------
function loadHistory() {
  const data = getDataObject();
  const today = getTodayKey();
  const dates = Object.keys(data).sort().reverse();

  historyContainer.innerHTML = "";
  if (dates.length === 0) {
    historyContainer.innerHTML = "<p style='color:#777;'>No history yet.</p>";
    return;
  }

  dates.forEach(date => {
    if (date === today) return; // skip today
    const entries = Array.isArray(data[date]) ? data[date] : [];
    if (entries.length === 0) return;

    const block = document.createElement("div");
    block.className = "history-day";
    block.innerHTML = `<h3>${date}</h3>`;

    entries.forEach(en => {
      const row = document.createElement("div");
      row.className = "history-entry";
      row.textContent = `${en.value} mmol/L | RPE: ${en.RPE} | ${en.time}`;
      block.appendChild(row);
    });

    historyContainer.appendChild(block);
  });
}

// -------------------- COLOR LOGIC --------------------
function getGlucoseColor(value) {
  if (value < 3.5) return "low";
  if (value < 4.5) return "warning";
  if (value <= 6.5) return "good";
  if (value <= 8) return "warning";
  return "high";
}

// -------------------- NAVIGATION --------------------
function setActivePage(name) {
  // nav classes
  [navGraph, navMeasure, navHistory].forEach(btn => btn.classList.remove("active"));
  // pages
  [graphPage, measurementPage, historyPage].forEach(pg => pg.classList.remove("active"));

  if (name === "measure") {
    navMeasure.classList.add("active");
    measurementPage.classList.add("active");
    loadTiles();
  } else if (name === "graph") {
    navGraph.classList.add("active");
    graphPage.classList.add("active");
    updateGraph();
  } else if (name === "history") {
    navHistory.classList.add("active");
    historyPage.classList.add("active");
    loadHistory();
  }
}

navMeasure && navMeasure.addEventListener("click", () => setActivePage("measure"));
navGraph && navGraph.addEventListener("click", () => setActivePage("graph"));
navHistory && navHistory.addEventListener("click", () => setActivePage("history"));

// -------------------- POPUP MENU --------------------
fab && fab.addEventListener("click", () => {
  inputOverlay && inputOverlay.classList.remove("hidden");
  inputValue && inputValue.focus();
});

cancelBtn && cancelBtn.addEventListener("click", () => {
  inputOverlay && inputOverlay.classList.add("hidden");
});

saveBtn && saveBtn.addEventListener("click", saveEntry);

// -------------------- INIT --------------------
window.addEventListener("load", () => {
  // ensure today's array exists (defensive)
  const data = getDataObject();
  const today = getTodayKey();
  if (!Array.isArray(data[today])) data[today] = [];
  saveDataObject(data);

  loadTiles();
  updateGraph();
  loadHistory();
});
