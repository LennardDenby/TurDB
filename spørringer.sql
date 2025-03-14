WITH unnested_routes AS (
    SELECT 
        unnest(rutenavn) AS route_name,
        ST_Distance(ST_Transform(wkb_geometry, 3857),
            ST_Transform(ST_SetSRID(ST_MakePoint(60.5, 10.9), 4326), 3857)) AS distance
    FROM routes
    WHERE ST_DWithin(
            ST_Transform(wkb_geometry, 3857),
            ST_Transform(ST_SetSRID(ST_MakePoint(60.5, 10.9), 4326), 3857),
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
    LIMIT 5
),
matching_routes AS (
    SELECT 
        r.rutenummer,
        r.rutenavn,
        r.wkb_geometry,
        ST_Distance(
            ST_Transform(r.wkb_geometry, 3857),
            ST_Transform(ST_SetSRID(ST_MakePoint(60.5, 10.9), 4326), 3857)
        ) AS distance,
        cr.route_name,
        cr.min_distance
    FROM routes r
    JOIN closest_routes cr ON r.rutenavn @> ARRAY[cr.route_name]
)
SELECT 
    rutenummer,
    route_name AS rutenavn,
    distance,
    ST_AsGeoJSON(wkb_geometry) AS geometry
FROM matching_routes
GROUP BY route_name
ORDER BY min_distance, distance;