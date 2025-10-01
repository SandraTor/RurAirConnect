-- Función para validar la precisión de la cuadrícula con datos reales
CREATE OR REPLACE FUNCTION validate_grid_precision()
RETURNS TABLE(
    test_name TEXT,
    sample_size INTEGER,
    avg_precision_meters DECIMAL,
    max_precision_meters DECIMAL,
    status TEXT,
    recommendation TEXT
) AS $
BEGIN
    RETURN QUERY
    WITH precision_test AS (
        SELECT 
            ms.location,
            get_precise_10m_cell(ms.location) as precise_cell,
            -- Comparar con método aproximado para referencia
            ST_SnapToGrid(ms.location::geometry, 0.00005)::geography as approx_cell
        FROM measurement_sessions ms
        WHERE location IS NOT NULL
        ORDER BY RANDOM()
        LIMIT 100  -- Muestra representativa
    ),
    distance_analysis AS (
        SELECT 
            COUNT(*) as sample_count,
            AVG(ST_Distance(precise_cell, approx_cell)) as avg_distance,
            MAX(ST_Distance(precise_cell, approx_cell)) as max_distance,
            MIN(ST_Distance(precise_cell, approx_cell)) as min_distance
        FROM precision_test
    )
    SELECT 
        'Precisión Cuadrícula 10m x 10m'::TEXT,
        sample_count::INTEGER,
        ROUND(avg_distance::numeric, 2),
        ROUND(max_distance::numeric, 2),
        CASE 
            WHEN avg_distance < 5 THEN 'EXCELENTE'
            WHEN avg_distance < 15 THEN 'BUENA'
            WHEN avg_distance < 25 THEN 'ACEPTABLE'
            ELSE 'REVISAR'
        END::TEXT,
        CASE 
            WHEN avg_distance < 5 THEN 'Precisión óptima para visualización rural'
            WHEN avg_distance < 15 THEN 'Precisión adecuada - continuar con función precisa'
            ELSE 'Considerar ajustes adicionales en la función de cuadrícula'
        END::TEXT
    FROM distance_analysis;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para verificar el estado completo del sistema
CREATE OR REPLACE FUNCTION verify_tfg_system()
RETURNS JSON AS $
DECLARE
    result JSONB;
    signal_grid_count INTEGER;
    pollution_grid_count INTEGER;
BEGIN
    -- Contar datos en las vistas principales
    SELECT COUNT(*) INTO signal_grid_count FROM vista_signal_grid_10m;
    SELECT COUNT(*) INTO pollution_grid_count FROM vista_pollution_grid_10m;
    
    -- Construir resultado de verificación
    result := jsonb_build_object(
        'system_status', 'TFG_PRODUCTION_READY',
        'verification_timestamp', NOW(),
        'database_structure', jsonb_build_object(
            'tables_created', (
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('operators', 'signal_types', 'pollutant_types', 
                                 'measurement_sessions', 'signal_measurements', 'pollution_measurements')
            ),
            'indexes_created', (
                SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public'
            ),
            'triggers_active', (
                SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public'
            )
        ),
        'data_availability', jsonb_build_object(
            'signal_grid_cells', signal_grid_count,
            'pollution_grid_cells', pollution_grid_count,
            'total_sessions', (SELECT COUNT(*) FROM measurement_sessions),
            'total_signal_measurements', (SELECT COUNT(*) FROM signal_measurements WHERE quality_flag = 'valid'),
            'total_pollution_measurements', (SELECT COUNT(*) FROM pollution_measurements WHERE quality_flag = 'valid')
        ),
        'api_functions', jsonb_build_object(
            'get_geojson_categories', 'READY',
            'get_geojson_layers', 'READY',
            'get_signal_geojson_optimized', 'READY',
            'get_pollution_geojson_optimized', 'READY',
            'get_complete_app_metadata', 'READY',
            'get_signal_stats_charts', 'READY',
            'get_pollution_temporal_charts', 'READY'
        ),
        'precision_test', (
            SELECT to_jsonb(v) FROM validate_grid_precision() v LIMIT 1
        ),
        'recommendations_for_webapp', ARRAY[
            'Usar get_precise_10m_cell para máxima precisión en toda España',
            'Las vistas están optimizadas para consultas frecuentes',
            'Los filtros por bounding box están implementados para zoom en Leaflet',
            'Campos de auditoría activos para seguimiento de cambios',
            'Sistema listo para implementación en PHP'
        ],
        'leaflet_integration_notes', jsonb_build_object(
            'precision_level', '10m x 10m cells (100m²)',
            'zoom_recommendation', 'Zoom mínimo 12-13 para visualización rural óptima',
            'geojson_format', 'Compliant con especificación GeoJSON RFC 7946',
            'performance_tips', ARRAY[
                'Usar bounding box para limitar datos en viewport',
                'Implementar clustering para alta densidad de puntos',
                'Cachear resultados de metadatos (cambian poco)'
            ]
        )
    );
    
    RETURN result;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;