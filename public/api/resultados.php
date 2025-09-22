<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../../src/php/geojson_supabase.php';

/**
 * Send JSON response
 */
function sendResponse($success, $data = null, $message = '', $code = 200) {
    http_response_code($code);
    echo json_encode([
        'success' => $success,
        'data' => $data,
        'message' => $message,
        'timestamp' => date('c')
    ]);
    exit;
}

/**
 * Execute database function and return JSON result
 */
function executeFunction($conn, $functionName, $params = []) {
    try {
        // Build the function call query
        $paramPlaceholders = [];
        $paramValues = [];
        
        for ($i = 0; $i < count($params); $i++) {
            $paramPlaceholders[] = '$' . ($i + 1);
            $paramValues[] = $params[$i];
        }
        
        $sql = "SELECT " . $functionName . "(" . implode(', ', $paramPlaceholders) . ") as result";
        
        // Execute the query
        $result = pg_query_params($conn, $sql, $paramValues);
        
        if (!$result) {
            throw new Exception('Error executing function: ' . pg_last_error($conn));
        }
        
        $row = pg_fetch_assoc($result);
        
        if (!$row) {
            throw new Exception('No data returned from function');
        }
        
        // Parse JSON result
        $jsonResult = json_decode($row['result'], true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Invalid JSON returned from function: ' . json_last_error_msg());
        }
        
        return $jsonResult;
        
    } catch (Exception $e) {
        error_log("Database function error: " . $e->getMessage());
        throw $e;
    }
}


/**
 * Get signal statistics for charts
 */
function getSignalCharts($conn, $signalType, $daysBack = null) {
    try {
        $params = [$signalType];
        
        if ($daysBack !== null && $daysBack !== '') {
            $params[] = intval($daysBack);
        } else {
            $params[] = null;
        }
        
        return executeFunction($conn, 'get_signal_stats_charts', $params);
        
    } catch (Exception $e) {
        error_log("Error getting signal charts: " . $e->getMessage());
        throw $e;
    }
}

/**
 * Get pollution temporal charts
 */
function getPollutionCharts($conn, $pollutantCode, $monthsBack = 3, $groupBy = 'day') {
    try {
        $params = [
            $pollutantCode,
            intval($monthsBack),
            $groupBy
        ];
        
        return executeFunction($conn, 'get_pollution_temporal_charts', $params);
        
    } catch (Exception $e) {
        error_log("Error getting pollution charts: " . $e->getMessage());
        throw $e;
    }
}

// Main API handler
try {
    // Get database connection
    $conn = connect_to_supabase();
    
    if (!$conn) {
        sendResponse(false, null, 'Error connecting to database', 500);
    }
    
    // Get action parameter
    $action = $_GET['action'] ?? '';
    
    switch ($action) {
            
        case 'get_signal_charts':
            $signalType = $_GET['signal_type'] ?? '';
            $daysBack = $_GET['days_back'] ?? null;
            
            if (empty($signalType)) {
                sendResponse(false, null, 'Signal type is required', 400);
            }
            
            $data = getSignalCharts($conn, $signalType, $daysBack);
            sendResponse(true, $data, 'Signal chart data retrieved successfully');
            break;
            
        case 'get_pollution_charts':
            $pollutantCode = $_GET['pollutant_code'] ?? '';
            $monthsBack = $_GET['months_back'] ?? 3;
            $groupBy = $_GET['group_by'] ?? 'day';
            
            if (empty($pollutantCode)) {
                sendResponse(false, null, 'Pollutant code is required', 400);
            }
            
            // Validate group_by parameter
            $validGroupBy = ['day', 'week', 'month'];
            if (!in_array($groupBy, $validGroupBy)) {
                $groupBy = 'day';
            }
            
            $data = getPollutionCharts($conn, $pollutantCode, $monthsBack, $groupBy);
            sendResponse(true, $data, 'Pollution chart data retrieved successfully');
            break;
            
        case 'health_check':
            // Simple health check endpoint
            $data = [
                'status' => 'OK',
                'database' => 'connected',
                'server_time' => date('c')
            ];
            sendResponse(true, $data, 'API is working correctly');
            break;
            
        default:
            sendResponse(false, null, 'Invalid action parameter', 400);
            break;
    }
    
} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage());
    sendResponse(false, null, 'Internal server error: ' . $e->getMessage(), 500);
} finally {
    // Close database connection if it exists
    if (isset($conn) && $conn) {
        pg_close($conn);
    }
}
?>