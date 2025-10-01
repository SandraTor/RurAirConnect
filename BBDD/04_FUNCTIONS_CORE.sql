-- =====================================================
-- 04_FUNCTIONS_CORE.sql - FUNCIONES BÁSICAS DE CUADRÍCULA
-- =====================================================

CREATE OR REPLACE FUNCTION get_precise_10m_cell(geog GEOGRAPHY)
RETURNS GEOGRAPHY AS $$
DECLARE
    lat DECIMAL;
    lng DECIMAL;
    utm_zone INTEGER;
    utm_srid INTEGER;
    geom GEOMETRY;
    utm_point GEOMETRY;
    snapped_utm GEOMETRY;
BEGIN
    -- Extraer coordenadas
    geom := geog::geometry;
    lat := ST_Y(geom);
    lng := ST_X(geom);
    
    -- Validación territorial España
    IF NOT is_valid_spanish_coordinates(lat, lng) THEN
        RAISE EXCEPTION 'COORDENADAS FUERA DE ESPAÑA: lat=%, lng=%. Solo se permiten coordenadas de España (península, Baleares, Canarias, Ceuta y Melilla).', 
            lat, lng
            USING HINT = 'Verificar que las coordenadas correspondan al territorio español',
                  ERRCODE = 'check_violation';
    END IF;
    
    -- Zonas UTM específicas del territorio español
    utm_zone := CASE 
        WHEN lng < -12 THEN 28  -- Canarias occidentales (El Hierro, La Palma, La Gomera, Tenerife oeste)
        WHEN lng < -6 THEN 29   -- Canarias orientales + Galicia occidental
        WHEN lng < 0 THEN 30    -- España centro-occidental (mayoría del territorio)
        ELSE 31                 -- España oriental + Baleares + Cataluña
    END;
    
    -- España está completamente en hemisferio norte
    utm_srid := 32600 + utm_zone;
    
    -- Transformación precisa: WGS84 → UTM → Snap 10m → WGS84
    utm_point := ST_Transform(ST_SetSRID(geom, 4326), utm_srid);
    snapped_utm := ST_SnapToGrid(utm_point, 10.0);  -- 10 metros exactos
    
    RETURN ST_Transform(snapped_utm, 4326)::geography;
    
EXCEPTION
    WHEN others THEN
        -- Error más informativo para debugging
        RAISE EXCEPTION 'ERROR en get_precise_10m_cell(): lat=%, lng=%, utm_zone=%, utm_srid=%, error=%', 
            lat, lng, utm_zone, utm_srid, SQLERRM
            USING HINT = 'Verificar validez de coordenadas y proyección UTM';
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Función auxiliar para validar territorio español -- con rectángulos ya que se valida también en python. MEnor carga computacional que ST_Contains y topología española.
CREATE OR REPLACE FUNCTION is_valid_spanish_coordinates(lat DECIMAL, lng DECIMAL)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        -- España peninsular + Islas Baleares
        (lat BETWEEN 35.5 AND 43.9 AND lng BETWEEN -9.5 AND 4.5)
        OR
        -- Islas Canarias
        (lat BETWEEN 27.5 AND 29.5 AND lng BETWEEN -18.5 AND -13.2)
        OR 
        -- Ceuta
        (lat BETWEEN 35.8 AND 35.95 AND lng BETWEEN -5.4 AND -5.2)
        OR
        -- Melilla
        (lat BETWEEN 35.26 AND 35.33 AND lng BETWEEN -3.05 AND -2.9)
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

-- Comentario actualizado de la función
COMMENT ON FUNCTION get_precise_10m_cell(GEOGRAPHY) IS 
'TFG - Función principal para crear cuadrículas precisas de 10m x 10m usando proyección UTM.
ACTUALIZADA: Incluye validación territorial española (península, Baleares, Canarias, Ceuta y Melilla).
Optimizada para España con zonas UTM específicas: 28N-31N.
Garantiza exactitud geográfica y rechaza coordenadas fuera del territorio nacional.';


-- Función para triggers de auditoría
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

