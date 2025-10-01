-- =====================================================
-- 02_TABLES.sql - ESTRUCTURA DE TABLAS
-- =====================================================

-- Catálogo de operadores
CREATE TABLE IF NOT EXISTS operators (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Operadores españoles
INSERT INTO operators (name, display_name) VALUES
('movistar', 'Movistar'),
('vodafone', 'Vodafone'),
('orange', 'Orange'),
('yoigo', 'Yoigo'),
('o2', 'O2'),
('pepephone', 'Pepephone'),
('digi', 'Digi'),
('lowi', 'Lowi'),
('otro', 'Otro');

-- Catálogo de tipos de señal
CREATE TABLE IF NOT EXISTS signal_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    display_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tipos de señal
INSERT INTO signal_types (code, display_name) VALUES
('4g', '4G'),
('5g', '5G');

-- Catálogo de tipos de contaminantes
CREATE TABLE IF NOT EXISTS pollutant_types (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    display_name VARCHAR(50) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tipos de contaminantes
INSERT INTO pollutant_types (code, display_name, unit) VALUES
('co', 'CO', 'ppm'),
('co2', 'CO2', 'ppm'),
('pm25', 'Partículas PM2.5', 'µg/m³'),
('pm10', 'Partículas PM10', 'µg/m³');

-- Tabla principal: sesiones de medición
CREATE TABLE IF NOT EXISTS measurement_sessions (
    id BIGSERIAL PRIMARY KEY,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    timestamp_recorded TIMESTAMPTZ NOT NULL,
    operator_id INTEGER NOT NULL REFERENCES operators(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT chk_coordinates_valid CHECK (
        latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180
    )
);

-- Mediciones de señal
CREATE TABLE IF NOT EXISTS signal_measurements (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES measurement_sessions(id) ON DELETE CASCADE,
    signal_type_id INTEGER NOT NULL REFERENCES signal_types(id),
    signal_strength_dbm INTEGER NOT NULL CHECK (signal_strength_dbm BETWEEN -140 AND -30),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data_source VARCHAR(100) DEFAULT 'forms',
    measurement_method VARCHAR(100) DEFAULT 'mobile',
    quality_flag VARCHAR(20) DEFAULT 'valid',
    
    UNIQUE(session_id, signal_type_id)
);

-- Mediciones de contaminación
CREATE TABLE IF NOT EXISTS pollution_measurements (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES measurement_sessions(id) ON DELETE CASCADE,
    pollutant_type_id INTEGER NOT NULL REFERENCES pollutant_types(id),
    concentration DECIMAL(10,4) NOT NULL CHECK (concentration >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    data_source VARCHAR(100) DEFAULT 'forms',
    measurement_method VARCHAR(100) DEFAULT 'domestic_sensor',
    quality_flag VARCHAR(20) DEFAULT 'valid',
    
    UNIQUE(session_id, pollutant_type_id)
);

-- Tabla de provincias (si no existe)
CREATE TABLE IF NOT EXISTS provincias_cyl (
    id SERIAL PRIMARY KEY,
    provincia VARCHAR(100) NOT NULL,
    cod_ine_prov VARCHAR(10),
    geometry GEOMETRY(MULTIPOLYGON, 4326)
);

-- ********************************
-- CARGA DE DATOS E DICCIONARIOS
-- ********************************





