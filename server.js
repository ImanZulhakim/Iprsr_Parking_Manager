const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "iprsr",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    process.exit();
  }
  console.log("Connected to MySQL database!");
});

const path = require("path");
const app = express();
app.use(bodyParser.json());

// Add this line to serve static files from the 'public' directory
app.use(express.static("public"));

// Optional: Add a route for the root path
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// Index page
app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Add location page
app.get("/add-location.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/add-location.html"));
});

// Edit space page
app.get("/edit-space.html", (req, res) => {
  const spaceID = req.query.id; // Get the space ID from the query parameter
  if (!spaceID) {
    return res.redirect("/index.html"); // Redirect back to index if no ID is provided
  }
  res.sendFile(path.join(__dirname, "public/edit-space.html"));
});

// Add lot page
app.get("/add-lot.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/add-lot.html"));
});

// API to edit parking space
app.post("/edit-parking-space", (req, res) => {
  const updatedSpace = req.body;

  const query = `
    UPDATE parking_spaces 
    SET parkingType = ?, 
        isNearest = ?, 
        isCovered = ?, 
        isWheelchairAccessible = ?, 
        hasLargeSpace = ?, 
        isWellLitArea = ?, 
        hasEVCharging = ?, 
        isFamilyParkingArea = ?, 
        isPremium = ?, 
        isAvailable = ?,
        coordinates = ?
    WHERE parkingSpaceID = ?`;

  const values = [
    updatedSpace.parkingType,
    updatedSpace.isNearest,
    updatedSpace.isCovered,
    updatedSpace.isWheelchairAccessible,
    updatedSpace.hasLargeSpace,
    updatedSpace.isWellLitArea,
    updatedSpace.hasEVCharging,
    updatedSpace.isFamilyParkingArea,
    updatedSpace.isPremium,
    updatedSpace.isAvailable,
    updatedSpace.coordinates,
    updatedSpace.parkingSpaceID,
  ];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("Error updating parking space:", err);
      res.status(500).json({ error: "Failed to update parking space" });
      return;
    }
    res.json({
      message: "Parking space updated successfully",
      redirectUrl: `/index.html?lotID=${updatedSpace.lotID}`,
    });
  });
});

// API to save parking lot boundary (polygon)
app.post("/add-lot-boundary", (req, res) => {
  const { lotID, coordinates, centerCoordinates } = req.body;

  // Validate required data
  if (!lotID || !coordinates || !centerCoordinates) {
    return res.status(400).json({ error: "Missing required data" });
  }

  // Start transaction
  db.beginTransaction((err) => {
    if (err) {
      console.error("Transaction error:", err);
      return res.status(500).json({ error: "Transaction error" });
    }

    // Check if a boundary already exists for this lotID
    db.query(
      "SELECT * FROM parking_lot_boundaries WHERE lotID = ?",
      [lotID],
      (err, existingBoundaries) => {
        if (err) {
          return db.rollback(() => {
            res
              .status(500)
              .json({ error: "Database error", details: err.message });
          });
        }

        if (existingBoundaries.length > 0) {
          return db.rollback(() => {
            res.status(409).json({
              error:
                "A boundary already exists for this parking lot. Use the edit function to update it.",
            });
          });
        }

        // Insert new boundary points
        const insertBoundaryQuery = `
          INSERT INTO parking_lot_boundaries (lotID, point_order, latitude, longitude)
          VALUES ?
        `;
        const values = coordinates.map((coord, index) => [
          lotID,
          index + 1,
          coord[0],
          coord[1],
        ]);

        db.query(insertBoundaryQuery, [values], (err) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json({
                error: "Error adding boundary points",
                details: err.message,
              });
            });
          }

          // Update parking lot center coordinates
          db.query(
            "UPDATE parkinglot SET coordinates = ? WHERE lotID = ?",
            [centerCoordinates.join(","), lotID],
            (err) => {
              if (err) {
                return db.rollback(() => {
                  res.status(500).json({
                    error: "Error updating center coordinates",
                    details: err.message,
                  });
                });
              }

              // Commit transaction
              db.commit((err) => {
                if (err) {
                  return db.rollback(() => {
                    res.status(500).json({
                      error: "Transaction commit error",
                      details: err.message,
                    });
                  });
                }
                res.status(200).json({
                  success: true,
                  message: "Parking lot boundary added successfully!",
                });
              });
            }
          );
        });
      }
    );
  });
});

