const express = require('express');
const path = require('path');
const fs = require('fs');
const { Console } = require('console');
const app = express();
const port = 3000;

app.use(express.static(path.join(__dirname, 'public')));
let geoJsonData = null;

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

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
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

function findMinimumDistanceToRoute(lat, lng, routeCoordinates) {
    let minDistance = Infinity;
    
    for (const point of routeCoordinates) {
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
        const { lat, lng, limit = 5, featureType = null } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ error: 'lat and lng parameters are required' });
        }

        if (featureType && !["AnnenRute", "Fotrute", "Skiløype", "Sykkelrute"].includes(featureType)) {
            return res.status(400).json({ 
                error: 'Invalid feature type. Valid options are: AnnenRute, Fotrute, Skiløype, Sykkelrute'
            });
        }
        
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        
        if (isNaN(parsedLat) || isNaN(parsedLng)) {
            return res.status(400).json({ error: 'Invalid latitude or longitude values' });
        }
        
        const filteredFeatures = featureType 
            ? geoJsonData.features.filter(feature => feature.properties.type === featureType)
            : geoJsonData.features;
            
        if (filteredFeatures.length === 0) {
            return res.json({
                type: "FeatureCollection",
                name: geoJsonData.name,
                crs: geoJsonData.crs,
                features: []
            });
        }

        const featuresWithDistance = filteredFeatures.map(feature => {
            let coordinates;
            if (feature.geometry.type === "LineString") {
                coordinates = feature.geometry.coordinates;
            } else if (feature.geometry.type === "MultiLineString") {
 
                coordinates = feature.geometry.coordinates[0];
            } else {
                console.warn(`Unsupported geometry type: ${feature.geometry.type}`);
                coordinates = [];
            }
            
            const distance = findMinimumDistanceToRoute(parsedLat, parsedLng, coordinates);
            
            const featureCopy = JSON.parse(JSON.stringify(feature));
            
            featureCopy.properties.distance_to_point = distance;
            
            return featureCopy;
        });
        
        const closestFeatures = featuresWithDistance
            .sort((a, b) => a.properties.distance_to_point - b.properties.distance_to_point)
            .slice(0, parseInt(limit));
        
        const response = {
            type: "FeatureCollection",
            name: geoJsonData.name,
            crs: geoJsonData.crs,
            features: closestFeatures
        };
        
        console.timeEnd("json parsing");
        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({error: 'Internal server error'})
    }
});

app.listen(port, '0.0.0.0', () => console.log(`Server running at http://0.0.0.0:${port}`));