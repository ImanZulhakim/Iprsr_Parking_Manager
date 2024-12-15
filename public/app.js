// Global variables
let currentPage = 1;
const rowsPerPage = 10;
const maxVisibleButtons = 5;

let tableData = [];
let currentMap = null; // Outdoor parking lot map
let drawnItems = null; // For drawn shapes on outdoor map
let currentLotID = null; // Selected lot ID
let currentMarker = null; // Marker for indoor lot location
let currentSpaceCoordinates = null;
let editSpaceMap = null;
let editSpaceMarker = null;
let currentLocationType = null;

// Document ready
$(document).ready(function () {
  $("#navbar-placeholder").load("navbar.html", function () {
    // Only try to show view-lots if we're on the index page
    const viewLotsElement = document.querySelector("#view-lots");
    if (viewLotsElement) {
      viewLotsElement.style.display = "none"; // Ensure Parking Lots section is hidden
    }
    const sectionTitle = document.getElementById("section-title");
    if (sectionTitle) sectionTitle.textContent = "Home";

    // Load Parking Locations on page load
    loadParkingLocations();
  });
});

// Initialize map
function initMap(containerId) {
  if (currentMap) {
    currentMap.remove();
  }

  currentMap = L.map(containerId).setView([4.2105, 108.9758], 6);

  // Add satellite layer from Google
  const satelliteTile = L.tileLayer(
    "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      maxZoom: 22,
      attribution: "© Google",
    }
  ).addTo(currentMap);

  // Add OpenStreetMap as alternative layer
  const streets = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 22,
      attribution: "© OpenStreetMap contributors",
    }
  );

  // Add layer control
  const baseMaps = {
    Satellite: satelliteTile,
    Streets: streets,
  };
  L.control.layers(baseMaps).addTo(currentMap);

  drawnItems = new L.FeatureGroup();
  currentMap.addLayer(drawnItems);

  return currentMap;
}

// Initialize drawing map to draw parking lot boundary
function drawParkingLot(lotID) {
  const locationType = document.getElementById("locationType").value;

  if (locationType === "indoor") {
    return;
  }

  if (currentMap) {
    currentMap.off();
    currentMap.remove();
  }

  currentMap = L.map("map").setView([4.2105, 101.9758], 7);

  const satelliteTile = L.tileLayer(
    "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      maxZoom: 22,
      attribution: "© Google",
    }
  ).addTo(currentMap);

  const streets = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 22,
      attribution: "© OpenStreetMap contributors",
    }
  );

  const baseMaps = {
    Satellite: satelliteTile,
    Streets: streets,
  };
  L.control.layers(baseMaps).addTo(currentMap);

  // Replace the existing geocoder setup with this enhanced version
  const geocoder = L.Control.Geocoder.nominatim({
    geocodingQueryParams: {
      countrycodes: "my", // Limit to Malaysia
      addressdetails: 1, // Get detailed address information
      format: "json",
    },
  });

  L.Control.geocoder({
    geocoder: geocoder,
    defaultMarkGeocode: false,
    placeholder: "Search for location...",
    collapsed: false,
  })
    .on("markgeocode", function (e) {
      const latlng = e.geocode.center;
      currentMap.setView(latlng, 17);

      // Extract address details
      const address = e.geocode.properties.address;
      const state = address.state || "";
      const district = address.county || address.city || "";

      // Create popup content with address details
      const popupContent = `
    <strong>${address.name || ""}</strong><br>
    ${district}<br>
    ${state}
  `;

      // Clear existing markers
      currentMap.eachLayer(function (layer) {
        if (layer instanceof L.Marker) {
          currentMap.removeLayer(layer);
        }
      });

      // Add marker with address popup
      L.marker(latlng).addTo(currentMap).bindPopup(popupContent).openPopup();
    })
    .addTo(currentMap);

  drawnItems = new L.FeatureGroup();
  currentMap.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    draw: {
      polygon: true,
      polyline: false,
      circle: false,
      rectangle: false,
      circlemarker: false,
      marker: false,
    },
    edit: {
      featureGroup: drawnItems,
    },
  });
  currentMap.addControl(drawControl);

  // Just add the drawn shape to the map without saving
  currentMap.on(L.Draw.Event.CREATED, function (event) {
    drawnItems.clearLayers(); // Clear any existing shapes
    const layer = event.layer;
    drawnItems.addLayer(layer);
  });
}

// Calculate the centroid of the polygon
function calculateCentroid(coordinates) {
  let sumLat = 0;
  let sumLng = 0;
  const totalPoints = coordinates.length;

  coordinates.forEach((coord) => {
    sumLat += coord[0];
    sumLng += coord[1];
  });

  const centerLat = sumLat / totalPoints;
  const centerLng = sumLng / totalPoints;

  return [centerLat, centerLng];
}

// Add event listener for checkbox changes to remove auto-selected indication when manually changed
document
  .querySelectorAll('.checkbox-group input[type="checkbox"]')
  .forEach((checkbox) => {
    checkbox.addEventListener("change", function () {
      this.parentElement.classList.remove("auto-selected");
    });
  });

// Initialize indoor map when location type changes
document.getElementById("locationType").addEventListener("change", function () {
  const locationType = this.value;
  if (locationType === "indoor") {
    initIndoorMap();
  }
});

