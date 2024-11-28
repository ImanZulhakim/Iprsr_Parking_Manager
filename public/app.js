let currentMap = null;
let drawControl = null;
let drawnItems = null;

// Global variable to store current marker and coordinates
let currentMarker = null;
let currentSpaceCoordinates = null;

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'block';
    
    if (sectionId === 'view-lots') {
        loadParkingLots();
    } else if (sectionId === 'manage-spaces') {
        loadLotSelect();
        loadParkingSpaces();
    }
}

function initMap(containerId) {
    if (currentMap) {
        currentMap.remove();
    }
    
    currentMap = L.map(containerId).setView([4.2105, 108.9758], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(currentMap);
    
    drawnItems = new L.FeatureGroup();
    currentMap.addLayer(drawnItems);
    
    return currentMap;
}

function startDrawing() {
    const lotID = document.getElementById('lotID').value;
    const location = document.getElementById('lotName').value;
    
    if (!lotID || !location) {
        alert('Please enter both Lot ID and Location Name first!');
        return;
    }

    // First check if lot exists and has boundaries
    fetch(`/check-lot/${lotID}`)
        .then(response => response.json())
        .then(data => {
            if (data.exists) {
                if (data.hasBoundaries) {
                    if (confirm('This parking lot already has boundaries. Do you want to update them?')) {
                        initializeDrawingMap(lotID);
                    }
                } else {
                    // Lot exists but no boundaries, allow drawing
                    initializeDrawingMap(lotID);
                }
            } else {
                // New lot, create it and then initialize map
                createNewLot(lotID, location);
            }
        })
        .catch(err => {
            console.error('Error checking lot:', err);
            alert('Error checking lot status. Please try again.');
        });
}

function createNewLot(lotID, location) {
    fetch('/create-lot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lotID, location })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            initializeDrawingMap(lotID);
        }
    })
    .catch(err => {
        console.error('Error creating parking lot:', err);
        alert('Error creating parking lot. Please try again.');
    });
}

function initializeDrawingMap(lotID) {
    if (currentMap) {
        currentMap.off();
        currentMap.remove();
    }

    currentMap = L.map('map').setView([6.4634, 100.5055], 17);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(currentMap);

    drawnItems = new L.FeatureGroup();
    currentMap.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        draw: {
            polygon: true,
            rectangle: false,
            circle: false,
            marker: false,
            polyline: false
        },
        edit: {
            featureGroup: drawnItems
        }
    });
    currentMap.addControl(drawControl);

    currentMap.on(L.Draw.Event.CREATED, function(event) {
        const layer = event.layer;
        const coordinates = layer.getLatLngs()[0].map(coord => [
            coord.lat,  // latitude first
            coord.lng   // longitude second
        ]);
        
        fetch('/save-lot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lotID, coordinates })
        })
        .then(response => response.text())
        .then(message => {
            alert('Parking lot boundary saved successfully!');
            drawnItems.addLayer(layer);
        })
        .catch(err => {
            console.error('Error saving boundary:', err);
            alert('Error saving boundary. Please try again.');
        });
    });
}

