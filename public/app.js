let currentMap = null;
let drawnItems = null;

// Global variable to store current marker and coordinates
let currentMarker = null;
let currentSpaceCoordinates = null;

$(document).ready(function () {
  $("#navbar-placeholder").load("navbar.html", function () {
    // Only try to show view-lots if we're on the index page
    const viewLotsElement = document.querySelector("#view-lots");
    if (viewLotsElement) {
      viewLotsElement.style.display = "block";
      const sectionTitle = document.getElementById("section-title");
      if (sectionTitle) sectionTitle.textContent = "Home";

      // Load parking lots on page load
      loadParkingLots();
    }
  });
});

// Initialize map
function initMap(containerId) {
  if (currentMap) {
    currentMap.remove();
  }

  currentMap = L.map(containerId).setView([4.2105, 108.9758], 6);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(currentMap);

  drawnItems = new L.FeatureGroup();
  currentMap.addLayer(drawnItems);

  return currentMap;
}

// Start drawing parking lot boundaries
function startDrawing() {
  const lotID = document.getElementById("lotID").value;
  const location = document.getElementById("lotName").value;

  if (!lotID || !location) {
    alert("Please enter both Lot ID and Location Name first!");
    return;
  }

  fetch(`/check-lot/${lotID}`)
    .then((response) => response.json())
    .then((data) => {
      if (data.exists) {
        const proceed = data.hasBoundaries
          ? confirm(
              "This parking lot already has boundaries. Do you want to update them?"
            )
          : true;

        if (proceed) initializeDrawingMap(lotID);
      } else {
        createNewLot(lotID, location);
      }
    })
    .catch((err) => {
      console.error("Error checking lot:", err);
      alert("Error checking lot status. Please try again.");
    });
}

// Create a new parking lot
function createNewLot(lotID, location) {
  fetch("/create-lot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lotID, location }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.message) initializeDrawingMap(lotID);
    })
    .catch((err) => {
      console.error("Error creating parking lot:", err);
      alert("Error creating parking lot. Please try again.");
    });
}

// Initialize map for drawing parking lot boundaries
function initializeDrawingMap(lotID) {
  if (currentMap) {
    currentMap.off();
    currentMap.remove();
  }

  currentMap = L.map("map").setView([6.4634, 100.5055], 17);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(currentMap);

  drawnItems = new L.FeatureGroup();
  currentMap.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    draw: { polygon: true },
    edit: { featureGroup: drawnItems },
  });
  currentMap.addControl(drawControl);

  currentMap.on(L.Draw.Event.CREATED, function (event) {
    const layer = event.layer;
    const coordinates = layer
      .getLatLngs()[0]
      .map((coord) => [coord.lat, coord.lng]);

    fetch("/save-lot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lotID, coordinates }),
    })
      .then(() => {
        alert("Parking lot boundary saved successfully!");
        drawnItems.addLayer(layer);
      })
      .catch((err) => {
        console.error("Error saving boundary:", err);
        alert("Error saving boundary. Please try again.");
      });
  });
}

