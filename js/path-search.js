// Path search logic for multi-line routes

// Cache for loaded schedule data
const scheduleCache = {};

// Fetch schedule JSON for a given line ("line_1A")
async function fetchSchedule(lineCode) {
    if (scheduleCache[lineCode]) return scheduleCache[lineCode];
    try {
        const resp = await fetch(`/assets/schedules/${lineCode}.json`);
        if (!resp.ok) return null;
        const data = await resp.json();
        scheduleCache[lineCode] = data;
        return data;
    } catch {
        return null;
    }
}

// Parse time "HH:MM" to minutes from midnight
function parseTime(t) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
}

// Format minutes from midnight back to "HH:MM"
function formatTime(mins) {
    const h = Math.floor(mins / 60).toString().padStart(2, "0");
    const m = (mins % 60).toString().padStart(2, "0");
    return `${h}:${m}`;
}

// Load all schedules referenced on the page (based on links in .card elements)
async function loadAllSchedules() {
    const cards = document.querySelectorAll('.card');
    const promises = [];
    cards.forEach(card => {
        card.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href') || '';
            const m = href.match(/line_(\d+[A-Za-z])/i);
            if (m) {
                const code = `line_${m[1].toUpperCase()}`;
                promises.push(fetchSchedule(code));
            }
        });
    });
    await Promise.all(promises);
}

// Find next three routes from start -> end (optionally with one transfer)
async function searchRoutes(startStation, endStation) {
    const startKey = startStation.trim().toLowerCase();
    const endKey = endStation.trim().toLowerCase();
    if (!startKey || !endKey) return [];

    // Ensure all schedules loaded
    await loadAllSchedules();

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const results = [];

    const schedules = Object.entries(scheduleCache);

    // Helper to record a found route
    function record(startTime, endTime, segments) {
        results.push({ startTime, endTime, segments });
    }

    // Search direct lines first
    for (const [code, sch] of schedules) {
        const stopsLower = sch.stops.map(s => s.name.toLowerCase());
        const sIdx = stopsLower.indexOf(startKey);
        const eIdx = stopsLower.indexOf(endKey);
        if (sIdx !== -1 && eIdx !== -1 && sIdx < eIdx) {
            for (let i = 0; i < sch.services; i++) {
                const dep = parseTime(sch.stops[sIdx].times[i]);
                if (dep >= nowMin) {
                    const arr = parseTime(sch.stops[eIdx].times[i]);
                    record(dep, arr, [{ line: code, from: sch.stops[sIdx].name, to: sch.stops[eIdx].name }]);
                }
            }
        }
    }

    // Search routes with one transfer
    for (const [code1, sch1] of schedules) {
        const stops1Lower = sch1.stops.map(s => s.name.toLowerCase());
        const sIdx = stops1Lower.indexOf(startKey);
        if (sIdx === -1) continue;

        // Explore each potential transfer stop on this line
        for (let tIdx = sIdx + 1; tIdx < stops1Lower.length; tIdx++) {
            const transferStopLower = stops1Lower[tIdx];
            for (const [code2, sch2] of schedules) {
                if (code1 === code2) continue;
                const stops2Lower = sch2.stops.map(s => s.name.toLowerCase());
                const tIdx2 = stops2Lower.indexOf(transferStopLower);
                const eIdx2 = stops2Lower.indexOf(endKey);
                if (tIdx2 === -1 || eIdx2 === -1 || tIdx2 >= eIdx2) continue;

                for (let i = 0; i < sch1.services; i++) {
                    const dep1 = parseTime(sch1.stops[sIdx].times[i]);
                    if (dep1 < nowMin) continue;
                    const arr1 = parseTime(sch1.stops[tIdx].times[i]);
                    for (let j = 0; j < sch2.services; j++) {
                        const dep2 = parseTime(sch2.stops[tIdx2].times[j]);
                        if (dep2 < arr1) continue;
                        const arr2 = parseTime(sch2.stops[eIdx2].times[j]);
                        record(dep1, arr2, [
                            { line: code1, from: sch1.stops[sIdx].name, to: sch1.stops[tIdx].name },
                            { line: code2, from: sch2.stops[tIdx2].name, to: sch2.stops[eIdx2].name }
                        ]);
                        break; // take earliest connection on line2 for this run
                    }
                }
            }
        }
    }

    results.sort((a, b) => a.startTime - b.startTime);
    return results.slice(0, 3).map(r => ({
        start: formatTime(r.startTime),
        end: formatTime(r.endTime),
        segments: r.segments
    }));
}

// Attach simple UI handlers on the index page
document.addEventListener('DOMContentLoaded', () => {
    const startInput = document.getElementById('route-start');
    const endInput = document.getElementById('route-end');
    const resultsDiv = document.getElementById('route-results');
    if (!startInput || !endInput || !resultsDiv) return;

    async function update() {
        const routes = await searchRoutes(startInput.value, endInput.value);
        if (!startInput.value.trim() || !endInput.value.trim()) {
            resultsDiv.innerHTML = '';
            return;
        }
        if (routes.length === 0) {
            resultsDiv.innerHTML = '<p class="text-danger">Nema dostupnih linija.</p>';
            return;
        }
        resultsDiv.innerHTML = routes.map(r => {
            const segs = r.segments.map(seg =>
                `${seg.line}: ${seg.from} &rarr; ${seg.to}`
            ).join('<br>');
            return `<div class="border rounded p-2 mb-2"><strong>${r.start} - ${r.end}</strong><br>${segs}</div>`;
        }).join('');
    }

    startInput.addEventListener('input', update);
    endInput.addEventListener('input', update);
});

// Example usage:
// searchRoutes('BIJELA ŠKOLA', 'TESLA').then(console.log);

