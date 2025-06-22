// schedule.js
; (function () {
  // 1) Load & parse the JSON, then hand off to displayScheduleData()
  async function loadScheduleData() {
    const pathParts = window.location.pathname.split("/");
    const htmlFile = pathParts[pathParts.length - 1];

    // only on your line_*.html pages
    if (!/^line_\w+\.html$/.test(htmlFile)) return;

    const baseName = htmlFile.replace(/\.html$/, "");
    const jsonFile = `../assets/schedules/${baseName}.json`;

    try {
      const resp = await fetch(jsonFile);
      if (!resp.ok) {
        throw new Error(`Schedule file not found (${resp.status})`);
      }
      const data = await resp.json();
      displayScheduleData(data);
    } catch (err) {
      console.error("Error loading schedule data:", err);
      const body = document.getElementById("schedule-body");
      if (body) {
        body.innerHTML =
          '<tr><td colspan="19" class="text-center text-danger">' +
          "Greška pri učitavanju podataka o redu vožnje." +
          "</td></tr>";
      }
    }
  }

  // 2) Render the table & headers
  function displayScheduleData(data) {
    // header info
    document.getElementById("route-title").textContent = data.name;
    document.getElementById("line-badge").textContent = `Linija: ${data.line_number}`;
    document.getElementById("regular-explanation").textContent = data.regular_explanation;
    document.getElementById("irregular-explanation").textContent = data.irregular_explanation;

    // service header row
    const svcHead = document.getElementById("service-header");
    for (let i = 1; i <= data.services; i++) {
      const th = document.createElement("th");
      th.className = "text-center small";
      th.textContent = i;
      th.classList.add(
        data.regular_services.includes(i) ? "regular-service" : "irregular-service"
      );
      svcHead.appendChild(th);
    }

    // route map
    generateRouteMap(data.stops);

    // schedule rows
    const tbody = document.getElementById("schedule-body");
    data.stops.forEach((stop, idx) => {
      const isEnd = idx === data.stops.length - 1;
      const tr = document.createElement("tr");
      if (isEnd) tr.classList.add("table-warning");

      // name cell
      const tdName = document.createElement("td");
      tdName.className = `sticky-col ${isEnd ? "table-warning" : ""}`;
      const nameHTML = stop.name.replace(
        /\*\*R\*\*/g,
        '<span class="station-r">R</span>'
      );
      tdName.innerHTML = (idx === 0 || isEnd)
        ? `<strong>${nameHTML}</strong>`
        : nameHTML;
      tr.appendChild(tdName);

      // time cells
      stop.times.forEach((time, ti) => {
        const td = document.createElement("td");
        td.className = "time-cell";
        td.textContent = time;
        td.classList.add(
          data.regular_services.includes(ti + 1)
            ? "regular-service"
            : "irregular-service"
        );
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

  // 3) Route-map mini-render
  function generateRouteMap(stops) {
    const container = document.getElementById("route-stations");
    container.innerHTML = "";

    stops.forEach((stop, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === stops.length - 1;

      const stationDiv = document.createElement("div");
      stationDiv.className = `station${isStart ? " start" : ""}${isEnd ? " end" : ""}`;

      const content = document.createElement("div");
      content.className = "station-content";

      const nameEl = document.createElement("div");
      nameEl.className = "station-name";
      nameEl.innerHTML = stop.name.replace(
        /\*\*R\*\*/g,
        '<span class="station-r">R</span>'
      );

      const dot = document.createElement("div");
      dot.className = "station-dot";

      content.append(nameEl, dot);
      stationDiv.appendChild(content);
      container.appendChild(stationDiv);
    });
  }

  // 4) Auto-invoke as soon as DOM is ready (even if other scripts already hooked DOMContentLoaded)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadScheduleData);
  } else {
    loadScheduleData();
  }
})();
