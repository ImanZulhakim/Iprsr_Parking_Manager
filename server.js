const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');

const app = express();
app.use(bodyParser.json());

// Add this line to serve static files from the 'public' directory
app.use(express.static('public'));

// Optional: Add a route for the root path
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// MySQL connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'iprsr',
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        process.exit();
    }
    console.log('Connected to MySQL database!');
});

// API to fetch parking lot boundaries
app.get('/get-lots', (req, res) => {
    const query = `
        SELECT lotID, latitude, longitude, point_order
        FROM parking_lot_boundaries
        ORDER BY lotID, point_order;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching parking lot data:', err);
            res.status(500).send('Database error');
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
app.post('/save-lot', (req, res) => {
    const { lotID, coordinates } = req.body;

    // Delete existing coordinates for this lotID (if any)
    const deleteQuery = 'DELETE FROM parking_lot_boundaries WHERE lotID = ?';
    db.query(deleteQuery, [lotID], (err) => {
        if (err) {
            console.error('Error deleting existing lot:', err);
            res.status(500).send('Error deleting existing lot');
            return;
        }

        // Insert new coordinates
        const insertQuery = `
            INSERT INTO parking_lot_boundaries (lotID, point_order, latitude, longitude)
            VALUES ?
        `;
        const values = coordinates.map((coord, index) => [
            lotID,
            index + 1,    // point_order
            coord[0],     // latitude is first in the array now
            coord[1]      // longitude is second
        ]);

        db.query(insertQuery, [values], (err) => {
            if (err) {
                console.error('Error saving lot coordinates:', err);
                res.status(500).send('Error saving lot coordinates');
                return;
            }
            res.status(200).send('Parking lot saved successfully!');
        });
    });
});

// API to create a new parking lot
app.post('/create-lot', (req, res) => {
    const { lotID, location } = req.body;
    
    const query = 'INSERT INTO parkinglot (lotID, location, spaces) VALUES (?, ?, 0)';
    db.query(query, [lotID, location], (err, result) => {
        if (err) {
            console.error('Error creating parking lot:', err);
            res.status(500).json({ 
                message: 'Error creating parking lot',
                error: err.message 
            });
            return;
        }
        res.json({ message: `Parking lot ${lotID} created successfully!` });
    });
});

// Add these new routes

// Get all parking lots
app.get('/get-all-lots', (req, res) => {
    const query = 'SELECT lotID, location FROM parkinglot';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching parking lots:', err);
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json(results);
    });
});

// Get specific lot boundary
app.get('/get-lot-boundary/:lotID', (req, res) => {
    const query = 'SELECT latitude, longitude FROM parking_lot_boundaries WHERE lotID = ? ORDER BY point_order';
    db.query(query, [req.params.lotID], (err, results) => {
        if (err) {
            console.error('Error fetching lot boundary:', err);
            res.status(500).json({ error: 'Database error' });
            return;
        }
        const coordinates = results.map(point => [point.latitude, point.longitude]);
        res.json(coordinates);
    });
});

app.get('/check-lot/:lotID', (req, res) => {
    const lotID = req.params.lotID;
    
    // First check if lot exists
    db.query('SELECT lotID FROM parkinglot WHERE lotID = ?', [lotID], (err, lotResults) => {
        if (err) {
            res.status(500).json({ error: 'Database error' });
            return;
        }

        if (lotResults.length === 0) {
            res.json({ exists: false, hasBoundaries: false });
            return;
        }

        // Check if boundaries exist
        db.query('SELECT COUNT(*) as count FROM parking_lot_boundaries WHERE lotID = ?', [lotID], (err, boundaryResults) => {
            if (err) {
                res.status(500).json({ error: 'Database error' });
                return;
            }

            res.json({
                exists: true,
                hasBoundaries: boundaryResults[0].count > 0
            });
        });
    });
});

// Create new parking space
app.post('/create-space', (req, res) => {
    console.log('Received request to create space:', req.body); // Debug log

    const { 
        parkingSpaceID, parkingType, isNearest, isCovered, 
        isWheelchairAccessible, hasLargeSpace, isWellLitArea,
        hasEVCharging, isFamilyParkingArea, isPremium, 
        isAvailable, lotID, coordinates 
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
        parkingSpaceID, parkingType, isNearest, isCovered,
        isWheelchairAccessible, hasLargeSpace, isWellLitArea,
        hasEVCharging, isFamilyParkingArea, isPremium,
        isAvailable, lotID, coordinates[0], coordinates[1]
    ];

    console.log('Executing query with values:', values); // Debug log

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({ 
                error: 'Database error',
                details: err.message 
            });
            return;
        }
        console.log('Space created successfully:', result); // Debug log
        res.json({ 
            message: 'Parking space created successfully',
            spaceID: parkingSpaceID
        });
    });
});

// Get all parking spaces
app.get('/get-spaces', (req, res) => {
    const query = 'SELECT * FROM parkingspace';
    db.query(query, (err, results) => {
        if (err) {
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json(results);
    });
});

// Update parking space
app.put('/update-space/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    
    const query = 'UPDATE parkingspace SET ? WHERE parkingSpaceID = ?';
    db.query(query, [updates, id], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json({ message: 'Parking space updated successfully' });
    });
});

// Delete parking space
app.delete('/delete-space/:id', (req, res) => {
    const spaceID = req.params.id;

    // First get the lotID
    db.query('SELECT lotID FROM parkingspace WHERE parkingSpaceID = ?', [spaceID], (err, results) => {
        if (err || results.length === 0) {
            res.status(500).json({ error: 'Database error or space not found' });
            return;
        }

        const lotID = results[0].lotID;

        // Start transaction
        db.beginTransaction(err => {
            if (err) {
                res.status(500).json({ error: 'Transaction error' });
                return;
            }

            // Delete the space
            db.query('DELETE FROM parkingspace WHERE parkingSpaceID = ?', [spaceID], (err) => {
                if (err) {
                    return db.rollback(() => {
                        res.status(500).json({ error: 'Database error' });
                    });
                }

                // Update lot's space count
                db.query('UPDATE parkinglot SET spaces = spaces - 1 WHERE lotID = ?', [lotID], (err) => {
                    if (err) {
                        return db.rollback(() => {
                            res.status(500).json({ error: 'Database error' });
                        });
                    }

                    // Commit transaction
                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => {
                                res.status(500).json({ error: 'Transaction commit error' });
                            });
                        }
                        res.json({ message: 'Parking space deleted successfully' });
                    });
                });
            });
        });
    });
});

app.post('/update-lot-spaces', (req, res) => {
    const { lotID, action } = req.body;
    
    const query = 'UPDATE parkinglot SET spaces = spaces + ? WHERE lotID = ?';
    db.query(query, [action === 'add' ? 1 : -1, lotID], (err, result) => {
        if (err) {
            res.status(500).json({ error: 'Database error' });
            return;
        }
        res.json({ message: 'Spaces updated successfully' });
    });
});

app.get('/get-next-space-number/:lotID', (req, res) => {
    const lotID = req.params.lotID;
    
    // Get all existing space IDs for this lot
    const query = 'SELECT parkingSpaceID FROM parkingspace WHERE lotID = ?';
    db.query(query, [lotID], (err, results) => {
        if (err) {
            res.status(500).json({ error: 'Database error' });
            return;
        }

        // Extract numbers from existing space IDs
        const existingNumbers = results
            .map(row => {
                const match = row.parkingSpaceID.match(/_(\d+)$/);
                return match ? parseInt(match[1]) : 0;
            })
            .filter(num => !isNaN(num));

        // Find the next available number
        const maxNumber = Math.max(0, ...existingNumbers);
        const nextNumber = maxNumber + 1;

        res.json({ nextNumber });
    });
});

const PORT = 3000;

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});