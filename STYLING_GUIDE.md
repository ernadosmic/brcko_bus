# Brčko Bus Schedule - Styling Documentation

## Overview

The bus schedule application has been enhanced with modern Bootstrap-inspired styling based on the examples in the `examples/` folder. The new design provides a professional, responsive, and accessible user interface.

## Key Features

### 1. **Bootstrap Integration**

- Uses Bootstrap 5.3.0 for responsive grid system and components
- Custom CSS variables override Bootstrap defaults for consistent branding
- Responsive design that works on all device sizes

### 2. **Design System**

- **Primary Color**: `#2e5cb8` (Professional blue)
- **Secondary Color**: `#f8b739` (Warm orange)
- **Service Types**:
  - Regular services: Blue background (`#e3f2fd`) with dark blue text (`#1976d2`)
  - Irregular services: Light red background (`#ffe0e0`) with dark red text (`#d32f2f`)

### 3. **Component Structure**

#### Page Banner

- Gradient background with primary colors
- Centered title and subtitle
- Responsive typography

#### Route Visualization

- Interactive route map with station dots
- Color-coded start (green) and end (red) stations
- Hidden on mobile devices for better UX

#### Schedule Table

- Sticky first column for station names
- Color-coded service types
- Responsive horizontal scrolling on mobile
- Touch-friendly navigation

#### Legend and Information

- Clear explanation of color coding
- Important notices and warnings
- Structured layout with Bootstrap grid

## File Structure

```
brcko_bus/
├── index.html              # Main application page (enhanced)
├── schedule.html           # Alternative Bootstrap-focused version
├── css/
│   ├── utils.css         # Variables and utilities
│   ├── page.css          # Page layout
│   └── route-map.css     # Route map styles
├── js/
│   └── main.js            # Enhanced JavaScript functionality
├── assets/
│   └── schedules/
│       └── line_8.json    # Schedule data
└── examples/              # Reference implementations
    ├── bus-timetable.html # Component template
    ├── route-map.html     # Route visualization
    ├── style.css          # Example styles
    └── red-voznje.md      # Jekyll template example
```

## Usage

### Basic Implementation

1. Include Bootstrap CSS and JS
2. Add custom CSS file
3. Load schedule data from JSON
4. Initialize the BusScheduleApp class

### Customization

- Modify CSS variables in `:root` for color schemes
- Adjust responsive breakpoints as needed
- Add additional service types or styling

## Key CSS Classes

### Service Types

- `.regular-service` - Blue styling for daily services
- `.irregular-service` - Red styling for weekday-only services

### Layout

- `.page-banner` - Header section with gradient
- `.schedule-wrapper` - Table container with overflow handling
- `.route-section` - Route map container
- `.sticky-column` - Fixed first column on mobile

### Interactive Elements

- `.current-time` - Highlights current time (with animation)
- `.station-r` - Orange indicator for intersection stations
- `.legend-dot` - Color indicators in legend

## Responsive Behavior

### Desktop (>1200px)

- Full route map visible
- Complete table layout
- All features enabled

### Tablet (768px - 1200px)

- Route map hidden
- Table remains full-width
- Sticky navigation

### Mobile (<768px)

- Horizontal scrolling table
- Touch-friendly navigation
- Simplified layout
- Scroll hints for better UX

## Accessibility Features

- High contrast color combinations
- Keyboard navigation support
- Screen reader friendly markup
- Reduced motion support for users who prefer it
- Print-friendly styles

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Mobile)
- Progressive enhancement for older browsers

## Performance Considerations

- CSS variables for efficient styling
- Minimal JavaScript for core functionality
- Lazy loading of non-critical features
- Optimized for fast rendering

## Maintenance

### Adding New Routes

1. Create new JSON file in `assets/schedules/`
2. Update JavaScript to load different data sources
3. Colors and styling will automatically apply

### Styling Updates

- Modify CSS variables for global changes
- Use existing Bootstrap classes where possible
- Test across all responsive breakpoints

### Feature Enhancements

- JavaScript is modular and extensible
- CSS follows BEM-like naming conventions
- Bootstrap components can be easily integrated