// Initialize indoor map
function initIndoorMap() {
  if (currentMap) {
    currentMap.remove();
  }

  currentMap = L.map("map").setView([4.2105, 101.9758], 7);

  // Add satellite layer
  const satelliteTile = L.tileLayer(
    "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
      subdomains: ["mt0", "mt1", "mt2", "mt3"],
      maxZoom: 22,
      attribution: "© Google",
    }
  ).addTo(currentMap);

  // Add streets layer
  const streets = L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 22,
      attribution: "© OpenStreetMap contributors",
    }
  );

  // Add layer control
  const baseMaps = {
    Satellite: satelliteTile,
    Streets: streets,
  };
  L.control.layers(baseMaps).addTo(currentMap);

  // Add click handler for marker placement
  currentMap.on("click", function (e) {
    if (currentMarker) {
      currentMap.removeLayer(currentMarker);
    }
    currentMarker = L.marker(e.latlng).addTo(currentMap);
    currentSpaceCoordinates = {
      lat: e.latlng.lat.toFixed(6),
      lng: e.latlng.lng.toFixed(6),
    };
  });

  // Add geocoder for location search
  const geocoder = L.Control.Geocoder.nominatim({
    geocodingQueryParams: {
      countrycodes: "my",
      addressdetails: 1,
      format: "json",
    },
  });

  L.Control.geocoder({
    geocoder: geocoder,
    defaultMarkGeocode: false,
    placeholder: "Search for location...",
    collapsed: false,
  }).addTo(currentMap);

  return currentMap;
}

// Save indoor parking lot
function saveIndoorParkingLot() {
  const lotID = document.getElementById("lotID").value;
  const locationName = document.getElementById("lotName").value;
  const locationID = document.getElementById("hiddenLocationID").value;

  if (!lotID || !locationName || !locationID || !currentSpaceCoordinates) {
    showPopup(
      "Please fill all fields and mark the location on the map.",
      "error"
    );
    return;
  }

  const coordinates = `${currentSpaceCoordinates.lat},${currentSpaceCoordinates.lng}`;

  fetch("/add-lot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lotID,
      lot_name: locationName,
      locationID,
      locationType: "indoor",
      coordinates,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((err) => {
          throw new Error(err.message || "Error creating indoor parking lot");
        });
      }
      return response.json();
    })
    .then((data) => {
      showPopup("Indoor parking lot added successfully!", "success");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 2000);
    })
    .catch((err) => {
      console.error("Error creating indoor parking lot:", err);
      showPopup(`Error creating indoor parking lot: ${err.message}`, "error");
    });
}

// Start drawing for outdoor parking lot
function startDrawing() {
  const lotID = document.getElementById("lotID").value;
  const locationName = document.getElementById("lotName").value;
  const locationID = document.getElementById("hiddenLocationID").value;

  if (!lotID || !locationName || !locationID) {
    showPopup("Please fill in all required fields before drawing.", "error");
    return;
  }

  drawParkingLot(lotID);
}

// Save outdoor parking lot
function saveOutdoorParkingLot() {
  if (!drawnItems || drawnItems.getLayers().length === 0) {
    showPopup("Please draw the parking lot boundary first.", "error");
    return;
  }

  const layer = drawnItems.getLayers()[0];
  const coordinates = layer
    .getLatLngs()[0]
    .map((coord) => [coord.lat, coord.lng]);
  const [centerLat, centerLng] = calculateCentroid(coordinates);

  const lotID = document.getElementById("lotID").value;
  const locationName = document.getElementById("lotName").value;
  const locationID = document.getElementById("hiddenLocationID").value;

  // First save the lot details
  fetch("/add-lot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lotID,
      lot_name: locationName,
      locationID,
      locationType: "outdoor",
      coordinates: `${centerLat},${centerLng}`,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to save lot details");
      }
      // Then save the boundary
      return fetch("/add-lot-boundary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lotID,
          coordinates,
          centerCoordinates: `${centerLat},${centerLng}`,
        }),
      });
    })
    .then(() => {
      showPopup("Parking lot saved successfully!", "success");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 2000);
    })
    .catch((err) => {
      console.error("Error saving parking lot:", err);
      showPopup("Error saving parking lot. Please try again.", "error");
    });
}

// Delete parking lot
async function deleteParkingLot(lotID) {
  try {
    const initialConfirm = await showConfirmDialog(
      "Are you sure you want to delete this parking lot? This action cannot be undone."
    );

    if (!initialConfirm) return;

    const response = await fetch(`/check-lot-spaces/${lotID}`);
    const data = await response.json();

    if (data.hasSpaces) {
      const spaceConfirm = await showConfirmDialog(
        `This parking lot contains ${data.spaceCount} parking spaces. Do you want to delete the lot and all its spaces?`
      );
      if (spaceConfirm) {
        performLotDeletion(lotID);
      }
    } else {
      performLotDeletion(lotID);
    }
  } catch (error) {
    console.error("Error:", error);
    showPopup("Error checking parking spaces. Please try again.", "error");
  }
}

// Perform lot deletion
function performLotDeletion(lotID) {
  fetch(`/delete-lot/${lotID}`, {
    method: "DELETE",
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((err) => Promise.reject(err));
      }
      return response.json();
    })
    .then((data) => {
      showPopup(data.message, "success");
      viewSpaces(lotID); // Refresh lots list

      // Clear and hide parking spaces table
      const spacesContainer = document.querySelector(
        "#parking-spaces-container"
      );
      if (spacesContainer) {
        spacesContainer.style.display = "none";
      }

      // Clear and hide map
      const mapContainer = document.querySelector("#view-map-container");
      if (mapContainer) {
        mapContainer.style.display = "none";
      }

      // Remove map instance if exists
      if (currentMap) {
        currentMap.remove();
        currentMap = null;
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      showPopup(
        error.message || "Error deleting parking lot. Please try again.",
        "error"
      );
    });
}

