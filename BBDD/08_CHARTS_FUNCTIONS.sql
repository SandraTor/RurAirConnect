-- =====================================================
-- 08_CHARTS_FUNCTIONS.sql - FUNCIONES PARA GRÁFICAS
-- =====================================================

-- FUNCIÓN para gráficos de barras: Señal por provincia y operador
CREATE OR REPLACE FUNCTION get_signal_stats_charts(
    p_signal_type TEXT DEFAULT '4G',
    p_days_back INTEGER DEFAULT NULL  -- Sin límite por defecto
) RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'chart_type', 'bar_chart',
            'signal_type', p_signal_type,
            'generated_at', NOW(),
            'data_summary', jsonb_build_object(
                'total_measurements', SUM(measurement_count),
                'avg_signal_strength', ROUND(AVG(avg_signal_strength)::numeric, 2),
                'provinces_covered', COUNT(DISTINCT provincia),
                'operators_covered', COUNT(DISTINCT operator_name)
            ),
            'data', jsonb_agg(
                jsonb_build_object(
                    'provincia', provincia,
                    'operator_name', operator_name,
                    'operator_code', operator_code,
                    'avg_signal_strength', avg_signal_strength,
                    'measurement_count', measurement_count,
                    'quality_level', CASE 
                        WHEN avg_signal_strength >= -70 THEN 'Excelente'
                        WHEN avg_signal_strength >= -85 THEN 'Buena'
                        WHEN avg_signal_strength >= -100 THEN 'Regular'
                        ELSE 'Pobre'
                    END,
                    'reliability', CASE 
                        WHEN measurement_count >= 20 THEN 'Alta'
                        WHEN measurement_count >= 10 THEN 'Media'
                        ELSE 'Baja'
                    END
                ) ORDER BY provincia, avg_signal_strength DESC
            )
        )
        FROM (
            SELECT 
                COALESCE(p.provincia, 'Sin Provincia') as provincia,
                COALESCE(o.display_name, o.name) as operator_name,
                o.name as operator_code,
                ROUND(AVG(sm.signal_strength_dbm)::numeric, 2) as avg_signal_strength,
                COUNT(*) as measurement_count
            FROM measurement_sessions ms
            JOIN signal_measurements sm ON ms.id = sm.session_id
            JOIN signal_types st ON sm.signal_type_id = st.id
            JOIN operators o ON ms.operator_id = o.id
            LEFT JOIN provincias_cyl p ON ST_Within(ms.location::geometry, p.geometry)
            WHERE 
                UPPER(st.code) = UPPER(p_signal_type)
                AND sm.quality_flag = 'valid'
                AND sm.signal_strength_dbm BETWEEN -140 AND -30
                AND (p_days_back IS NULL OR ms.timestamp_recorded >= NOW() - (p_days_back || ' days')::INTERVAL)
                AND (o.is_active IS NULL OR o.is_active = true)
                AND (st.is_active IS NULL OR st.is_active = true)
            GROUP BY p.provincia, o.name, o.display_name
            HAVING COUNT(*) >= 1  -- Mínimo 1 mediciones para incluir
        ) stats
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCIÓN para gráficos de líneas temporales: Contaminación por provincia
CREATE OR REPLACE FUNCTION get_pollution_temporal_charts(
    p_pollutant_code TEXT,
    p_months_back INTEGER DEFAULT 3,
    p_group_by TEXT DEFAULT 'day'  -- 'day', 'week', 'month'
) RETURNS JSON AS $$
DECLARE
    date_trunc_format TEXT;
BEGIN
    -- Validar formato de agrupación
    date_trunc_format := CASE LOWER(p_group_by)
        WHEN 'week' THEN 'week'
        WHEN 'month' THEN 'month'
        ELSE 'day'
    END;
    
    RETURN (
        SELECT jsonb_build_object(
            'chart_type', 'line_chart',
            'pollutant_code', p_pollutant_code,
            'time_grouping', date_trunc_format,
            'generated_at', NOW(),
            'data_summary', jsonb_build_object(
                'total_measurements', SUM(measurement_count),
                'avg_concentration', ROUND(AVG(avg_concentration)::numeric, 4),
                'date_range', jsonb_build_object(
                    'from', MIN(fecha),
                    'to', MAX(fecha)
                ),
                'provinces_covered', COUNT(DISTINCT provincia),
                'pollutant_unit', (
                    SELECT unit FROM pollutant_types WHERE code = p_pollutant_code LIMIT 1
                )
            ),
            'data', jsonb_agg(
                jsonb_build_object(
                    'fecha', fecha,
                    'provincia', provincia,
                    'avg_concentration', avg_concentration,
                    'measurement_count', measurement_count,
                    'min_concentration', min_concentration,
                    'max_concentration', max_concentration,
                    'reliability', CASE 
                        WHEN measurement_count >= 10 THEN 'Alta'
                        WHEN measurement_count >= 5 THEN 'Media'
                        ELSE 'Baja'
                    END
                ) ORDER BY fecha, provincia
            )
        )
        FROM (
            SELECT 
                date_trunc(date_trunc_format, ms.timestamp_recorded)::DATE as fecha,
                COALESCE(p.provincia, 'Sin Provincia') as provincia,
                ROUND(AVG(pm.concentration)::numeric, 4) as avg_concentration,
                COUNT(*) as measurement_count,
                MIN(pm.concentration) as min_concentration,
                MAX(pm.concentration) as max_concentration
            FROM measurement_sessions ms
            JOIN pollution_measurements pm ON ms.id = pm.session_id
            JOIN pollutant_types pt ON pm.pollutant_type_id = pt.id
            LEFT JOIN provincias_cyl p ON ST_Within(ms.location::geometry, p.geometry)
            WHERE 
                UPPER(pt.code) = UPPER(p_pollutant_code)
                AND pm.quality_flag = 'valid'
                AND pm.concentration > 0 AND pm.concentration < 9999
                AND ms.timestamp_recorded >= NOW() - (p_months_back || ' months')::INTERVAL
                AND (pt.is_active IS NULL OR pt.is_active = true)
            GROUP BY 
                date_trunc(date_trunc_format, ms.timestamp_recorded)::DATE, 
                p.provincia
            HAVING COUNT(*) >= 1  -- Mínimo 1 medicion por punto temporal
        ) temporal_stats
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;