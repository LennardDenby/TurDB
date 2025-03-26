const express = require('express');
const path = require('path');
const fs = require('fs');
const { Console } = require('console');
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
let geoJsonData = null;

// Load GeoJSON file when server starts
function loadGeoJsonData() {
    try {
        console.time("Loading GeoJSON");
        const data = fs.readFileSync(path.join(__dirname, 'OsloAkershusMerged.geojson'), 'utf8');
        geoJsonData = JSON.parse(data);
        console.timeEnd("Loading GeoJSON");
        console.log(`Loaded ${geoJsonData.features.length} routes`);
    } catch (error) {
        console.error("Error loading GeoJSON file:", error);
    }
}

loadGeoJsonData();

function findClosestRouteNavn(lat, lng, limit = 5, featureType = null) {
    if (!geoJsonData) return [];
    
    const filteredFeatures = featureType 
        ? geoJsonData.features.filter(feature => feature.properties.type === featureType)
        : geoJsonData.features;

    if (filteredFeatures.length === 0) return [];

    // Calculate distance for each route
    const routesWithDistance = geoJsonData.features.map(feature => {
        const distance = findMinimumDistanceToRoute(lat, lng, feature.geometry.coordinates[0]);
        return {
            name: feature.properties.name || 'Unnamed Route',
            description: feature.properties.desc || '',
            type: feature.properties.type || '',
            distance: distance,
            distance_meters: feature.properties.distance_meters || 0
        };
    });
    
    // Sort by distance and return the closest routes
    return routesWithDistance
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
}

// Helper function to calculate distance between two coordinates in meters (using Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c; // Distance in meters
}

// Helper function to find minimum distance from a point to a route
function findMinimumDistanceToRoute(lat, lng, routeCoordinates) {
    let minDistance = Infinity;
    
    for (const point of routeCoordinates) {
        // GeoJSON coordinates are in [longitude, latitude] order
        const distance = calculateDistance(lat, lng, point[1], point[0]);
        if (distance < minDistance) {
            minDistance = distance;
        }
    }
    
    return minDistance;
}

app.get('/api/routes', async(req, res) => {
    if (!geoJsonData) {
        return res.status(500).json({error: 'GeoJSON data not loaded'})
    }
    res.json(geoJsonData)
});

app.get('/api/routes/nearby', async(req, res) => {
    try {
        console.time("json parsing");
        const { lat, lng, limit = 5, featureType = null} = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ error: 'lat and lng parameters are required' });
        }

        if (featureType && !["AnnenRute", "Fotrute", "Skiløype", "Sykkelrute"].includes(featureType)) {
            return res.status(400).json({ 
                error: 'Invalid feature type. Valid options are: AnnenRute, Fotrute, Skiløype, Sykkelrute'
            });
        }
        
        const nearbyRoutes = findClosestRouteNavn(
            parseFloat(lat),
            parseFloat(lng),
            parseInt(limit)
        );
        
        console.timeEnd("json parsing");
        res.json(nearbyRoutes);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Internal server error'})
    }
});

app.get('/api/route-types', async(req, res) => {
    if (!geoJsonData) {
        return res.status(500).json({error: 'GeoJSON data not loaded'});
    }
    
    // Extract unique types from features
    const types = [...new Set(
        geoJsonData.features
            .map(feature => feature.properties.type)
            .filter(type => type) // Remove null/undefined values
    )];
    
    res.json(types);
});


app.listen(port, '0.0.0.0', () => console.log(`Server running at http://0.0.0.0:${port}`));