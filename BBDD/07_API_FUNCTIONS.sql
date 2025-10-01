-- =====================================================
-- 07_API_FUNCTIONS.sql - FUNCIONES PARA LA WEB APP
-- =====================================================

-- FUNCIÓN 1: Obtener categorías para dropdown
CREATE OR REPLACE FUNCTION get_geojson_categories()
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT COALESCE(jsonb_agg(DISTINCT category ORDER BY category), '[]'::jsonb)
        FROM (
            -- Tipos de señal con datos
            SELECT LOWER(st.display_name) AS category
            FROM signal_types st
            JOIN signal_measurements sm ON sm.signal_type_id = st.id
            WHERE st.is_active = true
            
            UNION
            
            -- Contaminación si hay datos
            SELECT 'contaminación aérea'::text
            WHERE EXISTS (
                SELECT 1 FROM pollution_measurements pm
                JOIN pollutant_types pt ON pt.id = pm.pollutant_type_id
                WHERE pt.is_active = true
            )
        ) categories
    )::json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

select get_geojson_categories();
select get_geojson_layers('4g');

-- FUNCIÓN 2: Obtener layers (operadores o contaminantes) para cada categoría
CREATE OR REPLACE FUNCTION get_geojson_layers(category TEXT)
RETURNS JSON AS $$
DECLARE
    result JSONB;
BEGIN
    -- Si es un tipo de señal, devolver operadores
    IF EXISTS (SELECT 1 FROM signal_types WHERE LOWER(display_name) = LOWER(category)) THEN
        SELECT COALESCE(jsonb_agg(DISTINCT 
            jsonb_build_object(
                'code', o.name,
                'display_name', COALESCE(o.display_name, o.name)
            ) ORDER BY jsonb_build_object(
                'code', o.name,
                'display_name', COALESCE(o.display_name, o.name)
            )
        ), '[]'::jsonb) INTO result
        FROM operators o
        JOIN measurement_sessions ms ON ms.operator_id = o.id
        JOIN signal_measurements sm ON sm.session_id = ms.id
        JOIN signal_types st ON st.id = sm.signal_type_id
        WHERE LOWER(st.display_name) = LOWER(category)
          AND o.is_active = true
          AND st.is_active = true;
    
    -- Si es contaminación, devolver tipos de contaminantes
    ELSIF LOWER(category) = 'contaminación aérea' THEN
        SELECT COALESCE(jsonb_agg(DISTINCT 
            jsonb_build_object(
                'code', pt.code,
                'display_name', COALESCE(pt.display_name, pt.code),
                'unit', pt.unit
            ) ORDER BY jsonb_build_object(
                'code', pt.code,
                'display_name', COALESCE(pt.display_name, pt.code),
                'unit', pt.unit
            )
        ), '[]'::jsonb) INTO result
        FROM pollutant_types pt
        JOIN pollution_measurements pm ON pm.pollutant_type_id = pt.id
        WHERE pt.is_active = true;
    
    ELSE
        result := '[]'::jsonb;
    END IF;

    RETURN result::json;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCIÓN 3: GeoJSON optimizado de datos de señal (SIN límite temporal)
