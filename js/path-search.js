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
    async function searchRoutes(startStation, endStation, nowMinOverride, dayOffset = 0) {
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
                    if (!depStr || depStr === '—' || depStr === '' || !arrStr || arrStr === '—' || arrStr === '') continue; // skip invalid
                    const dep = parseTime(depStr);
                    if (dep >= nowMin) {
                        const arr = parseTime(arrStr);
                        if (arr - dep > 5 * 60) continue;
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
                        if (!dep1Str || dep1Str === '—' || dep1Str === '' || !arr1Str || arr1Str === '—' || arr1Str === '') continue;

                        for (let j = 0; j < sch2.services; j++) {
                            const dep2Str = sch2.stops[tIdx2].times[j];
                            const arr2Str = sch2.stops[eIdx2].times[j];
                            if (!dep2Str || dep2Str === '—' || dep2Str === '' || !arr2Str || arr2Str === '—' || arr2Str === '') continue;
                            const dep1 = parseTime(dep1Str);
                            if (dep1 < nowMin) continue;
                            const arr1 = parseTime(arr1Str);
                            const dep2 = parseTime(dep2Str);
                            if (dep2 < arr1) continue; // Transfer 
                            const arr2 = parseTime(arr2Str);
                            if (arr2 >= bestDirectArrival) continue; // <-- Only keep if better than direct
                            if (arr2 - dep1 > 5 * 60) continue; // Skip if travel time > 5 hours
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
                                const dep1Str = sch1.stops[sIdx].times[i];
                                const arr1Str = sch1.stops[t1].times[i];
                                if (!dep1Str || dep1Str === '—' || dep1Str === '' || !arr1Str || arr1Str === '—' || arr1Str === '') continue;
                                const dep1 = parseTime(dep1Str);
                                if (dep1 < nowMin) continue;
                                const arr1 = parseTime(arr1Str);

                                for (let j = 0; j < sch2.services; j++) {
                                    const dep2Str = sch2.stops[t1Idx2].times[j];
                                    const arr2Str = sch2.stops[t2].times[j];
                                    if (!dep2Str || dep2Str === '—' || dep2Str === '' || !arr2Str || arr2Str === '—' || arr2Str === '') continue;
                                    const dep2 = parseTime(dep2Str);
                                    if (dep2 < arr1) continue; // Transfer bus must depart after arrival
                                    const arr2 = parseTime(arr2Str);

                                    for (let k = 0; k < sch3.services; k++) {
                                        const dep3Str = sch3.stops[t2Idx3].times[k];
                                        const arr3Str = sch3.stops[eIdx3].times[k];
                                        if (!dep3Str || dep3Str === '—' || dep3Str === '' || !arr3Str || arr3Str === '—' || arr3Str === '') continue;
                                        const dep3 = parseTime(dep3Str);
                                        if (dep3 < arr2) continue;
                                        const arr3 = parseTime(arr3Str);
                                        if (arr3 >= bestDirectArrival) continue;
                                        if (arr3 - dep1 > 5 * 60) continue; // Skip if travel time > 5 hours
                                        record(dep1, arr3, [
                                            {
                                                line: c1,
                                                from: sch1.stops[sIdx].name,
                                                to: sch1.stops[t1].name,
                                                dep: dep1Str,
                                                arr: arr1Str
                                            },
                                            {
                                                line: c2,
                                                from: sch2.stops[t1Idx2].name,
                                                to: sch2.stops[t2].name,
                                                dep: dep2Str,
                                                arr: arr2Str
                                            },
                                            {
                                                line: c3,
                                                from: sch3.stops[t2Idx3].name,
                                                to: sch3.stops[eIdx3].name,
                                                dep: dep3Str,
                                                arr: arr3Str
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
            segments: r.segments,
            dayOffset // <-- add this
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

        const multiTransferToggle = document.getElementById('multi-transfer-toggle');
        if (multiTransferToggle) {
            multiTransferToggle.addEventListener('change', update);
        }

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
            const today = new Date();
            const todayStr = today.toISOString().slice(0, 10);

            allRoutes = (await searchRoutes(startInput.value, endInput.value, nowMin, 0)) || [];

            if (allRoutes.length < MAX_RESULTS) {
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                const tomorrowRoutes = await searchRoutes(startInput.value, endInput.value, 0, 1);
                // Only add tomorrow's results that are not already in allRoutes
                const seen = new Set(allRoutes.map(r => r.start + '-' + r.end + '-' + r.segments.map(s => s.dep).join(',') + '-' + r.dayOffset));
                for (const r of tomorrowRoutes) {
                    const key = r.start + '-' + r.end + '-' + r.segments.map(s => s.dep).join(',') + '-' + r.dayOffset;
                    if (!seen.has(key)) allRoutes.push(r);
                    if (allRoutes.length >= MAX_RESULTS) break;
                }
            }
            if (allRoutes.length < MAX_RESULTS) {
                const prekosutra = new Date(today);
                prekosutra.setDate(today.getDate() + 2);
                const prekosutraRoutes = await searchRoutes(startInput.value, endInput.value, 0, 2);
                // Only add prekosutra's results that are not already in allRoutes
                const seen2 = new Set(allRoutes.map(r => r.start + '-' + r.end + '-' + r.segments.map(s => s.dep).join(',') + '-' + r.dayOffset));
                for (const r of prekosutraRoutes) {
                    const key = r.start + '-' + r.end + '-' + r.segments.map(s => s.dep).join(',') + '-' + r.dayOffset;
                    if (!seen2.has(key)) allRoutes.push(r);
                    if (allRoutes.length >= MAX_RESULTS) break;
                }
            }

            if (!document.getElementById('multi-transfer-toggle')?.checked) {
                allRoutes = allRoutes.filter(r => r.segments.length <= 2);
            }

            if (!startInput.value.trim() || !endInput.value.trim()) {
                resultsDiv.innerHTML = '';
                return;
            }
            if (allRoutes.length === 0) {
                resultsDiv.innerHTML = '<p class="text-danger">Nema dostupnih linija.</p>';
                return;
            }

            // Group routes by start, end, and dayOffset
            function groupRoutes(routes) {
                const groups = {};
                routes.forEach(r => {
                    // Only group two-segment (one transfer) routes
                    if (r.segments.length === 2) {
                        const seg0 = r.segments[0];
                        // Group by the first leg of the journey to find all possible transfers from that one bus ride
                        const key = `${seg0.line}|${seg0.dep}|${seg0.from}|${r.dayOffset}`;
                        if (!groups[key]) {
                            groups[key] = {
                                ...r, // Use the first route found as a template
                                transferOptions: []
                            };
                        }
                        // Store the second leg, including the arrival time at the transfer stop and the overall end time for this specific path
                        groups[key].transferOptions.push({
                            ...r.segments[1],
                            transferArr: seg0.arr,
                            originalEnd: r.end
                        });
                    } else {
                        // For direct or multi-transfer, keep as is
                        const key = Math.random().toString(36).slice(2); // unique
                        groups[key] = r;
                    }
                });

                // Post-process the grouped transfers to remove illogical options
                for (const key in groups) {
                    const group = groups[key];
                    if (!group.transferOptions || group.transferOptions.length <= 1) {
                        continue; // Nothing to process
                    }

                    const sch0 = scheduleCache[group.segments[0].line];
                    if (!sch0 || !sch0.stops) {
                        continue; // Schedule not found, can't sort
                    }

                    const stopNames0 = sch0.stops.map(s => s.name);

                    // Sort transfer options chronologically by their arrival time on the first line
                    group.transferOptions.sort((a, b) => {
                        return parseTime(a.transferArr) - parseTime(b.transferArr);
                    });

                    // Find the first transfer point that is a short walk from the destination
                    let walkableTransferIndex = -1;
                    for (let i = 0; i < group.transferOptions.length; i++) {
                        const opt = group.transferOptions[i];
                        const travelTime = parseTime(opt.arr) - parseTime(opt.dep);
                        if (travelTime === 1 || travelTime === 2) {
                            walkableTransferIndex = i;
                            break; // Found the first walkable transfer, this is our logical cutoff
                        }
                    }

                    // If a walkable transfer was found, prune all subsequent (less logical) options
                    if (walkableTransferIndex !== -1) {
                        group.transferOptions = group.transferOptions.slice(0, walkableTransferIndex + 1);
                    }

                    // After pruning, find the earliest arrival time among the remaining valid options
                    // and set it as the main 'end' time for the entire grouped route.
                    if (group.transferOptions.length > 0) {
                        const bestEndTimeInMinutes = group.transferOptions.reduce((bestTime, currentOpt) => {
                            // Time if taking the bus transfer
                            const busArrivalTime = parseTime(currentOpt.originalEnd);

                            // Time if walking from the transfer stop
                            const travelTime = parseTime(currentOpt.arr) - parseTime(currentOpt.dep);
                            let walkingArrivalTime = Infinity;
                            if (travelTime === 1) {
                                walkingArrivalTime = parseTime(currentOpt.transferArr) + 4; // 4 min walk
                            } else if (travelTime === 2) {
                                walkingArrivalTime = parseTime(currentOpt.transferArr) + 6; // 6 min walk
                            }

                            // The best time for this specific option is the minimum of walking or taking the bus
                            const bestTimeForThisOption = Math.min(busArrivalTime, walkingArrivalTime);

                            // Compare with the overall best time found so far
                            return Math.min(bestTime, bestTimeForThisOption);
                        }, parseTime(group.transferOptions[0].originalEnd)); // Initial best time

                        group.end = formatTime(bestEndTimeInMinutes);
                    }
                }

                return Object.values(groups);
            }

            const allGroupedRoutes = groupRoutes(allRoutes);
            const routesToDisplay = allGroupedRoutes.slice(0, resultsToShow);

            resultsDiv.innerHTML = routesToDisplay.map(r => {
                const dayLabel = getDayLabel(r.dayOffset);

                if (r.transferOptions && r.transferOptions.length) {
                    const seg0 = r.segments[0];
                    const sch0 = scheduleCache[seg0.line];
                    const lineNum0 = sch0?.line_number || seg0.line.replace(/^line_/, '');
                    const lineName0 = sch0?.name || '';
                    const dayLabelHtml = `<span class="route-time">${seg0.dep} - ${r.end}<sup>${dayLabel}</sup></span>`;

                    // Main line: show start time and all transfer stops with arrival times
                    let main = `
                        <div class="route-segment">
        ${dayLabelHtml}
        <div><strong>Linija ${lineNum0} (${lineName0})</strong>: <span class="transfer-time">(${seg0.dep})</span> ${seg0.from} &rarr;</div>
        <div class="mt-2">
            ${r.transferOptions.map(seg1 => {
                        const travelTime = parseTime(seg1.arr) - parseTime(seg1.dep);
                        let walkingHtml = '';
                        if (travelTime === 1) {
                            walkingHtml = ` + <i class="fa-duotone fa-solid fa-person-walking"></i> <span class="transfer-time">(4 min)</span> &rarr; ${seg1.to}<hr>`;
                        } else if (travelTime === 2) {
                            walkingHtml = ` + <i class="fa-duotone fa-solid fa-person-walking"></i> <span class="transfer-time">(6 min)</span> &rarr; ${seg1.to}<hr>`;
                        }
                        return `→ <span class="transfer-time">(${seg1.transferArr})</span> ${seg1.from}${walkingHtml}`;
                    }).join('<br>')}
        </div>
                    `;

                    // Transfer line: show all transfer options with both times
                    const sch1 = scheduleCache[r.transferOptions[0].line];
                    const lineNum1 = sch1?.line_number || r.transferOptions[0].line.replace(/^line_/, '');
                    const lineName1 = sch1?.name || '';
                    main += `
                        <div class="mt-2"><strong>Stanice presjedanja Linija ${lineNum1} (${lineName1}):</strong></div>
    <div>
        ${r.transferOptions.map(seg1 =>
                        `<span class="transfer-time">(${seg1.dep})</span> ${seg1.from} → <span class="transfer-time">(${seg1.arr})</span> ${seg1.to}`
                    ).join('<br>')}
    </div>
    </div>
                    `;
                    return `<div class="route-result">${main}</div>`;
                }

                // Otherwise, render as before
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
                    const isRegular = sch?.regular_services?.includes(serviceIdx + 1);
                    const isWeekday = sch?.weekday_services?.includes(serviceIdx + 1);
                    const isIrregular = sch?.irregular_services?.includes(serviceIdx + 1);

                    let serviceNote = '';
                    if (isWeekday) {
                        serviceNote = `<div class="weekday-note">
                            <strong>Napomena:</strong> Polasci ove linije u ovom terminu saobraćaju samo radnim danima.<br>
                            <a href="linije/${seg.line}.html" target="_blank" class="weekday-link">Provjeri detaljnije plan</a>
                          </div>`;
                    } else if (isIrregular) {
                        serviceNote = `<div class="weekday-note">
                            <strong>Napomena:</strong> Polasci ove linije u ovom terminu ne saobraćaju subotom, nedeljom, praznicima i radnim danom za vrijeme školskog raspusta.<br>
                            <a href="linije/${seg.line}.html" target="_blank" class="weekday-link">Provjeri detaljnije plan</a>
                          </div>`;
                    }

                    const travelTime = parseTime(seg.arr) - parseTime(seg.dep);
                    let segmentHtml;

                    // Always define the standard "as-is" route display
                    const originalSegmentHtml = `<div><strong>Linija ${lineNum} (${lineName})</strong>: <span class="transfer-time">(${seg.dep})</span> ${seg.from} &rarr; <span class="transfer-time">(${seg.arr})</span> ${seg.to}</div>`;

                    if (idx === arr.length - 1 && (travelTime === 1 || travelTime === 2)) {
                        // If it's a short final leg, create the walking suggestion
                        const walkingTime = travelTime === 1 ? 4 : 6; // 1 minute = 4 minutes walking, 2 minutes = 5 minutes walking
                        const walkingPart = ` + <i class="fa-duotone fa-solid fa-person-walking"></i> <span class="transfer-time">(${walkingTime} min)</span> &rarr; ${seg.to}`;
                        const walkingSuggestionHtml = `<div>${seg.from}${walkingPart}</div>`;
                        // Combine the suggestion and the original, separated by a line
                        segmentHtml = `${walkingSuggestionHtml}<hr class="my-1">${originalSegmentHtml}`;
                    } else {
                        // Otherwise, just use the standard display
                        segmentHtml = originalSegmentHtml;
                    }

                    return `<div class="route-segment">
                        ${segmentHtml}
                        ${serviceNote}
                        ${idx < arr.length - 1 ? '<hr>' : ''}
                    </div>`;
                }).join('');
                return `<div class="route-result">
                    <span class="route-time">${r.start} - ${r.end} <sup>${dayLabel}</sup></span>
                    ${segs}
                </div>`;
            }).join('');

            const totalGroupedResults = allGroupedRoutes.length;
            if (resultsToShow < Math.min(totalGroupedResults, MAX_RESULTS)) {
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

        const searchBtn = document.getElementById('route-search-btn');
        const loadingBar = document.getElementById('route-loading');

        function showLoading() {
            if (loadingBar) loadingBar.style.display = '';
        }

        function hideLoading() {
            if (loadingBar) loadingBar.style.display = 'none';
        }

        function triggerSearch() {
            showLoading();
            update().finally(hideLoading);
        }

        searchBtn?.addEventListener('click', triggerSearch);
        [startInput, endInput].forEach(inp =>
            inp.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    triggerSearch();
                }
            })
        );

       document.getElementById('swap-btn').onclick = function () {
           const start = document.getElementById('route-start');
           const end = document.getElementById('route-end');
           const tmp = start.value;
           start.value = end.value;
            end.value = tmp;
            triggerSearch(); // Update results after swap
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

    // Station suggestion autocomplete inputs

    function setupAutocomplete(input, suggestionsDiv) {
        let isClickingOnSuggestion = false;

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
                div.addEventListener('mousedown', () => {
                    isClickingOnSuggestion = true;
                });
                div.onclick = () => {
                    input.value = st;
                    suggestionsDiv.innerHTML = '';
                    suggestionsDiv.classList.remove('active');
                    isClickingOnSuggestion = false;
                    input.focus(); // Keep focus on input
                };
                suggestionsDiv.appendChild(div);
            });
        });

        // Use focusout instead of blur and check if we're clicking on suggestion
        input.addEventListener('focusout', () => {
            // Only hide suggestions if we're not clicking on one
            if (!isClickingOnSuggestion) {
                setTimeout(() => {
                    suggestionsDiv.innerHTML = '';
                    suggestionsDiv.classList.remove('active');
                }, 150);
            }
        });

        // Reset flag when clicking outside
        document.addEventListener('click', (e) => {
            if (!suggestionsDiv.contains(e.target) && e.target !== input) {
                isClickingOnSuggestion = false;
                suggestionsDiv.innerHTML = '';
                suggestionsDiv.classList.remove('active');
            }
        });
    }

    let resultsToShow = 3;
    const MAX_RESULTS = 60;

    function getDayLabel(dayOffset) {
        const d = new Date();
        d.setDate(d.getDate() + (dayOffset || 0));
        const dateStr = d.toLocaleDateString('sr-Latn-BA', { day: '2-digit', month: '2-digit', year: 'numeric' });
        if (dayOffset === 0) return ` danas (${dateStr})`;
        if (dayOffset === 1) return ` sutra (${dateStr})`;
        if (dayOffset === 2) return ` prekosutra (${dateStr})`;
        return '';
    }
})();