// Handle Add Location Form Submission
document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("add-location-form");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      const locationID = document.getElementById("locationID").value;
      const locationName = document.getElementById("locationName").value;
      const district = document.getElementById("district").value;
      const state = document.getElementById("state").value;

      fetch("/add-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationID, locationName, district, state }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Failed to save location");
          return response.json();
        })
        .then((data) => {
          showPopup(data.message, "success");
          setTimeout(() => {
            window.location.href = "index.html"; // Redirect back to the main page
          }, 2000);
        })
        .catch((error) => {
          console.error("Error:", error);
          alert("Error adding location. Please try again.");
        });
    });
  }
});

// Redirect to the previous page
function goBack() {
  window.location.href = "index.html";
}

// Load parking locations
function loadParkingLocations() {
  fetch("/get-all-locations")
    .then((response) => response.json())
    .then((locations) => {
      const locationsTableBody = document.querySelector(
        "#locations-table tbody"
      );
      if (!locationsTableBody) {
        console.error("Locations table body not found.");
        return;
      }

      locationsTableBody.innerHTML = locations.length
        ? locations
            .map(
              (location) => `
                  <tr data-location-id="${location.locationID}">
                      <td>${location.locationID}</td>
                      <td>${location.location_name}</td>
                      <td>${location.district}</td>
                      <td>${location.state}</td>
                      <td>
                        <!-- View Lots Button -->
                        <button class="action-btn view-btn" onclick="viewLots('${location.locationID}', '${location.location_name}')">
                          <i class="fas fa-eye"></i> View Lots
                        </button>
                        <!-- Edit Location Button -->
                        <button class="action-btn edit-btn" onclick="editParkingLocation('${location.locationID}')">
                          <i class="fas fa-edit"></i> Edit
                        </button>
                        <!-- Delete Location Button -->
                        <button class="action-btn delete-btn" onclick="deleteParkingLocation('${location.locationID}')">
                          <i class="fas fa-trash"></i>
                        </button>
                      </td>
                  </tr>`
            )
            .join("")
        : '<tr><td colspan="5">No parking locations available</td></tr>';
    })
    .catch((err) => {
      console.error("Error loading parking locations:", err);
      showPopup("Failed to load parking locations.", "error");
    });
}

// Go to add location page
function goToAddLocation() {
  // Redirect to add-location.html for creating a new parking location
  window.location.href = "add-location.html";
}

