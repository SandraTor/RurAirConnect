-- =====================================================
-- 00_ROLES.sql - ROLES Y PERMISOS
-- =====================================================
-- =====================================================
-- IMPORTANTE: Este script debe ejecutarse ANTES que todos los demás
-- Ejecutar con usuario administrador (postgres/supabase admin)
-- =====================================================

-- Crear rol para inserción de datos desde script python
CREATE ROLE python_script LOGIN PASSWORD ''; --Establecer contraseña
-- Crear rol para web app
CREATE ROLE web_reader WITH LOGIN PASSWORD ''; --Establecer contraseña


GRANT CONNECT ON DATABASE postgres TO python_script;
GRANT USAGE ON SCHEMA public TO python_script;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO python_script;

GRANT USAGE ON SCHEMA public TO web_reader;

GRANT SELECT ON TABLE operators TO web_reader;
GRANT SELECT ON TABLE signal_types TO web_reader;
GRANT SELECT ON TABLE pollutant_types TO web_reader;
GRANT SELECT ON TABLE measurement_sessions TO web_reader;
GRANT SELECT ON TABLE signal_measurements TO web_reader;
GRANT SELECT ON TABLE pollution_measurements TO web_reader;
