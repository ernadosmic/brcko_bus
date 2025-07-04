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

  // Share/Download schedule as image function
  function setupDownloadButton() {
    const downloadBtn = document.getElementById('download-schedule-btn');
    const scheduleCard = document.querySelector('.schedule-card');

    if (!downloadBtn || !scheduleCard) return;

    downloadBtn.addEventListener('click', function () {
      showShareDownloadModal();
    });
  }

  // Show modal with share/download options
  function showShareDownloadModal() {
    const modalHtml = `
      <div class="modal fade" id="shareDownloadModal" tabindex="-1" aria-labelledby="shareDownloadModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title" id="shareDownloadModalLabel">Izaberite opciju</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body text-center">
              <p class="mb-4">Šta želite da uradite sa redom vožnje?</p>
              <div class="d-grid gap-2">
                <button type="button" class="btn btn-primary btn-lg" id="shareBtn">
                  <i class="fas fa-share-alt me-2"></i>Podijeli link
                </button>
                <button type="button" class="btn btn-success btn-lg" id="downloadBtn">
                  <i class="fas fa-download me-2"></i>Preuzmi sliku
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Remove existing modal if present
    const existingModal = document.getElementById('shareDownloadModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('shareDownloadModal'));
    modal.show();

    // Add event listeners
    document.getElementById('shareBtn').addEventListener('click', () => {
      modal.hide();
      shareScheduleLink();
    });

    document.getElementById('downloadBtn').addEventListener('click', () => {
      modal.hide();
      downloadScheduleImage();
    });

    // Clean up modal after it's hidden
    document.getElementById('shareDownloadModal').addEventListener('hidden.bs.modal', function () {
      this.remove();
    });
  }

  // Generate canvas from schedule card
  async function generateScheduleCanvas() {
    const scheduleCard = document.querySelector('.schedule-card');

    // Get the actual content dimensions
    const rect = scheduleCard.getBoundingClientRect();

    const options = {
      scale: 2, // Higher quality
      backgroundColor: '#ffffff',
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: rect.width, // Use actual rendered width
      height: rect.height, // Use actual rendered height
      scrollX: 0,
      scrollY: 0,
      windowWidth: rect.width,
      windowHeight: rect.height
    };

    return await html2canvas(scheduleCard, options);
  }

  // Share schedule link
  async function shareScheduleLink() {
    try {
      const lineNumber = document.getElementById('line-badge').textContent.replace('Linija: ', '');
      const routeName = document.getElementById('route-title').textContent;
      const currentUrl = window.location.href;

      if (navigator.share) {
        // Use Web Share API if available
        await navigator.share({
          title: `Red vožnje - Linija ${lineNumber}`,
          text: `Red vožnje za liniju ${lineNumber}: ${routeName}`,
          url: currentUrl
        });
      } else {
        // Fallback: copy URL to clipboard and show instructions
        try {
          await navigator.clipboard.writeText(currentUrl);
          alert(`Link je kopiran u clipboard!\n\nLinija ${lineNumber}: ${routeName}\n${currentUrl}\n\nMožete ga zalijepiti bilo gdje (Ctrl+V).`);
        } catch (clipboardError) {
          console.log('Clipboard not supported, showing URL');
          // If clipboard fails, show URL in a prompt
          prompt('Kopirajte ovaj link za dijeljenje:', currentUrl);
        }
      }
    } catch (error) {
      console.error('Error sharing link:', error);
      alert('Greška pri dijeljenju linka. Pokušajte ponovo.');
    }
  }

  // Download schedule image
  async function downloadScheduleImage() {
    try {
      const canvas = await generateScheduleCanvas();
      const lineNumber = document.getElementById('line-badge').textContent.replace('Linija: ', '');

      // Create download link
      const link = document.createElement('a');
      link.download = `red_voznje_linija_${lineNumber}.png`;
      link.href = canvas.toDataURL('image/png');

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error('Error downloading image:', error);
      alert('Greška pri preuzimanju slike. Pokušajte ponovo.');
    }
  }

  // Helper function to download from blob
  function downloadImageFromBlob(blob, lineNumber) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `red_voznje_linija_${lineNumber}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      loadScheduleData();
      setupDownloadButton();
    });
  } else {
    loadScheduleData();
    setupDownloadButton();
  }
})();