// Delete parking location
async function deleteParkingLocation(locationID) {
  try {
    // Confirm deletion with the user
    const confirmDelete = await showConfirmDialog(
      "Are you sure you want to delete this parking location? This action cannot be undone."
    );

    if (!confirmDelete) return; // If user cancels, do nothing

    // Send DELETE request to the server
    const response = await fetch(`/delete-location/${locationID}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Show success message
    showPopup(data.message, "success");
  } catch (error) {
    console.error("Error deleting parking location:", error);
    showPopup("Error deleting parking location. Please try again.", "error");
  }
}

// Ensure script runs after DOM is fully loaded
document.addEventListener("DOMContentLoaded", function () {
  // Check which page we are on
  if (window.location.pathname.includes("edit-location.html")) {
    prefillFormFields();
    handleFormSubmission();
  }
});

// Function to fetch location data and redirect to the edit page
function editParkingLocation(locationID) {
  fetch(`/get-location/${locationID}`)
    .then((response) => response.json())
    .then((location) => {
      if (!location) {
        alert("Location not found.");
        return;
      }

      // Build query parameters to pass data to the edit page
      const queryParams = new URLSearchParams({
        locationID: location.locationID,
        locationName: location.location_name,
        district: location.district,
        state: location.state,
      });

      // Redirect to edit-location.html with query parameters
      window.location.href = `edit-location.html?${queryParams.toString()}`;
    })
    .catch((error) => {
      console.error("Error fetching location details:", error);
      alert("Failed to fetch location data.");
    });
}

// Function to pre-fill form fields on the edit page
function prefillFormFields() {
  const urlParams = new URLSearchParams(window.location.search);

  const locationID = urlParams.get("locationID");
  const locationName = urlParams.get("locationName");
  const district = urlParams.get("district");
  const state = urlParams.get("state");

  // Populate fields if query parameters are present
  if (locationID && locationName && district && state) {
    document.querySelector("#locationID").value = locationID;
    document.querySelector("#locationName").value = locationName;
    document.querySelector("#district").value = district;
    document.querySelector("#state").value = state;
  } else {
    console.error("Invalid or missing query parameters.");
    alert("Error loading location data.");
  }
}

// Function to handle form submission and update location data
function handleFormSubmission() {
  const editForm = document.querySelector("#edit-location-form");

  if (editForm) {
    editForm.addEventListener("submit", function (event) {
      event.preventDefault();

      // Collect form data
      const locationID = document.querySelector("#locationID").value;
      const locationName = document.querySelector("#locationName").value;
      const district = document.querySelector("#district").value;
      const state = document.querySelector("#state").value;

      // Send updated data to the server
      fetch("/update-location", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationID, locationName, district, state }),
      })
        .then((response) => {
          if (!response.ok) throw new Error("Failed to update location");
          return response.json();
        })
        .then((data) => {
          showPopup("Location updated successfully!", "success");
          setTimeout(() => {
            window.location.href = "index.html"; // Redirect back to the main page
          }, 2000);
        })
        .catch((error) => {
          console.error("Error:", error);
          alert("Error updating location. Please try again.");
        });
    });
  }
}

// Go to add lot page
function goToAddLot() {
  const locationID = localStorage.getItem("currentLocationID");
  const locationName = localStorage.getItem("currentLocationName");

  if (!locationID) {
    alert("Location ID is missing. Unable to add a lot.");
    return;
  }

  window.location.href = `add-lot.html?locationID=${encodeURIComponent(
    locationID
  )}&locationName=${encodeURIComponent(locationName)}`;
}

// Show parking lots when "View Lots" button is clicked
function viewLots(locationID, locationName) {
  // Store both locationID and locationName
  localStorage.setItem("currentLocationID", locationID);
  localStorage.setItem("currentLocationName", locationName);

  const locationsContainer = document.querySelector("#view-locations");
  const lotsContainer = document.querySelector("#view-lots");

  if (locationsContainer && lotsContainer) {
    locationsContainer.style.display = "none";
    lotsContainer.style.display = "block";

    const lotsTitle = document.querySelector("#view-lots .table-header h3");
    if (lotsTitle) {
      lotsTitle.textContent = `Parking Lots for ${locationName}`;
    }

    // Update the add button to include both ID and name
    const addLotButton = document.querySelector("#view-lots .add-btn");
    if (addLotButton) {
      addLotButton.setAttribute("onclick", `goToAddLot()`);
    }

    loadParkingLots(locationID);
  }
}

// Go back to Parking Locations
function goBackToLocations() {
  // Hide Parking Lots table
  const lotsContainer = document.querySelector("#view-lots");
  if (lotsContainer) lotsContainer.style.display = "none";

  // Hide Parking Spaces table
  const spacesContainer = document.querySelector("#parking-spaces-container");
  if (spacesContainer) spacesContainer.style.display = "none";

  // Hide the Map container
  const mapContainer = document.querySelector("#view-map-container");
  if (mapContainer) mapContainer.style.display = "none";

  // Show Parking Locations table
  const locationsContainer = document.querySelector("#view-locations");
  if (locationsContainer) locationsContainer.style.display = "block";

  // Clear map instance if exists
  if (currentMap) {
    currentMap.off();
    currentMap.remove();
    currentMap = null;
  }
}

// Load parking lots based on the selected location
function loadParkingLots(locationID) {
  fetch(`/get-lots-by-location/${locationID}`)
    .then((response) => response.json())
    .then((lots) => {
      const lotsTableBody = document.querySelector("#lots-table tbody");
      if (!lotsTableBody) {
        console.error("Lots table body not found.");
        return;
      }

      // Populate table or display fallback
      lotsTableBody.innerHTML = lots.length
        ? lots
            .map(
              (lot) => `
          <tr>
            <td>${lot.lotID}</td>
            <td>${lot.lot_name}</td>
            <td>
              <button class="action-btn view-btn" onclick="viewSpaces('${lot.lotID}')">
                <i class="fas fa-eye"></i> View Spaces
              </button>
              <div class="toggle-container">
                  <input type="checkbox" id="toggle-${lot.lotID}" class="toggle-checkbox" onchange="toggleReserved('${lot.lotID}', this)">
                  <label for="toggle-${lot.lotID}" class="toggle-label">
                      <div class="toggle-inner">
                          <span class="reserve">RESERVE LOT</span>
                      </div>
                      <div class="toggle-switch"></div>
                  </label>
              </div>
              <button class="action-btn edit-btn" onclick="editLotBoundary('${lot.lotID}')">
                <i class="fas fa-draw-polygon"></i> Edit Boundary
              </button>
              <button class="action-btn delete-btn" onclick="deleteParkingLot('${lot.lotID}')">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>`
            )
            .join("")
        : '<tr><td colspan="3">No parking lots available</td></tr>';
    })
    .catch((err) => {
      console.error("Error loading parking lots:", err);
      showPopup("Failed to load parking lots.", "error");
    });
}

// Update the toggleReserved function
function toggleReserved(lotID, checkbox) {
  const isReserving = checkbox.checked;

  fetch(`/get-spaces?lotID=${lotID}`)
    .then((response) => response.json())
    .then((spaces) => {
      const updatePromises = spaces.map((space) => {
        const updates = isReserving
          ? {
              parkingType: "Regular",
              // No need to set originalType here, server will handle it
            }
          : {
              parkingType: space.originalType || space.parkingType || "Regular",
              originalType: null, // Clear the originalType when unreserving
            };

        return fetch(`/update-space/${space.parkingSpaceID}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updates),
        });
      });

      Promise.all(updatePromises)
        .then(() => {
          showPopup(
            `Parking lot ${
              isReserving ? "reserved" : "unreserved"
            } successfully!`,
            "success"
          );
          return fetch(`/update-lot-reserved/${lotID}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ isReserved: isReserving }),
          });
        })
        .then(() => {
          if (currentLotID === lotID) {
            viewSpaces(lotID);
          }
        })
        .catch((error) => {
          console.error("Error updating spaces:", error);
          checkbox.checked = !isReserving; // Revert checkbox state on error
          showPopup("Error updating parking spaces", "error");
        });
    })
    .catch((error) => {
      console.error("Error fetching spaces:", error);
      checkbox.checked = !checkbox.checked; // Revert checkbox state on error
      showPopup("Error fetching parking spaces", "error");
    });
}

// Add this new function
function editLotBoundary(lotID) {
  window.location.href = `edit-lot-boundary.html?lotID=${lotID}`;
}

// Initialize edit boundary page
function initEditBoundaryPage(lotID) {
  // Fetch the lot details
  fetch(`/get-lot/${lotID}`)
    .then((response) => response.json())
    .then((lot) => {
      // Update form fields with lot details
      document.getElementById("lotID").value = lot.lotID;
      document.getElementById("lotName").value = lot.location;

      // Initialize map
      if (currentMap) {
        currentMap.remove();
      }

      currentMap = L.map("edit-boundary-map").setView([4.2105, 108.9758], 6);

      // Add satellite layer
      const satelliteTile = L.tileLayer(
        "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
          maxZoom: 22,
        }
      ).addTo(currentMap);

      // Add OpenStreetMap layer
      const streets = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 22,
        }
      );

      // Add layer control
      const baseMaps = {
        Satellite: satelliteTile,
        Streets: streets,
      };
      L.control.layers(baseMaps).addTo(currentMap);

      // Initialize drawing feature group
      drawnItems = new L.FeatureGroup();
      currentMap.addLayer(drawnItems);

      // Add draw control
      const drawControl = new L.Control.Draw({
        draw: {
          polygon: true,
          polyline: false,
          circle: false,
          rectangle: false,
          circlemarker: false,
          marker: false,
        },
        edit: {
          featureGroup: drawnItems,
        },
      });
      currentMap.addControl(drawControl);

      // Load existing boundary
      fetch(`/get-lot-boundary/${lotID}`)
        .then((response) => response.json())
        .then((coordinates) => {
          if (coordinates && coordinates.length > 0) {
            const polygon = L.polygon(coordinates, {
              color: "blue",
              fillOpacity: 0.4,
            }).addTo(drawnItems);
            currentMap.fitBounds(polygon.getBounds());
          }
        });

      // Handle new boundary drawing
      currentMap.on(L.Draw.Event.CREATED, function (event) {
        drawnItems.clearLayers();
        const layer = event.layer;
        const coordinates = layer
          .getLatLngs()[0]
          .map((coord) => [coord.lat, coord.lng]);

        // Calculate center point
        const centerLat =
          coordinates.reduce((sum, coord) => sum + coord[0], 0) /
          coordinates.length;
        const centerLng =
          coordinates.reduce((sum, coord) => sum + coord[1], 0) /
          coordinates.length;

        // Save updated boundary
        fetch("/save-lot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lotID,
            coordinates,
            centerCoordinates: [centerLat, centerLng],
          }),
        })
          .then(() => {
            showPopup("Parking lot boundary updated successfully!", "success");
            drawnItems.addLayer(layer);
            setTimeout(() => {
              window.location.href = "index.html";
            }, 2000);
          })
          .catch((err) => {
            console.error("Error saving boundary:", err);
            showPopup("Error saving boundary. Please try again.", "error");
          });
      });
    })
    .catch((error) => {
      console.error("Error loading lot details:", error);
      showPopup("Error loading lot details. Please try again.", "error");
    });
}

// Cancel edit boundary
async function cancelEdit() {
  const confirmed = await showConfirmDialog(
    "Are you sure you want to cancel? Any unsaved changes will be lost."
  );
  if (confirmed) {
    window.location.href = "index.html";
  }
}

// View lot details
function viewSpaces(lotID) {
  currentLotID = lotID;

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

      // Fetch the lot details to get the locationType
      fetch(`/get-lot/${lotID}`)
        .then((response) => response.json())
        .then((lot) => {
          // Set the currentLocationType
          currentLocationType = lot.locationType;

          // Update the title dynamically
          document.getElementById("current-lot-location").textContent =
            lot.lot_name;

          // Toggle map container visibility based on locationType
          const mapContainer = document.getElementById("view-map-container");
          if (currentLocationType === "outdoor") {
            mapContainer.style.display = "block"; // Show the map for outdoor lots
          } else {
            mapContainer.style.display = "none"; // Hide the map for indoor lots
          }
        })
        .catch((err) => {
          console.error("Error fetching lot details:", err);
          showPopup("Failed to load lot details.", "error");
        });

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
      showPopup("Failed to load parking spaces.", "error");
    });
}

// Function to display rows for the current page
function displayTableRows() {
  const tableBody = document.querySelector("#spaces-table tbody");

  if (!tableBody) {
    console.error("Table body element not found!");
    return;
  }

  if (!tableData || tableData.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="14" style="text-align: center; padding: 20px;">
          No parking spaces available
        </td>
      </tr>`;
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
        }')"><i class="fas fa-edit"></i> Edit</button>
        <button class="action-btn delete-btn" onclick="deleteParkingSpace('${
          space.parkingSpaceID
        }')"><i class="fas fa-trash"></i></button>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

// Create pagination controls
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

// Edit parking space
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
      showPopup("Parking space updated successfully!", "success");
      // Redirect back to the lot view
      window.location.href = `index.html?lotID=${updatedSpace.lotID}`;
    })
    .catch((error) => {
      console.error("Error updating parking space:", error);
      showPopup("Error updating parking space: " + error.message, "error");
    });
}