app.post("/edit-indoor-lot", (req, res) => {
  const { lotID, lot_name, coordinates } = req.body;

  // Validate required data
  if (!lotID || !lot_name || !coordinates) {
    console.error("Missing required data:", { lotID, lot_name, coordinates });
    return res.status(400).json({ error: "Missing required data" });
  }

  // Update lot details in database
  db.query(
    "UPDATE parkinglot SET lot_name = ?, coordinates = ? WHERE lotID = ?",
    [lot_name, coordinates, lotID],
    (err, result) => {
      if (err) {
        console.error("Error updating indoor lot:", err);
        return res.status(500).json({ error: "Database error" });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Lot not found" });
      }

      res.json({ success: true, message: "Indoor lot updated successfully" });
    }
  );
});

// API to save parking lot boundary (polygon)
app.post("/edit-lot-boundary", (req, res) => {
  const { lotID, lot_name, coordinates, centerCoordinates } = req.body;

  // Debugging: Log the received request body
  console.log("Received request body:", {
    lotID,
    lot_name,
    coordinates: coordinates ? coordinates.length : 0,
    centerCoordinates,
  });

  // Debugging: Log the received lot_name
  console.log("Received lot_name:", lot_name);

  if (!lotID || !lot_name || !coordinates || !centerCoordinates) {
    console.error("Missing required data:", {
      lotID,
      lot_name,
      coordinates,
      centerCoordinates,
    });
    return res.status(400).json({ error: "Missing required data" });
  }

  db.beginTransaction(async (err) => {
    if (err) {
      console.error("Transaction error:", err);
      return res.status(500).json({ error: "Transaction error" });
    }

    try {
      // Update lot name
      await new Promise((resolve, reject) => {
        console.log("Updating lot name:", { lotID, lot_name });
        if (!lot_name) {
          console.error("Lot name is undefined or empty");
          reject(new Error("Lot name is required"));
          return;
        }

        db.query(
          "UPDATE parkinglot SET lot_name = ? WHERE lotID = ?",
          [lot_name, lotID],
          (err, result) => {
            if (err) {
              console.error("Error updating lot name:", err);
              reject(err);
              return;
            }
            if (result.affectedRows === 0) {
              console.error("No rows were updated for lot name");
              reject(new Error(`No lot found with ID ${lotID}`));
              return;
            }
            console.log("Update result:", result);
            console.log(
              `Updated lot_name to '${lot_name}' for lotID '${lotID}'`
            );
            resolve(result);
          }
        );
      });
      // Delete existing boundaries
      await new Promise((resolve, reject) => {
        console.log("Deleting existing boundaries for lotID:", lotID);
        db.query(
          "DELETE FROM parking_lot_boundaries WHERE lotID = ?",
          [lotID],
          (err) => {
            if (err) {
              console.error("Error deleting existing boundaries:", err);
              reject(err);
            }
            console.log(
              "Successfully deleted existing boundaries for lotID:",
              lotID
            );
            resolve();
          }
        );
      });

      // Update center coordinates
      await new Promise((resolve, reject) => {
        console.log("Updating center coordinates for lotID:", lotID);
        db.query(
          "UPDATE parkinglot SET coordinates = ? WHERE lotID = ?",
          [centerCoordinates.join(","), lotID],
          (err) => {
            if (err) {
              console.error("Error updating center coordinates:", err);
              reject(err);
            }
            console.log(
              "Successfully updated center coordinates for lotID:",
              lotID
            );
            resolve();
          }
        );
      });

      // Insert new boundary points
      const insertBoundaryQuery = `
        INSERT INTO parking_lot_boundaries (lotID, point_order, latitude, longitude)
        VALUES ?
      `;
      const values = coordinates.map((coord, index) => [
        lotID,
        index + 1,
        coord[0],
        coord[1],
      ]);

      await new Promise((resolve, reject) => {
        console.log("Inserting new boundary points for lotID:", lotID);
        db.query(insertBoundaryQuery, [values], (err) => {
          if (err) {
            console.error("Error inserting boundary points:", err);
            reject(err);
          }
          console.log(
            "Successfully inserted new boundary points for lotID:",
            lotID
          );
          resolve();
        });
      });

      db.commit((err) => {
        if (err) {
          console.error("Transaction commit error:", err);
          return db.rollback(() => {
            res.status(500).json({ error: "Transaction commit error" });
          });
        }
        console.log("Transaction committed successfully for lotID:", lotID);
        res.status(200).json({
          success: true,
          message: "Parking lot updated successfully!",
        });
      });
    } catch (error) {
      console.error("Error in boundary update:", error);
      return db.rollback(() => {
        res.status(500).json({
          error: "Error updating boundary",
          details: error.message,
        });
      });
    }
  });
});

