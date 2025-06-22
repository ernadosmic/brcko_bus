// 1) Global cache
let cachedStations = null;

// 2) Fetch + parse all your JSON stops for each card
async function getLineStations() {
    const cards = document.querySelectorAll('.card');
    const lineStations = {};

    async function fetchStations(lineNum, suffix) {
        suffix = suffix.toUpperCase();
        try {
            const base = document.body.dataset.pathPrefix || '';
            const resp = await fetch(`${base}assets/schedules/line_${lineNum}${suffix}.json`);
            if (!resp.ok) return [];
            const data = await resp.json();
            if (!Array.isArray(data.stops)) return [];
            return data.stops.map(s => s.name).filter(Boolean);
        } catch {
            return [];
        }
    }

    for (const card of cards) {
        const header = card.querySelector('.card-header h4');
        if (!header) continue;
        const lineName = header.textContent.trim();

        let matches = [...card.querySelectorAll('a')].map(a => {
            const href = a.getAttribute('href') || '';
            const m = href.match(/line_(\d+)([A-Za-z])\.html/i);
            return m ? { num: m[1], suffix: m[2].toUpperCase() } : null;
        }).filter(Boolean);

        if (matches.length === 0) {
            const nm = lineName.match(/\d+/);
            if (nm) matches.push({ num: nm[0], suffix: 'A' });
        }

        const batch = await Promise.all(
            matches.map(({ num, suffix }) => fetchStations(num, suffix))
        );

        lineStations[lineName] = Array.from(new Set(batch.flat()));
    }

    return lineStations;
}

// 3) Highlight helper
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

// 4) Filter + chips, with (R) → (R)
function triggerFilter(query) {
    const chips = new Set();

    document.querySelectorAll('.card').forEach(card => {
        const header = card.querySelector('.card-header h4');
        if (!header) return;
        const lineName = header.textContent.trim();

        if (!query) {
            card.style.display = '';
            return;
        }

        const stations = cachedStations[lineName] || [];
        const match = stations.some(s => s.toLowerCase().includes(query));
        card.style.display = match ? '' : 'none';

        stations.forEach(s => {
            if (s.toLowerCase().includes(query)) {
                chips.add(s);
            }
        });
    });

    const out = document.getElementById('found-stations');
    out.innerHTML = '';

    if (query && chips.size) {
        out.innerHTML = [...chips].map(s => {
            // Replace any literal (R) with (R)
            const displayName = s.replace(/\*\*R\*\*/g, '(R)');
            // Then highlight the query substring
            return '<span class="badge bg-warning text-dark me-2 mb-1 station-chip" style="cursor:pointer;">'
                + highlightMatch(displayName, query)
                + '</span>';
        }).join('');

        // On click, trim whitespace and re-filter
        out.querySelectorAll('.station-chip').forEach(chip =>
            chip.addEventListener('click', () => {
                const txt = chip.textContent.trim();
                const searchBar = document.getElementById('search-bar');
                searchBar.value = txt;
                triggerFilter(txt.toLowerCase());
            })
        );
    }
}

// 5) Startup: only attach search after we have all stations
document.addEventListener('DOMContentLoaded', async () => {
    const searchBar = document.getElementById('search-bar');
    const foundStationsDiv = document.getElementById('found-stations');
    if (!searchBar || !foundStationsDiv) return;

    searchBar.disabled = true;
    cachedStations = await getLineStations();
    console.log('✅ all stations in memory', cachedStations);

    searchBar.disabled = false;
    searchBar.addEventListener('input', e =>
        triggerFilter(e.target.value.trim().toLowerCase())
    );
});