// Initialize edit space map
function initializeEditSpaceMap(coordinates) {
  console.log("Initializing map...");

  if (editSpaceMap) {
    editSpaceMap.off();
    editSpaceMap.remove();
    console.log("Previous map removed.");
  }

  const mapElement = document.getElementById("edit-space-map");
  console.log("Map container:", mapElement);

  editSpaceMap = L.map("edit-space-map").setView([4.2105, 108.9758], 6);
  console.log("Map created.");

  L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    maxZoom: 22,
  }).addTo(editSpaceMap);
  console.log("Tile layer added.");

  if (coordinates) {
    const [lat, lng] = coordinates.split(",").map(parseFloat);
    if (!isNaN(lat) && !isNaN(lng)) {
      editSpaceMap.setView([lat, lng], 19);
      editSpaceMarker = L.marker([lat, lng], { draggable: true }).addTo(
        editSpaceMap
      );
      console.log("Marker added at:", lat, lng);
    } else {
      console.error("Invalid coordinates:", coordinates);
    }
  }

  // Force resize after a delay
  setTimeout(() => {
    editSpaceMap.invalidateSize();
    console.log("Map size invalidated.");
  }, 500);
}

// Load parking space data
function loadParkingSpaceData(spaceID) {
  fetch(`/get-parking-space/${spaceID}`)
    .then((res) => res.json())
    .then((space) => {
      // Fill form fields with space data
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

      // Initialize map with lot boundary
      fetch(`/get-lot-boundary/${space.lotID}`)
        .then((response) => response.json())
        .then((coordinates) => {
          if (!coordinates || coordinates.length === 0) {
            showPopup("No boundary found for this parking lot", "error");
            return;
          }

          if (editSpaceMap) {
            editSpaceMap.off();
            editSpaceMap.remove();
          }

          // Initialize map
          editSpaceMap = L.map("edit-space-map", {
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
          ).addTo(editSpaceMap);

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
          L.control.layers(baseMaps).addTo(editSpaceMap);

          // Draw lot boundary
          const polygon = L.polygon(coordinates, {
            color: "yellow",
            weight: 2,
            fillOpacity: 0.1,
          }).addTo(editSpaceMap);

          // Fit map to boundary
          editSpaceMap.fitBounds(polygon.getBounds());

          // If space has coordinates, add marker
          if (space.coordinates) {
            try {
              const [lat, lng] = space.coordinates
                .split(",")
                .map((coord) => parseFloat(coord.trim()));
              if (!isNaN(lat) && !isNaN(lng)) {
                editSpaceMarker = L.marker([lat, lng], {
                  draggable: true,
                }).addTo(editSpaceMap);

                // Update coordinates when marker is dragged
                editSpaceMarker.on("dragend", function (e) {
                  const pos = e.target.getLatLng();
                  document.getElementById(
                    "coordinates"
                  ).value = `${pos.lat},${pos.lng}`;
                });

                document.getElementById("coordinates").value =
                  space.coordinates;
              }
            } catch (error) {
              console.error("Error setting marker:", error);
            }
          }

          // Add click handler for updating marker position
          editSpaceMap.on("click", function (e) {
            if (editSpaceMarker) {
              editSpaceMap.removeLayer(editSpaceMarker);
            }

            editSpaceMarker = L.marker(e.latlng, {
              draggable: true,
            }).addTo(editSpaceMap);

            document.getElementById(
              "coordinates"
            ).value = `${e.latlng.lat},${e.latlng.lng}`;

            editSpaceMarker.on("dragend", function (e) {
              const pos = e.target.getLatLng();
              document.getElementById(
                "coordinates"
              ).value = `${pos.lat},${pos.lng}`;
            });
          });
        })
        .catch((err) => {
          console.error("Error loading lot boundaries:", err);
          showPopup("Error loading lot boundaries", "error");
        });
    })
    .catch((error) => {
      console.error("Error loading parking space data:", error);
      showPopup("Failed to load parking space data", "error");
    });
}

// Update checkboxes based on parking type
function updateCheckboxesBasedOnType(parkingType) {
  // Reset all checkboxes first
  const checkboxes = document.querySelectorAll(
    '.checkbox-group input[type="checkbox"]'
  );
  checkboxes.forEach((checkbox) => {
    checkbox.checked = false;
    checkbox.parentElement.classList.remove("auto-selected");
  });

  // Auto-select based on type
  switch (parkingType) {
    case "Special":
      setCheckboxes(["isNearest", "isWheelchairAccessible", "isWellLitArea"]);
      break;
    case "Female":
      setCheckboxes(["isNearest", "isWellLitArea"]);
      break;
    case "Premium":
      setCheckboxes(["isPremium"]);
      break;
    case "EV":
      setCheckboxes(["hasEVCharging"]);
      break;
    case "Family":
      setCheckboxes(["hasLargeSpace", "isFamilyParkingArea"]);
      break;
  }
}

// Set checkboxes
function setCheckboxes(names) {
  names.forEach((name) => {
    const checkbox = document.querySelector(`input[name="${name}"]`);
    if (checkbox) {
      checkbox.checked = true;
      checkbox.parentElement.classList.add("auto-selected");
    }
  });
}

// Custom popup function
function showPopup(message, type = "info") {
  const popup = document.createElement("div");
  popup.className = `custom-popup ${type}`;
  popup.innerHTML = `
    <div class="popup-content">
      <p>${message}</p>
      <button onclick="this.parentElement.parentElement.remove()">OK</button>
    </div>
  `;
  document.body.appendChild(popup);

  // Set different durations based on message type
  const duration = type === "success" ? 8000 : 5000; // 8 seconds for success, 5 for others

  setTimeout(() => {
    if (popup.parentElement) {
      popup.remove();
    }
  }, duration);
}

// Confirmation dialog
function showConfirmDialog(message) {
  return new Promise((resolve) => {
    const popup = document.createElement("div");
    popup.className = "confirm-popup";
    popup.innerHTML = `
      <div class="confirm-content">
        <p>${message}</p>
        <div class="confirm-buttons">
          <button class="confirm-cancel">Cancel</button>
          <button class="confirm-delete">Confirm</button>
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    const cancelBtn = popup.querySelector(".confirm-cancel");
    const deleteBtn = popup.querySelector(".confirm-delete");

    cancelBtn.addEventListener("click", () => {
      popup.remove();
      resolve(false);
    });

    deleteBtn.addEventListener("click", () => {
      popup.remove();
      resolve(true);
    });
  });
}

// Determine marker color based on space availability and preferences
function determineMarkerColor(space) {
  if (!space.isAvailable) return "#FF5252";
  if (space.isNearest) return "#69F0AE";
  if (space.isWheelchairAccessible) return "#2196F3";
  if (space.isFamilyParkingArea) return "#E040FB";
  if (space.hasEVCharging) return "#1DE9B6";
  if (space.isPremium) return "#FFD54F";
  return "#9E9E9E";
}

// Create custom marker
function createCustomMarker(color) {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background-color: ${color};
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
          background-color: ${color};
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
}

// Add new parking space
function addParkingSpace() {
  const spaceID = document.getElementById("spaceID").value;
  const parkingType = document.getElementById("parkingType").value;
  const lotID = document.getElementById("lotSelect").value;
  const isNearest = document.getElementById("isNearest").checked ? 1 : 0;
  const isCovered = document.getElementById("isCovered").checked ? 1 : 0;
  const isWheelchairAccessible = document.getElementById(
    "isWheelchairAccessible"
  ).checked
    ? 1
    : 0;
  const hasLargeSpace = document.getElementById("hasLargeSpace").checked
    ? 1
    : 0;
  const isWellLitArea = document.getElementById("isWellLitArea").checked
    ? 1
    : 0;
  const hasEVCharging = document.getElementById("hasEVCharging").checked
    ? 1
    : 0;
  const isFamilyParkingArea = document.getElementById("isFamilyParkingArea")
    .checked
    ? 1
    : 0;
  const isPremium = document.getElementById("isPremium").checked ? 1 : 0;
  const isAvailable = 1;

  // Get locationType from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const locationType = urlParams.get("locationType");

  let coordinates = "N/A"; // Default for indoor spaces

  if (locationType === "outdoor") {
    // For outdoor spaces, get coordinates from the map
    if (!currentSpaceCoordinates) {
      showPopup("Please mark the space location on the map.", "error");
      return;
    }
    coordinates = `${currentSpaceCoordinates.lat.toFixed(
      6
    )}, ${currentSpaceCoordinates.lng.toFixed(6)}`;
  } else {
    // For indoor spaces, use floor/level information
    const levelType = document.getElementById("levelType").value;
    const levelNumber = document.getElementById("levelNumber").value;
    if (!levelType || !levelNumber) {
      showPopup("Please select floor/level type and enter number.", "error");
      return;
    }
    coordinates = `${levelType} ${levelNumber}`;
  }

  if (!spaceID || !parkingType || !lotID) {
    showPopup("Please complete all fields.", "error");
    return;
  }

  const spaceData = {
    parkingSpaceID: spaceID,
    parkingType,
    isNearest,
    isCovered,
    isWheelchairAccessible,
    hasLargeSpace,
    isWellLitArea,
    hasEVCharging,
    isFamilyParkingArea,
    isPremium,
    isAvailable,
    lotID,
    coordinates,
  };

  fetch("/add-space", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(spaceData),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to create parking space");
      }
      return response.json();
    })
    .then(() => {
      showPopup("Parking space added successfully!", "success");
      window.location.href = `index.html?lotID=${lotID}`;
    })
    .catch((error) => {
      console.error("Error creating parking space:", error);
      showPopup("Failed to add parking space: " + error.message, "error");
    });
}

// Delete parking space
async function deleteParkingSpace(spaceID) {
  if (
    await showConfirmDialog(
      "Are you sure you want to delete this parking space?"
    )
  ) {
    fetch(`/delete-space/${spaceID}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        showPopup("Parking space deleted successfully", "success");
        // Refresh the current page to update the table
        location.reload();
      })
      .catch((error) => {
        console.error("Error:", error);
        showPopup("Failed to delete parking space: " + error.message, "error");
      });
  }
}