// API to add a new parking lot
app.post("/add-lot", (req, res) => {
  const { lotID, lot_name, locationID, locationType, coordinates } = req.body;

  if (!lotID || !lot_name || !locationID || !locationType) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Check if lot exists first
  db.query(
    "SELECT lotID FROM parkinglot WHERE lotID = ?",
    [lotID],
    (err, results) => {
      if (err) {
        console.error("Error checking lot existence:", err);
        return res
          .status(500)
          .json({ error: "Database error", details: err.message });
      }

      if (results.length > 0) {
        return res.status(409).json({
          error: "Duplicate entry",
          message: `Parking lot with ID '${lotID}' already exists.`,
        });
      }

      // Insert new lot
      const query =
        "INSERT INTO parkinglot (lotID, lot_name, locationID, locationType, coordinates) VALUES (?, ?, ?, ?, ?)";
      db.query(
        query,
        [lotID, lot_name, locationID, locationType, coordinates],
        (err) => {
          if (err) {
            console.error("Error creating parking lot:", err);
            return res.status(500).json({
              error: "Database error",
              details: err.message,
            });
          }
          res.status(201).json({
            success: true,
            message: `Parking lot ${lotID} created successfully!`,
          });
        }
      );
    }
  );
});

// Check if lot has spaces
app.get("/check-lot-spaces/:lotID", (req, res) => {
  const lotID = req.params.lotID;
  const query = "SELECT spaces FROM parkinglot WHERE lotID = ?";

  db.query(query, [lotID], (err, results) => {
    if (err) {
      return res.status(500).json({
        message: "Error checking parking spaces",
        error: err.message,
      });
    }
    res.json({
      hasSpaces: results[0].count > 0,
      spaceCount: results[0].count,
    });
  });
});

// Delete a parking lot
app.delete("/delete-lot/:lotID", (req, res) => {
  const lotID = req.params.lotID;

  // Start a transaction
  db.beginTransaction((err) => {
    if (err) {
      return res.status(500).json({
        message: "Transaction error",
        error: err.message,
      });
    }

    // First delete all parking spaces
    const deleteSpacesQuery = "DELETE FROM parkingspace WHERE lotID = ?";
    db.query(deleteSpacesQuery, [lotID], (err) => {
      if (err) {
        return db.rollback(() => {
          res.status(500).json({
            message: "Error deleting parking spaces",
            error: err.message,
          });
        });
      }

      // Then delete boundaries
      const deleteBoundariesQuery =
        "DELETE FROM parking_lot_boundaries WHERE lotID = ?";
      db.query(deleteBoundariesQuery, [lotID], (err) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json({
              message: "Error deleting boundaries",
              error: err.message,
            });
          });
        }

        // Finally delete the lot itself
        const deleteLotQuery = "DELETE FROM parkinglot WHERE lotID = ?";
        db.query(deleteLotQuery, [lotID], (err) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json({
                message: "Error deleting parking lot",
                error: err.message,
              });
            });
          }

          // Commit the transaction
          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json({
                  message: "Error committing transaction",
                  error: err.message,
                });
              });
            }
            res.json({
              message: `Parking lot ${lotID} and all associated data deleted successfully`,
            });
          });
        });
      });
    });
  });
});

// Get all parking lots
app.get("/get-all-lots", (req, res) => {
  const query = "SELECT lotID, lot_name FROM parkinglot";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching parking lots:", err); // Log detailed error
      res.status(500).json({ error: "Database error" });
      return;
    }
    console.log("Parking lots fetched:", results); // Debug log
    res.json(results);
  });
});

// Get all parking locations
app.get("/get-all-locations", (req, res) => {
  const query =
    "SELECT locationID, location_name, district, state FROM parkinglocation";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching parking locations:", err);
      res.status(500).json({ error: "Database error" });
      return;
    }
    res.json(results);
  });
});

