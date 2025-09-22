<?php
//api/get_geojson.php
ini_set('display_errors', 0);
error_reporting(E_ERROR | E_PARSE);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../src/php/geojson_supabase.php';

// ===============================================
// Limpieza y validación de parámetros
// ===============================================
function parse_request_data(): array {
    $method = $_SERVER['REQUEST_METHOD'];
    $input_params = [];

    if ($method === 'POST') {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (stripos($contentType, 'application/json') !== false) {
            $raw_input = file_get_contents('php://input');
            $input_params = json_decode($raw_input, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new InvalidArgumentException('Invalid JSON in request body');
            }
        } else {
            $input_params = $_POST;
        }
    } else {
        $input_params = $_GET;

        // Parametros array por coma
        foreach (['operators', 'pollutants', 'provinces'] as $key) {
            if (isset($input_params[$key]) && is_string($input_params[$key])) {
                $input_params[$key] = array_filter(explode(',', $input_params[$key]), 'strlen');
            }
        }

        // bbox como JSON string
        if (isset($input_params['bbox']) && is_string($input_params['bbox'])) {
            $bbox = json_decode($input_params['bbox'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $input_params['bbox'] = $bbox;
            }
        }
    }

    return $input_params;
}

// ===============================================
//Validación de parámetros por categoría
// ===============================================
function validate_parameters(string $category, array $params): array {
    $cat = mb_strtolower(trim($category));
    $clean = [];

    // Comunes
    if (isset($params['provinces'])) {
        if (!is_array($params['provinces'])) throw new InvalidArgumentException('provinces must be an array');
        $clean['provinces'] = array_filter($params['provinces'], 'strlen');
    }

    if (isset($params['bbox'])) {
        $bbox = $params['bbox'];
        if (!is_array($bbox)) throw new InvalidArgumentException('bbox must be an object');
        foreach (['south', 'west', 'north', 'east'] as $k) {
            if (!isset($bbox[$k]) || !is_numeric($bbox[$k])) {
                throw new InvalidArgumentException("bbox must contain valid numeric '$k'");
            }
        }
        if ($bbox['south'] >= $bbox['north'] || $bbox['west'] >= $bbox['east']) {
            throw new InvalidArgumentException('bbox: south < north and west < east');
        }
        $clean['bbox'] = $bbox;
    }

    // Específicos
    if ($cat === 'contaminación aérea') {
        if (isset($params['pollutants'])) {
            if (!is_array($params['pollutants'])) throw new InvalidArgumentException('pollutants must be array');
            $clean['pollutants'] = array_filter($params['pollutants'], 'strlen');
        }
        foreach (['date_from', 'date_to'] as $d) {
            if (isset($params[$d])) {
                if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $params[$d])) {
                    throw new InvalidArgumentException("$d must be in YYYY-MM-DD");
                }
                $clean[$d] = $params[$d];
            }
        }
        
    } else {
        if (isset($params['operators'])) {
            if (!is_array($params['operators'])) throw new InvalidArgumentException('operators must be array');
            $clean['operators'] = array_values(array_filter($params['operators'], fn($v) => is_string($v) && trim($v) !== ''));
        }
        if (isset($params['days_back'])) {
            $v = (int)$params['days_back'];
            if ($v < 1 || $v > 365) throw new InvalidArgumentException('days_back must be 1-365');
            $clean['days_back'] = $v;
        }
        
    }

    return $clean;
}

// ===============================================
// Logging (debug)
// ===============================================
function log_request(string $category, array $params): void {
    $log = [
        'timestamp' => date('Y-m-d H:i:s'),
        'category' => $category,
        'params_count' => count($params),
        'params' => $params,
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'ua' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
    error_log("GeoJSON API Request (FULL): " . json_encode($log, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

// ===============================================
// MAIN API LOGIC
// ===============================================
try {
    
    $raw_params = parse_request_data();

    $category = $raw_params['category'] ?? null;
    if (!$category) throw new InvalidArgumentException('category is required');
    unset($raw_params['category']);

    $validated = validate_parameters($category, $raw_params);

    log_request($category, $validated);

    error_log("Calling Supabase with category: " . $category);
    error_log("Params: " . json_encode($validated));

    $geojson = get_geojson_from_supabase($category, $validated);

    if (!$geojson || !isset($geojson['type'])) {
        throw new RuntimeException('Invalid GeoJSON response');
    }

    // Metadatos extra opcionales
    if (isset($geojson['metadata'])) {
        $geojson['metadata']['api_version'] = '1.0';
        $geojson['metadata']['request_category'] = $category;
        $geojson['metadata']['response_time'] = date('Y-m-d H:i:s');
    }

    http_response_code(200);
    echo json_encode($geojson, JSON_UNESCAPED_UNICODE | JSON_NUMERIC_CHECK);

} catch (InvalidArgumentException $e) {
    http_response_code(400);
    echo json_encode([
        'error' => 'Bad Request',
        'message' => $e->getMessage(),
        'code' => 'INVALID_PARAMETERS'
    ], JSON_UNESCAPED_UNICODE);
} catch (RuntimeException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal Server Error',
        'message' => $e->getMessage(),
        'code' => 'PROCESSING_ERROR'
    ], JSON_UNESCAPED_UNICODE);
    error_log("GeoJSON DB Error: " . $e->getMessage());
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Internal Server Error',
        'message' => 'Unexpected error',
        'code' => 'UNKNOWN_ERROR'
    ], JSON_UNESCAPED_UNICODE);
    error_log("GeoJSON API Error: " . $e->getMessage());
    error_log($e->getTraceAsString());
}
?>
