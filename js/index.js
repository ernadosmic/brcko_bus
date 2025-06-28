// schedule.js
; (function () {
  async function loadScheduleData() {
    // 1) Grab the last segment of the path, e.g. "line_1A.html" or "line_1a"
    let htmlFile = window.location.pathname.split('/').pop() || '';
    // 2) Strip a trailing slash or .html if present
    htmlFile = htmlFile.replace(/\/$/, '').replace(/\.html$/i, '');

    // 3) Match "line_<number><letter>" (case-insensitive)
    const m = htmlFile.match(/^line_(\d+)([A-Za-z])$/i);
    if (!m) {
      // not on a line_*.html page
      return;
    }

    // 4) Reconstruct the proper JSON filename with uppercase suffix
    const num = m[1];
    const suffix = m[2].toUpperCase();        // FORCE "A","B",…
    const jsonName = `line_${num}${suffix}.json`;

    // 5) Absolute path from site root
    const jsonUrl = `${window.location.origin}/assets/schedules/${jsonName}`;
    console.log("[schedule.js] fetching:", jsonUrl);

    try {
      const resp = await fetch(jsonUrl);
      console.log("[schedule.js] status:", resp.status);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      displayScheduleData(data);
    } catch (err) {
      console.error("[schedule.js] load error:", err);
      const body = document.getElementById("schedule-body");
      if (body) {
        body.innerHTML =
          '<tr><td colspan="19" class="text-center text-danger">' +
          "Greška pri učitavanju podataka o redu vožnje." +
          "</td></tr>";
      }
    }
  }

  function displayScheduleData(data) {
    // — Header info —
    document.getElementById("route-title").textContent = data.name;
    document.getElementById("line-badge").textContent = `Linija: ${data.line_number}`;
    document.getElementById("regular-explanation").textContent = data.regular_explanation;
    document.getElementById("irregular-explanation").textContent = data.irregular_explanation;
    document.getElementById("weekday-explanation").textContent = data.weekday_explanation;

    // — Service header —
    const svcHead = document.getElementById("service-header");
    svcHead.innerHTML = "";
    for (let i = 1; i <= data.services; i++) {
      const th = document.createElement("th");
      th.className = "text-center small";
      th.textContent = i;
      th.classList.add(
        data.regular_services.includes(i)
          ? "regular-service"
          : data.irregular_services && data.irregular_services.includes(i)
            ? "irregular-service"
            : "weekday-service"
      );
      svcHead.appendChild(th);
    }

    // — Route map —
    generateRouteMap(data.stops);

    // — Schedule rows —
    const tbody = document.getElementById("schedule-body");
    tbody.innerHTML = "";
    data.stops.forEach((stop, idx) => {
      const isEnd = idx === data.stops.length - 1;
      const tr = document.createElement("tr");
      if (isEnd) tr.classList.add("table-warning");

      // Station name cell
      const tdName = document.createElement("td");
      tdName.className = `sticky-col${isEnd ? " table-warning" : ""}`;
      const nameHTML = stop.name.replace(
        /\(R\)/g,
        '<span class="station-r">R</span>'
      );
      tdName.innerHTML = (idx === 0 || isEnd)
        ? `<strong>${nameHTML}</strong>`
        : nameHTML;
      tr.appendChild(tdName);

      // Time cells
      stop.times.forEach((time, ti) => {
        const td = document.createElement("td");
        td.className = "time-cell";
        td.textContent = time;
        td.classList.add(
          data.regular_services.includes(ti + 1)
            ? "regular-service"
            : data.irregular_services && data.irregular_services.includes(ti + 1)
              ? "irregular-service"
              : "weekday-service"
        );
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });
  }

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
        /\(R\)/g,
        '<span class="station-r">R</span>'
      );

      const dot = document.createElement("div");
      dot.className = "station-dot";

      content.append(nameEl, dot);
      stationDiv.appendChild(content);
      container.appendChild(stationDiv);
    });
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadScheduleData);
  } else {
    loadScheduleData();
  }
})();
