// 1) Global cache
let cachedStations = null;

// 2) Fetch + parse all your JSON stops for each card
async function getLineStations() {
    const cards = document.querySelectorAll('.card');
    const lineStations = {};

    // Helper to fetch one JSON and return its stop-names
    async function fetchStations(lineNum, suffix) {
        // force uppercase so we always hit "line_1A.json" not "line_1a.json"
        suffix = suffix.toUpperCase();

        try {
            const resp = await fetch(`/assets/schedules/line_${lineNum}${suffix}.json`);
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

        // try to extract suffixes from the <a> links
        let matches = [...card.querySelectorAll('a')]
            .map(a => {
                const href = a.getAttribute('href') || '';
                const m = href.match(/line_(\d+)([A-Za-z])\.html/i);
                return m
                    ? { num: m[1], suffix: m[2].toUpperCase() }
                    : null;
            })
            .filter(Boolean);

        // FALLBACK: if we found no links, assume a single-direction "A"
        if (matches.length === 0) {
            // try to pull the number out of your header text
            const nm = lineName.match(/\d+/);
            if (nm) matches.push({ num: nm[0], suffix: 'A' });
        }

        // now fetch *all* directions in parallel
        const batch = await Promise.all(
            matches.map(({ num, suffix }) => fetchStations(num, suffix))
        );

        // flatten + dedupe
        lineStations[lineName] = Array.from(
            new Set(batch.flat())
        );
    }

    return lineStations;
}

// 3) Highlight helper (unchanged)
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

// 4) Filter + chips (unchanged)
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
            if (s.toLowerCase().includes(query)) chips.add(s);
        });
    });

    const out = document.getElementById('found-stations');
    out.innerHTML = '';

    if (query && chips.size) {
        // remove indentation in the template & join
        out.innerHTML = [...chips]
            .map(s =>
                `<span class="badge bg-warning text-dark me-2 mb-1 station-chip" style="cursor:pointer;">` +
                `${highlightMatch(s, query)}` +
                `</span>`
            )
            .join('');

        // on click, trim() the text so there’s no leading/trailing spaces
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

// 5) New async startup — only hook up search *after* our JSON is in memory
document.addEventListener('DOMContentLoaded', async () => {
    const searchBar = document.getElementById('search-bar');
    const foundStationsDiv = document.getElementById('found-stations');
    if (!searchBar || !foundStationsDiv) return;

    // 1) Block the input while we fetch
    searchBar.disabled = true;

    // 2) Fetch everything (with the fixes above)
    cachedStations = await getLineStations();
    console.log('✅ all stations in memory', cachedStations);

    // 3) Re-enable + attach search
    searchBar.disabled = false;
    searchBar.addEventListener('input', e =>
        triggerFilter(e.target.value.trim().toLowerCase())
    );
});
