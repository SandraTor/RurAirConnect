<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Log de depuración
error_log("Proxy contacto.php - Método: " . $_SERVER['REQUEST_METHOD']);
error_log("Proxy contacto.php - POST data: " . print_r($_POST, true));

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Método no permitido']);
  exit;
}

$target = __DIR__ . "/../../src/php/enviarContacto.php";
error_log("Proxy contacto.php - Buscando archivo: " . $target);

if (!file_exists($target)) {
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'No se encontró el archivo de procesamiento en: ' . $target]);
  exit;
}

// Capturar cualquier output del archivo incluido
ob_start();
try {
  require_once $target;
} catch (Exception $e) {
  ob_clean();
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'Error en el procesamiento: ' . $e->getMessage()]);
  exit;
}
$output = ob_get_clean();

// Si hay output, enviarlo
if (!empty($output)) {
  echo $output;
} else {
  // Si no hay output, algo salió mal
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => 'No se recibió respuesta del procesador']);
}
?>