// Load parking lots
function loadParkingLots() {
  fetch("/get-all-lots")
    .then((response) => {
      console.log("API response:", response); // Debug log
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((lots) => {
      console.log("Parking lots data:", lots); // Debug log
      const lotsTableBody = document.querySelector("#lots-table tbody");
      if (!lotsTableBody) {
        console.error("Could not find lots table body element");
        return;
      }
      lotsTableBody.innerHTML = lots.length
        ? lots
            .map(
              (lot) => `
            <tr>
              <td>${lot.lotID}</td>
              <td>${lot.location}</td>
              <td>
                <button class="action-btn view-btn" onclick="viewLot('${lot.lotID}')">View Spaces</button>
              </td>
            </tr>`
            )
            .join("")
        : '<tr><td colspan="3">No parking lots available</td></tr>';
    })
    .catch((err) => {
      console.error("Error loading parking lots:", err);
      alert("Failed to load parking lots. " + err.message);
    });
}

// Global variables
let currentPage = 1;
const rowsPerPage = 10;
const maxVisibleButtons = 5;
let tableData = [];

// View lot details
function viewLot(lotID) {
  // Fetch parking spaces for the selected lot
  fetch(`/get-spaces?lotID=${lotID}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((spaces) => {
      // Store fetched spaces globally
      tableData = spaces;

      // Initialize table with pagination
      currentPage = 1;
      displayTableRows();
      createPaginationControls();

      // Show containers
      document.querySelector("#parking-spaces-container").style.display =
        "block";
      const mapContainer = document.querySelector("#view-map-container");
      mapContainer.style.display = "block";

      // Initialize map
      if (currentMap) {
        currentMap.off();
        currentMap.remove();
      }

      // Create map with satellite view
      currentMap = L.map("view-map-container").setView([4.2105, 108.9758], 6);
      const satelliteTile = L.tileLayer(
        "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
          maxZoom: 22,
        }
      );
      satelliteTile.addTo(currentMap);

      // Fetch and display the lot boundary
      fetch(`/get-lot-boundary/${lotID}`)
        .then((response) => response.json())
        .then((coordinates) => {
          if (coordinates && coordinates.length > 0) {
            const polygon = L.polygon(coordinates, {
              color: "blue",
              fillOpacity: 0.4,
            }).addTo(currentMap);

            // Fit map to boundary
            currentMap.fitBounds(polygon.getBounds());

            // Add markers for each parking space
            spaces.forEach((space) => {
              // Check if space has coordinates stored as a string "lat,lng"
              if (space.coordinates) {
                try {
                  const [lat, lng] = space.coordinates
                    .split(",")
                    .map((coord) => parseFloat(coord.trim()));

                  if (!isNaN(lat) && !isNaN(lng)) {
                    // Determine marker color based on space type and availability
                    let markerColor = "#9E9E9E"; // Default gray for regular spaces

                    if (!space.isAvailable) {
                      markerColor = "#FF5252"; // redAccent for occupied
                    } else if (space.isNearest) {
                      markerColor = "#69F0AE"; // greenAccent for recommended
                    } else if (space.isWheelchairAccessible) {
                      markerColor = "#2196F3"; // blueAccent for special
                    } else if (space.isFamilyParkingArea) {
                      markerColor = "#E040FB"; // purpleAccent for family
                    } else if (space.hasEVCharging) {
                      markerColor = "#1DE9B6"; // tealAccent for EV
                    } else if (space.isPremium) {
                      markerColor = "#FFD54F"; // yellow/gold for premium
                    }

                    // Create custom marker icon with Google Maps style
                    const markerIcon = L.divIcon({
                      className: "custom-marker",
                      html: `
                        <div style="
                          background-color: ${markerColor};
                          width: 24px;
                          height: 24px;
                          border-radius: 50%;
                          border: 2px solid white;
                          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                          position: relative;
                        ">
                          <div style="
                            position: absolute;
                            bottom: -8px;
                            left: 50%;
                            transform: translateX(-50%);
                            width: 2px;
                            height: 8px;
                            background-color: ${markerColor};
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                          "></div>
                        </div>
                      `,
                      iconSize: [24, 24],
                      iconAnchor: [12, 24],
                      popupAnchor: [0, -24],
                    });

                    const marker = L.marker([lat, lng], {
                      icon: markerIcon,
                    }).addTo(currentMap);

                    // Create popup content
                    const popupContent = `
                      <div class="space-popup">
                        <b>Space ID:</b> ${space.parkingSpaceID}<br>
                        <b>Type:</b> ${space.parkingType}<br>
                        <b>Available:</b> ${
                          space.isAvailable ? "Yes" : "No"
                        }<br>
                        <b>Features:</b><br>
                        ${space.isNearest ? "• Nearest<br>" : ""}
                        ${space.isCovered ? "• Covered<br>" : ""}
                        ${
                          space.isWheelchairAccessible
                            ? "• Wheelchair Accessible<br>"
                            : ""
                        }
                        ${space.hasLargeSpace ? "• Large Space<br>" : ""}
                        ${space.isWellLitArea ? "• Well Lit<br>" : ""}
                        ${space.hasEVCharging ? "• EV Charging<br>" : ""}
                        ${
                          space.isFamilyParkingArea
                            ? "• Family Parking<br>"
                            : ""
                        }
                        ${space.isPremium ? "• Premium<br>" : ""}
                      </div>
                    `;

                    marker.bindPopup(popupContent);
                  }
                } catch (error) {
                  console.error(
                    "Error creating marker for space:",
                    space.parkingSpaceID,
                    error
                  );
                }
              }
            });
          }
        })
        .catch((err) => {
          console.error("Error fetching lot boundary:", err);
        });
    })
    .catch((err) => {
      console.error("Error fetching spaces:", err);
      alert("Failed to load parking spaces.");
    });
}

// Function to display rows for the current page
function displayTableRows() {
  const tableBody = document.querySelector("#spaces-table tbody");

  if (!tableBody) {
    console.error("Table body element not found!");
    return;
  }

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, tableData.length);
  const paginatedSpaces = tableData.slice(startIndex, endIndex);

  tableBody.innerHTML = ""; // Clear existing rows
  paginatedSpaces.forEach((space) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${space.parkingSpaceID}</td>
      <td>${space.parkingType}</td>
      <td>${space.isNearest ? "Yes" : "No"}</td>
      <td>${space.isCovered ? "Yes" : "No"}</td>
      <td>${space.isWheelchairAccessible ? "Yes" : "No"}</td>
      <td>${space.hasLargeSpace ? "Yes" : "No"}</td>
      <td>${space.isWellLitArea ? "Yes" : "No"}</td>
      <td>${space.hasEVCharging ? "Yes" : "No"}</td>
      <td>${space.isFamilyParkingArea ? "Yes" : "No"}</td>
      <td>${space.isPremium ? "Yes" : "No"}</td>
      <td>${space.lotID}</td>
      <td>${space.isAvailable ? "Available" : "Not Available"}</td>
      <td>${space.coordinates || "N/A"}</td>
      <td>
        <button class="action-btn edit-btn" onclick="navigateToEdit('${
          space.parkingSpaceID
        }')">Edit</button>
        <button class="action-btn delete-btn" onclick="deleteParkingSpace('${
          space.parkingSpaceID
        }')">Delete</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

function createPaginationControls() {
  const paginationControls = document.getElementById("paginationControls");
  if (!paginationControls) return;

  paginationControls.innerHTML = "";
  const totalPages = Math.ceil(tableData.length / rowsPerPage);

  if (totalPages <= 1) {
    paginationControls.style.display = "none";
    return;
  }

  paginationControls.style.display = "block";

  // Previous button
  const prevButton = document.createElement("button");
  prevButton.textContent = "Previous";
  prevButton.disabled = currentPage === 1;
  prevButton.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      displayTableRows();
      createPaginationControls();
    }
  };
  paginationControls.appendChild(prevButton);

  // Page buttons
  let startPage = Math.max(1, currentPage - Math.floor(maxVisibleButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxVisibleButtons - 1);

  // Adjust start page if we're near the end
  if (endPage - startPage + 1 < maxVisibleButtons) {
    startPage = Math.max(1, endPage - maxVisibleButtons + 1);
  }

  // First page button if not visible
  if (startPage > 1) {
    const firstButton = document.createElement("button");
    firstButton.textContent = "1";
    firstButton.onclick = () => {
      currentPage = 1;
      displayTableRows();
      createPaginationControls();
    };
    paginationControls.appendChild(firstButton);

    if (startPage > 2) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      paginationControls.appendChild(ellipsis);
    }
  }

  // Numbered page buttons
  for (let i = startPage; i <= endPage; i++) {
    const button = document.createElement("button");
    button.textContent = i.toString();
    button.classList.toggle("active", i === currentPage);
    button.onclick = () => {
      currentPage = i;
      displayTableRows();
      createPaginationControls();
    };
    paginationControls.appendChild(button);
  }

  // Last page button if not visible
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.className = "pagination-ellipsis";
      paginationControls.appendChild(ellipsis);
    }

    const lastButton = document.createElement("button");
    lastButton.textContent = totalPages.toString();
    lastButton.onclick = () => {
      currentPage = totalPages;
      displayTableRows();
      createPaginationControls();
    };
    paginationControls.appendChild(lastButton);
  }

  // Next button
  const nextButton = document.createElement("button");
  nextButton.textContent = "Next";
  nextButton.disabled = currentPage === totalPages;
  nextButton.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      displayTableRows();
      createPaginationControls();
    }
  };
  paginationControls.appendChild(nextButton);
}

// Navigate to edit space
function navigateToEdit(spaceID) {
  window.location.href = `edit-space.html?id=${spaceID}`;
}

function editParkingSpace(event) {
  event.preventDefault();

  const form = event.target;
  const formData = new FormData(form);
  const spaceID = formData.get("spaceID");

  // Convert form data to JSON object
  const updatedSpace = {
    parkingType: formData.get("parkingType"),
    isNearest: formData.get("isNearest") === "on" ? 1 : 0,
    isCovered: formData.get("isCovered") === "on" ? 1 : 0,
    isWheelchairAccessible:
      formData.get("isWheelchairAccessible") === "on" ? 1 : 0,
    hasLargeSpace: formData.get("hasLargeSpace") === "on" ? 1 : 0,
    isWellLitArea: formData.get("isWellLitArea") === "on" ? 1 : 0,
    hasEVCharging: formData.get("hasEVCharging") === "on" ? 1 : 0,
    isFamilyParkingArea: formData.get("isFamilyParkingArea") === "on" ? 1 : 0,
    isPremium: formData.get("isPremium") === "on" ? 1 : 0,
    isAvailable: formData.get("isAvailable") === "on" ? 1 : 0,
    lotID: formData.get("lotID"),
    coordinates: formData.get("coordinates"),
  };

  // Send PUT request to update the parking space
  fetch(`/update-space/${spaceID}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatedSpace),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      alert("Parking space updated successfully!");
      // Redirect back to the lot view
      window.location.href = `index.html?lotID=${updatedSpace.lotID}`;
    })
    .catch((error) => {
      console.error("Error updating parking space:", error);
      alert("Error updating parking space: " + error.message);
    });
}

