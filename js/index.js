; (function () {
  console.log("[schedule.js] 🔥 script loaded, location:", window.location.href);

  async function loadScheduleData() {
    const htmlFile = window.location.pathname.split("/").pop();
    console.log("[schedule.js] htmlFile:", htmlFile);

    if (!/^line_\w+\.html$/i.test(htmlFile)) {
      console.log("[schedule.js] not a line_*.html page, exiting.");
      return;
    }

    const baseName = htmlFile.replace(/\.html$/i, "");
    // use window.location.origin to guarantee the correct domain + protocol
    const jsonFile = `${window.location.origin}/assets/schedules/${baseName}.json`;
    console.log("[schedule.js] will fetch:", jsonFile);

    try {
      const resp = await fetch(jsonFile);
      console.log("[schedule.js] fetch status:", resp.status);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      console.log("[schedule.js] got JSON:", data);
      displayScheduleData(data);
    } catch (err) {
      console.error("[schedule.js] error loading schedule:", err);
      const body = document.getElementById("schedule-body");
      if (body) {
        body.innerHTML =
          '<tr><td colspan="19" class="text-center text-danger">' +
          "Greška pri učitavanju podataka o redu vožnje." +
          "</td></tr>";
      }
    }
  }

  // 2) Build the table & headers
  function displayScheduleData(data) {
    // — Header info —
    document.getElementById("route-title").textContent = data.name;
    document.getElementById("line-badge").textContent = `Linija: ${data.line_number}`;
    document.getElementById("regular-explanation").textContent = data.regular_explanation;
    document.getElementById("irregular-explanation").textContent = data.irregular_explanation;

    // — Service numbers row —
    const svcHead = document.getElementById("service-header");
    svcHead.innerHTML = "";  // clear old
    for (let i = 1; i <= data.services; i++) {
      const th = document.createElement("th");
      th.className = "text-center small";
      th.textContent = i;
      th.classList.add(
        data.regular_services.includes(i) ? "regular-service" : "irregular-service"
      );
      svcHead.appendChild(th);
    }

    // — Route map —
    generateRouteMap(data.stops);

    // — Schedule rows —
    const tbody = document.getElementById("schedule-body");
    tbody.innerHTML = "";  // clear old
    data.stops.forEach((stop, idx) => {
      const isEnd = idx === data.stops.length - 1;
      const tr = document.createElement("tr");
      if (isEnd) tr.classList.add("table-warning");

      // station name
      const tdName = document.createElement("td");
      tdName.className = `sticky-col${isEnd ? " table-warning" : ""}`;
      const nameHTML = stop.name.replace(
        /\*\*R\*\*/g,
        '<span class="station-r">R</span>'
      );
      tdName.innerHTML = (idx === 0 || isEnd)
        ? `<strong>${nameHTML}</strong>`
        : nameHTML;
      tr.appendChild(tdName);

      // times
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

  // 3) Mini route‐map under the headers
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

  // 4) Hook it up
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadScheduleData);
  } else {
    loadScheduleData();
  }
})();
