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

app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/edit-space.html", (req, res) => {
  const spaceID = req.query.id; // Get the space ID from the query parameter
  if (!spaceID) {
    return res.redirect("/index.html"); // Redirect back to index if no ID is provided
  }
  res.sendFile(path.join(__dirname, "public/edit-space.html"));
});

app.get("/add-lot.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public/add-lot.html"));
});

app.post("/edit-parking-space", (req, res) => {
  const updatedSpace = req.body;
  // Save the updated space to the database or process it
  // Assume you save successfully and redirect to the lot's view

  res.json({
    message: "Parking space updated successfully",
    redirectUrl: `/index.html?lotID=${updatedSpace.lotID}`, // Pass the redirect URL
  });
  a;
});

// API to fetch parking lot boundaries
app.get("/get-lots", (req, res) => {
  const query = `
        SELECT lotID, latitude, longitude, point_order
        FROM parking_lot_boundaries
        ORDER BY lotID, point_order;
    `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching parking lot data:", err);
      res.status(500).send("Database error");
      return;
    }

    // Group coordinates by lotID
    const lots = results.reduce((acc, row) => {
      if (!acc[row.lotID]) {
        acc[row.lotID] = [];
      }
      acc[row.lotID].push([row.longitude, row.latitude]); // Store as [lng, lat]
      return acc;
    }, {});

    res.json(lots);
  });
});

// API to save parking lot boundary (polygon)
app.post("/save-lot", (req, res) => {
  const { lotID, coordinates, centerCoordinates } = req.body;

  // Start a transaction
  db.beginTransaction((err) => {
    if (err) {
      return res.status(500).send("Transaction error");
    }

    // Update parkinglot table with center coordinates
    const updateLotQuery =
      "UPDATE parkinglot SET coordinates = POINT(?, ?) WHERE lotID = ?";
    db.query(
      updateLotQuery,
      [centerCoordinates[0], centerCoordinates[1], lotID],
      (err) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).send("Error updating lot coordinates");
          });
        }

        // Insert boundary coordinates
        const insertBoundaryQuery =
          "INSERT INTO parking_lot_boundaries (lotID, point_order, latitude, longitude) VALUES ?";
        const values = coordinates.map((coord, index) => [
          lotID,
          index + 1,
          coord[0],
          coord[1],
        ]);

        db.query(insertBoundaryQuery, [values], (err) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).send("Error saving boundary coordinates");
            });
          }

          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).send("Error committing transaction");
              });
            }
            res.status(200).send("Parking lot saved successfully!");
          });
        });
      }
    );
  });
});

// API to create a new parking lot
app.post("/create-lot", (req, res) => {
  const { lotID, location } = req.body;

  const query =
    "INSERT INTO parkinglot (lotID, location, spaces) VALUES (?, ?, 0)";
  db.query(query, [lotID, location], (err, result) => {
    if (err) {
      console.error("Error creating parking lot:", err);
      res.status(500).json({
        message: "Error creating parking lot",
        error: err.message,
      });
      return;
    }
    res.json({ message: `Parking lot ${lotID} created successfully!` });
  });
});

// Delete parking lot and its boundaries
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

    // First delete from parking_lot_boundaries
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

      // Then delete from parkinglot
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
          res.json({ message: `Parking lot ${lotID} deleted successfully` });
        });
      });
    });
  });
});

// Get all parking lots
app.get("/get-all-lots", (req, res) => {
  const query = "SELECT lotID, location FROM parkinglot";
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

// Get specific lot boundary
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

// Create new parking space
app.post("/create-space", (req, res) => {
  console.log("Received request to create space:", req.body); // Debug log

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
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, POINT(?, ?))
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
    coordinates[0],
    coordinates[1],
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
    console.log("Space created successfully:", result); // Debug log
    res.json({
      message: "Parking space created successfully",
      spaceID: parkingSpaceID,
    });
  });
});

// Get all parking spaces
app.get("/get-spaces", (req, res) => {
  const lotID = req.query.lotID;
  const query = "SELECT * FROM parkingspace WHERE lotID = ?";

  db.query(query, [lotID], (err, results) => {
    if (err) {
      res.status(500).json({ error: "Database error" });
      return;
    }
    res.json(results);
  });
});

// Update parking space
app.put("/update-space/:id", (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const query = "UPDATE parkingspace SET ? WHERE parkingSpaceID = ?";

  db.query(query, [updates, id], (err, result) => {
    if (err) {
      console.error("Error updating space:", err);
      return res.status(500).json({ error: "Update failed" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Space not found" });
    }

    res.json({ success: true });
  });
});

// Delete parking space
app.delete("/delete-space/:id", (req, res) => {
  const spaceID = req.params.id;

  // First get the lotID
  db.query(
    "SELECT lotID FROM parkingspace WHERE parkingSpaceID = ?",
    [spaceID],
    (err, results) => {
      if (err || results.length === 0) {
        res.status(500).json({ error: "Database error or space not found" });
        return;
      }

      const lotID = results[0].lotID;

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

            // Update lot's space count
            db.query(
              "UPDATE parkinglot SET spaces = spaces - 1 WHERE lotID = ?",
              [lotID],
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
                      res
                        .status(500)
                        .json({ error: "Transaction commit error" });
                    });
                  }
                  res.json({ message: "Parking space deleted successfully" });
                });
              }
            );
          }
        );
      });
    }
  );
});

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

// Create a new parking space
app.post("/create-parking-space", (req, res) => {
  const spaceData = req.body;
  const query = "INSERT INTO parkingspace SET ?";
  db.query(query, spaceData, (err, result) => {
    if (err) {
      console.error("Error creating parking space:", err);
      res.status(500).json({ message: "Error creating parking space" });
      return;
    }
    res.json({ message: "Parking space created successfully!" });
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

// Update a parking space
app.put("/update-space/:id", (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const query = "UPDATE parkingspace SET ? WHERE parkingSpaceID = ?";
  db.query(query, [updates, id], (err, result) => {
    if (err) {
      res.status(500).json({ message: "Error updating parking space" });
      return;
    }
    res.json({ message: "Parking space updated successfully" });
  });
});

// Delete a parking space
app.delete("/delete-space/:id", (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM parkingspace WHERE parkingSpaceID = ?";
  db.query(query, [id], (err, result) => {
    if (err) {
      res.status(500).json({ message: "Error deleting parking space" });
      return;
    }
    res.json({ message: "Parking space deleted successfully" });
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
