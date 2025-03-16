# TurDB - Norwegian Hiking Routes API

# http://turdb.info.gf:3000/

TurDB is a REST API that provides information about hiking routes in Norway. It allows users to find the closest hiking routes from given coordinates, helping hikers discover new trails and plan their outdoor adventures.

## Features
- Retrieve all hiking routes.
- Find hiking routes near specific coordinates.
- Data sourced from [Geonorge - Turrutebasen](https://kartkatalog.geonorge.no/metadata/turrutebasen/d1422d17-6d95-4ef1-96ab-8af31744dd63).

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/TurDB.git
   cd TurDB
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up the PostgreSQL database:
   - Ensure PostgreSQL is installed and running.
   - Create a database named `turdb`.
   - Update the database connection details in `server.js` if necessary.

4. Start the server:
   ```bash
   node server.js
   ```

5. Access the API at `http://localhost:3000`.

## API Endpoints

### Get All Routes
- **Endpoint:** `/api/routes`
- **Method:** `GET`
- **Description:** Retrieves a list of hiking routes.

### Get Routes Near Coordinates
- **Endpoint:** `/api/routes/nearby`
- **Method:** `GET`
- **Parameters:**
  - `lat` - Latitude (required)
  - `lng` - Longitude (required)
  - `limit` - Limit number of hikes to return (optional, default: 5)
- **Description:** Retrieves hiking routes near the specified coordinates.

## Example Usage

### Using JavaScript Fetch API
```javascript
fetch('http://localhost:3000/api/routes')
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
```

### Using cURL
```bash
curl -X GET http://localhost:3000/api/routes
```

## License
This project is licensed under the MIT License. See the LICENSE file for details.

## Acknowledgments
- Data provided by [Geonorge - Turrutebasen](https://kartkatalog.geonorge.no/metadata/turrutebasen/d1422d17-6d95-4ef1-96ab-8af31744dd63).
- Created by Lennard Denby.
