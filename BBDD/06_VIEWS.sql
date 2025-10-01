-- =====================================================
-- 06_VIEWS.sql - VISTAS PRINCIPALES
-- =====================================================

-- Vista optimizada: Datos de señal por cuadrículas precisas
CREATE OR REPLACE VIEW vista_signal_grid_10m AS
SELECT 
    -- Identificadores únicos
    md5(ST_X(cell_center::geometry)::text || '|' || ST_Y(cell_center::geometry)::text || '|' || 
        operator_code || '|' || signal_type_code) as cell_id,
    
    -- Geometría de la celda (centro)
    cell_center,
    ST_X(cell_center::geometry) as cell_lng,
    ST_Y(cell_center::geometry) as cell_lat,
    
    -- Datos del operador y señal
    operator_code,
    operator_name,
    signal_type_code,
    signal_type_name,
    
    -- Estadísticas agregadas
    avg_signal_strength,
    min_signal_strength,
    max_signal_strength,
    measurement_count,
    signal_stddev,
    
    -- Clasificación de calidad
    CASE 
        WHEN avg_signal_strength >= -90 THEN 'Excelente'
        WHEN avg_signal_strength >= -100 THEN 'Buena'
        WHEN avg_signal_strength >= -110 THEN 'Regular'
        ELSE 'Pobre'
    END as signal_quality,
    
    -- Metadatos temporales
    first_measurement,
    last_measurement,
    EXTRACT(DAYS FROM (NOW() - last_measurement))::integer as data_age_days,
    
    -- Información geográfica
    provincia_nombre,
    provincia_codigo,
    
    -- GeoJSON completo
    jsonb_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(cell_center::geometry)::jsonb,
        'properties', jsonb_build_object(
            'id', md5(ST_X(cell_center::geometry)::text || '|' || ST_Y(cell_center::geometry)::text || '|' || 
                     operator_code || '|' || signal_type_code),
            'operator_code', operator_code,
            'operator_name', operator_name,
            'signal_type', signal_type_code,
            'signal_type_name', signal_type_name,
            'avg_signal_strength', avg_signal_strength,
            'min_signal_strength', min_signal_strength,
            'max_signal_strength', max_signal_strength,
            'measurement_count', measurement_count,
            'signal_quality', CASE 
                WHEN avg_signal_strength >= -70 THEN 'Excelente'
                WHEN avg_signal_strength >= -85 THEN 'Buena'
                WHEN avg_signal_strength >= -100 THEN 'Regular'
                ELSE 'Pobre'
            END,
            'provincia', provincia_nombre,
            'data_age_days', EXTRACT(DAYS FROM (NOW() - last_measurement))::integer,
            'layer_type', 'signal_grid'
        )
    ) as geojson_feature
FROM (
    SELECT 
        get_precise_10m_cell(ms.location) as cell_center,
        o.name as operator_code,
        COALESCE(o.display_name, o.name) as operator_name,
        st.code as signal_type_code,
        COALESCE(st.display_name, st.code) as signal_type_name,
        
        ROUND(AVG(sm.signal_strength_dbm)::numeric, 2) as avg_signal_strength,
        MIN(sm.signal_strength_dbm) as min_signal_strength,
        MAX(sm.signal_strength_dbm) as max_signal_strength,
        COUNT(*) as measurement_count,
        ROUND(STDDEV_POP(sm.signal_strength_dbm)::numeric, 2) as signal_stddev,
        
        MIN(ms.timestamp_recorded) as first_measurement,
        MAX(ms.timestamp_recorded) as last_measurement,
        
        COALESCE(p.provincia, 'Sin Provincia') as provincia_nombre,
        p.cod_ine_prov as provincia_codigo
        
    FROM measurement_sessions ms
    JOIN signal_measurements sm ON ms.id = sm.session_id
    JOIN operators o ON ms.operator_id = o.id
    JOIN signal_types st ON sm.signal_type_id = st.id
    LEFT JOIN provincias_cyl p ON ST_Within(ms.location::geometry, p.geometry)
    WHERE 
        sm.signal_strength_dbm IS NOT NULL
        AND sm.signal_strength_dbm BETWEEN -140 AND -30
        AND sm.quality_flag = 'valid'
        AND (o.is_active IS NULL OR o.is_active = true)
        AND (st.is_active IS NULL OR st.is_active = true)
    GROUP BY 
        cell_center, o.name, o.display_name, st.code, st.display_name,
        p.provincia, p.cod_ine_prov
) aggregated;