let editSpaceMap = null;
let editSpaceMarker = null;

function initializeEditSpaceMap(coordinates) {
  if (editSpaceMap) {
    editSpaceMap.off();
    editSpaceMap.remove();
  }

  // Initialize map
  editSpaceMap = L.map("edit-space-map").setView([4.2105, 108.9758], 6);

  // Add satellite layer
  const satelliteTile = L.tileLayer(
    "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      maxZoom: 22,
    }
  );
  satelliteTile.addTo(editSpaceMap);

  // If coordinates exist, add marker and center map
  if (coordinates) {
    const [lat, lng] = coordinates
      .split(",")
      .map((coord) => parseFloat(coord.trim()));
    if (!isNaN(lat) && !isNaN(lng)) {
      editSpaceMap.setView([lat, lng], 19);
      editSpaceMarker = L.marker([lat, lng], { draggable: true }).addTo(
        editSpaceMap
      );

      // Update coordinates when marker is dragged
      editSpaceMarker.on("dragend", function (e) {
        const position = e.target.getLatLng();
        document.getElementById(
          "coordinates"
        ).value = `${position.lat},${position.lng}`;
      });
    }
  }

  // Add click handler to update marker position
  editSpaceMap.on("click", function (e) {
    const position = e.latlng;

    if (editSpaceMarker) {
      editSpaceMap.removeLayer(editSpaceMarker);
    }

    editSpaceMarker = L.marker(position, { draggable: true }).addTo(
      editSpaceMap
    );
    document.getElementById(
      "coordinates"
    ).value = `${position.lat},${position.lng}`;

    // Update coordinates when marker is dragged
    editSpaceMarker.on("dragend", function (e) {
      const newPos = e.target.getLatLng();
      document.getElementById(
        "coordinates"
      ).value = `${newPos.lat},${newPos.lng}`;
    });
  });
}