function loadParkingLots() {
    fetch('/get-all-lots')
        .then(response => response.json())
        .then(lots => {
            const tbody = document.querySelector('#lots-table tbody');
            tbody.innerHTML = '';
            
            lots.forEach(lot => {
                const row = `
                    <tr>
                        <td>${lot.lotID}</td>
                        <td>${lot.location}</td>
                        <td><button class="view-button" onclick="viewLotOnMap('${lot.lotID}')">View</button></td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        })
        .catch(err => console.error('Error fetching parking lots:', err));
}

function viewLotOnMap(lotID) {
    // Show the map container
    document.getElementById('view-map-container').style.display = 'block';
    
    // Initialize or reset the map
    if (currentMap) {
        // Remove all event listeners before removing the map
        currentMap.off();
        currentMap.remove();
    }
    
    // Initialize new map
    currentMap = L.map('view-map').setView([4.2105, 108.9758], 6);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(currentMap);
    
    // Reset the drawn items layer
    drawnItems = new L.FeatureGroup();
    currentMap.addLayer(drawnItems);
    
    // Fetch and display the boundary
    fetch(`/get-lot-boundary/${lotID}`)
        .then(response => response.json())
        .then(coordinates => {
            if (coordinates && coordinates.length > 0) {
                drawnItems.clearLayers();
                
                const polygon = L.polygon(coordinates, { 
                    color: 'red',
                    fillColor: '#f03',
                    fillOpacity: 0.3
                }).addTo(currentMap);
                
                polygon.bindPopup(`Lot ID: ${lotID}`);
                
                // Fit bounds with padding
                currentMap.fitBounds(polygon.getBounds(), {
                    padding: [50, 50]
                });
                
                drawnItems.addLayer(polygon);
            } else {
                alert('No boundary data found for this parking lot');
            }
        })
        .catch(err => {
            console.error('Error loading boundary:', err);
            alert('Error loading parking lot boundary');
        });
}

function loadParkingSpaces() {
    fetch('/get-spaces')
        .then(response => response.json())
        .then(spaces => {
            const tbody = document.querySelector('#spaces-table tbody');
            tbody.innerHTML = '';
            
            spaces.forEach(space => {
                const row = `
                    <tr>
                        <td>${space.parkingSpaceID}</td>
                        <td>${space.parkingType}</td>
                        <td>${space.lotID}</td>
                        <td>${space.isAvailable ? 'Available' : 'Occupied'}</td>
                        <td>
                            <button onclick="editSpace('${space.parkingSpaceID}')">Edit</button>
                            <button onclick="deleteSpace('${space.parkingSpaceID}')">Delete</button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        })
        .catch(err => console.error('Error loading parking spaces:', err));
}

function startSpaceMarking() {
    const lotID = document.getElementById('lotSelect').value;
    const spaceID = document.getElementById('spaceID').value;
    
    if (!lotID || !spaceID) {
        alert('Please select a parking lot and generate a space ID first');
        return;
    }

    // Get the lot boundaries first
    fetch(`/get-lot-boundary/${lotID}`)
        .then(response => response.json())
        .then(coordinates => {
            if (!coordinates || coordinates.length === 0) {
                alert('No boundary found for this parking lot');
                return;
            }

            if (currentMap) {
                currentMap.off();
                currentMap.remove();
            }

            // Initialize map
            currentMap = L.map('space-map', {
                maxZoom: 22,
                minZoom: 15
            }).setView([coordinates[0][0], coordinates[0][1]], 19);
            
            // Google Satellite (Primary layer)
            const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                maxZoom: 22,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
            }).addTo(currentMap);

            // OpenStreetMap (Alternative layer)
            const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 22
            });

            // Layer control
            const baseMaps = {
                "Satellite": googleSat,
                "Streets": streets
            };
            L.control.layers(baseMaps).addTo(currentMap);

            // Draw lot boundary
            const polygon = L.polygon(coordinates, {
                color: 'yellow', // Yellow boundary for better visibility on satellite
                weight: 2,
                fillOpacity: 0.1
            }).addTo(currentMap);

            // Fit map to boundary
            currentMap.fitBounds(polygon.getBounds());

            // Clear any existing markers
            if (currentMarker) {
                currentMap.removeLayer(currentMarker);
            }

            // Add click handler for marking space location
            currentMap.on('click', function(e) {
                if (currentMarker) {
                    currentMap.removeLayer(currentMarker);
                }

                currentMarker = L.marker(e.latlng, {
                    draggable: true
                }).addTo(currentMap);

                currentSpaceCoordinates = e.latlng;

                const popupContent = `
                    <div class="space-popup">
                        <b>Space ID:</b> ${spaceID}<br>
                        <b>Type:</b> ${document.getElementById('parkingType').value}<br>
                        <b>Coordinates:</b><br>
                        Lat: ${e.latlng.lat.toFixed(6)}<br>
                        Lng: ${e.latlng.lng.toFixed(6)}<br>
                        <button type="button" class="save-space-btn" onclick="window.saveNewParkingSpace()">Save Space</button>
                    </div>
                `;
                currentMarker.bindPopup(popupContent).openPopup();
            });
        })
        .catch(err => {
            console.error('Error loading lot boundaries:', err);
            alert('Error loading lot boundaries');
        });
}

function loadLotSelect() {
    fetch('/get-all-lots')
        .then(response => response.json())
        .then(lots => {
            const select = document.getElementById('lotSelect');
            select.innerHTML = '<option value="">Select Parking Lot</option>';
            lots.forEach(lot => {
                select.innerHTML += `<option value="${lot.lotID}">${lot.lotID} - ${lot.location}</option>`;
            });
        })
        .catch(err => console.error('Error loading lots:', err));
}

document.getElementById('lotSelect').addEventListener('change', function() {
    const lotID = this.value;
    if (lotID) {
        // Get the next available space number for this lot
        fetch(`/get-next-space-number/${lotID}`)
            .then(response => response.json())
            .then(data => {
                const spaceIDInput = document.getElementById('spaceID');
                spaceIDInput.value = `${lotID}_${String(data.nextNumber).padStart(2, '0')}`;
                spaceIDInput.readOnly = true; // Make it read-only
                
                document.getElementById('parkingType').disabled = false;
            });
    } else {
        document.getElementById('spaceID').value = '';
        document.getElementById('spaceID').readOnly = false;
        document.getElementById('parkingType').disabled = true;
    }
});