// Add location
app.post("/add-location", (req, res) => {
  const { locationID, locationName, district, state } = req.body;

  if (!locationID || !locationName || !district || !state) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const query = `
    INSERT INTO parkinglocation (locationID, location_name, district, state)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    query,
    [locationID, locationName, district, state],
    (err, result) => {
      if (err) {
        console.error("Error adding location:", err);
        res.status(500).json({ message: "Database error", error: err.message });
        return;
      }

      res.json({ message: "Location added successfully!" });
    }
  );
});

// Delete parking location
app.delete("/delete-location/:locationID", (req, res) => {
  const { locationID } = req.params;

  // Check if the location exists
  const checkLocationQuery = `SELECT * FROM parkinglocation WHERE locationID = ?`;
  db.query(checkLocationQuery, [locationID], (err, results) => {
    if (err) {
      console.error("Error checking location:", err);
      return res
        .status(500)
        .json({ message: "Database error", error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Location not found" });
    }

    // Delete the location
    const deleteLocationQuery = `DELETE FROM parkinglocation WHERE locationID = ?`;
    db.query(deleteLocationQuery, [locationID], (err, result) => {
      if (err) {
        console.error("Error deleting location:", err);
        return res
          .status(500)
          .json({ message: "Database error", error: err.message });
      }

      res.json({ message: "Location deleted successfully!" });
    });
  });
});

// Get location details by ID
app.get("/get-location/:locationID", (req, res) => {
  const { locationID } = req.params;

  const query = `SELECT * FROM parkinglocation WHERE locationID = ?`;
  db.query(query, [locationID], (err, results) => {
    if (err) {
      console.error("Error fetching location:", err);
      return res
        .status(500)
        .json({ message: "Database error", error: err.message });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: "Location not found" });
    }

    res.json(results[0]);
  });
});

// Update location
app.put("/update-location", (req, res) => {
  const { locationID, locationName, district, state } = req.body;

  if (!locationID || !locationName || !district || !state) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const query = `
    UPDATE parkinglocation
    SET location_name = ?, district = ?, state = ?
    WHERE locationID = ?
  `;

  db.query(
    query,
    [locationName, district, state, locationID],
    (err, result) => {
      if (err) {
        console.error("Error updating location:", err);
        res.status(500).json({ message: "Database error", error: err.message });
        return;
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Location not found" });
      }

      res.json({ message: "Location updated successfully!" });
    }
  );
});

// Get all parking lots by location ID
app.get("/get-lots-by-location/:locationID", (req, res) => {
  const locationID = req.params.locationID;

  if (!locationID) {
    res.status(400).json({ error: "Location ID is required" });
    return;
  }

  const query = "SELECT lotID, lot_name FROM parkinglot WHERE locationID = ?";
  db.query(query, [locationID], (err, results) => {
    if (err) {
      console.error("Error fetching parking lots:", err);
      res.status(500).json({ error: "Database error" });
      return;
    }
    res.json(results);
  });
});

// Get a parking lot by lotID
app.get("/get-lot/:lotID", (req, res) => {
  const query = "SELECT * FROM parkinglot WHERE lotID = ?";
  db.query(query, [req.params.lotID], (err, results) => {
    if (err) {
      console.error("Error fetching parking lot:", err);
      res.status(500).json({ error: "Database error" });
      return;
    }
    if (results.length === 0) {
      res.status(404).json({ error: "Lot not found" });
      return;
    }
    res.json(results[0]);
  });
});

// Get a parking lot boundary by lotID
app.get("/get-lot-boundary/:lotID", (req, res) => {
  const query =
    "SELECT latitude, longitude FROM parking_lot_boundaries WHERE lotID = ? ORDER BY point_order";
  db.query(query, [req.params.lotID], (err, results) => {
    if (err) {
      console.error("Error fetching lot boundary:", err);
      res.status(500).json({ error: "Database error" });
      return;
    }
    const coordinates = results.map((point) => [
      point.latitude,
      point.longitude,
    ]);
    res.json(coordinates);
  });
});

// Check if parking lot exists and has boundaries
app.get("/check-lot/:lotID", (req, res) => {
  const lotID = req.params.lotID;

  // First check if lot exists
  db.query(
    "SELECT lotID FROM parkinglot WHERE lotID = ?",
    [lotID],
    (err, lotResults) => {
      if (err) {
        res.status(500).json({ error: "Database error" });
        return;
      }

      if (lotResults.length === 0) {
        res.json({ exists: false, hasBoundaries: false });
        return;
      }

      // Check if boundaries exist
      db.query(
        "SELECT COUNT(*) as count FROM parking_lot_boundaries WHERE lotID = ?",
        [lotID],
        (err, boundaryResults) => {
          if (err) {
            res.status(500).json({ error: "Database error" });
            return;
          }

          res.json({
            exists: true,
            hasBoundaries: boundaryResults[0].count > 0,
          });
        }
      );
    }
  );
});

// Add a new parking space
app.post("/add-space", (req, res) => {
  console.log("Received request to add space:", req.body); // Debug log

  const {
    parkingSpaceID,
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
  } = req.body;

  const query = `
        INSERT INTO parkingspace 
        (parkingSpaceID, parkingType, isNearest, isCovered, 
         isWheelchairAccessible, hasLargeSpace, isWellLitArea,
         hasEVCharging, isFamilyParkingArea, isPremium, 
         isAvailable, lotID, coordinates)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

  const values = [
    parkingSpaceID,
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
  ];

  console.log("Executing query with values:", values); // Debug log

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("Database error:", err);
      res.status(500).json({
        error: "Database error",
        details: err.message,
      });
      return;
    }
    console.log("Space added successfully:", result); // Debug log
    res.json({
      message: "Parking space added successfully",
      spaceID: parkingSpaceID,
    });
  });
});

