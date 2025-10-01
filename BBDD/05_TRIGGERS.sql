-- =====================================================
-- 05_TRIGGERS.sql - TRIGGERS DE AUDITORÍA
-- =====================================================

-- Triggers para campos updated_at
DROP TRIGGER IF EXISTS update_measurement_sessions_updated_at ON measurement_sessions;
CREATE TRIGGER update_measurement_sessions_updated_at 
    BEFORE UPDATE ON measurement_sessions FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_operators_updated_at ON operators;
CREATE TRIGGER update_operators_updated_at 
    BEFORE UPDATE ON operators FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_signal_types_updated_at ON signal_types;
CREATE TRIGGER update_signal_types_updated_at 
    BEFORE UPDATE ON signal_types FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pollutant_types_updated_at ON pollutant_types;
CREATE TRIGGER update_pollutant_types_updated_at 
    BEFORE UPDATE ON pollutant_types FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_signal_measurements_updated_at ON signal_measurements;
CREATE TRIGGER update_signal_measurements_updated_at 
    BEFORE UPDATE ON signal_measurements FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pollution_measurements_updated_at ON pollution_measurements;
CREATE TRIGGER update_pollution_measurements_updated_at 
    BEFORE UPDATE ON pollution_measurements FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();