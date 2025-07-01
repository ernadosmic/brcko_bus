class StationsManager {
    constructor() {
        this.stations = new Map(); // station name -> { lines: Set, scheduleData: [] }
        this.allStations = [];
        this.filteredStations = [];
        this.isLoading = true;

        this.initializeElements();
        this.bindEvents();
        this.loadAllStations();
    }

    initializeElements() {
        this.searchInput = document.getElementById('station-search');
        this.sortSelect = document.getElementById('sort-select');
        this.stationsContainer = document.getElementById('stations-container');
        this.loadingState = document.getElementById('loading-state');
        this.noResults = document.getElementById('no-results');
        this.countNumber = document.getElementById('count-number');
    }

    bindEvents() {
        this.searchInput.addEventListener('input', this.debounce(this.handleSearch.bind(this), 300));
        this.sortSelect.addEventListener('change', this.handleSort.bind(this));
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    } async loadAllStations() {
        try {
            // Get all schedule files
            const scheduleFiles = await this.getScheduleFiles();
            console.log(`Attempting to load ${scheduleFiles.length} potential schedule files...`);

            // Update loading message
            const loadingText = this.loadingState.querySelector('p');
            if (loadingText) {
                loadingText.textContent = `Učitavanje ${scheduleFiles.length} rasporednih fajlova...`;
            }

            let loadedCount = 0;
            const totalFiles = scheduleFiles.length;

            // Process files in batches to avoid overwhelming the browser
            const batchSize = 10;
            for (let i = 0; i < scheduleFiles.length; i += batchSize) {
                const batch = scheduleFiles.slice(i, i + batchSize);

                // Process batch
                await Promise.all(batch.map(async (file) => {
                    await this.processScheduleFile(file);
                    loadedCount++;

                    // Update progress
                    if (loadingText) {
                        const progress = Math.round((loadedCount / totalFiles) * 100);
                        loadingText.textContent = `Učitavanje... ${progress}% (${loadedCount}/${totalFiles})`;
                    }
                }));

                // Small delay to prevent blocking the UI
                await new Promise(resolve => setTimeout(resolve, 10));
            }

            console.log(`Successfully processed ${this.stations.size} unique stations from available schedule files`);

            this.prepareStationsData();
            this.renderStations();
            this.hideLoading();

        } catch (error) {
            console.error('Error loading stations:', error);
            this.showError();
        }
    } async getScheduleFiles() {
        try {
            // Load the index file that contains the list of all available schedule files
            const response = await fetch('assets/schedules/index.json');
            if (!response.ok) {
                console.warn('Could not load schedule index, falling back to pattern matching');
                return this.getFallbackScheduleFiles();
            }

            const index = await response.json();
            if (!index.files || !Array.isArray(index.files)) {
                console.warn('Invalid index format, falling back to pattern matching');
                return this.getFallbackScheduleFiles();
            }

            console.log(`Found ${index.files.length} schedule files in index (last updated: ${index.lastUpdated})`);
            return index.files.map(file => `assets/schedules/${file}`);

        } catch (error) {
            console.warn('Error loading schedule index:', error);
            return this.getFallbackScheduleFiles();
        }
    }

    // Fallback method in case the index file is missing
    getFallbackScheduleFiles() {
        console.log('Using fallback pattern matching for schedule files');
        const patterns = [];

        // Based on known file patterns
        for (let i = 1; i <= 35; i++) {
            patterns.push(`line_${i}A.json`);
            patterns.push(`line_${i}B.json`);
        }

        // Special cases
        patterns.push(`line_12C.json`);
        patterns.push(`line_12D.json`);

        return patterns.map(file => `assets/schedules/${file}`);
    }

    async processScheduleFile(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                // Silently skip files that don't exist - this is expected behavior
                return;
            }

            const data = await response.json();
            const lineNumber = data.line_number || filePath.match(/line_(\w+)\.json/)?.[1] || 'Unknown';

            // Validate data structure
            if (!data.stops || !Array.isArray(data.stops)) {
                console.warn(`Invalid data structure in ${filePath}: missing or invalid stops array`);
                return;
            }

            // Process each stop in this line
            data.stops.forEach(stop => {
                // Validate stop data
                if (!stop.name || typeof stop.name !== 'string') {
                    return; // Skip invalid stops
                }

                const stationName = stop.name.trim();
                if (!stationName) return; // Skip empty names

                if (!this.stations.has(stationName)) {
                    this.stations.set(stationName, {
                        lines: new Set(),
                        scheduleData: []
                    });
                }

                const station = this.stations.get(stationName);
                station.lines.add(lineNumber);
                station.scheduleData.push({
                    line: lineNumber,
                    lineName: data.name || `Linija ${lineNumber}`,
                    times: Array.isArray(stop.times) ? stop.times : [],
                    fileName: filePath.split('/').pop() // For debugging
                });
            });

        } catch (error) {
            // Only log actual errors (not 404s for non-existent files)
            if (error.name !== 'TypeError' || !error.message.includes('fetch')) {
                console.warn(`Error processing ${filePath}:`, error);
            }
        }
    }

    prepareStationsData() {
        this.allStations = Array.from(this.stations.entries()).map(([name, data]) => ({
            name,
            lines: Array.from(data.lines).sort((a, b) => {
                // Sort lines numerically
                const aNum = parseInt(a) || 999;
                const bNum = parseInt(b) || 999;
                return aNum - bNum;
            }),
            lineCount: data.lines.size,
            scheduleData: data.scheduleData
        }));

        this.filteredStations = [...this.allStations];
        this.handleSort();
    }

    renderStations() {
        if (this.filteredStations.length === 0) {
            this.showNoResults();
            return;
        }

        this.hideNoResults();
        this.updateCount(this.filteredStations.length);

        const html = this.filteredStations.map(station => this.createStationCard(station)).join('');
        this.stationsContainer.innerHTML = html;
        this.stationsContainer.style.display = 'block';
    }

    createStationCard(station) {
        const linesHtml = station.lines.map(line =>
            `<span class="badge bg-primary me-1 mb-1">${line}</span>`
        ).join('');

        return `
            <div class="station-card-wrapper">
                <div class="card h-100 border-0 shadow-sm station-card" data-station="${station.name}">
                    <div class="card-body">
                        <div class="d-flex align-items-start justify-content-between mb-3">
                            <div class="flex-grow-1">
                                <h5 class="card-title mb-2">
                                    <i class="fas fa-map-marker-alt text-primary me-2"></i>
                                    ${station.name}
                                </h5>
                                <p class="text-muted small mb-0">
                                    <i class="fas fa-bus me-1"></i>
                                    ${station.lineCount} ${station.lineCount === 1 ? 'linija' : 'linija'}
                                </p>
                            </div>
                            <div class="text-end">
                                <span class="badge bg-light text-dark">${station.lineCount}</span>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <div class="d-flex flex-wrap">
                                ${linesHtml}
                            </div>
                        </div>
                        
                        <div class="d-grid">
                            <button class="btn btn-outline-primary btn-sm" onclick="stationsManager.showStationDetails('${station.name}')">
                                <i class="fas fa-clock me-1"></i>
                                Prikaži vozni red
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    handleSearch() {
        const query = this.searchInput.value.toLowerCase().trim();

        if (query === '') {
            this.filteredStations = [...this.allStations];
        } else {
            this.filteredStations = this.allStations.filter(station =>
                station.name.toLowerCase().includes(query) ||
                station.lines.some(line => line.toLowerCase().includes(query))
            );
        }

        this.renderStations();
    }

    handleSort() {
        const sortBy = this.sortSelect.value;

        this.filteredStations.sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.name.localeCompare(b.name, 'sr');
                case 'lines':
                    return b.lineCount - a.lineCount;
                default:
                    return 0;
            }
        });

        this.renderStations();
    }

    showStationDetails(stationName) {
        const station = this.stations.get(stationName);
        if (!station) return;

        // Create modal content
        const modalHtml = `
            <div class="modal fade" id="stationModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">
                                <i class="fas fa-map-marker-alt me-2"></i>
                                ${stationName}
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                ${station.scheduleData.map(schedule => `
                                    <div class="col-md-6 mb-3">
                                        <div class="card border-0 bg-light">
                                            <div class="card-body">
                                                <h6 class="card-title">
                                                    <span class="badge bg-primary me-2">${schedule.line}</span>
                                                    ${schedule.lineName}
                                                </h6>
                                                <div class="small">
                                                    <strong>Polasci:</strong>
                                                    <div class="mt-1">
                                                        ${schedule.times.map(time =>
            `<span class="badge bg-secondary me-1">${time}</span>`
        ).join('')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Zatvori</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('stationModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Add modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('stationModal'));
        modal.show();

        // Clean up modal after hiding
        document.getElementById('stationModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    updateCount(count) {
        this.countNumber.textContent = count;
    }

    hideLoading() {
        this.loadingState.style.display = 'none';
        this.isLoading = false;

        // Show a brief success message with stats
        if (this.allStations.length > 0) {
            console.log(`🚌 Stations loaded successfully:`);
            console.log(`   • ${this.allStations.length} unique stations`);
            console.log(`   • ${Array.from(new Set(this.allStations.flatMap(s => s.lines))).length} bus lines`);
            console.log(`   • ${this.allStations.reduce((sum, s) => sum + s.scheduleData.length, 0)} schedule entries`);
        }
    }

    showNoResults() {
        this.stationsContainer.style.display = 'none';
        this.noResults.style.display = 'block';
        this.updateCount(0);
    }

    hideNoResults() {
        this.noResults.style.display = 'none';
    }

    showError() {
        this.hideLoading();
        this.stationsContainer.innerHTML = `
            <div class="col-12">
                <div class="alert alert-danger text-center">
                    <i class="fas fa-exclamation-triangle mb-2" style="font-size: 2rem;"></i>
                    <h4>Greška pri učitavanju</h4>
                    <p>Došlo je do greške prilikom učitavanja stanica. Molimo pokušajte ponovo.</p>
                    <button class="btn btn-danger" onclick="location.reload()">
                        <i class="fas fa-redo me-1"></i>
                        Osvježi stranicu
                    </button>
                </div>
            </div>
        `;
        this.stationsContainer.style.display = 'block';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    window.stationsManager = new StationsManager();
});
