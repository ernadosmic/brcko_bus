// 1) Global cache
let cachedStations = null;

// 2) Fetch + parse all your JSON stops for each card
async function getLineStations() {
    // Find all cards and their line numbers
    const cards = document.querySelectorAll('.card');
    const lineStations = {};

    // Helper to fetch and parse JSON for one direction
    async function fetchStations(lineNum, suffix) {
        try {
            const resp = await fetch(`/assets/schedules/line_${lineNum}${suffix}.json`);
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!data.stops) return [];
            return data.stops.map(stop => stop.name).filter(Boolean);
        } catch {
            return [];
        }
    }

    // For each card, pull out its “A/B/C…” links and fetch each JSON
    for (const card of cards) {
        const header = card.querySelector('.card-header h4');
        if (!header) continue;
        const lineName = header.textContent.trim();

        // extract suffixes from the anchors on that card
        const matches = [...card.querySelectorAll('a')]
            .map(a => {
                const href = a.getAttribute('href');
                const m = href && href.match(/line_(\d+)([A-Za-z])\.html/);
                return m ? { num: m[1], suffix: m[2] } : null;
            })
            .filter(Boolean);

        // sequentially fetch each direction (could be parallelized if you like)
        let stations = [];
        for (const { num, suffix } of matches) {
            const stops = await fetchStations(num, suffix);
            stations = stations.concat(stops);
        }

        // dedupe and store
        lineStations[lineName] = [...new Set(stations)];
    }

    return lineStations;
}

// 3) Highlight the matching substring in a station name
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

// 4) Filter cards & show chips
function triggerFilter(query) {
    const foundStationsSet = new Set();

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

        stations.forEach(st => {
            if (st.toLowerCase().includes(query)) {
                foundStationsSet.add(st);
            }
        });
    });

    const foundStationsDiv = document.getElementById('found-stations');
    foundStationsDiv.innerHTML = '';

    if (query && foundStationsSet.size) {
        foundStationsDiv.innerHTML = [...foundStationsSet]
            .map(st =>
                `<span class="badge bg-warning text-dark me-2 mb-1 station-chip" style="cursor:pointer;">${highlightMatch(st, query)}</span>`
            )
            .join('');

        foundStationsDiv.querySelectorAll('.station-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const plainText = chip.textContent; // mark tags stripped by textContent
                document.getElementById('search-bar').value = plainText;
                triggerFilter(plainText.toLowerCase());
            });
        });
    }
}

// 5) NEW startup: wait for all JSON before enabling search
document.addEventListener('DOMContentLoaded', async () => {
    const searchBar = document.getElementById('search-bar');
    const foundStationsDiv = document.getElementById('found-stations');
    if (!searchBar || !foundStationsDiv) return;

    // lock it until data is ready
    searchBar.disabled = true;

    // fetch everything
    cachedStations = await getLineStations();
    console.log("✅ all stations in memory", cachedStations);

    // unlock & attach filter listener
    searchBar.disabled = false;
    searchBar.addEventListener('input', e =>
        triggerFilter(e.target.value.trim().toLowerCase())
    );
});
