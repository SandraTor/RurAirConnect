<?php
//api/get_metadata_bbdd.php
header('Content-Type: application/json');
require_once __DIR__ . '/../../src/php/geojson_supabase.php';

try {
    $conn = connect_to_supabase();

    // SET search_path
    pg_query($conn, "SET search_path TO public");

    $action = $_GET['action'] ?? '';
    $category = $_GET['category'] ?? null;

    // Obtener metadatos completos
    if ($action === 'list') {
        $result = pg_query($conn, 'SELECT get_complete_app_metadata() AS metadata');
        if (!$result) throw new Exception("Error en la consulta");

        $row = pg_fetch_assoc($result);
        if ($row && isset($row['metadata'])) {
            echo $row['metadata'];
        } else {
            echo json_encode([]);
        }
        exit;
    }

    // Obtener categorías (4G, 5G, contaminación aérea)
    if ($action === 'categories') {
        $result = pg_query($conn, "SELECT get_geojson_categories() AS categories");
        if (!$result) throw new Exception("Error en la consulta");

        $row = pg_fetch_assoc($result);
        if ($row && !empty($row['categories'])) {
            echo $row['categories'];
        } else {
            echo '[]'; // Fallback a array vacío
        }
        exit;
    }

    if ($category !== null) {
        // Preparar consulta parametrizada
        $prepName = "get_layers_by_category";
        $prepQuery = 'SELECT get_geojson_layers($1)::text AS layers';

        // Preparar sólo si no está preparada ya
        static $prepared = false;
        if (!$prepared) {
            $prep = pg_prepare($conn, $prepName, $prepQuery);
            if (!$prep) throw new Exception("Error preparando consulta");
            $prepared = true;
        }

        $result = pg_execute($conn, $prepName, [$category]);
        if (!$result) {
            http_response_code(400);
            echo json_encode(['error' => 'Error en la consulta']);
            exit;
        }

        $row = pg_fetch_assoc($result);
        if (!$row) {
            http_response_code(400);
            echo json_encode(['error' => 'Categoría no válida']);
            exit;
        }

        echo $row['layers'] ?: '[]';
        exit;
    }

    // Acción no válida
    http_response_code(400);
    echo json_encode(['error' => 'Acción no válida']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Metadata error: ' . $e->getMessage()]);
}//con pg_*