// View lot on map
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
        showPopup("No boundary data found for this lot", "error");
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
      showPopup("Failed to load lot boundary.", "error");
    });
}

// Mark space on map
function startSpaceMarking() {
  const lotID = document.getElementById("lotSelect").value;
  const spaceID = document.getElementById("spaceID").value;

  if (!lotID || !spaceID) {
    showPopup(
      "Please select a parking lot and generate a space ID first.",
      "error"
    );
    return;
  }

  // Fetch the lot boundaries
  fetch(`/get-lot-boundary/${lotID}`)
    .then((response) => response.json())
    .then((coordinates) => {
      if (!coordinates || coordinates.length === 0) {
        showPopup("No boundary found for this parking lot.", "error");
        return;
      }

      // Remove the existing map if it exists
      if (currentMap) {
        currentMap.off();
        currentMap.remove();
      }

      // Initialize the map
      currentMap = L.map("space-map", {
        maxZoom: 22,
        minZoom: 15,
      }).setView([coordinates[0][0], coordinates[0][1]], 19);

      // Add Google Satellite layer (Primary)
      const googleSat = L.tileLayer(
        "http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
          maxZoom: 22,
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
        }
      ).addTo(currentMap);

      // Add OpenStreetMap layer (Alternative)
      const streets = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 22,
        }
      );

      // Add layer control
      const baseMaps = {
        Satellite: googleSat,
        Streets: streets,
      };
      L.control.layers(baseMaps).addTo(currentMap);

      // Draw the lot boundary
      const polygon = L.polygon(coordinates, {
        color: "yellow", // Yellow for visibility on satellite
        weight: 2,
        fillOpacity: 0.1,
      }).addTo(currentMap);

      // Fit the map view to the boundary
      currentMap.fitBounds(polygon.getBounds());

      // Clear any existing markers
      if (currentMarker) {
        currentMap.removeLayer(currentMarker);
      }

      // Add a click handler for marking space location
      currentMap.on("click", function (e) {
        if (currentMarker) {
          currentMap.removeLayer(currentMarker);
        }

        currentMarker = L.marker(e.latlng, {
          draggable: true,
        }).addTo(currentMap);

        currentSpaceCoordinates = e.latlng;

        // Create a popup with space details
        const popupContent = `
          <div class="space-popup">
            <b>Space ID:</b> ${spaceID}<br>
            <b>Type:</b> ${document.getElementById("parkingType").value}<br>
            <b>Coordinates:</b><br>
            Lat: ${e.latlng.lat.toFixed(6)}<br>
            Lng: ${e.latlng.lng.toFixed(6)}<br>
          </div>
        `;
        currentMarker.bindPopup(popupContent).openPopup();
      });
    })
    .catch((err) => {
      console.error("Error loading lot boundaries:", err);
      showPopup("Error loading lot boundaries. Please try again.", "error");
    });
}

