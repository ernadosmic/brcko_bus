async function getLineStations() {
    // Find all cards and their line numbers
    const cards = document.querySelectorAll('.card');
    const lineStations = {};

    // Helper to fetch and parse JSON
    async function fetchStations(lineNum, suffix) {
        try {
            const resp = await fetch(`/assets/schedules/line_${lineNum}${suffix}.json`);
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!data.stops) return [];
            // Collect all unique station names for this direction
            return data.stops.map(stop => stop.name).filter(Boolean);
        } catch {
            return [];
        }
    }

    // For each card, get the line number and fetch both directions
    for (const card of cards) {
        const header = card.querySelector('.card-header h4');
        if (!header) continue;
        const lineName = header.textContent.trim();
        // Extract line number and possible suffixes (A, B, C, D, etc.)
        const matches = [...card.querySelectorAll('a')].map(a => {
            const href = a.getAttribute('href');
            const m = href && href.match(/line_(\d+)([A-Za-z])\.html/);
            return m ? { num: m[1], suffix: m[2] } : null;
        }).filter(Boolean);

        // Fetch all directions for this line
        let stations = [];
        for (const m of matches) {
            const stops = await fetchStations(m.num, m.suffix);
            stations = stations.concat(stops);
        }
        // Remove duplicates
        lineStations[lineName] = [...new Set(stations)];
    }
    return lineStations;
}

document.addEventListener('DOMContentLoaded', () => {
    let cachedStations = null;
    const searchBar = document.getElementById('search-bar');
    const foundStationsDiv = document.getElementById('found-stations');
    if (!searchBar || !foundStationsDiv) return;

    getLineStations().then(lineStations => {
        cachedStations = lineStations;
    });

    function triggerFilter(query) {
        let foundStationsSet = new Set();

        document.querySelectorAll('.card').forEach(card => {
            const header = card.querySelector('.card-header h4');
            if (!header) return;
            const lineName = header.textContent.trim();
            if (!query) {
                card.style.display = '';
                return;
            }
            const stations = (cachedStations && cachedStations[lineName]) || [];
            const match = stations.some(st => st.toLowerCase().includes(query));
            card.style.display = match ? '' : 'none';

            // Collect matching stations for chips
            stations.forEach(st => {
                if (st.toLowerCase().includes(query)) foundStationsSet.add(st);
            });
        });

        // Show chips for found stations
        foundStationsDiv.innerHTML = '';
        if (query && foundStationsSet.size > 0) {
            foundStationsDiv.innerHTML = [...foundStationsSet].map(st =>
                `<span class="badge bg-warning text-dark me-2 mb-1 station-chip" style="cursor:pointer;">${highlightMatch(st, query)}</span>`
            ).join('');
            // Add click listeners to chips
            foundStationsDiv.querySelectorAll('.station-chip').forEach(chip => {
                chip.addEventListener('click', function () {
                    // Remove <mark> tags to get the plain station name
                    const plainText = chip.textContent;
                    searchBar.value = plainText;
                    triggerFilter(plainText.toLowerCase());
                });
            });
        }
    }

    searchBar.addEventListener('input', function (e) {
        triggerFilter(e.target.value.trim().toLowerCase());
    });

    // Helper to highlight the matched part
    function highlightMatch(station, query) {
        const idx = station.toLowerCase().indexOf(query);
        if (idx === -1) return station;
        const end = idx + query.length;
        return (
            station.substring(0, idx) +
            '<mark>' + station.substring(idx, end) + '</mark>' +
            station.substring(end)
        );
    }
});