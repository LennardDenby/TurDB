const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
let geoJsonData = null;
let rutenummerPos = [];

// Load GeoJSON file when server starts
function loadGeoJsonData() {
    try {
        const filePath = path.join(__dirname, 'AlleFotruter_Fixed.geojson');
        console.log(`Loading GeoJSON data from ${filePath}...`);
        
        const data = fs.readFileSync(filePath, 'utf8');
        geoJsonData = JSON.parse(data);

        geoJsonData.features.forEach(feature => {
            const entry = new Map();
            entry.set("rutenummer", feature.properties.rutenummer[0]);
            entry.set("pos", [feature.geometry.coordinates[0][0], feature.geometry.coordinates[0][1]]);
            rutenummerPos.push(entry);
        })
        console.log(`GeoJSON data loaded successfully. Found ${geoJsonData.features.length} features.`);
    } catch (err) {
        console.error('Error loading GeoJSON data:', err);
    }
}

loadGeoJsonData();

function findClosestRouteNumbers(lat, lng, limit = 5) {
    if (!rutenummerPos || rutenummerPos.length === 0) {
        console.error('Route position data not loaded or empty');
        return [];
    }
    
    // Convert coordinates to numbers to ensure proper comparison
    const targetLat = parseFloat(lat);
    const targetLng = parseFloat(lng);
    
    if (isNaN(targetLat) || isNaN(targetLng)) {
        console.error('Invalid coordinates provided');
        return [];
    }
    
    // Calculate distance for each route position and store with its rutenummer
    const routesWithDistance = rutenummerPos.map(entry => {
        const pos = entry.get("pos");
        const routeNumber = entry.get("rutenummer");
        
        // Some error checking to handle potential data issues
        if (!pos || pos.length < 2 || !routeNumber) {
            return { distance: Infinity, rutenummer: 'unknown' };
        }
        
        // pos[1] is latitude, pos[0] is longitude (common GeoJSON format)
        const distance = calculateDistance(targetLng, targetLat, pos[1], pos[0]);
        
        return {
            rutenummer: routeNumber,
            distance: distance
        };
    });
    
    // Filter out invalid entries and get distinct routes
    const routeMap = new Map();
    routesWithDistance.forEach(route => {
        if (route.distance === Infinity || route.rutenummer === 'unknown') return;
        
        if (!routeMap.has(route.rutenummer) || 
            routeMap.get(route.rutenummer).distance > route.distance) {
            routeMap.set(route.rutenummer, route);
        }
    });
    
    // Convert to array, sort by distance, and limit results
    const closestRoutes = Array.from(routeMap.values())
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
    
    return closestRoutes.map(route => ({
        rutenummer: route.rutenummer,
        distance_meters: Math.round(route.distance)
    }));
}

// Helper function to calculate distance between two coordinates in meters (using Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}

app.get('/api/routes', async(req, res) => {
    if (!geoJsonData) {
        return res.status(500).json({error: 'GeoJSON data not loaded'})
    }
    res.json(geoJsonData)
});

app.get('/api/routes/nearby', async(req, res) => {
    try {
        console.time("json parsing")
        const { lat, lng, limit = 5 } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }
        
        const nearestRoutes = findClosestRouteNumbers(lat, lng, parseInt(limit));
        
        if (nearestRoutes.length === 0) {
            return res.status(404).json({ 
                message: 'No routes found near the specified location',
                params: { lat, lng, limit }
            });
        }
        
        // Process each nearest route to combine all matching features
        const routesWithDetails = nearestRoutes.map(route => {
            // Find ALL matching features in geoJsonData for this route number
            const matchingFeatures = geoJsonData.features.filter(feature => 
                feature.properties.rutenummer.includes(route.rutenummer)
            );
            
            if (matchingFeatures.length === 0) {
                return route;
            }
            
            // Get properties from the first matching feature
            const firstFeature = matchingFeatures[0];
            const routeDetails = {
                ...route,
                rutenavn: firstFeature.properties.rutenavn || [],
                gradering: firstFeature.properties.gradering || [],
            };
            
            // Combine coordinates from all matching features
            const allCoordinates = [];
            const lineStrings = [];
            
            matchingFeatures.forEach(feature => {
                // Handle different geometry types
                if (feature.geometry.type === 'LineString') {
                    lineStrings.push(feature.geometry.coordinates);
                } else if (feature.geometry.type === 'MultiLineString') {
                    lineStrings.push(...feature.geometry.coordinates);
                }
            });
            
            
            // Create a combined geometry
            routeDetails.geometry = {
                type: 'MultiLineString',
                coordinates: lineStrings
            };
            
            return routeDetails;
        });
        console.timeEnd("json parsing")
        res.json({
            routes: routesWithDetails
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, '0.0.0.0', () => console.log(`Server running at http://0.0.0.0:${port}`));