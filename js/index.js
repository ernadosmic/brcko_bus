// Enhanced JavaScript to load and display the schedule
async function loadScheduleData() {
  try {
    const response = await fetch("../assets/schedules/line_8.json");
    const data = await response.json();

    displayScheduleData(data);
  } catch (error) {
    console.error("Error loading schedule data:", error);
    document.getElementById("schedule-body").innerHTML =
      '<tr><td colspan="19" class="text-center text-danger">Greška pri učitavanju podataka</td></tr>';
  }
}

function displayScheduleData(data) {
  // Update title and info
  document.getElementById("route-title").textContent = data.name;
  document.getElementById("line-badge").textContent =
    `Linija: ${data.line_number}`;
  document.getElementById("regular-explanation").textContent =
    data.regular_explanation;
  document.getElementById("irregular-explanation").textContent =
    data.irregular_explanation;

  // Generate service header
  const serviceHeader = document.getElementById("service-header");
  for (let i = 1; i <= data.services; i++) {
    const th = document.createElement("th");
    th.className = "text-center small";
    th.textContent = i;

    if (data.regular_services.includes(i)) {
      th.classList.add("regular-service");
    } else {
      th.classList.add("irregular-service");
    }

    serviceHeader.appendChild(th);
  }

  // Generate route map
  generateRouteMap(data.stops);

  // Generate schedule table
  const tableBody = document.getElementById("schedule-body");

  data.stops.forEach((stop, index) => {
    const row = document.createElement("tr");
    const isEndStation = index === data.stops.length - 1;

    if (isEndStation) {
      row.className = "table-warning";
    }

    // Station name cell
    const stationCell = document.createElement("td");
    stationCell.className = `sticky-col ${isEndStation ? "table-warning" : ""}`;

    // Process station name to handle **R** markers
    let stationName = stop.name.replace(
      /\*\*R\*\*/g,
      '<span class="station-r">R</span>',
    );

    if (index === 0 || isEndStation) {
      stationCell.innerHTML = `<strong>${stationName}</strong>`;
    } else {
      stationCell.innerHTML = stationName;
    }

    row.appendChild(stationCell);

    // Time cells
    stop.times.forEach((time, timeIndex) => {
      const timeCell = document.createElement("td");
      timeCell.classList.add("time-cell");
      timeCell.textContent = time;

      if (data.regular_services.includes(timeIndex + 1)) {
        timeCell.classList.add("regular-service");
      } else {
        timeCell.classList.add("irregular-service");
      }

      row.appendChild(timeCell);
    });

    tableBody.appendChild(row);
  });
}

function generateRouteMap(stops) {
  const routeStations = document.getElementById("route-stations");
  routeStations.innerHTML = "";

  stops.forEach((stop, index) => {
    const stationDiv = document.createElement("div");
    stationDiv.className = "station";

    if (index === 0) {
      stationDiv.classList.add("start");
    } else if (index === stops.length - 1) {
      stationDiv.classList.add("end");
    }

    const stationContent = document.createElement("div");
    stationContent.className = "station-content";

    const stationName = document.createElement("div");
    stationName.className = "station-name";
    // Clean up station name for route display and process **R** markers
    let cleanName = stop.name.replace(
      /\*\*R\*\*/g,
      '<span class="station-r">R</span>'
    );
    // Remove the truncation logic - show full names
    stationName.innerHTML = cleanName; // Changed from textContent to innerHTML

    const stationDot = document.createElement("div");
    stationDot.className = "station-dot";

    stationContent.appendChild(stationName);
    stationContent.appendChild(stationDot);
    stationDiv.appendChild(stationContent);
    routeStations.appendChild(stationDiv);
  });
}



// Load data when page loads
document.addEventListener("DOMContentLoaded", loadScheduleData);
