// Bus Schedule Application
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
            // Legend and info are now static in HTML
        } catch (error) {
            console.error('Error initializing bus schedule:', error);
            this.showError('Failed to load bus schedule data');
        }
    } async loadScheduleData() {
        try {
            const response = await fetch('assets/schedules/line_8.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.scheduleData = await response.json();

            // Update page title - keep original direction from JSON
            document.title = `Brčko Bus - Linija ${this.scheduleData.line_number}`;
            document.getElementById('route-name').textContent = this.scheduleData.name;
        } catch (error) {
            throw new Error('Failed to load schedule data: ' + error.message);
        }
    }

    renderRouteMap() {
        const stopsContainer = document.getElementById('stops-container');
        stopsContainer.innerHTML = '';

        // Keep original order from JSON (Maoča to Omerbegovača)
        const originalStops = this.scheduleData.stops;        // Show all major stops (filter for better display)
        const majorStops = [
            'Maoča Badarka',
            'Maoča Centar',
            'Maoča Škola',
            'Maoča Rašljani **R**',
            'Rašljani **R** (Škola Maoča)',
            'Prutače',
            'Šljunkara',
            'Rahić Centar',
            'Rahić Škola',
            'Ograđenovac',
            'Palanka **R**',
            'Mušići',
            'Brka Bor',
            'Brka Servis',
            'Tihe Noći',
            'Brka Kanal',
            'Stari Brod',
            'Brod Škola',
            'Šadrvan',
            'Suljagića Sokak',
            'Broduša',
            'Izbor',
            'Meraje',
            'Dom zdravlja',
            'Kolobara',
            'Centar',
            'Vet. Stanica',
            'Staklorad',
            '4. Juli',
            'Dizdaruša S.',
            'Dizdaruša Dom',
            'Čađavac **R**',
            'Šišin Han',
            'Krajnovići',
            'Omerbegovača'
        ]; const displayStops = originalStops.filter(stop =>
            majorStops.includes(stop.name)
        );

        displayStops.forEach((stop, index) => {
            const stopElement = this.createStopMarker(stop, index, displayStops.length);
            stopsContainer.appendChild(stopElement);
        });
    }

    createStopMarker(stop, index, totalStops) {
        const stopMarker = document.createElement('div');
        stopMarker.className = 'stop-marker';

        const stopCircle = document.createElement('div');
        stopCircle.className = 'stop-circle';

        // Mark first and last stops as terminals (green)
        if (index === 0 || index === totalStops - 1) {
            stopCircle.classList.add('terminal');
        }
        // Mark some special stops with orange circles
        else if (stop.name.includes('Centar') || stop.name.includes('Dom') || stop.name.includes('**R**')) {
            stopCircle.classList.add('special');
        }

        const stopName = document.createElement('div');
        stopName.className = 'stop-name';
        stopName.textContent = stop.name.replace(' **R**', '').replace('(Škola Maoča)', '');

        stopMarker.appendChild(stopCircle);
        stopMarker.appendChild(stopName);

        return stopMarker;
    }

    renderScheduleTable() {
        this.renderTableHeader();
        this.renderTableBody();
    }

    renderTableHeader() {
        const table = document.getElementById('schedule-table');
        const thead = table.querySelector('thead tr');

        // Clear existing service headers (keep station and direction headers)
        const existingHeaders = thead.querySelectorAll('.service-header');
        existingHeaders.forEach(header => header.remove());

        // Add service number headers
        for (let i = 1; i <= this.scheduleData.services; i++) {
            const th = document.createElement('th');
            th.className = 'service-header';
            th.textContent = i.toString();

            // Color code based on service type
            if (this.scheduleData.regular_services.includes(i)) {
                th.classList.add('regular');
            } else {
                th.classList.add('irregular');
            }

            thead.appendChild(th);
        }
    } renderTableBody() {
        const tbody = document.getElementById('schedule-body');
        tbody.innerHTML = '';

        // Keep original order from JSON (Maoča to Omerbegovača)
        this.scheduleData.stops.forEach(stop => {
            const row = this.createScheduleRow(stop);
            tbody.appendChild(row);
        });
    }

    createScheduleRow(stop) {
        const row = document.createElement('tr');

        // Station name cell
        const stationCell = document.createElement('td');
        stationCell.className = 'station-name';
        stationCell.textContent = stop.name;

        if (stop.name.includes('**R**')) {
            stationCell.classList.add('request-stop');
        }

        row.appendChild(stationCell);

        // Direction cell (empty for now, can be used for return direction)
        const directionCell = document.createElement('td');
        directionCell.className = 'direction-cell';
        directionCell.textContent = '→';
        row.appendChild(directionCell);

        // Time cells
        stop.times.forEach((time, index) => {
            const timeCell = document.createElement('td');
            timeCell.className = 'time-cell';
            timeCell.textContent = time;

            const serviceNumber = index + 1;
            if (this.scheduleData.regular_services.includes(serviceNumber)) {
                timeCell.classList.add('regular');
            } else {
                timeCell.classList.add('irregular');
            }

            // Add click handler for time highlighting
            timeCell.addEventListener('click', () => {
                this.highlightService(serviceNumber);
            });

            row.appendChild(timeCell);
        });

        return row;
    }

    highlightService(serviceNumber) {
        // Remove existing highlights
        document.querySelectorAll('.time-cell.highlighted').forEach(cell => {
            cell.classList.remove('highlighted');
        });

        // Add highlight to selected service column
        const serviceCells = document.querySelectorAll('.time-cell');
        serviceCells.forEach((cell, index) => {
            if ((index % this.scheduleData.services) === (serviceNumber - 1)) {
                cell.classList.add('highlighted');
            }
        });

        // Highlight header
        const headers = document.querySelectorAll('.service-header');
        headers.forEach((header, index) => {
            header.classList.remove('highlighted');
            if (index === serviceNumber - 1) {
                header.classList.add('highlighted');
            }
        });
    }

    // Legend and info are now static in HTML - methods removed

    showError(message) {
        const container = document.querySelector('.container');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.cssText = `
            background-color: #f8d7da;
            color: #721c24;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border-left: 4px solid #dc3545;
        `;
        errorDiv.textContent = message;
        container.appendChild(errorDiv);
    }
}

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