// Get all parking spaces by lotID
app.get("/get-spaces", (req, res) => {
  const lotID = req.query.lotID;

  if (!lotID) {
    res.status(400).json({ error: "Lot ID is required" });
    return;
  }

  const query = "SELECT * FROM parkingspace WHERE lotID = ?";

  db.query(query, [lotID], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      res.status(500).json({ error: "Database error" });
      return;
    }
    res.json(results);
  });
});

// Update a parking space
app.put("/update-space/:id", (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // If we're reserving (changing to Regular), store the current type first
  if (updates.parkingType === "Regular") {
    db.query(
      "SELECT parkingType, originalType FROM parkingspace WHERE parkingSpaceID = ?",
      [id],
      (err, results) => {
        if (err) {
          res.status(500).json({ message: "Error updating parking space" });
          return;
        }

        // Check if originalType already exists
        if (!results[0].originalType) {
          // Store the original type before updating to Regular
          updates.originalType = results[0].parkingType;
        }

        // Now perform the update
        db.query(
          "UPDATE parkingspace SET ? WHERE parkingSpaceID = ?",
          [updates, id],
          (err, result) => {
            if (err) {
              res.status(500).json({ message: "Error updating parking space" });
              return;
            }
            res.json({ message: "Parking space updated successfully" });
          }
        );
      }
    );
  } else {
    // Normal update without storing original type
    db.query(
      "UPDATE parkingspace SET ? WHERE parkingSpaceID = ?",
      [updates, id],
      (err, result) => {
        if (err) {
          res.status(500).json({ message: "Error updating parking space" });
          return;
        }
        res.json({ message: "Parking space updated successfully" });
      }
    );
  }
});

// Delete parking space
app.delete("/delete-space/:id", (req, res) => {
  const spaceID = req.params.id;

  // Start transaction
  db.beginTransaction((err) => {
    if (err) {
      res.status(500).json({ error: "Transaction error" });
      return;
    }

    // Delete the space
    db.query(
      "DELETE FROM parkingspace WHERE parkingSpaceID = ?",
      [spaceID],
      (err) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json({ error: "Database error" });
          });
        }

        // Commit transaction
        db.commit((err) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json({ error: "Transaction commit error" });
            });
          }
          res.json({ message: "Parking space deleted successfully" });
        });
      }
    );
  });
});

// Update lot spaces count
app.post("/update-lot-spaces", (req, res) => {
  const { lotID, action } = req.body;

  const query = "UPDATE parkinglot SET spaces = spaces + ? WHERE lotID = ?";
  db.query(query, [action === "add" ? 1 : -1, lotID], (err, result) => {
    if (err) {
      res.status(500).json({ error: "Database error" });
      return;
    }
    res.json({ message: "Spaces updated successfully" });
  });
});

// Get next available space number
app.get("/get-next-space-number/:lotID", (req, res) => {
  const lotID = req.params.lotID;

  // Get all existing space IDs for this lot
  const query = "SELECT parkingSpaceID FROM parkingspace WHERE lotID = ?";
  db.query(query, [lotID], (err, results) => {
    if (err) {
      res.status(500).json({ error: "Database error" });
      return;
    }

    // Extract numbers from existing space IDs
    const existingNumbers = results
      .map((row) => {
        const match = row.parkingSpaceID.match(/_(\d+)$/);
        return match ? parseInt(match[1]) : 0;
      })
      .filter((num) => !isNaN(num));

    // Find the next available number
    const maxNumber = Math.max(0, ...existingNumbers);
    const nextNumber = maxNumber + 1;

    res.json({ nextNumber });
  });
});

// Get a specific parking space
app.get("/get-parking-space/:id", (req, res) => {
  const query = "SELECT * FROM parkingspace WHERE parkingSpaceID = ?";
  db.query(query, [req.params.id], (err, results) => {
    if (err) {
      console.error("Error fetching parking space:", err);
      res.status(500).json({ message: "Error fetching parking space" });
      return;
    }
    res.json(results[0]);
  });
});

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public/404.html"));
});

const PORT = 3000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
