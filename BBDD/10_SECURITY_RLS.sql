
-- =====================================================
-- 10_SECURITY_RLS.sql - ROW LEVEL SECURITY CONFIGURATION
-- =====================================================

-- =====================================================
-- CONFIGURACIÓN DE ROW LEVEL SECURITY (RLS)
-- =====================================================

-- IMPORTANTE: En Supabase, RLS es OBLIGATORIO para tablas públicas
-- Sin RLS configurado, las tablas son inaccesibles desde el cliente

-- Habilitar RLS en todas las tablas principales
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE pollutant_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurement_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE pollution_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE provincias_cyl ENABLE ROW LEVEL SECURITY;

--Permisos para rol de python
CREATE POLICY "Allow script inserts" 
ON measurement_sessions FOR INSERT 
TO python_script 
WITH CHECK (TRUE);

CREATE POLICY "Allow script updates"
ON measurement_sessions FOR UPDATE
TO python_script
USING (TRUE);

-- Políticas para pollution_measurements
CREATE POLICY "Allow script inserts pollution" ON pollution_measurements
FOR INSERT TO python_script
WITH CHECK (TRUE);

CREATE POLICY "Allow script updates pollution" ON pollution_measurements  
FOR UPDATE TO python_script
USING (TRUE);

CREATE POLICY "Allow web read pollution" ON pollution_measurements
FOR SELECT TO web_reader  
USING (TRUE);

-- Políticas para signal_measurements
CREATE POLICY "Allow script inserts signal" ON signal_measurements
FOR INSERT TO python_script
WITH CHECK (TRUE);

CREATE POLICY "Allow script updates signal" ON signal_measurements
FOR UPDATE TO python_script
USING (TRUE);

CREATE POLICY "Allow web read signal" ON signal_measurements
FOR SELECT TO web_reader
USING (TRUE);

CREATE POLICY "Allow web read measurement" ON measurement_sessions
FOR SELECT TO web_reader
USING (TRUE);

CREATE POLICY "Allow read provincias" ON provincias_cyl FOR SELECT USING (TRUE); --tODOS LEEN SOLO SUPER USER MODIFICA


--permisos de select
CREATE POLICY select_all_for_roles ON signal_measurements
FOR SELECT
TO web_reader, python_script
USING (true);

CREATE POLICY select_all_for_roles ON operators
FOR SELECT
TO web_reader, python_script
USING (true);

CREATE POLICY select_all_for_roles ON provincias_cyl
FOR SELECT
TO web_reader, python_script
USING (true);

CREATE POLICY select_all_for_roles ON pollutant_types
FOR SELECT
TO web_reader, python_script
USING (true);

CREATE POLICY select_all_for_roles ON signal_types
FOR SELECT
TO web_reader, python_script
USING (true);