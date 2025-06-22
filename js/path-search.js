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
    async function searchRoutes(startStation, endStation, nowMinOverride) {
        const startKey = normalize(startStation.trim());
        const endKey = normalize(endStation.trim());
        if (!startKey || !endKey) return [];

        // Ensure schedules are loaded (redundant if preloaded, but safe)
        await loadAllSchedules();

        const now = new Date();
        const nowMin = typeof nowMinOverride === 'number'
            ? nowMinOverride
            : now.getHours() * 60 + now.getMinutes();
        const results = [];

        const schedules = Object.entries(scheduleCache);

        // Record helper
        function record(dep, arr, segments) {
            results.push({ dep, arr, segments });
        }

        // Direct routes
        // Collect direct route earliest arrival
        let bestDirectArrival = Infinity;
        for (const [code, sch] of schedules) {
            if (!sch || !Array.isArray(sch.stops)) continue;
            const names = sch.stops.map(s => normalize(s.name));
            const sIdx = names.indexOf(startKey);
            const eIdx = names.indexOf(endKey);
            if (sIdx !== -1 && eIdx !== -1 && sIdx < eIdx) {
                for (let i = 0; i < sch.services; i++) {
                    const depStr = sch.stops[sIdx].times[i];
                    const arrStr = sch.stops[eIdx].times[i];
                    if (depStr === '—' || arrStr === '—') continue; // <-- skip invalid
                    const dep = parseTime(depStr);
                    if (dep >= nowMin) {
                        const arr = parseTime(arrStr);
                        record(dep, arr, [{
                            line: code,
                            from: sch.stops[sIdx].name,
                            to: sch.stops[eIdx].name,
                            dep: depStr,
                            arr: arrStr
                        }]);
                        if (arr < bestDirectArrival) bestDirectArrival = arr;
                    }
                }
            }
        }

        // One-transfer routes
        for (const [c1, sch1] of schedules) {
            if (!sch1 || !Array.isArray(sch1.stops)) continue;
            const names1 = sch1.stops.map(s => normalize(s.name));
            const sIdx = names1.indexOf(startKey);
            if (sIdx === -1) continue;

            for (let t = sIdx + 1; t < names1.length; t++) {
                const transfer = names1[t];
                // Check if sch1 continues to the destination after transfer stop
                const eIdx1 = names1.indexOf(endKey);
                if (eIdx1 > t) continue; // Don't suggest transfer if direct route exists

                for (const [c2, sch2] of schedules) {
                    if (c1 === c2) continue;
                    if (!sch2 || !Array.isArray(sch2.stops)) continue;
                    // Prevent transfers between A/B of the same line number
                    if (getLineNumber(c1) === getLineNumber(c2)) continue;
                    const names2 = sch2.stops.map(s => normalize(s.name));
                    const tIdx2 = names2.indexOf(transfer);
                    const eIdx2 = names2.indexOf(endKey);
                    if (tIdx2 === -1 || eIdx2 === -1 || tIdx2 >= eIdx2) continue;

                    for (let i = 0; i < sch1.services; i++) {
                        const dep1Str = sch1.stops[sIdx].times[i];
                        const arr1Str = sch1.stops[t].times[i];
                        if (dep1Str === '—' || arr1Str === '—') continue;

                        for (let j = 0; j < sch2.services; j++) {
                            const dep2Str = sch2.stops[tIdx2].times[j];
                            const arr2Str = sch2.stops[eIdx2].times[j];
                            if (dep2Str === '—' || arr2Str === '—') continue;

                            const dep1 = parseTime(dep1Str);
                            if (dep1 < nowMin) continue;
                            const arr1 = parseTime(arr1Str);
                            const dep2 = parseTime(dep2Str);
                            const arr2 = parseTime(arr2Str);
                            if (arr2 >= bestDirectArrival) continue; // <-- Only keep if better than direct
                            record(dep1, arr2, [
                                {
                                    line: c1,
                                    from: sch1.stops[sIdx].name,
                                    to: sch1.stops[t].name,
                                    dep: sch1.stops[sIdx].times[i],
                                    arr: sch1.stops[t].times[i]
                                },
                                {
                                    line: c2,
                                    from: sch2.stops[tIdx2].name,
                                    to: sch2.stops[eIdx2].name,
                                    dep: sch2.stops[tIdx2].times[j],
                                    arr: sch2.stops[eIdx2].times[j]
                                }
                            ]);
                            break;
                        }
                    }
                }
            }
        }

        // Two-transfer routes (up to three segments)
        for (const [c1, sch1] of schedules) {
            if (!sch1 || !Array.isArray(sch1.stops)) continue;
            const names1 = sch1.stops.map(s => normalize(s.name));
            const sIdx = names1.indexOf(startKey);
            if (sIdx === -1) continue;

            for (let t1 = sIdx + 1; t1 < names1.length; t1++) {
                const transfer1 = names1[t1];
                const eIdx1 = names1.indexOf(endKey);
                if (eIdx1 > t1) continue; // Don't suggest transfer if direct route exists

                for (const [c2, sch2] of schedules) {
                    if (c1 === c2) continue;
                    if (!sch2 || !Array.isArray(sch2.stops)) continue;
                    if (getLineNumber(c1) === getLineNumber(c2)) continue;
                    const names2 = sch2.stops.map(s => normalize(s.name));
                    const t1Idx2 = names2.indexOf(transfer1);
                    if (t1Idx2 === -1) continue;

                    for (let t2 = t1Idx2 + 1; t2 < names2.length; t2++) {
                        const transfer2 = names2[t2];
                        const eIdx2 = names2.indexOf(endKey);
                        if (eIdx2 > t2) continue;

                        for (const [c3, sch3] of schedules) {
                            if (c3 === c2 || c3 === c1) continue;
                            if (!sch3 || !Array.isArray(sch3.stops)) continue;
                            if (getLineNumber(c3) === getLineNumber(c2) || getLineNumber(c3) === getLineNumber(c1)) continue;
                            const names3 = sch3.stops.map(s => normalize(s.name));
                            const t2Idx3 = names3.indexOf(transfer2);
                            const eIdx3 = names3.indexOf(endKey);
                            if (t2Idx3 === -1 || eIdx3 === -1 || t2Idx3 >= eIdx3) continue;

                            for (let i = 0; i < sch1.services; i++) {
                                const dep1 = parseTime(sch1.stops[sIdx].times[i]);
                                if (dep1 < nowMin) continue;
                                const arr1 = parseTime(sch1.stops[t1].times[i]);
                                for (let j = 0; j < sch2.services; j++) {
                                    const dep2 = parseTime(sch2.stops[t1Idx2].times[j]);
                                    if (dep2 < arr1) continue;
                                    const arr2 = parseTime(sch2.stops[t2].times[j]);
                                    for (let k = 0; k < sch3.services; k++) {
                                        const dep3 = parseTime(sch3.stops[t2Idx3].times[k]);
                                        if (dep3 < arr2) continue;
                                        const arr3 = parseTime(sch3.stops[eIdx3].times[k]);
                                        if (arr3 >= bestDirectArrival) continue;
                                        record(dep1, arr3, [
                                            {
                                                line: c1,
                                                from: sch1.stops[sIdx].name,
                                                to: sch1.stops[t1].name,
                                                dep: sch1.stops[sIdx].times[i],
                                                arr: sch1.stops[t1].times[i]
                                            },
                                            {
                                                line: c2,
                                                from: sch2.stops[t1Idx2].name,
                                                to: sch2.stops[t2].name,
                                                dep: sch2.stops[t1Idx2].times[j],
                                                arr: sch2.stops[t2].times[j]
                                            },
                                            {
                                                line: c3,
                                                from: sch3.stops[t2Idx3].name,
                                                to: sch3.stops[eIdx3].name,
                                                dep: sch3.stops[t2Idx3].times[k],
                                                arr: sch3.stops[eIdx3].times[k]
                                            }
                                        ]);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        results.sort((a, b) => a.dep - b.dep);
        return results.map(r => ({
            start: formatTime(r.dep),
            end: formatTime(r.arr),
            segments: r.segments
        }));
    }



    // UI hookup with disabled inputs until schedules load
    document.addEventListener('DOMContentLoaded', async () => {
        const startInput = document.getElementById('route-start');
        const endInput = document.getElementById('route-end');
        const resultsDiv = document.getElementById('route-results');
        const startSuggestions = document.getElementById('route-start-suggestions');
        const endSuggestions = document.getElementById('route-end-suggestions');
        if (!startInput || !endInput || !resultsDiv) return;

        startInput.disabled = true;
        endInput.disabled = true;

        await loadAllSchedules();
        await collectAllStations();

        setupAutocomplete(startInput, startSuggestions);
        setupAutocomplete(endInput, endSuggestions);

        startInput.disabled = false;
        endInput.disabled = false;

        function isValidStation(name) {
            return allStations.some(st => normalize(st) === normalize(name.trim()));
        }

        let prevStart = '', prevEnd = '';
        async function update() {
            if (startInput.value !== prevStart || endInput.value !== prevEnd) {
                resultsToShow = 3;
                prevStart = startInput.value;
                prevEnd = endInput.value;
            }
            if (!isValidStation(startInput.value) || !isValidStation(endInput.value)) {
                resultsDiv.innerHTML = '<p class="text-danger">Unesite ispravne stanice iz liste.</p>';
                return;
            }
            // Try today
            const now = new Date();
            const nowMin = now.getHours() * 60 + now.getMinutes();
            allRoutes = await searchRoutes(startInput.value, endInput.value, nowMin);

            // If not enough results, try tomorrow (from 00:00)
            if (allRoutes.length < resultsToShow) {
                const tomorrowMin = 0; // midnight
                const tomorrowRoutes = await searchRoutes(startInput.value, endInput.value, tomorrowMin);
                // Only add tomorrow's results that are not already in allRoutes
                const seen = new Set(allRoutes.map(r => r.start + '-' + r.end + '-' + r.segments.map(s => s.dep).join(',')));
                for (const r of tomorrowRoutes) {
                    const key = r.start + '-' + r.end + '-' + r.segments.map(s => s.dep).join(',');
                    if (!seen.has(key)) allRoutes.push(r);
                    if (allRoutes.length >= MAX_RESULTS) break;
                }
            }
            if (!startInput.value.trim() || !endInput.value.trim()) {
                resultsDiv.innerHTML = '';
                return;
            }
            if (allRoutes.length === 0) {
                resultsDiv.innerHTML = '<p class="text-danger">Nema dostupnih linija.</p>';
                return;
            }
            const routes = allRoutes.slice(0, resultsToShow);

            resultsDiv.innerHTML = routes.map(r => {
                const segs = r.segments.map((seg, idx, arr) => {
                    const sch = scheduleCache[seg.line];
                    const lineNum = sch?.line_number || seg.line.replace(/^line_/, '');
                    const lineName = sch?.name || '';
                    let serviceIdx = -1;
                    if (sch && sch.stops) {
                        const fromIdx = sch.stops.findIndex(s => s.name === seg.from);
                        if (fromIdx !== -1) {
                            serviceIdx = sch.stops[fromIdx].times.indexOf(seg.dep);
                        }
                    }
                    const isIrregular = sch?.irregular_services?.includes(serviceIdx + 1);
                    const irregularNote = isIrregular
                        ? `<div class="irregular-note">
                            <strong>Napomena:</strong> Polasci ove linije ne spadaju u regularni plan vožnje.<br>
                            <a href="linije/${seg.line}.html" target="_blank" class="irregular-link">Provjeri detaljnije plan</a>
                          </div>`
                        : '';
                    return `<div class="route-segment">
                        <div class="segment-time"><span>${seg.dep} - ${seg.arr}</span></div>
                        <div><strong>Linija ${lineNum} (${lineName})</strong>: ${seg.from} &rarr; ${seg.to}</div>
                        ${irregularNote}
                        ${idx < arr.length - 1 ? '<hr>' : ''}
                    </div>`;
                }).join('');
                return `<div class="route-result">
                    <span class="route-time">${r.start} - ${r.end}</span>
                    ${segs}
                </div>`;
            }).join('');

            const totalResults = allRoutes.length;
            if (resultsToShow < Math.min(totalResults, MAX_RESULTS)) {
                resultsDiv.innerHTML += `
                    <div class="d-grid mt-2">
                        <button id="show-more-btn" class="btn btn-outline-primary">Prikaži još</button>
                    </div>
                `;
                document.getElementById('show-more-btn').onclick = () => {
                    resultsToShow += 3;
                    update();
                };
            }
        }

        startInput.addEventListener('input', update);
        endInput.addEventListener('input', update);
        document.getElementById('swap-btn').onclick = function () {
            const start = document.getElementById('route-start');
            const end = document.getElementById('route-end');
            const tmp = start.value;
            start.value = end.value;
            end.value = tmp;
            update(); // Directly update results, do not trigger input events
        };
    });

    let allStations = [];

    async function collectAllStations() {
        const stationSet = new Set();
        for (const sch of Object.values(scheduleCache)) {
            if (sch && Array.isArray(sch.stops)) {
                sch.stops.forEach(stop => stationSet.add(stop.name));
            }
        }
        allStations = Array.from(stationSet).sort((a, b) => a.localeCompare(b, 'hr'));
    }

    function getLineNumber(code) {
        const m = code.match(/^line_(\d+)/i);
        return m ? m[1] : null;
    }

    function normalize(str) {
        return str
            .toLowerCase()
            .replace(/[čćc]/g, 'c')
            .replace(/[žz]/g, 'z')
            .replace(/[šs]/g, 's')
            .replace(/[đd]/g, 'd');
    }

    function setupAutocomplete(input, suggestionsDiv) {
        input.addEventListener('input', function () {
            const val = input.value.trim().toLowerCase();
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.classList.remove('active');
            if (!val) return;
            const matches = allStations.filter(st =>
                normalize(st).includes(normalize(val))
            ).slice(0, 10);
            if (matches.length) suggestionsDiv.classList.add('active');
            matches.forEach(st => {
                const div = document.createElement('div');
                div.textContent = st;
                div.onclick = () => {
                    input.value = st;
                    suggestionsDiv.innerHTML = '';
                    suggestionsDiv.classList.remove('active');
                    input.dispatchEvent(new Event('input'));
                };
                suggestionsDiv.appendChild(div);
            });
        });
        input.addEventListener('blur', () => setTimeout(() => {
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.classList.remove('active');
        }, 150));
    } function setupAutocomplete(input, suggestionsDiv) {
        input.addEventListener('input', function () {
            const val = input.value.trim().toLowerCase();
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.classList.remove('active');
            if (!val) return;
            const matches = allStations.filter(st =>
                normalize(st).includes(normalize(val))
            ).slice(0, 10);
            if (matches.length) suggestionsDiv.classList.add('active');
            matches.forEach(st => {
                const div = document.createElement('div');
                div.textContent = st;
                div.onclick = () => {
                    input.value = st;
                    suggestionsDiv.innerHTML = '';
                    suggestionsDiv.classList.remove('active');
                    input.dispatchEvent(new Event('input'));
                };
                suggestionsDiv.appendChild(div);
            });
        });
        input.addEventListener('blur', () => setTimeout(() => {
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.classList.remove('active');
        }, 150));
    }

    let resultsToShow = 3;
    const MAX_RESULTS = 30;
})();
