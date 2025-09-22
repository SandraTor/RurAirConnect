
<?php
/**
 * PHP - geojson_supabase
 * Conexión y gestión funciones para obtener geojson desde BBDD
 * TFG - Sandra Torrero Casado
 */
function connect_to_supabase() {
    // URL de conexión completa 
    $db_url = 'postgresql://web_reader.ocipehbjrbsrkhlslipo:Web4pp$!@aws-0-eu-west-1.pooler.supabase.com:5432/postgres';

    $parts = parse_url($db_url);
    if (!$parts) {
        throw new Exception("La URL de conexión a la base de datos no es válida");
    }

    $host = $parts['host'] ?? 'localhost';
    $port = $parts['port'] ?? 5432;
    $user = $parts['user'] ?? '';
    $pass = $parts['pass'] ?? '';
    $dbname = ltrim($parts['path'] ?? '', '/');

    $conn_str = "host=$host port=$port dbname=$dbname user=$user password=$pass";
    $conn = pg_connect($conn_str);

    if (!$conn) {
        throw new Exception("No se pudo conectar a PostgreSQL");
    }

    return $conn;
}

function get_geojson_from_supabase(string $category, array $params = []): array {
    $conn = connect_to_supabase();

    error_log("=== INICIO DEBUG GEOJSON ===");
    error_log("Category received: " . json_encode($category));
    error_log("Params received: " . json_encode($params, JSON_PRETTY_PRINT));

    $all_categories = get_geojson_categories($conn);
    error_log("All categories from DB: " . json_encode($all_categories));

    $contamination_category = array_pop($all_categories);
    $signal_types = $all_categories;

    error_log("Contamination category: " . json_encode($contamination_category));
    error_log("Signal types: " . json_encode($signal_types));

    $cat_lower = mb_strtolower($category);
    $signal_types_lower = array_map('mb_strtolower', $signal_types);
    $contamination_category_lower = mb_strtolower($contamination_category);

    error_log("Category normalized: " . $cat_lower);
    error_log("Signal types normalized: " . json_encode($signal_types_lower));

    if ($cat_lower === $contamination_category_lower) {
        error_log("=== BRANCH: CONTAMINATION ===");

        $function = 'get_pollution_geojson_optimized';

        $pollutant_codes = (isset($params['pollutants']) && is_array($params['pollutants']) && !empty($params['pollutants']))
            ? $params['pollutants'] : null;

        $provinces = (isset($params['provinces']) && is_array($params['provinces']) && !empty($params['provinces']))
            ? $params['provinces'] : null;

        $date_from = (!empty($params['date_from']) && is_string($params['date_from'])) ? $params['date_from'] : null;
        $date_to = (!empty($params['date_to']) && is_string($params['date_to'])) ? $params['date_to'] : null;

        $bbox = (isset($params['bbox']) && is_array($params['bbox']) && !empty($params['bbox']))
            ? json_encode($params['bbox']) : null;

        $min_measurements = (isset($params['min_measurements']) && is_numeric($params['min_reliability']))
            ? (int)$params['min_measurements'] : 1;

        $sql = "SELECT get_pollution_geojson_optimized(
            $1::TEXT[], $2::TEXT[], $3::DATE, $4::DATE,
            $5::JSONB, $6::INTEGER
        ) AS geojson";

        $sql_params = [
            to_pg_array($pollutant_codes),
            to_pg_array($provinces),
            $date_from,
            $date_to,
            $bbox,
            $min_measurements
        ];

    } elseif (in_array($cat_lower, $signal_types_lower, true)) {
        error_log("=== BRANCH: SIGNAL ===");

        $function = 'get_signal_geojson_optimized';

        // Mantener el valor original (case-sensitive) para la consulta
        $signal_types_arr = [$category];
        error_log("Signal types parameter: " . json_encode($signal_types_arr));

        // OPERATORS
        $operators = null;
        if (isset($params['operators'])) {
            if (is_array($params['operators']) && !empty($params['operators'])) {
                $operators = $params['operators'];
            } elseif (is_string($params['operators']) && trim($params['operators']) !== '') {
                $operators = [trim($params['operators'])];
            }
        }

        // PROVINCES
        $provinces = (isset($params['provinces']) && is_array($params['provinces']) && !empty($params['provinces']))
            ? $params['provinces'] : null;

        // DAYS BACK
        $days_back = (isset($params['days_back']) && is_numeric($params['days_back']))
            ? (int)$params['days_back'] : null;

        // BBOX
        $bbox = (isset($params['bbox']) && is_array($params['bbox']) && !empty($params['bbox']))
            ? json_encode($params['bbox']) : null;

        // QUALITY
        $min_quality = (isset($params['min_quality']) && is_numeric($params['min_quality']))
            ? (int)$params['min_quality'] : null;

        // SQL Y PARÁMETROS
        $sql = "SELECT get_signal_geojson_optimized(
            $1::TEXT[], $2::TEXT[], $3::TEXT[], $4::JSONB
        ) AS geojson";

        $sql_params = [
            to_pg_array($signal_types_arr),
            to_pg_array($operators),
            to_pg_array($provinces),
            $bbox
        ];

        error_log("SQL PARAMS: " . var_export($sql_params, true));
        } else {
        error_log("Category not recognized: " . $category);
        throw new Exception("Categoría no soportada o inválida: " . $category);
    }

    foreach ($sql_params as $i => $param) {
        error_log("Param $" . ($i+1) . " (" . gettype($param) . "): " . var_export($param, true));
    }
    $result = pg_query_params($conn, $sql, $sql_params);
    if (!$result) {
        $err = pg_last_error($conn);
        error_log("Error ejecutando función $function: " . $err);
        throw new Exception("Error ejecutando función $function: " . $err);
    }

    $row = pg_fetch_assoc($result);
    if (!$row || empty($row['geojson'])) {
        return [
            'type' => 'FeatureCollection',
            'features' => [],
            'metadata' => ['total_features' => 0, 'error' => 'No data found']
        ];
    }

    return json_decode($row['geojson'], true);
}

function get_geojson_categories($conn): array {
    $sql = "SELECT get_geojson_categories() AS categories_json";
    $result = pg_query($conn, $sql);
    if (!$result) {
        $err = pg_last_error($conn);
        error_log("Error obteniendo categorías: " . $err);
        throw new Exception("Error obteniendo categorías: " . $err);
    }

    $row = pg_fetch_assoc($result);
    if (!$row || empty($row['categories_json'])) {
        throw new Exception("No se pudo obtener categorías de la base de datos");
    }

    return json_decode($row['categories_json'], true);
}

function to_pg_array(?array $arr): ?string {
    if (!$arr || !is_array($arr)) return null;

    // Escapar cada elemento para PostgreSQL
    $escaped = array_map(function($item) {
        // Convertir a string si no lo es
        $item = (string)$item;
        
        // Escapar caracteres especiales para PostgreSQL arrays
        $item = str_replace('\\', '\\\\', $item);  // Escapar backslashes
        $item = str_replace('"', '\\"', $item);    // Escapar comillas dobles
        
        // Envolver en comillas dobles si contiene espacios o caracteres especiales
        if (preg_match('/[\s,{}"]/', $item)) {
            return '"' . $item . '"';
        }
        
        return $item;
    }, $arr);

    return '{' . implode(',', $escaped) . '}';
}
