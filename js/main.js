// Enhanced Bus Schedule Application with improved styling
class BusScheduleApp {
    constructor() {
        this.scheduleData = null;
        this.init();
    }

    async init() {
        try {
            await this.loadScheduleData();
            this.renderRouteMap();
            this.renderScheduleTable();
            this.addResponsiveFeatures();
        } catch (error) {
            console.error('Error initializing bus schedule:', error);
            this.showError('Failed to load bus schedule data');
        }
    }

    async loadScheduleData() {
        try {
            const response = await fetch('assets/schedules/line_8.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.scheduleData = await response.json();

            // Update page title
            document.title = `Brčko Bus - Linija ${this.scheduleData.line_number}`;
            document.getElementById('route-name').textContent = this.scheduleData.name;
        } catch (error) {
            throw new Error('Failed to load schedule data: ' + error.message);
        }
    }

    renderRouteMap() {
        const stopsContainer = document.getElementById('stops-container');
        if (!stopsContainer) return;

        stopsContainer.innerHTML = '';

        // Show key stops for better visualization
        const keyStops = this.getKeyStops();

        keyStops.forEach((stop, index) => {
            const stopElement = this.createStopElement(stop, index, keyStops.length);
            stopsContainer.appendChild(stopElement);
        });
    }

    getKeyStops() {
        // Select representative stops for route visualization
        const allStops = this.scheduleData.stops.map(stop => stop.name);
        const keyStopNames = [
            'Maoča Badarka',
            'Rahić Centar',
            'Ograđenovac',
            'Centar',
            'Staklorad',
            'Dizdaruša Dom',
            'Čađavac **R**',
            'Krajnovići',
            'Omerbegovača'
        ];

        return keyStopNames.filter(name =>
            allStops.some(stopName => stopName.includes(name.replace(' **R**', '')))
        );
    }

    createStopElement(stopName, index, total) {
        const stopDiv = document.createElement('div');
        stopDiv.className = 'stop';

        // Add special classes for start and end stations
        if (index === 0) stopDiv.classList.add('start-station');
        if (index === total - 1) stopDiv.classList.add('end-station');

        const stopDot = document.createElement('div');
        stopDot.className = 'stop-dot';

        const stopLabel = document.createElement('div');
        stopLabel.className = 'stop-label';

        // Clean up stop name and handle R markers
        let cleanName = stopName.replace(/\*\*R\*\*/g, '');
        if (cleanName.length > 12) {
            cleanName = cleanName.substring(0, 10) + '...';
        }
        stopLabel.textContent = cleanName;

        // Add R indicator if present
        if (stopName.includes('**R**')) {
            const rIndicator = document.createElement('span');
            rIndicator.className = 'station-r';
            rIndicator.textContent = 'R';
            stopLabel.appendChild(rIndicator);
        }

        stopDiv.appendChild(stopDot);
        stopDiv.appendChild(stopLabel);

        return stopDiv;
    }

    renderScheduleTable() {
        this.renderTableHeader();
        this.renderTableBody();
    }

    renderTableHeader() {
        const tableHead = document.querySelector('#schedule-table thead');
        if (!tableHead) return;

        // Clear existing header
        tableHead.innerHTML = '';

        // Main header row
        const headerRow = document.createElement('tr');

        const stationHeader = document.createElement('th');
        stationHeader.className = 'station-header sticky-column';
        stationHeader.textContent = 'Stanica';
        headerRow.appendChild(stationHeader);

        const timeHeader = document.createElement('th');
        timeHeader.colSpan = this.scheduleData.services;
        timeHeader.textContent = 'Vrijeme polaska';
        timeHeader.className = 'text-center';
        headerRow.appendChild(timeHeader);

        tableHead.appendChild(headerRow);

        // Service numbers row
        const serviceRow = document.createElement('tr');

        const emptyCell = document.createElement('th');
        emptyCell.className = 'sticky-column';
        serviceRow.appendChild(emptyCell);

        for (let i = 1; i <= this.scheduleData.services; i++) {
            const serviceHeader = document.createElement('th');
            serviceHeader.className = 'text-center service-header';
            serviceHeader.textContent = i;

            // Apply service type styling
            if (this.scheduleData.regular_services.includes(i)) {
                serviceHeader.classList.add('regular-service');
            } else {
                serviceHeader.classList.add('irregular-service');
            }

            serviceRow.appendChild(serviceHeader);
        }

        tableHead.appendChild(serviceRow);
    }

    renderTableBody() {
        const tableBody = document.getElementById('schedule-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';

        this.scheduleData.stops.forEach((stop, stopIndex) => {
            const row = this.createScheduleRow(stop, stopIndex);
            tableBody.appendChild(row);
        });
    }

    createScheduleRow(stop, stopIndex) {
        const row = document.createElement('tr');

        // Highlight start and end stations
        const isStartStation = stopIndex === 0;
        const isEndStation = stopIndex === this.scheduleData.stops.length - 1;

        if (isEndStation) {
            row.classList.add('end-station-row');
        }

        // Station name cell
        const stationCell = document.createElement('td');
        stationCell.className = 'station-name sticky-column';

        // Process station name
        let stationName = stop.name.replace(/\*\*R\*\*/g, '<span class="station-r">R</span>');

        if (isStartStation || isEndStation) {
            stationCell.innerHTML = `<strong>${stationName}</strong>`;
        } else {
            stationCell.innerHTML = stationName;
        }

        row.appendChild(stationCell);

        // Time cells
        stop.times.forEach((time, timeIndex) => {
            const timeCell = document.createElement('td');
            timeCell.className = 'time-cell';
            timeCell.textContent = time;

            // Apply service type styling
            const serviceNumber = timeIndex + 1;
            if (this.scheduleData.regular_services.includes(serviceNumber)) {
                timeCell.classList.add('regular-service');
            } else {
                timeCell.classList.add('irregular-service');
            }

            row.appendChild(timeCell);
        });

        return row;
    }

    addResponsiveFeatures() {
        // Add horizontal scroll indicator on mobile
        const tableWrapper = document.querySelector('.schedule-wrapper');
        if (tableWrapper && window.innerWidth <= 768) {
            const scrollHint = document.createElement('div');
            scrollHint.className = 'scroll-hint';
            scrollHint.innerHTML = '<small>← Pomijerite lijevo i desno za pregled →</small>';
            tableWrapper.appendChild(scrollHint);
        }

        // Add touch scroll support
        this.addTouchScrollSupport();
    }

    addTouchScrollSupport() {
        const tableWrapper = document.querySelector('.schedule-wrapper');
        if (!tableWrapper) return;

        let isScrolling = false;
        let startX = 0;
        let scrollLeft = 0;

        tableWrapper.addEventListener('touchstart', (e) => {
            isScrolling = true;
            startX = e.touches[0].pageX - tableWrapper.offsetLeft;
            scrollLeft = tableWrapper.scrollLeft;
        });

        tableWrapper.addEventListener('touchmove', (e) => {
            if (!isScrolling) return;
            e.preventDefault();
            const x = e.touches[0].pageX - tableWrapper.offsetLeft;
            const walk = (x - startX) * 2;
            tableWrapper.scrollLeft = scrollLeft - walk;
        });

        tableWrapper.addEventListener('touchend', () => {
            isScrolling = false;
        });
    }

    showError(message) {
        const container = document.querySelector('.container');
        if (!container) return;

        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger';
        errorDiv.innerHTML = `
            <h4>Greška</h4>
            <p>${message}</p>
            <p>Molimo pokušajte ponovo kasnije ili kontaktirajte tehničku podršku.</p>
        `;

        container.insertBefore(errorDiv, container.firstChild);
    }

    // Utility method to format times
    formatTime(timeString) {
        // Ensure consistent time format
        const [hours, minutes] = timeString.split(':');
        return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    }

    // Method to highlight current time
    highlightCurrentTime() {
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        document.querySelectorAll('.time-cell').forEach(cell => {
            if (cell.textContent === currentTime) {
                cell.classList.add('current-time');
            }
        });
    }
}

// Enhanced initialization with better error handling
document.addEventListener('DOMContentLoaded', () => {
    try {
        new BusScheduleApp();
    } catch (error) {
        console.error('Failed to initialize Bus Schedule App:', error);

        // Fallback error display
        const body = document.body;
        const errorMessage = document.createElement('div');
        errorMessage.className = 'container mt-5';
        errorMessage.innerHTML = `
            <div class="alert alert-danger text-center">
                <h3>Greška pri učitavanju</h3>
                <p>Nažalost, došlo je do greške pri učitavanju reda vožnje.</p>
                <p>Molimo osvježite stranicu ili pokušajte ponovo kasnije.</p>
                <button class="btn btn-primary" onclick="location.reload()">Osvježi stranicu</button>
            </div>
        `;
        body.appendChild(errorMessage);
    }
});

// Add window resize handler for responsive features
window.addEventListener('resize', () => {
    // Re-initialize responsive features on resize
    const app = window.busScheduleApp;
    if (app && typeof app.addResponsiveFeatures === 'function') {
        app.addResponsiveFeatures();
    }
});

// Export for global access if needed
window.BusScheduleApp = BusScheduleApp;

// Additional CSS for highlighting
const additionalStyles = `
    .time-cell.highlighted {
        background-color: #2c5aa0 !important;
        color: white !important;
        font-weight: bold;
    }
    
    .service-header.highlighted {
        background-color: #1e3d72 !important;
        box-shadow: 0 0 10px rgba(44, 90, 160, 0.5);
    }
    
    .error-message {
        animation: fadeIn 0.5s ease-in;
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    /* Enhanced styles */
    .stop {
        display: flex;
        align-items: center;
        margin: 5px 0;
    }
    
    .stop-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: #007bff;
        margin-right: 10px;
    }
    
    .stop-label {
        font-size: 14px;
        color: #333;
    }
    
    .station-r {
        font-weight: bold;
        color: #dc3545;
        margin-left: 2px;
    }
    
    .current-time {
        background-color: #28a745 !important;
        color: white !important;
        font-weight: bold;
    }
    
    .scroll-hint {
        text-align: center;
        font-size: 12px;
        color: #666;
        margin-top: 5px;
    }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BusScheduleApp();
});

// Add some utility functions for enhanced interactivity
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    return `${hours}:${minutes}`;
}

function getCurrentTimeHighlight() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Find and highlight the next departure
    const timeCells = document.querySelectorAll('.time-cell');
    let nextDeparture = null;
    let minDiff = Infinity;

    timeCells.forEach(cell => {
        const cellTime = cell.textContent;
        const [cellHours, cellMinutes] = cellTime.split(':').map(Number);
        const [currentHours, currentMinutes] = currentTime.split(':').map(Number);

        const cellTotalMinutes = cellHours * 60 + cellMinutes;
        const currentTotalMinutes = currentHours * 60 + currentMinutes;

        let diff = cellTotalMinutes - currentTotalMinutes;
        if (diff < 0) diff += 24 * 60; // Handle next day

        if (diff < minDiff && diff > 0) {
            minDiff = diff;
            nextDeparture = cell;
        }
    });

    if (nextDeparture) {
        // Remove existing next-departure highlights
        document.querySelectorAll('.time-cell.next-departure').forEach(cell => {
            cell.classList.remove('next-departure');
        });

        nextDeparture.classList.add('next-departure');
    }
}

// Add CSS for next departure highlighting
const nextDepartureStyle = `
    .time-cell.next-departure {
        background-color: #ff6b35 !important;
        color: white !important;
        animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(255, 107, 53, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(255, 107, 53, 0); }
        100% { box-shadow: 0 0 0 0 rgba(255, 107, 53, 0); }
    }
`;

styleSheet.textContent += nextDepartureStyle;

// Update next departure highlight every minute
setInterval(getCurrentTimeHighlight, 60000);
setTimeout(getCurrentTimeHighlight, 1000); // Initial call after page load