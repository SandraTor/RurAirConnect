-- ===================================================== 
-- 01_SETUP.sql - EXTENSIONES Y CONFIGURACIÓN INICIAL
-- =====================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS btree_gist;  -- Índices espacio-temporales
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- Búsquedas de texto

-- Configuración de timezone para consistencia
SET timezone = 'Europe/Madrid';
ALTER DATABASE postgres SET timezone = 'Europe/Madrid';