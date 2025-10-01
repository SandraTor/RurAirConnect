-- =====================================================
-- 03_INDEXES.sql - ÍNDICES OPTIMIZADOS
-- =====================================================

-- Índices espaciales y temporales principales
CREATE INDEX IF NOT EXISTS idx_sessions_location ON measurement_sessions USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON measurement_sessions (timestamp_recorded DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_operator ON measurement_sessions (operator_id);

-- Índice espacio-temporal combinado (el más importante)
CREATE INDEX IF NOT EXISTS idx_sessions_spatiotemporal 
ON measurement_sessions USING GIST(location, timestamp_recorded);

-- Índices para mediciones de señal
CREATE INDEX IF NOT EXISTS idx_signal_session ON signal_measurements(session_id);
CREATE INDEX IF NOT EXISTS idx_signal_type ON signal_measurements(signal_type_id);
CREATE INDEX IF NOT EXISTS idx_signal_strength ON signal_measurements(signal_strength_dbm);
CREATE INDEX IF NOT EXISTS idx_signal_quality ON signal_measurements(quality_flag) WHERE quality_flag = 'valid';

-- Índices para mediciones de contaminación
CREATE INDEX IF NOT EXISTS idx_pollution_session ON pollution_measurements(session_id);
CREATE INDEX IF NOT EXISTS idx_pollution_type ON pollution_measurements(pollutant_type_id);
CREATE INDEX IF NOT EXISTS idx_pollution_concentration ON pollution_measurements(concentration);
CREATE INDEX IF NOT EXISTS idx_pollution_quality ON pollution_measurements(quality_flag) WHERE quality_flag = 'valid';

-- Índices para consultas frecuentes por fecha
CREATE INDEX IF NOT EXISTS idx_sessions_date ON measurement_sessions (DATE(timestamp_recorded));