-- Vista optimizada: Datos de contaminación por cuadrículas precisas (últimos 30 días)
CREATE OR REPLACE VIEW vista_pollution_grid_10m AS
SELECT 
    -- Identificadores únicos
    md5(ST_X(cell_center::geometry)::text || '|' || ST_Y(cell_center::geometry)::text || '|' || 
        pollutant_code || '|' || measurement_date::text) as cell_id,
    
    -- Geometría de la celda
    cell_center,
    ST_X(cell_center::geometry) as cell_lng,
    ST_Y(cell_center::geometry) as cell_lat,
    
    -- Datos del contaminante
    pollutant_code,
    pollutant_name,
    pollutant_unit,
    
    -- Estadísticas agregadas
    avg_concentration,
    min_concentration,
    max_concentration,
    measurement_count,
    concentration_stddev,
    
    -- Metadatos temporales
    measurement_date,
    first_measurement,
    last_measurement,
    EXTRACT(DAYS FROM (NOW() - last_measurement))::integer as data_age_days,
    
    -- Información geográfica
    provincia_nombre,
    provincia_codigo,
    
    -- GeoJSON completo
    jsonb_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(cell_center::geometry)::jsonb,
        'properties', jsonb_build_object(
            'id', md5(ST_X(cell_center::geometry)::text || '|' || ST_Y(cell_center::geometry)::text || '|' || 
                     pollutant_code || '|' || measurement_date::text),
            'pollutant_code', pollutant_code,
            'pollutant_name', pollutant_name,
            'pollutant_unit', pollutant_unit,
            'avg_concentration', avg_concentration,
            'min_concentration', min_concentration,
            'max_concentration', max_concentration,
            'measurement_count', measurement_count,
            'measurement_date', measurement_date,
            'provincia', provincia_nombre,
            'data_age_days', EXTRACT(DAYS FROM (NOW() - last_measurement))::integer,
            'layer_type', 'pollution_grid'
        )
    ) as geojson_feature
FROM (
    SELECT 
        get_precise_10m_cell(ms.location) as cell_center,
        pt.code as pollutant_code,
        COALESCE(pt.display_name, pt.code) as pollutant_name,
        pt.unit as pollutant_unit,
        
        ROUND(AVG(pm.concentration)::numeric, 4) as avg_concentration,
        MIN(pm.concentration) as min_concentration,
        MAX(pm.concentration) as max_concentration,
        COUNT(*) as measurement_count,
        ROUND(STDDEV_POP(pm.concentration)::numeric, 4) as concentration_stddev,
        
        DATE(ms.timestamp_recorded) as measurement_date,
        MIN(ms.timestamp_recorded) as first_measurement,
        MAX(ms.timestamp_recorded) as last_measurement,
        
        COALESCE(p.provincia, 'Sin Provincia CyL') as provincia_nombre,
        p.cod_ine_prov as provincia_codigo
        
    FROM measurement_sessions ms
    JOIN pollution_measurements pm ON ms.id = pm.session_id
    JOIN pollutant_types pt ON pm.pollutant_type_id = pt.id
    LEFT JOIN provincias_cyl p ON ST_Within(ms.location::geometry, p.geometry)
    WHERE 
        pm.concentration IS NOT NULL
        AND pm.concentration > 0
        AND pm.concentration < 9999
        AND pm.quality_flag = 'valid'
        AND ms.timestamp_recorded >= CURRENT_DATE - INTERVAL '30 days'  -- Solo últimos 30 días
        AND (pt.is_active IS NULL OR pt.is_active = true)
    GROUP BY 
        cell_center, pt.code, pt.display_name, pt.unit,
        DATE(ms.timestamp_recorded), p.provincia, p.cod_ine_prov
) aggregated;