CREATE OR REPLACE FUNCTION get_signal_geojson_optimized(
    p_signal_types TEXT[] DEFAULT NULL,
    p_operators TEXT[] DEFAULT NULL,
    p_provincias TEXT[] DEFAULT NULL,
    p_bbox JSONB DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    result JSON;
    bbox_south DECIMAL;
    bbox_west DECIMAL;
    bbox_north DECIMAL;
    bbox_east DECIMAL;
BEGIN
    -- Extraer bounding box si se proporciona
    IF p_bbox IS NOT NULL THEN
        bbox_south := (p_bbox->>'south')::DECIMAL;
        bbox_west := (p_bbox->>'west')::DECIMAL;
        bbox_north := (p_bbox->>'north')::DECIMAL;
        bbox_east := (p_bbox->>'east')::DECIMAL;
    END IF;
    
    SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(geojson_feature ORDER BY avg_signal_strength DESC), '[]'::jsonb),
        'metadata', jsonb_build_object(
            'total_features', COUNT(*),
            'generated_at', NOW(),
            'data_type', 'signal_measurements',
            'filters_applied', jsonb_build_object(
                'signal_types', p_signal_types,
                'operators', p_operators,
                'provincias', p_provincias,
                'has_bbox', (p_bbox IS NOT NULL)
            ),
            'quality_distribution', jsonb_build_object(
                'excelente', COUNT(*) FILTER (WHERE signal_quality = 'Excelente'),
                'buena', COUNT(*) FILTER (WHERE signal_quality = 'Buena'),
                'regular', COUNT(*) FILTER (WHERE signal_quality = 'Regular'),
                'pobre', COUNT(*) FILTER (WHERE signal_quality = 'Pobre')
            )
        )
    ) INTO result
    FROM vista_signal_grid_10m vsg
    WHERE 
        -- Filtros principales
        (p_signal_types IS NULL OR signal_type_code = ANY(p_signal_types))
        AND (p_operators IS NULL OR operator_code = ANY(p_operators))
        AND (p_provincias IS NULL OR provincia_nombre = ANY(p_provincias))
        -- Filtros geográficos
        AND (bbox_south IS NULL OR cell_lat >= bbox_south)
        AND (bbox_west IS NULL OR cell_lng >= bbox_west)
        AND (bbox_north IS NULL OR cell_lat <= bbox_north)
        AND (bbox_east IS NULL OR cell_lng <= bbox_east);
    
    RETURN COALESCE(result, '{"type":"FeatureCollection","features":[],"metadata":{"total_features":0}}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

select get_pollution_geojson_optimized('{co}');
-- FUNCIÓN 4: GeoJSON optimizado de contaminación (últimos 30 días por defecto)
CREATE OR REPLACE FUNCTION get_pollution_geojson_optimized(
    p_pollutant_codes TEXT[] DEFAULT NULL,
    p_provincias TEXT[] DEFAULT NULL,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL,
    p_bbox JSONB DEFAULT NULL,
    p_min_measurements INTEGER DEFAULT 1
) RETURNS JSON AS $$
DECLARE
    result JSON;
    bbox_south DECIMAL;
    bbox_west DECIMAL;
    bbox_north DECIMAL;
    bbox_east DECIMAL;
    filter_date_from DATE;
    filter_date_to DATE;
BEGIN
    -- Fechas por defecto: últimos 30 días
    filter_date_from := COALESCE(p_date_from, CURRENT_DATE - INTERVAL '30 days');
    filter_date_to := COALESCE(p_date_to, CURRENT_DATE);
    
    -- Extraer bounding box
    IF p_bbox IS NOT NULL THEN
        bbox_south := (p_bbox->>'south')::DECIMAL;
        bbox_west := (p_bbox->>'west')::DECIMAL;
        bbox_north := (p_bbox->>'north')::DECIMAL;
        bbox_east := (p_bbox->>'east')::DECIMAL;
    END IF;
    
    SELECT jsonb_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(jsonb_agg(geojson_feature ORDER BY measurement_date DESC, avg_concentration DESC), '[]'::jsonb),
        'metadata', jsonb_build_object(
            'total_features', COUNT(*),
            'generated_at', NOW(),
            'data_type', 'pollution_measurements',
            'date_range', jsonb_build_object(
                'from', filter_date_from,
                'to', filter_date_to,
                'actual_from', MIN(measurement_date),
                'actual_to', MAX(measurement_date)
            ),
            'filters_applied', jsonb_build_object(
                'pollutant_codes', p_pollutant_codes,
                'provincias', p_provincias,
                'min_measurements', p_min_measurements,
                'has_bbox', (p_bbox IS NOT NULL)
            ),
            'data_summary', jsonb_build_object(
                'unique_pollutants', COUNT(DISTINCT pollutant_code),
                'unique_dates', COUNT(DISTINCT measurement_date),
                'avg_measurements_per_cell', ROUND(AVG(measurement_count)::numeric, 1)
            )
        )
    ) INTO result
    FROM vista_pollution_grid_10m vpg
    WHERE 
        -- Filtros principales
        (p_pollutant_codes IS NULL OR pollutant_code = ANY(p_pollutant_codes))
        AND (p_provincias IS NULL OR provincia_nombre = ANY(p_provincias))
        AND measurement_date BETWEEN filter_date_from AND filter_date_to
        AND measurement_count >= p_min_measurements
        -- Filtros geográficos
        AND (bbox_south IS NULL OR cell_lat >= bbox_south)
        AND (bbox_west IS NULL OR cell_lng >= bbox_west)
        AND (bbox_north IS NULL OR cell_lat <= bbox_north)
        AND (bbox_east IS NULL OR cell_lng <= bbox_east);
    
    RETURN COALESCE(result, '{"type":"FeatureCollection","features":[],"metadata":{"total_features":0}}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCIÓN 5: Metadatos completos de la aplicación
CREATE OR REPLACE FUNCTION get_complete_app_metadata() 
RETURNS JSON AS $$
BEGIN
    RETURN jsonb_build_object(
        'version', '1.0.0-tfg-production',
        'generated_at', NOW(),
        'system_info', jsonb_build_object(
            'grid_precision', '10m x 10m cells (100m²) using precise UTM projection',
            'geographic_scope', 'Península Ibérica',
            'coordinate_system', 'WGS84 (EPSG:4326)',
            'temporal_policy', jsonb_build_object(
                'signal_data', 'Sin límite temporal - datos históricos completos',
                'pollution_data', 'Últimos 30 días por defecto'
            )
        ),
        'operators', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'code', name,
                    'display_name', COALESCE(display_name, name),
                    'is_active', COALESCE(is_active, true),
                    'total_sessions', (
                        SELECT COUNT(*) FROM measurement_sessions ms WHERE ms.operator_id = operators.id
                    ),
                    'last_activity', (
                        SELECT MAX(timestamp_recorded) FROM measurement_sessions ms WHERE ms.operator_id = operators.id
                    )
                ) ORDER BY COALESCE(display_name, name)
            ), '[]'::jsonb)
            FROM operators WHERE (is_active IS NULL OR is_active = true)
        ),
        'signal_types', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'code', code,
                    'display_name', COALESCE(display_name, code),
                    'is_active', COALESCE(is_active, true),
                    'measurement_count', (
                        SELECT COUNT(*) FROM signal_measurements sm WHERE sm.signal_type_id = signal_types.id
                    )
                ) ORDER BY code
            ), '[]'::jsonb)
            FROM signal_types WHERE (is_active IS NULL OR is_active = true)
        ),
        'pollutant_types', (
            SELECT COALESCE(jsonb_agg(
                jsonb_build_object(
                    'code', code,
                    'display_name', COALESCE(display_name, code),
                    'unit', unit,
                    'is_active', COALESCE(is_active, true),
                    'measurement_count', (
                        SELECT COUNT(*) FROM pollution_measurements pm WHERE pm.pollutant_type_id = pollutant_types.id
                    )
                ) ORDER BY code
            ), '[]'::jsonb)
            FROM pollutant_types WHERE (is_active IS NULL OR is_active = true)
        ),
        'provincias_available', (
            SELECT COALESCE(jsonb_agg(DISTINCT provincia ORDER BY provincia), '[]'::jsonb)
            FROM provincias_cyl WHERE provincia IS NOT NULL
        ),
        'data_statistics', (
            SELECT jsonb_build_object(
                'total_sessions', COUNT(*),
                'total_signal_measurements', (SELECT COUNT(*) FROM signal_measurements WHERE quality_flag = 'valid'),
                'total_pollution_measurements', (SELECT COUNT(*) FROM pollution_measurements WHERE quality_flag = 'valid'),
                'date_range', jsonb_build_object(
                    'oldest', MIN(timestamp_recorded),
                    'newest', MAX(timestamp_recorded),
                    'days_span', EXTRACT(DAYS FROM (MAX(timestamp_recorded) - MIN(timestamp_recorded)))
                ),
                'geographic_coverage', jsonb_build_object(
                    'bbox', jsonb_build_object(
                        'south', MIN(latitude),
                        'west', MIN(longitude),
                        'north', MAX(latitude),
                        'east', MAX(longitude)
                    ),
                    'center', jsonb_build_object(
                        'lat', ROUND(AVG(latitude)::numeric, 6),
                        'lng', ROUND(AVG(longitude)::numeric, 6)
                    )
                ),
                'grid_statistics', jsonb_build_object(
                    'signal_grid_cells', (SELECT COUNT(*) FROM vista_signal_grid_10m),
                    'pollution_grid_cells', (SELECT COUNT(*) FROM vista_pollution_grid_10m),
                    'avg_measurements_per_signal_cell', (
                        SELECT ROUND(AVG(measurement_count)::numeric, 1) FROM vista_signal_grid_10m
                    ),
                    'avg_measurements_per_pollution_cell', (
                        SELECT ROUND(AVG(measurement_count)::numeric, 1) FROM vista_pollution_grid_10m
                    )
                )
            )
            FROM measurement_sessions
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
