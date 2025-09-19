#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Este módulo proporciona funcionalidades para la importación automatizada de datos
desde Google Sheets hacia una base de datos PostgreSQL/Supabase, específicamente
diseñado para el almacenamiento de mediciones de calidad del aire y intensidad
de señales de telecomunicaciones.

Autor: Sandra Torrero Casado
Fecha: Julio 2025
Proyecto: TFG
"""
import os
import requests
import psycopg2
import logging
from datetime import datetime
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point, MultiPolygon, Polygon
from shapely.geometry.base import BaseGeometry
from io import StringIO
from decimal import Decimal, InvalidOperation
from typing import Dict, Tuple, Optional, Union

# =========================================================================
# CONFIGURACIÓN DEL SISTEMA
# =========================================================================

# ========= CONFIGURACIÓN =========
SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL", "DATOS CONEXIÓN A SUPABASE CON ROL python_script")

# URL CSV exportable desde Google Sheets (usar formato export?format=csv)
GOOGLE_SHEET_CSV_URL = "URL GOOGLE SHEETS/export?format=csv"

# Configuración de logging
log_filename = f"import_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.FileHandler(log_filename, encoding='utf-8'),  # Guarda en archivo
        logging.StreamHandler()  # Muestra en consola
    ]
)
logger = logging.getLogger(__name__)
logger.info(f"Log guardándose en: {log_filename}")

# =========================================================================
# CONFIGURACIÓN DE CONEXIÓN A BASE DE DATOS
# =========================================================================

try:
    conn = psycopg2.connect(SUPABASE_DB_URL)
    conn.autocommit = True
    cur = conn.cursor()
    logger.info("Conexión a la base de datos establecida exitosamente")
except psycopg2.Error as e:
    logger.error(f"Error al conectar con la base de datos: {e}")
    raise

# =========================================================================
# CONFIGURACIÓN DE VALIDACIÓN GEOGRÁFICA
# =========================================================================

# URL del servicio WFS del IGN para la geometría nacional de España
SPAIN_WFS_URL = (
    "https://contenido.ign.es/wfs-inspire/unidades-administrativas"
    "?service=WFS&request=GetFeature&COUNT=1&version=2.0.0"
    "&TYPENAME=au:AdministrativeUnit"
    "&resourceid=AU_ADMINISTRATIVEUNIT_34000000000"
    "&srsName=EPSG:4326"  # Explícitamente WGS84
)

# Cache en memoria para la geometría de España
_spain_geometry_cache = None

# =========================================================================
# CACHÉS Y DICCIONARIOS DE REFERENCIA
# =========================================================================

def get_lookup_dict(table: str, key_column: str = "display_name", value_column: str = "id") -> Dict[str, int]:
    """
    Carga diccionarios de lookup desde tablas de referencia para optimizar consultas.
    
    Args:
        table (str): Nombre de la tabla de referencia
        key_column (str): Columna que servirá como clave del diccionario
        value_column (str): Columna que servirá como valor del diccionario
    
    Returns:
        Dict[str, int]: Diccionario con mapeo clave-valor
    """
    try:
        cur.execute(f"SELECT {key_column}, {value_column} FROM {table} WHERE is_active = true")
        result = dict(cur.fetchall())
        logger.debug(f"Cargado diccionario de {table}: {len(result)} registros")
        return result
    except psycopg2.Error as e:
        logger.error(f"Error cargando diccionario de {table}: {e}")
        return {}

# Inicialización de cachés de datos de referencia
operators_dict = get_lookup_dict("operators", key_column="display_name")
signal_types_dict = get_lookup_dict("signal_types", key_column="display_name") 
pollutants_dict = get_lookup_dict("pollutant_types", key_column="code")

logger.info(f"Datos de referencia cargados - Operadores: {len(operators_dict)}, "
           f"Tipos de señal: {len(signal_types_dict)}, "
           f"Contaminantes: {len(pollutants_dict)}")

# =========================================================================
# FUNCIONES DE PROCESAMIENTO Y VALIDACIÓN DE DATOS
# =========================================================================

def parse_location(loc_str: str) -> Tuple[Optional[float], Optional[float]]:
    """
    Parsea y valida coordenadas geográficas desde formato string.
    
    Args:
        loc_str (str): String con coordenadas en formato "latitud,longitud"
    
    Returns:
        Tuple[Optional[float], Optional[float]]: Tupla con (latitud, longitud) 
        o (None, None) si hay error
    """
    try:
        lat_str, lon_str = loc_str.split(",")
        lat, lon = round(float(lat_str.strip()), 8), round(float(lon_str.strip()), 8)
        
        # Validación de rangos geográficos válidos
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            logger.warning(f"Coordenadas fuera de rango válido: {lat}, {lon}")
            return None, None
            
        return lat, lon
    except (ValueError, AttributeError) as e:
        logger.warning(f"Error parseando coordenadas '{loc_str}': {e}")
        return None, None

def parse_timestamp(ts_str: str) -> Optional[datetime]:
    """
    Parsea timestamp con soporte para múltiples formatos comunes.
    
    Args:
        ts_str (str): String con timestamp
    
    Returns:
        Optional[datetime]: Objeto datetime o None si hay error
    """
    # Formatos soportados ordenados por probabilidad de uso
    formats = [
        "%d/%m/%Y %H:%M:%S",    # Formato español completo
        "%d/%m/%Y %H:%M",       # Formato español sin segundos
        "%Y-%m-%d %H:%M:%S",    # Formato ISO completo
        "%Y-%m-%d %H:%M",       # Formato ISO sin segundos
        "%d-%m-%Y %H:%M:%S",    # Formato alternativo
        "%d-%m-%Y %H:%M"        # Formato alternativo sin segundos
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(ts_str.strip(), fmt)
        except ValueError:
            continue
    
    logger.warning(f"No se pudo parsear el timestamp: '{ts_str}'")
    return None

def get_operator_id(operator_name: str) -> Optional[int]:
    """
    Obtiene el ID del operador normalizando el nombre de entrada.
    
    Args:
        operator_name (str): Nombre del operador
    
    Returns:
        Optional[int]: ID del operador o None si no se encuentra
    """
    if not operator_name or not operator_name.strip():
        return None
    
    # Normalización del nombre: capitaliza cada palabra
    normalized = operator_name.strip().title()
    operator_id = operators_dict.get(normalized)
    
    if operator_id is None:
        logger.warning(f"Operador no encontrado en base de datos: '{operator_name}'")
    
    return operator_id
# =========================================================================
# FUNCIONES DE VALIDACIÓN GEOGRÁFICA
# =========================================================================

def get_spain_geometry(use_cache: bool = True):
    """
    Obtiene la geometría nacional de España desde el WFS del IGN.
    
    Args:
        use_cache (bool): Si usar caché en memoria para evitar descargas repetidas
    
    Returns:
        shapely.geometry: Geometría MultiPolygon de España
    
    Raises:
        Exception: Si no se puede descargar o procesar la geometría
    """
    global _spain_geometry_cache
    
    # Verificar caché en memoria
    if use_cache and _spain_geometry_cache is not None:
        logger.debug("Usando geometría de España desde caché en memoria")
        return _spain_geometry_cache
    
    logger.info("Descargando geometría de España desde el WFS del IGN...")
    
    try:
        # Descargar desde el servicio WFS
        gdf = gpd.read_file(SPAIN_WFS_URL)
        
        if gdf.empty:
            raise ValueError("No se encontró la geometría nacional de España en el WFS")
        
        # Verificar que tenemos el CRS correcto (WGS84)
        if gdf.crs != 'EPSG:4326':
            logger.info(f"Reproyectando geometría desde {gdf.crs} a EPSG:4326")
            gdf = gdf.to_crs('EPSG:4326')
        
        # Extraer la geometría
        spain_geom = gdf.geometry.iloc[0]
        
        # Guardar en caché
        if use_cache:
            _spain_geometry_cache = spain_geom
            logger.debug("Geometría de España guardada en caché en memoria")
        
        logger.info("Geometría de España cargada exitosamente")
        return spain_geom
        
    except Exception as e:
        logger.error(f"Error cargando geometría de España: {e}")
        raise Exception(f"No se pudo cargar la geometría de España: {e}")

def is_point_in_spain(lat: float, lon: float, spain_geom = None) -> bool:
    """
    Verifica si un punto (lat, lon) está dentro del territorio español.
    
    Args:
        lat (float): Latitud del punto
        lon (float): Longitud del punto  
        spain_geom (BaseGeometry, optional): Geometría de España. Se carga automáticamente si no se proporciona.
    
    Returns:
        bool: True si el punto está dentro de España, False en caso contrario
    """
    try:
        # Cargar geometría si no se proporciona
        if spain_geom is None:
            spain_geom = get_spain_geometry()
        
        # Verificación adicional de seguridad
        if not hasattr(spain_geom, 'contains'):
            logger.error(f"Geometría inválida recibida: {type(spain_geom)}")
            return True  # Asumir válido si hay error
        
        punto = Point(lon, lat)
               
        # Verificar si está contenido en España
        return spain_geom.contains(punto) #type: ignore
        
    except Exception as e:
        logger.warning(f"Error validando punto ({lat}, {lon}) contra geometría de España: {e}")
        # En caso de error, asumir que el punto es válido para no bloquear la importación
        return True

def validate_coordinates_spain(lat: float, lon: float) -> Tuple[bool, str]:
    """
    Valida que las coordenadas estén dentro de España con logging detallado.
    
    Args:
        lat (float): Latitud
        lon (float): Longitud
    
    Returns:
        Tuple[bool, str]: (is_valid, validation_message)
    """
    try:
        # Validación básica de rangos
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            return False, f"Coordenadas fuera de rango geográfico válido: ({lat}, {lon})"
        
        # Validación específica para España (rangos aproximados)
        # España continental: lat ~36-44, lon ~-9.3 a 3.3
        # Canarias: lat ~27-29, lon ~-18 a -13.4  
        # Baleares: lat ~38-40, lon ~1.1 a 4.3
        if not ((27 <= lat <= 44) and (-19 <= lon <= 5)):
            return False, f"Coordenadas fuera del área geográfica de España: ({lat}, {lon})"
        
        # Validación precisa usando geometría
        if not is_point_in_spain(lat, lon):
            return False, f"Coordenadas fuera del territorio español: ({lat}, {lon})"
        
        return True, "Coordenadas válidas dentro de España"
        
    except Exception as e:
        logger.error(f"Error durante validación geográfica: {e}")
        # En caso de error, permitir el punto pero registrar el problema
        return True, f"Validación geográfica no disponible (permitiendo punto): {e}"
    
# =========================================================================
# FUNCIONES DE INTERACCIÓN CON BASE DE DATOS
# =========================================================================

def find_existing_session(lat: float, lon: float, timestamp: datetime, operator_id: int) -> Optional[int]:
    """
    Busca sesión existente con tolerancia en coordenadas y tiempo para evitar duplicados.
    
    La tolerancia implementada permite pequeñas diferencias que pueden surgir de:
    - Precisión limitada en dispositivos GPS
    - Diferencias menores en sincronización temporal
    
    Args:
        lat (float): Latitud
        lon (float): Longitud  
        timestamp (datetime): Timestamp de la medición
        operator_id (int): ID del operador
    
    Returns:
        Optional[int]: ID de sesión existente o None si no existe
    """
    try:
        cur.execute("""
            SELECT id FROM measurement_sessions 
            WHERE ABS(latitude - %s) < 0.00000001
            AND ABS(longitude - %s) < 0.00000001
            AND ABS(EXTRACT(EPOCH FROM (timestamp_recorded - %s))) < 60
            AND operator_id = %s
            LIMIT 1
        """, (lat, lon, timestamp, operator_id))
        
        result = cur.fetchone()
        return result[0] if result else None
    except psycopg2.Error as e:
        logger.error(f"Error buscando sesión existente: {e}")
        return None

def insert_or_get_session(lat: float, lon: float, timestamp: datetime, operator_id: int) -> Tuple[Optional[int], bool]:
    """
    Inserta una nueva sesión de medición o retorna una existente.
    
    Args:
        lat (float): Latitud
        lon (float): Longitud
        timestamp (datetime): Timestamp de la medición
        operator_id (int): ID del operador
    
    Returns:
        Tuple[Optional[int], bool]: (session_id, is_new_session)
    """
    # Verificar si existe sesión similar
    existing_id = find_existing_session(lat, lon, timestamp, operator_id)
    if existing_id:
        logger.debug(f"Sesión existente identificada: ID {existing_id}")
        return existing_id, False
    
    # Crear nueva sesión
    try:
        cur.execute("""
            INSERT INTO measurement_sessions 
            (location, latitude, longitude, timestamp_recorded, operator_id, created_at, updated_at)
            VALUES (ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, %s, %s, %s, NOW(), NOW())
            RETURNING id;
        """, (lon, lat, lat, lon, timestamp, operator_id))
        
        result = cur.fetchone()
        if result is not None:
            session_id = result[0]
            logger.debug(f"Nueva sesión de medición creada: ID {session_id}")
            return session_id, True
        else:
            logger.error("Error: No se pudo obtener el ID de la sesión creada")
            return None, False
        
    except psycopg2.Error as e:
        logger.error(f"Error creando nueva sesión: {e}")
        return None, False

def upsert_signal_measurement(session_id: int, signal_type_code: str, strength: Union[int, float, str]) -> bool:
    """
    Inserta o actualiza una medición de intensidad de señal.
    
    Args:
        session_id (int): ID de la sesión de medición
        signal_type_code (str): Código del tipo de señal (ej: "4G", "5G")
        strength (Union[int, float, str]): Intensidad de señal en dBm
    
    Returns:
        bool: True si la operación fue exitosa, False en caso contrario
    """
    # Validar tipo de señal
    signal_type_id = signal_types_dict.get(signal_type_code.upper())
    if signal_type_id is None:
        logger.warning(f"Tipo de señal no reconocido: {signal_type_code}")
        return False
    
    # Validar y convertir intensidad de señal
    try:
        if pd.isna(strength):
            return False
            
        strength_int = int(float(strength))
        
        # Validar rango típico de potencia de señal en dBm
        if not (-150 <= strength_int <= 0):
            logger.warning(f"Intensidad de señal fuera de rango esperado: {strength_int} dBm")
            return False
            
    except (ValueError, TypeError) as e:
        logger.warning(f"Error procesando intensidad de señal '{strength}': {e}")
        return False
    
    # Realizar upsert en base de datos
    try:
        cur.execute("""
            INSERT INTO signal_measurements 
            (session_id, signal_type_id, signal_strength_dbm, created_at, updated_at, 
             data_source, measurement_method, quality_flag)
            VALUES (%s, %s, %s, NOW(), NOW(), 'forms', 'mobile', 'valid')
            ON CONFLICT (session_id, signal_type_id) 
            DO UPDATE SET 
                signal_strength_dbm = EXCLUDED.signal_strength_dbm,
                updated_at = NOW(),
                quality_flag = 'valid';
        """, (session_id, signal_type_id, strength_int))
        
        logger.debug(f"Medición de señal {signal_type_code} procesada: {strength_int} dBm")
        return True
        
    except psycopg2.Error as e:
        logger.error(f"Error procesando medición de señal {signal_type_code}: {e}")
        return False

def upsert_pollutant_measurement(session_id: int, pollutant_code: str, concentration: Union[int, float, str]) -> bool:
    """
    Inserta o actualiza una medición de concentración de contaminante.
    
    Args:
        session_id (int): ID de la sesión de medición
        pollutant_code (str): Código del contaminante (ej: "pm25", "co2")
        concentration (Union[int, float, str]): Concentración medida
    
    Returns:
        bool: True si la operación fue exitosa, False en caso contrario
    """
    # Validar tipo de contaminante
    pollutant_id = pollutants_dict.get(pollutant_code.lower())
    if pollutant_id is None:
        logger.warning(f"Tipo de contaminante no reconocido: {pollutant_code}")
        return False
    
    # Validar y convertir concentración
    try:
        if pd.isna(concentration):
            return False
            
        concentration_decimal = Decimal(str(float(concentration)))
        
        # Validar que la concentración no sea negativa
        if concentration_decimal < 0:
            logger.warning(f"Concentración negativa detectada: {concentration_decimal}")
            return False
            
    except (ValueError, TypeError, InvalidOperation) as e:
        logger.warning(f"Error procesando concentración '{concentration}': {e}")
        return False
    
    # Realizar upsert en base de datos
    try:
        cur.execute("""
            INSERT INTO pollution_measurements 
            (session_id, pollutant_type_id, concentration, created_at, updated_at,
             data_source, measurement_method, quality_flag)
            VALUES (%s, %s, %s, NOW(), NOW(), 'forms', 'domestic_sensor', 'valid')
            ON CONFLICT (session_id, pollutant_type_id)
            DO UPDATE SET 
                concentration = EXCLUDED.concentration,
                updated_at = NOW(),
                quality_flag = 'valid';
        """, (session_id, pollutant_id, concentration_decimal))
        
        logger.debug(f"Medición de contaminante {pollutant_code.upper()} procesada: {concentration_decimal}")
        return True
        
    except psycopg2.Error as e:
        logger.error(f"Error procesando medición de contaminante {pollutant_code}: {e}")
        return False

# =========================================================================
# FUNCIONES DE CARGA Y PROCESAMIENTO DE DATOS
# =========================================================================

def load_csv_from_sheets(url: str) -> pd.DataFrame:
    """
    Descarga y carga datos CSV desde Google Sheets.
    
    Args:
        url (str): URL del CSV exportable de Google Sheets
    
    Returns:
        pd.DataFrame: DataFrame con los datos cargados
    
    Raises:
        Exception: Si hay error en la descarga o procesamiento
    """
    logger.info("Iniciando descarga de datos desde Google Sheets")
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        # Detectar y manejar diferentes encodings
        encodings_to_try = ['utf-8', 'utf-8-sig', 'latin1', 'cp1252', 'iso-8859-1']
        df = None
        
        for encoding in encodings_to_try:
            try:
                logger.debug(f"Intentando cargar CSV con encoding: {encoding}")
                # Usar response.content y controlar la decodificación
                content = response.content.decode(encoding)
                df = pd.read_csv(StringIO(content))
                logger.info(f"CSV cargado exitosamente con encoding: {encoding}")
                break
            except (UnicodeDecodeError, pd.errors.ParserError) as e:
                logger.debug(f"Encoding {encoding} falló: {e}")
                continue
        
        if df is None:
            logger.warning("Todos los encodings estándar fallaron, usando limpieza de caracteres")
            content = response.content.decode(errors="replace")  # Decodificar reemplazando errores
            # Reemplazar manualmente caracteres malformados comunes
            content = (content.replace('Ã³', 'ó').replace('Ã¡', 'á')
                             .replace('Ã©', 'é').replace('Ã­', 'í')
                             .replace('Ãº', 'ú'))
            df = pd.read_csv(StringIO(content))
        
        df.columns = df.columns.str.strip()
        logger.debug(f"Columnas después de limpieza: {list(df.columns)}")
        
        logger.info(f"Datos cargados exitosamente: {len(df)} registros, {len(df.columns)} columnas")
        logger.debug(f"Columnas finales: {list(df.columns)}")
        
        return df
        
    except requests.RequestException as e:
        logger.error(f"Error descargando CSV: {e}")
        raise Exception(f"Error de conectividad: {e}")
    except pd.errors.EmptyDataError:
        logger.error("El archivo CSV está vacío")
        raise Exception("Archivo CSV vacío")
    except Exception as e:
        logger.error(f"Error procesando CSV: {e}")
        raise

def validate_row_data(row: pd.Series) -> Tuple[bool, str]:
    """
    Valida que una fila contenga los datos mínimos requeridos.
    
    Args:
        row (pd.Series): Fila de datos del DataFrame
    
    Returns:
        Tuple[bool, str]: (is_valid, error_message)
    """
    # Campos obligatorios
    required_fields = ["Marca temporal", "OPERADOR", "COORDENADAS_LIMPIAS"]
    missing_fields = []
    
    for field in required_fields:
        if field not in row or pd.isna(row[field]) or not str(row[field]).strip():
            missing_fields.append(field)
    
    if missing_fields:
        return False, f"Campos obligatorios faltantes: {', '.join(missing_fields)}"
    
    # Verificar que exista al menos una medición válida
    signal_fields = ["Intensidad 4G", "Intensidad 5G"]
    pollutant_fields = [
        "Concentración PM 2.5", "ConcentraciÃ³n PM 2.5",
        "Concentración PM 10", "ConcentraciÃ³n PM 10", 
        "Concentración CO", "ConcentraciÃ³n CO",
        "Concentración CO2", "ConcentraciÃ³n CO2"
    ]
    
    has_signal = any(field in row and not pd.isna(row[field]) for field in signal_fields)
    has_pollutant = any(field in row and not pd.isna(row[field]) for field in pollutant_fields)
    
    if not (has_signal or has_pollutant):
        return False, "No se encontraron mediciones válidas (señal o contaminantes)"
    
    return True, "Validación exitosa"

def process_data_row(row: pd.Series, row_index: int, statistics: Dict[str, int]) -> None:
    """
    Procesa una fila individual de datos con validación completa y logging.
    
    Args:
        row (pd.Series): Fila de datos a procesar
        row_index (int): Índice de la fila para logging
        statistics (Dict[str, int]): Diccionario de estadísticas para actualizar
    """
    logger.debug(f"Procesando registro {row_index + 1}")
    
    # Validación inicial de datos
    is_valid, validation_message = validate_row_data(row)
    if not is_valid:
        logger.warning(f"Registro {row_index + 1} omitido: {validation_message}")
        statistics['skipped'] += 1
        return
    
    # Procesamiento de timestamp
    timestamp = parse_timestamp(row["Marca temporal"])
    if not timestamp:
        logger.warning(f"Registro {row_index + 1}: timestamp inválido")
        statistics['invalid_timestamp'] += 1
        return
    
    # Procesamiento de operador
    operator_name = str(row["OPERADOR"]).strip()
    operator_id = get_operator_id(operator_name)
    if operator_id is None:
        logger.warning(f"Registro {row_index + 1}: operador no reconocido '{operator_name}'")
        statistics['unknown_operator'] += 1
        return
    
    # Procesamiento de coordenadas
    location_str = str(row["COORDENADAS_LIMPIAS"])
    lat, lon = parse_location(location_str)
    if lat is None or lon is None:
        logger.warning(f"Registro {row_index + 1}: coordenadas inválidas '{location_str}'")
        statistics['invalid_coords'] += 1
        return
    
    logger.debug(f"Registro {row_index + 1} - Coordenadas: ({lat}, {lon}), "
                f"Timestamp: {timestamp}, Operador: {operator_name}")
    # NUEVA VALIDACIÓN: Verificar que el punto está en España
    coords_valid, coords_message = validate_coordinates_spain(lat, lon)
    if not coords_valid:
        logger.warning(f"Registro {row_index + 1}: {coords_message}")
        # Añadir nueva estadística para puntos fuera de España
        if 'outside_spain' not in statistics:
            statistics['outside_spain'] = 0
        statistics['outside_spain'] += 1
        return
    
    logger.debug(f"Registro {row_index + 1} - Coordenadas validadas en España: ({lat}, {lon}), "
                f"Timestamp: {timestamp}, Operador: {operator_name}")
    
    # Crear o encontrar sesión de medición
    session_id, is_new_session = insert_or_get_session(lat, lon, timestamp, operator_id)
    if session_id is None:
        logger.error(f"Registro {row_index + 1}: error creando sesión")
        statistics['db_errors'] += 1
        return
    
    # Actualizar estadísticas de sesiones
    if is_new_session:
        statistics['new_sessions'] += 1
    else:
        statistics['existing_sessions'] += 1
    
    # Procesar mediciones de señal
    signal_measurements = 0
    signal_types = [("Intensidad 4G", "4G"), ("Intensidad 5G", "5G")]
    
    for field_name, signal_code in signal_types:
        if field_name in row and not pd.isna(row[field_name]):
            if upsert_signal_measurement(session_id, signal_code, row[field_name]):
                signal_measurements += 1
    
    # Procesar mediciones de contaminantes
    pollutant_measurements = 0
    pollutant_mapping = {
        "Concentración PM 2.5": "pm25",
        "ConcentraciÃ³n PM 2.5": "pm25",
        "Concentración PM 10": "pm10",
        "ConcentraciÃ³n PM 10": "pm10", 
        "Concentración CO": "co",
        "ConcentraciÃ³n CO": "co",
        "Concentración CO2": "co2",
        "ConcentraciÃ³n CO2": "co2"
    }
    logger.debug(f"Registro {row_index + 1} - Columnas disponibles: {list(row.index)}")
    logger.debug(f"Registro {row_index + 1} - Diccionario de contaminantes cargado: {list(pollutants_dict.keys())}")
    
    for field_name, pollutant_code in pollutant_mapping.items():
        if field_name in row:
            field_value = row[field_name]
            logger.debug(f"Registro {row_index + 1} - Campo '{field_name}': valor='{field_value}', es_na={pd.isna(field_value)}")
            
            if not pd.isna(field_value):
                logger.debug(f"Registro {row_index + 1} - Intentando procesar {pollutant_code} con valor {field_value}")
                if upsert_pollutant_measurement(session_id, pollutant_code, field_value):
                    pollutant_measurements += 1
                    logger.debug(f"Registro {row_index + 1} - ✓ Contaminante {pollutant_code} procesado exitosamente")
                else:
                    logger.warning(f"Registro {row_index + 1} - ✗ Falló procesamiento de {pollutant_code}")
        else:
            logger.debug(f"Registro {row_index + 1} - Campo '{field_name}' no encontrado en CSV")
    
    # Actualizar estadísticas finales
    statistics['processed'] += 1
    statistics['total_signals'] += signal_measurements
    statistics['total_pollutants'] += pollutant_measurements
    
    logger.debug(f"Registro {row_index + 1} procesado exitosamente: "
                f"{signal_measurements} señales, {pollutant_measurements} contaminantes")

# =========================================================================
# FUNCIÓN PRINCIPAL DEL SISTEMA
# =========================================================================

def main() -> None:
    """
    Función principal del sistema de importación.
    
    Ejecuta el proceso completo de descarga, validación, procesamiento e 
    inserción de datos con logging y estadísticas detalladas.
    """
    logger.info("="*80)
    logger.info("SISTEMA DE IMPORTACIÓN DE DATOS DE MEDICIONES AMBIENTALES")
    logger.info("Trabajo Final de Grado - Análisis de Calidad Ambiental y Conectividad")
    logger.info("="*80)
    
    # Inicialización de estadísticas de procesamiento
    processing_stats = {
        'processed': 0,
        'new_sessions': 0,
        'existing_sessions': 0,
        'skipped': 0,
        'invalid_timestamp': 0,
        'invalid_coords': 0,
        'unknown_operator': 0,
        'db_errors': 0,
        'total_signals': 0,
        'total_pollutants': 0
    }
    
    try:
        # Fase 1: Carga de datos
        logger.info("FASE 1: Carga de datos desde Google Sheets")
        dataframe = load_csv_from_sheets(GOOGLE_SHEET_CSV_URL)
        
        if dataframe.empty:
            logger.warning("No se encontraron datos para procesar")
            return
        
        # Fase 2: Procesamiento de datos
        logger.info(f"FASE 2: Procesamiento de {len(dataframe)} registros")
        
        for index, row in dataframe.iterrows():
            # Convertir el índice a int para evitar problemas de tipo
            row_number = int(index) if isinstance(index, (int, float)) else 0
            try:
                process_data_row(row, row_number, processing_stats)
            except Exception as e:
                logger.error(f"Error procesando registro {row_number + 1}: {e}")
                processing_stats['db_errors'] += 1
                continue
        
        # Fase 3: Generación de informe final
        logger.info("FASE 3: Generación de informe de resultados")
        generate_processing_report(processing_stats, len(dataframe))
        
    except Exception as e:
        logger.error(f"Error crítico en el proceso de importación: {e}")
        raise
    finally:
        # Limpieza y cierre de recursos
        cleanup_resources()

def generate_processing_report(stats: Dict[str, int], total_rows: int) -> None:
    """
    Genera un informe detallado de los resultados del procesamiento.
    
    Args:
        stats (Dict[str, int]): Estadísticas de procesamiento
        total_rows (int): Total de filas procesadas
    """
    logger.info("="*80)
    logger.info("INFORME DE RESULTADOS DE IMPORTACIÓN")
    logger.info("="*80)
    
    # Estadísticas principales
    logger.info("RESUMEN EJECUTIVO:")
    logger.info(f"  • Total de registros procesados exitosamente: {stats['processed']}")
    logger.info(f"  • Nuevas sesiones de medición creadas: {stats['new_sessions']}")
    logger.info(f"  • Sesiones existentes actualizadas: {stats['existing_sessions']}")
    logger.info(f"  • Total de mediciones de señal registradas: {stats['total_signals']}")
    logger.info(f"  • Total de mediciones de contaminantes registradas: {stats['total_pollutants']}")
    
    # Análisis de errores
    total_errors = (stats['skipped'] + stats['invalid_timestamp'] + 
                   stats['invalid_coords'] + stats['unknown_operator'] + 
                   stats['db_errors'] + stats.get('outside_spain', 0))
    
    if total_errors > 0:
        logger.info("\nANÁLISIS DE ERRORES:")
        logger.info(f"  • Registros con datos incompletos: {stats['skipped']}")
        logger.info(f"  • Registros con timestamp inválido: {stats['invalid_timestamp']}")
        logger.info(f"  • Registros con coordenadas inválidas: {stats['invalid_coords']}")
        logger.info(f"  • Registros con coordenadas fuera de España: {stats.get('outside_spain', 0)}")
        logger.info(f"  • Registros con operador desconocido: {stats['unknown_operator']}")
        logger.info(f"  • Errores de base de datos: {stats['db_errors']}")
        logger.info(f"  • Total de errores: {total_errors}")
    
    # Cálculo de tasa de éxito
    success_rate = (stats['processed'] / total_rows * 100) if total_rows > 0 else 0
    logger.info(f"\nTASA DE ÉXITO: {success_rate:.2f}%")
    
    if success_rate >= 95:
        logger.info("IMPORTACIÓN COMPLETADA CON ÉXITO")
    elif success_rate >= 80:
        logger.info("IMPORTACIÓN COMPLETADA CON ADVERTENCIAS")
    else:
        logger.warning("IMPORTACIÓN COMPLETADA CON ERRORES SIGNIFICATIVOS")
    
    logger.info("="*80)

def cleanup_resources() -> None:
    """
    Limpia y cierra todos los recursos utilizados.
    """
    try:
        if 'cur' in globals() and cur:
            cur.close()
            logger.debug("Cursor de base de datos cerrado")
        
        if 'conn' in globals() and conn:
            conn.close()
            logger.debug("Conexión a base de datos cerrada")
            
        logger.info("Recursos del sistema liberados correctamente")
        
    except Exception as e:
        logger.error(f"Error durante la limpieza de recursos: {e}")

# =========================================================================
# PUNTO DE ENTRADA DEL PROGRAMA
# =========================================================================

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Proceso interrumpido por el usuario")
    except Exception as e:
        logger.error(f"Error fatal: {e}")
        raise
    finally:
        cleanup_resources()