// Add this function to load parking space data
function loadParkingSpaceData(spaceID) {
  fetch(`/get-parking-space/${spaceID}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((space) => {
      // Fill in the form with existing data
      document.querySelector('input[name="spaceID"]').value =
        space.parkingSpaceID;
      document.querySelector('input[name="lotID"]').value = space.lotID;
      document.getElementById("displaySpaceID").value = space.parkingSpaceID;
      document.getElementById("displayLotID").value = space.lotID;
      document.querySelector('select[name="parkingType"]').value =
        space.parkingType;

      // Set checkbox values
      document.querySelector('input[name="isNearest"]').checked =
        space.isNearest === 1;
      document.querySelector('input[name="isCovered"]').checked =
        space.isCovered === 1;
      document.querySelector('input[name="isWheelchairAccessible"]').checked =
        space.isWheelchairAccessible === 1;
      document.querySelector('input[name="hasLargeSpace"]').checked =
        space.hasLargeSpace === 1;
      document.querySelector('input[name="isWellLitArea"]').checked =
        space.isWellLitArea === 1;
      document.querySelector('input[name="hasEVCharging"]').checked =
        space.hasEVCharging === 1;
      document.querySelector('input[name="isFamilyParkingArea"]').checked =
        space.isFamilyParkingArea === 1;
      document.querySelector('input[name="isPremium"]').checked =
        space.isPremium === 1;
      document.querySelector('input[name="isAvailable"]').checked =
        space.isAvailable === 1;

      if (space.coordinates) {
        document.getElementById("coordinates").value = space.coordinates;
        initializeEditSpaceMap(space.coordinates);
      } else {
        initializeEditSpaceMap(null);
      }
    })
    .catch((error) => {
      console.error("Error loading parking space data:", error);
      alert("Error loading parking space data: " + error.message);
    });
}

// Delete parking space
function deleteParkingSpace(spaceID) {
  if (confirm("Are you sure you want to delete this parking space?")) {
    fetch(`/delete-space/${spaceID}`, { method: "DELETE" })
      .then(() => {
        alert("Parking space deleted successfully.");
        loadParkingLots();
      })
      .catch((err) => {
        console.error("Error deleting parking space:", err);
        alert("Failed to delete parking space.");
      });
  }
}

function viewLotOnMap(lotID) {
  console.log(`Displaying map for lotID: ${lotID}`);

  const mapContainer = document.getElementById("view-map-container");

  if (!mapContainer) {
    console.error("Map container not found!");
    return;
  }

  if (currentMap) {
    currentMap.off();
    currentMap.remove();
  }

  currentMap = L.map("map").setView([4.2105, 108.9758], 6);
  const satelliteTile = L.tileLayer(
    "http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      maxZoom: 22,
    }
  );
  satelliteTile.addTo(currentMap);

  // Fetch and display the boundary
  fetch(`/get-lot-boundary/${lotID}`)
    .then((response) => {
      if (!response.ok) throw new Error("Failed to fetch lot boundary");
      return response.json();
    })
    .then((coordinates) => {
      if (!coordinates || coordinates.length === 0) {
        alert("No boundary data found for this lot");
        return;
      }

      const polygon = L.polygon(coordinates, {
        color: "blue",
        fillOpacity: 0.4,
      }).addTo(currentMap);

      currentMap.fitBounds(polygon.getBounds());
    })
    .catch((err) => {
      console.error("Error fetching lot boundary:", err);
      alert("Failed to load lot boundary.");
    });
}

function startSpaceMarking() {
  const lotID = document.getElementById("lotSelect").value;
  const spaceID = document.getElementById("spaceID").value;

  if (!lotID || !spaceID) {
    alert("Please select a parking lot and generate a space ID first");
    return;
  }

  // Get the lot boundaries first
  fetch(`/get-lot-boundary/${lotID}`)
    .then((response) => response.json())
    .then((coordinates) => {
      if (!coordinates || coordinates.length === 0) {
        alert("No boundary found for this parking lot");
        return;
      }

      if (currentMap) {
        currentMap.off();
        currentMap.remove();
      }

      // Initialize map
      currentMap = L.map("space-map", {
        maxZoom: 22,
        minZoom: 15,
      }).setView([coordinates[0][0], coordinates[0][1]], 19);

      // Google Satellite (Primary layer)
      const googleSat = L.tileLayer(
        "http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
          maxZoom: 22,
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
        }
      ).addTo(currentMap);

      // OpenStreetMap (Alternative layer)
      const streets = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 22,
        }
      );

      // Layer control
      const baseMaps = {
        Satellite: googleSat,
        Streets: streets,
      };
      L.control.layers(baseMaps).addTo(currentMap);

      // Draw lot boundary
      const polygon = L.polygon(coordinates, {
        color: "yellow", // Yellow boundary for better visibility on satellite
        weight: 2,
        fillOpacity: 0.1,
      }).addTo(currentMap);

      // Fit map to boundary
      currentMap.fitBounds(polygon.getBounds());

      // Clear any existing markers
      if (currentMarker) {
        currentMap.removeLayer(currentMarker);
      }

      // Add click handler for marking space location
      currentMap.on("click", function (e) {
        if (currentMarker) {
          currentMap.removeLayer(currentMarker);
        }

        currentMarker = L.marker(e.latlng, {
          draggable: true,
        }).addTo(currentMap);

        currentSpaceCoordinates = e.latlng;

        const popupContent = `
                    <div class="space-popup">
                        <b>Space ID:</b> ${spaceID}<br>
                        <b>Type:</b> ${
                          document.getElementById("parkingType").value
                        }<br>
                        <b>Coordinates:</b><br>
                        Lat: ${e.latlng.lat.toFixed(6)}<br>
                        Lng: ${e.latlng.lng.toFixed(6)}<br>
                        <button type="button" class="save-space-btn" onclick="window.saveNewParkingSpace()">Save Space</button>
                    </div>
                `;
        currentMarker.bindPopup(popupContent).openPopup();
      });
    })
    .catch((err) => {
      console.error("Error loading lot boundaries:", err);
      alert("Error loading lot boundaries");
    });
}

function loadLotSelect() {
  fetch("/get-all-lots")
    .then((response) => response.json())
    .then((lots) => {
      const select = document.getElementById("lotSelect");
      if (!select) {
        console.error("lotSelect element not found in the DOM.");
        return;
      }
      select.innerHTML = '<option value="">Select Parking Lot</option>';
      lots.forEach((lot) => {
        select.innerHTML += `<option value="${lot.lotID}">${lot.lotID} - ${lot.location}</option>`;
      });
    })
    .catch((err) => console.error("Error loading lots:", err));
}

document.addEventListener("DOMContentLoaded", function () {
  const lotSelect = document.getElementById("lotSelect");
  if (lotSelect) {
    lotSelect.addEventListener("change", function () {
      const lotID = this.value;
      if (lotID) {
        fetch(`/get-next-space-number/${lotID}`)
          .then((response) => response.json())
          .then((data) => {
            const spaceIDInput = document.getElementById("spaceID");
            spaceIDInput.value = `${lotID}_${String(data.nextNumber).padStart(
              2,
              "0"
            )}`;
            spaceIDInput.readOnly = true;

            document.getElementById("parkingType").disabled = false;
          });
      } else {
        document.getElementById("spaceID").value = "";
        document.getElementById("spaceID").readOnly = false;
        document.getElementById("parkingType").disabled = true;
      }
    });
  } else {
    console.error("lotSelect element not found in the DOM.");
  }
});

// Make saveNewParkingSpace globally accessible
window.saveNewParkingSpace = function () {
  console.log("Save function called"); // Debug log

  if (!currentSpaceCoordinates) {
    alert("Please mark a location on the map first");
    return;
  }

  const spaceData = {
    parkingSpaceID: document.getElementById("spaceID").value,
    parkingType: document.getElementById("parkingType").value,
    isNearest: document.getElementById("isNearest").checked ? 1 : 0,
    isCovered: document.getElementById("isCovered").checked ? 1 : 0,
    isWheelchairAccessible: document.getElementById("isWheelchairAccessible")
      .checked
      ? 1
      : 0,
    hasLargeSpace: document.getElementById("hasLargeSpace").checked ? 1 : 0,
    isWellLitArea: document.getElementById("isWellLitArea").checked ? 1 : 0,
    hasEVCharging: document.getElementById("hasEVCharging").checked ? 1 : 0,
    isFamilyParkingArea: document.getElementById("isFamilyParkingArea").checked
      ? 1
      : 0,
    isPremium: document.getElementById("isPremium").checked ? 1 : 0,
    isAvailable: document.getElementById("isAvailable").checked ? 1 : 0,
    lotID: document.getElementById("lotSelect").value,
    coordinates: [currentSpaceCoordinates.lat, currentSpaceCoordinates.lng],
  };

  console.log("Saving space data:", spaceData); // Debug log

  // Send data to server
  fetch("/create-space", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(spaceData),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      console.log("Save response:", data); // Debug log
      alert("Parking space saved successfully!");

      // Clear the marker
      if (currentMarker) {
        currentMap.removeLayer(currentMarker);
        currentMarker = null;
        currentSpaceCoordinates = null;
      }

      // Refresh the parking spaces table
      loadParkingSpaces();
    })
    .catch((error) => {
      console.error("Error saving parking space:", error);
      alert("Error saving parking space: " + error.message);
    });
};

// Function to reset the form
function resetSpaceForm() {
  document.getElementById("parkingType").value = "";
  document
    .querySelectorAll('.checkbox-group input[type="checkbox"]')
    .forEach((checkbox) => {
      checkbox.checked = false;
    });
  // Generate new space ID if needed
  loadNextSpaceID(document.getElementById("lotSelect").value);
}

// Add event listener for parking type selection
document.getElementById("parkingType")?.addEventListener("change", function () {
  // Get all checkbox elements
  const isNearest = document.getElementById("isNearest");
  const isWheelchairAccessible = document.getElementById(
    "isWheelchairAccessible"
  );
  const isWellLitArea = document.getElementById("isWellLitArea");
  const isPremium = document.getElementById("isPremium");
  const hasEVCharging = document.getElementById("hasEVCharging");
  const hasLargeSpace = document.getElementById("hasLargeSpace");

  // Reset all checkboxes first
  const allCheckboxes = document.querySelectorAll(
    '.checkbox-group input[type="checkbox"]'
  );
  allCheckboxes.forEach((checkbox) => {
    checkbox.checked = false;
    checkbox.disabled = false; // Enable all checkboxes for potential manual changes
  });

  // Auto-tick based on parking type
  switch (this.value) {
    case "Special":
      isNearest.checked = true;
      isWheelchairAccessible.checked = true;
      isWellLitArea.checked = true;

      // Optional: Add visual indication that these were auto-selected
      [isNearest, isWheelchairAccessible, isWellLitArea].forEach((checkbox) => {
        checkbox.parentElement.classList.add("auto-selected");
      });
      break;

    case "Female":
      isNearest.checked = true;
      isWellLitArea.checked = true;

      [isNearest, isWellLitArea].forEach((checkbox) => {
        checkbox.parentElement.classList.add("auto-selected");
      });
      break;

    case "Premium":
      isPremium.checked = true;

      isPremium.parentElement.classList.add("auto-selected");
      break;

    case "EV":
      hasEVCharging.checked = true;

      hasEVCharging.parentElement.classList.add("auto-selected");
      break;

    case "Family":
      hasLargeSpace.checked = true;

      hasLargeSpace.parentElement.classList.add("auto-selected");
      break;

    default:
      // Remove all auto-selected indicators
      document.querySelectorAll(".auto-selected").forEach((el) => {
        el.classList.remove("auto-selected");
      });
      break;
  }
});

// Add event listener for checkbox changes to remove auto-selected indication when manually changed
document
  .querySelectorAll('.checkbox-group input[type="checkbox"]')
  .forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      this.parentElement.classList.remove("auto-selected");
    });
  });