// Calculate lot center point
// function calculateLotCenterPoint(lotID) {
//   return fetch(`/get-lot-boundary/${lotID}`)
//     .then((response) => response.json())
//     .then((points) => {
//       if (!points || points.length === 0) return null;

//       const lats = points.map((p) => p.lat);
//       const lngs = points.map((p) => p.lng);

//       const centerLat = (Math.max(...lats) + Math.min(...lats)) / 2;
//       const centerLng = (Math.max(...lngs) + Math.min(...lngs)) / 2;

//       return `${centerLat}, ${centerLng}`;
//     });
// }

// Load lot select
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

// Load next space ID
document.addEventListener("DOMContentLoaded", function () {
  const lotSelect = document.getElementById("lotSelect");
  if (lotSelect) {
    lotSelect.addEventListener("change", function () {
      const lotID = this.value;
      if (lotID) {
        loadNextSpaceID(lotID);
      } else {
        document.getElementById("spaceID").value = "";
        document.getElementById("spaceID").readOnly = false;
        document.getElementById("parkingType").disabled = true;
      }
    });
  }
});

// Load next space ID
function loadNextSpaceID(lotID) {
  if (!lotID) return;

  fetch(`/get-spaces?lotID=${lotID}`)
    .then((response) => response.json())
    .then((spaces) => {
      // Filter spaces for the current lot and get their numbers
      const spaceNumbers = spaces
        .map((space) => {
          const match = space.parkingSpaceID.match(
            new RegExp(`${lotID}_(\\d+)`)
          );
          return match ? parseInt(match[1]) : 0;
        })
        .filter((num) => !isNaN(num));

      // Find the next available number
      const maxNumber = Math.max(0, ...spaceNumbers);
      const nextNumber = (maxNumber + 1).toString().padStart(2, "0");

      // Set the space ID
      const spaceIDInput = document.getElementById("spaceID");
      spaceIDInput.value = `${lotID}_${nextNumber}`;
      spaceIDInput.readOnly = true;

      // Enable parking type selection
      document.getElementById("parkingType").disabled = false;
    })
    .catch((err) => {
      console.error("Error getting next space number:", err);
      showPopup("Error generating space ID", "error");
    });
}

