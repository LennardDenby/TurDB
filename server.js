const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();
const port = 3000;

const pool = new Pool({
    user: 'lennarrd',
    host: 'localhost',
    database: 'turdb',
    password: 'lennarrd',
    port: 5432,
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/routes', async(req, res) => {
    try {
        const result = await pool.query(`
            SELECT rutenavn, rutenummer, ST_AsGeoJSON(wkb_geometry) AS geometry
            FROM ROUTES
        `);
        const features = result.rows.map(row => ({
            ...row,
            geometry: JSON.parse(row.geometry)
        }));
        res.json({ features });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/routes/nearby', async(req, res) => {
    try {
        const { lat, lng, limit = 5 } = req.query;
        
        if (!lat || !lng) {
            return res.status(400).json({ error: "Latitude and longitude are required" });
        }
        console.time('sql');
        const result = await pool.query(`
            WITH unnested_routes AS (
            SELECT 
                unnest(rutenavn) AS route_name,
                ST_Distance(ST_Transform(wkb_geometry, 3857),
                    ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857)) AS distance
            FROM routes
            WHERE ST_DWithin(
                    ST_Transform(wkb_geometry, 3857),
                    ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857),
                    20000
                )
            ),
            closest_routes AS (
                SELECT
                    route_name, 
                    MIN(distance) AS min_distance
                FROM unnested_routes
                WHERE route_name != 'Ukjent'
                GROUP BY route_name
                ORDER BY MIN(distance) ASC
                LIMIT $3
            ),
            matching_routes AS (
                SELECT 
                    r.rutenummer,
                    r.rutenavn,
                    r.wkb_geometry,
                    ST_Distance(
                        ST_Transform(r.wkb_geometry, 3857),
                        ST_Transform(ST_SetSRID(ST_MakePoint($1, $2), 4326), 3857)
                    ) AS distance,
                    cr.route_name,
                    cr.min_distance
                FROM routes r
                JOIN closest_routes cr ON r.rutenavn @> ARRAY[cr.route_name]
            ),
            combined_routes AS (
                SELECT 
                    route_name,
                    MIN(min_distance) AS min_distance,
                    string_agg(DISTINCT CASE 
                        WHEN rutenummer IS NULL THEN ''
                        WHEN rutenummer::text = '{}' THEN ''
                        ELSE rutenummer::text 
                    END, ', ') AS rutenummers_text,
                    ST_AsGeoJSON(ST_Collect(wkb_geometry)) AS geometry_json,
                    MIN(distance) AS min_actual_distance
                FROM matching_routes
                GROUP BY route_name
            )
            SELECT 
                route_name AS rutenavn,
                rutenummers_text,
                min_actual_distance AS distance,
                geometry_json AS geometry
            FROM combined_routes
            ORDER BY min_distance, min_actual_distance;
        `, [lat, lng, limit]);
        console.timeLog("sql");
        
        

        const features = result.rows.map(row => {
            let geometryObj;
            try {
                geometryObj = typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry;
            } catch (e) {
                console.error('Failed to parse geometry JSON:', row.geometry);
                geometryObj = { type: 'MultiLineString', coordinates: [] }; // Fallback
            }
            
            let coordinates;
            if (geometryObj.type === 'LineString') {
                coordinates = [geometryObj.coordinates];
            } else if (geometryObj.type === 'MultiLineString') {
                coordinates = geometryObj.coordinates;
            } else {
                coordinates = [];
            }
            
            let routeNumbers = [];
            if (row.rutenummers_text) {
                const flattened = row.rutenummers_text
                    .replace(/\{|\}/g, '')
                    .replace(/,,/g, ',');
                    
                routeNumbers = flattened
                    .split(',')
                    .map(s => s.trim())
                    .filter(s => s !== '');
            }
            
            return {
                rutenummer: routeNumbers,
                rutenavn: row.rutenavn,
                distance_meters: Math.round(row.distance),
                geometry: {
                    type: 'MultiLineString',
                    coordinates: coordinates
                }
            };
        });
        res.json({ features });
        console.timeEnd("sql");
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, '0.0.0.0', () => console.log(`Server running at http://0.0.0.0:${port}`));