# iPARK Web - Admin Panel for Intelligent Parking Recommendation System

The **iPARK Web** repository contains the source code for the admin panel of the iPARK system. Built using **Node.js** and **JavaScript**, it provides system administrators with the tools to manage parking locations, lots, spaces, and their real-time statuses.

---

## Features

- **Parking Location Management**  
  Add, edit, and delete parking locations, including geospatial boundaries.

- **Parking Lot Management**  
  Manage parking lots, define indoor/outdoor types, and control statuses such as reserved or active.

- **Parking Space Management**  
  Configure attributes for individual parking spaces, including accessibility, EV charging, and premium options.

- **Interactive Mapping**  
  Leverage geospatial tools for defining parking lot boundaries and marking parking spaces using **Leaflet.js**.

- **Real-Time Updates**  
  Ensure real-time synchronization between the admin panel and the mobile app.

---

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Node.js (Express.js)
- **Database**: MySQL
- **Mapping Library**: Leaflet.js

---

## Screenshots

### Admin Panel
![image](https://github.com/user-attachments/assets/5819b54e-b0c5-4ea8-bfa5-57fb017f0d59)


---

## Installation

### Prerequisites

1. **Node.js**: Install Node.js from [Node.js Downloads](https://nodejs.org/).
2. **MySQL Database**: Ensure MySQL is configured and running.
3. **Browser**: A modern web browser like Chrome or Firefox.

---

### Steps to Set Up

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ImanZulhakim/iPark_Web.git
   cd iPark_Web
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up the database**:
   - Open phpMyAdmin or a MySQL client.
   - Create a new database named `ipark`.
   - Import the provided `iPark.sql` file located in the `database` folder into the `ipark` database.

4. **Configure database connection**:
   - Open `config/database.js` and update the MySQL credentials:
     ```javascript
     module.exports = {
       host: 'localhost',
       user: 'root', // Default for MySQL
       password: '', // Default for MySQL
       database: 'ipark',
     };
     ```

5. **Start the server**:
   - Run the following command to start the web server:
     ```bash
     node server.js
     ```

6. **Access the admin panel**:
   - Open a web browser and navigate to:
     ```
     http://localhost:3000
     ```

---

## Folder Structure

```plaintext
iPark_Web/
│
├── public/             # Frontend files (HTML, CSS, JavaScript)
│   ├── assets/         # Static assets like images and icons
│   ├── css/            # Stylesheets
│   ├── js/             # JavaScript files
│
├── routes/             # Express.js routes for handling HTTP requests
├── config/             # Database and server configuration
├── server.js           # Entry point for the Node.js server
├── database/           # Contains the iPark.sql file
└── README.md           # Documentation
```

---

## Features in Detail

### Parking Location Management
- Add new parking locations with geospatial data.
- Edit or delete existing parking locations.
- View a list of all parking locations in the system.

### Parking Lot Management
- Manage parking lots associated with a specific location.
- Define boundaries for outdoor lots using an interactive map.
- Specify statuses such as "Active," "Reserved," or "Inactive."

### Parking Space Management
- Configure spaces within parking lots.
- Add attributes like wheelchair accessibility, EV charging, and premium status.
- Mark indoor or outdoor spaces dynamically.

---

## Related Repositories

- [iPARK Mobile Application](https://github.com/ImanZulhakim/iPark): The Flutter-based mobile app for end-users.
- [iPARK PHP Backend](https://github.com/ImanZulhakim/iPark_Web): APIs for real-time updates and administrative management.
- [iPARK Python Backend](https://github.com/ImanZulhakim/iParkPythonBackend): Python backend for recommendation logic.

---

## Contributing

Contributions are welcome! To contribute:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature/YourFeature`).
3. Commit your changes (`git commit -m 'Add Your Feature'`).
4. Push to your branch (`git push origin feature/YourFeature`).
5. Open a pull request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---