// Reset space form function
function resetSpaceForm() {
  // Reset form fields
  document.getElementById("spaceID").value = "";
  document.getElementById("parkingType").value = "";

  // Reset all checkboxes
  const checkboxes = [
    "isNearest",
    "isCovered",
    "isWheelchairAccessible",
    "hasLargeSpace",
    "isWellLitArea",
    "hasEVCharging",
    "isFamilyParkingArea",
    "isPremium",
    "isAvailable",
  ];

  checkboxes.forEach((id) => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.checked = false;
      checkbox.parentElement.classList.remove("auto-selected");
    }
  });

  // Reset map marker if exists
  if (currentMarker) {
    currentMap.removeLayer(currentMarker);
    currentMarker = null;
    currentSpaceCoordinates = null;
  }

  // Reload space ID based on current lot
  const lotID = document.getElementById("lotSelect").value;
  if (lotID) {
    loadParkingSpaces();
  }
}

// Load parking spaces
function loadParkingSpaces(lotID) {
  fetch(`/get-spaces?lotID=${lotID}`)
    .then((response) => response.json())
    .then((spaces) => {
      const tbody = document.querySelector("#spaces-table tbody");
      if (!tbody) {
        console.error("Spaces table body not found.");
        return;
      }

      // Populate table or display fallback
      tbody.innerHTML = spaces.length
        ? spaces
            .map(
              (space) => `
          <tr>
            <td>${space.parkingSpaceID}</td>
            <td>${space.parkingType || "Not Set"}</td>
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
              <button class="action-btn edit-btn" onclick="editSpace('${
                space.parkingSpaceID
              }')">
                <i class="fas fa-edit"></i> Edit
              </button>
              <button class="action-btn delete-btn" onclick="deleteParkingSpace('${
                space.parkingSpaceID
              }')">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>`
            )
            .join("")
        : '<tr><td colspan="14">No parking spaces available</td></tr>';
    })
    .catch((err) => {
      console.error("Error loading parking spaces:", err);
      showPopup("Failed to load parking spaces.", "error");
    });
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