// Make saveNewParkingSpace globally accessible
window.saveNewParkingSpace = function() {
    console.log('Save function called'); // Debug log
    
    if (!currentSpaceCoordinates) {
        alert('Please mark a location on the map first');
        return;
    }

    const spaceData = {
        parkingSpaceID: document.getElementById('spaceID').value,
        parkingType: document.getElementById('parkingType').value,
        isNearest: document.getElementById('isNearest').checked ? 1 : 0,
        isCovered: document.getElementById('isCovered').checked ? 1 : 0,
        isWheelchairAccessible: document.getElementById('isWheelchairAccessible').checked ? 1 : 0,
        hasLargeSpace: document.getElementById('hasLargeSpace').checked ? 1 : 0,
        isWellLitArea: document.getElementById('isWellLitArea').checked ? 1 : 0,
        hasEVCharging: document.getElementById('hasEVCharging').checked ? 1 : 0,
        isFamilyParkingArea: document.getElementById('isFamilyParkingArea').checked ? 1 : 0,
        isPremium: document.getElementById('isPremium').checked ? 1 : 0,
        isAvailable: document.getElementById('isAvailable').checked ? 1 : 0,
        lotID: document.getElementById('lotSelect').value,
        coordinates: [
            currentSpaceCoordinates.lat,
            currentSpaceCoordinates.lng
        ]
    };

    console.log('Saving space data:', spaceData); // Debug log

    // Send data to server
    fetch('/create-space', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(spaceData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Save response:', data); // Debug log
        alert('Parking space saved successfully!');
        
        // Clear the marker
        if (currentMarker) {
            currentMap.removeLayer(currentMarker);
            currentMarker = null;
            currentSpaceCoordinates = null;
        }

        // Refresh the parking spaces table
        loadParkingSpaces();
    })
    .catch(error => {
        console.error('Error saving parking space:', error);
        alert('Error saving parking space: ' + error.message);
    });
};

// Function to reset the form
function resetSpaceForm() {
    document.getElementById('parkingType').value = '';
    document.querySelectorAll('.checkbox-group input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });
    // Generate new space ID if needed
    loadNextSpaceID(document.getElementById('lotSelect').value);
}

// Add event listener for parking type selection
document.getElementById('parkingType').addEventListener('change', function() {
    // Get all checkbox elements
    const isNearest = document.getElementById('isNearest');
    const isWheelchairAccessible = document.getElementById('isWheelchairAccessible');
    const isWellLitArea = document.getElementById('isWellLitArea');
    const isPremium = document.getElementById('isPremium');
    const hasEVCharging = document.getElementById('hasEVCharging');
    const hasLargeSpace = document.getElementById('hasLargeSpace');

    // Reset all checkboxes first
    const allCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
    allCheckboxes.forEach(checkbox => {
        checkbox.checked = false;
        checkbox.disabled = false; // Enable all checkboxes for potential manual changes
    });

    // Auto-tick based on parking type
    switch(this.value) {
        case 'Special':
            isNearest.checked = true;
            isWheelchairAccessible.checked = true;
            isWellLitArea.checked = true;
            
            // Optional: Add visual indication that these were auto-selected
            [isNearest, isWheelchairAccessible, isWellLitArea].forEach(checkbox => {
                checkbox.parentElement.classList.add('auto-selected');
            });
            break;

        case 'Female':
            isNearest.checked = true;
            isWellLitArea.checked = true;
            
            [isNearest, isWellLitArea].forEach(checkbox => {
                checkbox.parentElement.classList.add('auto-selected');
            });
            break;

        case 'Premium':
            isPremium.checked = true;
            
            isPremium.parentElement.classList.add('auto-selected');
            break;

        case 'EV':
            hasEVCharging.checked = true;
            
            hasEVCharging.parentElement.classList.add('auto-selected');
            break;

        case 'Family':
            hasLargeSpace.checked = true;
            
            hasLargeSpace.parentElement.classList.add('auto-selected');
            break;

        default:
            // Remove all auto-selected indicators
            document.querySelectorAll('.auto-selected').forEach(el => {
                el.classList.remove('auto-selected');
            });
            break;
    }
});

// Add event listener for checkbox changes to remove auto-selected indication when manually changed
document.querySelectorAll('.checkbox-group input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        this.parentElement.classList.remove('auto-selected');
    });
});

