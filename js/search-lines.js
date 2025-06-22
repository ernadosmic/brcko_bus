document.addEventListener('DOMContentLoaded', async () => {
    const searchBar = document.getElementById('search-bar');
    const foundStationsDiv = document.getElementById('found-stations');

    // 1) disable the input until we're ready
    searchBar.disabled = true;

    // 2) load everything (in parallel) before even letting the user type
    cachedStations = await (async function getLineStations() {
        const cards = [...document.querySelectorAll('.card')];
        const out = {};

        await Promise.all(cards.map(async card => {
            const lineName = card.querySelector('.card-header h4').textContent.trim();
            const links = [...card.querySelectorAll('a')];
            const suffixes = links
                .map(a => (a.href.match(/line_(\d+)([A-Za-z])\.html/) || []).slice(1))
                .filter(Boolean)
                .map(([num, suf]) => ({ num, suf }));

            // fetch all directions in parallel
            const allStops = await Promise.all(
                suffixes.map(({ num, suf }) =>
                    fetch(`/assets/schedules/line_${num}${suf}.json`)
                        .then(r => r.ok ? r.json() : { stops: [] })
                        .then(d => d.stops || [])
                        .catch(() => [])
                )
            );

            // flatten + dedupe
            out[lineName] = [...new Set(allStops.flat().map(s => s.name).filter(Boolean))];
        }));

        console.log("✅  got all stations:", out);
        return out;
    })();

    // 3) re-enable and attach the listener now that data is in memory
    searchBar.disabled = false;
    searchBar.addEventListener('input', e => triggerFilter(e.target.value.trim().toLowerCase()));
});
