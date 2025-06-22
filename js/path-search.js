/* path-search.js */
; (function () {
    console.log('[path-search.js] Loaded. URL:', window.location.href);

    // Cache for loaded schedule data
    const scheduleCache = {};

    // Fetch schedule JSON for a given line code (e.g., "line_1A")
    async function fetchSchedule(lineCode) {
        if (scheduleCache[lineCode]) return scheduleCache[lineCode];

        // Build an absolute URL to avoid relative-path issues
        const url = `${window.location.origin}/assets/schedules/${lineCode}.json`;
        console.log('[path-search.js] fetchSchedule for', lineCode, '->', url);

        try {
            const resp = await fetch(url);
            console.log('[path-search.js] Response for', lineCode, 'status:', resp.status);
            if (!resp.ok) return null;
            const data = await resp.json();
            scheduleCache[lineCode] = data;
            return data;
        } catch (err) {
            console.error('[path-search.js] fetch error for', lineCode, err);
            return null;
        }
    }

    // Parse time "HH:MM" into minutes since midnight
    function parseTime(t) {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    }

    // Format minutes since midnight back to "HH:MM"
    function formatTime(mins) {
        const h = String(Math.floor(mins / 60)).padStart(2, '0');
        const m = String(mins % 60).padStart(2, '0');
        return `${h}:${m}`;
    }

    // Load all schedules referenced on the page
    async function loadAllSchedules() {
        console.log('[path-search.js] loadAllSchedules()');
        const cards = document.querySelectorAll('.card');
        const promises = [];

        cards.forEach(card => {
            card.querySelectorAll('a').forEach(a => {
                const href = a.getAttribute('href') || '';
                const m = href.match(/line_(\d+)([A-Za-z])/i);
                if (m) {
                    const code = `line_${m[1]}${m[2].toUpperCase()}`;
                    console.log('[path-search.js] will fetch schedule for', code);
                    promises.push(fetchSchedule(code));
                }
            });
        });

        await Promise.all(promises);
        console.log('[path-search.js] All schedules loaded:', Object.keys(scheduleCache));
    }

    // Search routes between two stations (direct or one transfer)
    async function searchRoutes(startStation, endStation) {
        const startKey = startStation.trim().toLowerCase();
        const endKey = endStation.trim().toLowerCase();
        if (!startKey || !endKey) return [];

        await loadAllSchedules();
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const results = [];

        const schedules = Object.entries(scheduleCache);

        // Record helper
        function record(dep, arr, segments) {
            results.push({ dep, arr, segments });
        }

        // Direct routes
        for (const [code, sch] of schedules) {
            if (!sch || !Array.isArray(sch.stops)) continue;
            const names = sch.stops.map(s => s.name.toLowerCase());
            const sIdx = names.indexOf(startKey);
            const eIdx = names.indexOf(endKey);
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

        // One-transfer routes
        for (const [c1, sch1] of schedules) {
            if (!sch1 || !Array.isArray(sch1.stops)) continue;
            const names1 = sch1.stops.map(s => s.name.toLowerCase());
            const sIdx = names1.indexOf(startKey);
            if (sIdx === -1) continue;

            for (let t = sIdx + 1; t < names1.length; t++) {
                const transfer = names1[t];
                for (const [c2, sch2] of schedules) {
                    if (c1 === c2) continue;
                    if (!sch2 || !Array.isArray(sch2.stops)) continue;
                    const names2 = sch2.stops.map(s => s.name.toLowerCase());
                    const tIdx2 = names2.indexOf(transfer);
                    const eIdx2 = names2.indexOf(endKey);
                    if (tIdx2 === -1 || eIdx2 === -1 || tIdx2 >= eIdx2) continue;

                    for (let i = 0; i < sch1.services; i++) {
                        const dep1 = parseTime(sch1.stops[sIdx].times[i]);
                        if (dep1 < nowMin) continue;
                        const arr1 = parseTime(sch1.stops[t].times[i]);

                        for (let j = 0; j < sch2.services; j++) {
                            const dep2 = parseTime(sch2.stops[tIdx2].times[j]);
                            if (dep2 < arr1) continue;
                            const arr2 = parseTime(sch2.stops[eIdx2].times[j]);
                            record(dep1, arr2, [
                                { line: c1, from: sch1.stops[sIdx].name, to: sch1.stops[t].name },
                                { line: c2, from: sch2.stops[tIdx2].name, to: sch2.stops[eIdx2].name }
                            ]);
                            break;
                        }
                    }
                }
            }
        }

        results.sort((a, b) => a.dep - b.dep);
        return results.slice(0, 3).map(r => ({
            start: formatTime(r.dep),
            end: formatTime(r.arr),
            segments: r.segments
        }));
    }

    // UI hookup
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
                    `${seg.line}: ${seg.from} → ${seg.to}`
                ).join('<br>');
                return `<div class="border rounded p-2 mb-2"><strong>${r.start} - ${r.end}</strong><br>${segs}</div>`;
            }).join('');
        }

        startInput.addEventListener('input', update);
        endInput.addEventListener('input', update);
    });

})();
