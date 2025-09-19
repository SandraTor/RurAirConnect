//main.gs

//-----------------------------------------
// RurAirConnect - TFG Sandra Torrero Casado
// 2025
//-----------------------------------------
// ========================================
// CONFIGURACIÓN PRINCIPAL
// ========================================
const LOC_COLUMN_NAME = "LOCALIZACION";
const SESSION_ID_COLUMN = "SESSION_ID"; 
const COORDS_COLUMN = "COORDENADAS_LIMPIAS";
const FORM_URL = 'SUSTITUIR POR URL DEL FORMULARIO';

// Configuración del sistema de limpieza
const CLEANUP_CONFIG = {
  enabled: true,
  mode: 'deferred', // 'deferred', 'manual', 'endpoint'
  deferredDelayMinutes: 2,
  maxRetries: 3
};

// ========================================
// CONTROLADOR PRINCIPAL (doGet)
// ========================================

/**
 * Función principal que maneja todas las rutas
 */
function doGet(e) {
  const action = e.parameter.action || 'preload';
  
  console.log(`Solicitud recibida: action=${action}, params:`, e.parameter);
  
  switch (action) {
    case 'preload':
      return createLocationConfirmationPage();
      
    case 'cleanup':
      if (CLEANUP_CONFIG.enabled && CLEANUP_CONFIG.mode === 'endpoint') {
        return handleCleanupEndpoint(e.parameter);
      } else {
        return createErrorPage('Endpoint de limpieza no habilitado');
      }
      
    default:
      return createLocationConfirmationPage();
  }
}

// ========================================
// PÁGINA DE CONFIRMACIÓN DE UBICACIÓN
// ========================================

/**
 * Crea la página donde el usuario confirma su ubicación antes del Forms
 * FUNCIONALIDADES:
 * - Edición visual arrastrando el marcador en el mapa
 * - Menú de opciones para cambiar ubicación
 * - Preview en tiempo real de cambios
 */
function createLocationConfirmationPage() {
  const sessionId = generateSessionId();
  
  console.log(`Nueva sesión creada: ${sessionId}`);
  
  const html = HtmlService.createTemplate(`
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirma tu ubicación</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: 0;
      padding: 1rem;
      min-height: 100vh;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      padding: 2rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      border: 1px solid rgba(255,255,255,0.2);
    }
    
    h1 { 
      text-align: center;
      margin-bottom: 0.5rem; 
      font-size: 1.5rem;
      font-weight: 600;
    }
    
    .loader {
      border: 4px solid rgba(255,255,255,0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 2s linear infinite;
      margin: 1rem auto;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    #map {
      height: 350px;
      border-radius: 10px;
      margin: 1rem 0;
      display: none;
      border: 2px solid rgba(255,255,255,0.3);
      position: relative;
    }
    
    .map-overlay {
      position: absolute;
      top: 10px;
      right: 0;
      max-width:80%;
      z-index: 1000;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 0.5rem;
      border-radius: 6px;
      font-size: 0.8rem;
      display: none;
    }
    
    .location-info {
      background: rgba(255,255,255,0.15);
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
      display: none;
    }
    
    /* Menú de opciones para cambiar ubicación */
    .location-options {
      background: rgba(255,255,255,0.1);
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
      display: none;
    }
    
    .location-options h3 {
      margin: 0 0 1rem 0;
      font-size: 1.1rem;
    }
    
    .option-buttons {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    
    .option-btn {
      flex: 1;
      min-width: 120px;
      padding: 0.8rem;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px;
      background: rgba(255,255,255,0.1);
      color: white;
      cursor: pointer;
      text-align: center;
      font-size: 0.9rem;
      transition: all 0.3s ease;
    }
    
    .option-btn:hover {
      background: rgba(255,255,255,0.2);
      transform: translateY(-1px);
    }
    
    /* Formulario manual */
    .manual-form {
      background: rgba(255,255,255,0.1);
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
      display: none;
    }
    
    .manual-form input {
      width: 100%;
      padding: 0.8rem;
      margin: 0.5rem 0;
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 6px;
      background: rgba(255,255,255,0.1);
      color: white;
    }
    
    .manual-form input::placeholder {
      color: rgba(255,255,255,0.7);
    }
    
    /* Estados de edición del mapa */
    .editing-mode .map-overlay {
      display: block;
    }
    
    .editing-instructions {
      background: rgba(52, 152, 219, 0.8);
      color: white;
      padding: 0.8rem;
      border-radius: 6px;
      margin: 1rem 0;
      display: none;
      text-align: center;
    }
    
    .editing-controls {
      display: none;
      margin-top: 1rem;
      gap: 0.5rem;
    }
    
    .editing-controls.active {
      display: flex;
    }
    
    button {
      background: rgba(255,255,255,0.2);
      color: white;
      border: 2px solid rgba(255,255,255,0.3);
      padding: 0.8rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      margin: 0.5rem;
      transition: all 0.3s ease;
      width: 100%;
    }
    
    button:hover {
      background: rgba(255,255,255,0.3);
      transform: translateY(-2px);
    }
    
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .confirm-button {
      background: linear-gradient(45deg, #4caf50, #45a049);
      font-weight: 600;
      font-size: 1.1rem;
      display: none;
    }
    
    .confirm-button:hover {
      background: linear-gradient(45deg, #45a049, #4caf50);
    }
    
    /* Estilo para botón de placeholder */
    #use-placeholder-btn {
      background: linear-gradient(45deg, #3498db, #2980b9) !important;
      margin: 1rem 0;
    }
    
    #use-placeholder-btn:hover {
      background: linear-gradient(45deg, #2980b9, #3498db) !important;
      transform: translateY(-2px);
    }
    
    .cancel-btn {
      background: rgba(231, 76, 60, 0.7);
    }
    
    .cancel-btn:hover {
      background: rgba(231, 76, 60, 0.9);
    }
    
    .apply-btn {
      background: rgba(46, 204, 113, 0.7);
    }
    
    .apply-btn:hover {
      background: rgba(46, 204, 113, 0.9);
    }
    
    #status {
      text-align: center;
      font-size: 1.1rem;
      margin: 1rem 0;
    }
    
    #error-msg {
      display: none;
      color: #ffcdd2;
      text-align: center;
      margin: 1rem 0;
    }
    
    .session-id {
      font-size: 0.7rem;
      opacity: 0.7;
      text-align: center;
      margin-top: 1rem;
      font-family: monospace;
    }
    
    /* Preview de coordenadas en tiempo real */
    .live-preview {
      font-size: 0.8rem;
      opacity: 0.9;
      text-align: center;
      margin: 0.5rem 0;
      font-family: monospace;
      background: rgba(0,0,0,0.3);
      padding: 0.3rem;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📍 Confirma tu ubicación</h1>
    
    <div class="loader" id="loader"></div>
    <p id="status">Inicializando sistema de ubicación</p>
    
    <div id="map">
      <div class="map-overlay" id="map-overlay">
        🖱️ Arrastra el marcador para cambiar la ubicación
      </div>
    </div>
    
    <div class="editing-instructions" id="editing-instructions">
      <div id="instructions">
        🎯 <strong>Modo edición activado:</strong> Arrastra el marcador rojo a la nueva ubicación
      </div>
      <div class="live-preview" id="live-preview"></div>
    </div>
    
    <div class="location-info" id="location-info">
      <h3>📊 Información de ubicación:</h3>
      <p id="coord-display"></p>
    </div>
    
    <!-- Menú de opciones para cambiar ubicación -->
    <div class="location-options" id="location-options">
      <h3>¿Quieres cambiar la ubicación?</h3>
      <div class="option-buttons">
        <div class="option-btn" onclick="startMapEditing()">
          🗺️ Editar en el mapa
        </div>
        <div class="option-btn" onclick="showManualForm()">
          ⌨️ Introducir coordenadas
        </div>
      </div>
    </div>
    
    <!-- Controles de edición del mapa -->
    <div class="editing-controls" id="editing-controls">
      <button class="apply-btn" onclick="applyMapEdit()">✅ Aplicar cambios</button>
      <button class="cancel-btn" onclick="cancelMapEdit()">❌ Cancelar</button>
    </div>
    
    <div id="error-msg">
      <p>⚠️ No se pudo obtener la ubicación automáticamente. Es obligatorio introducir una ubicación.</p>
      <button onclick="showLocationOptions()">Introducir ubicación</button>
    </div>
    
    <div class="manual-form" id="manual-form">
      <h3>Introduce tu ubicación manualmente:</h3>
      <input type="number" step="any" id="latInput" placeholder="Latitud (ej: 40.4168)" />
      <input type="number" step="any" id="lngInput" placeholder="Longitud (ej: -3.7038)" />
      <button onclick="setManualLocation()">Usar esta ubicación</button>
      <button onclick="hideManualForm()">Cancelar</button>
    </div>
    
    <button class="confirm-button" id="confirm-button" onclick="confirmAndProceed()">
      ✅ Confirmar ubicación y continuar al formulario
    </button>
    
    <div class="session-id">Sesión: ${sessionId}</div>
  </div>

  <script>
    const FORM_URL = '${FORM_URL}';
    const SESSION_ID = '${sessionId}';
    
    // Variables de control
    let isInIframe = false;
    let locationReceived = false;
    let operationMode = 'detecting';
    let fallbackTimer = null;
    let map = null;
    let marker = null;
    
    // Variables de ubicación confirmada
    let confirmedLocation = null;
    let locationAccuracy = null;
    
    // Variables de edición del mapa
    let isEditingMap = false;
    let originalLocation = null;
    let editingLocation = null;
    
    console.log('Iniciando sistema de confirmación para sesión:', SESSION_ID);
    
    // PASO 1: Detectar contexto de ejecución
    function detectExecutionContext() {
      try {
        isInIframe = (window.self !== window.top);
      } catch (e) {
        isInIframe = true;
      }
      
      console.log('Contexto detectado:', isInIframe ? 'Iframe' : 'Acceso directo');
      
      if (isInIframe) {
        initIframeMode();
      } else {
        initDirectMode();
      }
    }
    
    // PASO 2A: Inicializar modo iframe
    function initIframeMode() {
      console.log('Iniciando modo iframe...');
      document.getElementById('status').textContent = 'Esperando ubicación desde la página principal...';
      
      setTimeout(() => {
        try {
          parent.postMessage({
            type: 'iframe_listo',
            sessionId: SESSION_ID,
            timestamp: Date.now()
          }, '*');
          console.log('Notificación enviada al padre');
        } catch (error) {
          console.error('Error comunicándose con el padre:', error);
          fallbackToDirectMode();
        }
      }, 1000);
      
      window.addEventListener('message', handleParentMessage);
      
      fallbackTimer = setTimeout(() => {
        if (!locationReceived) {
          console.warn('Timeout en modo iframe, cambiando a modo directo');
          fallbackToDirectMode();
        }
      }, 5000);
    }
    
    // PASO 2B: Inicializar modo directo
    function initDirectMode() {
      console.log('Iniciando modo directo...');
      document.getElementById('status').textContent = 'Solicitando permisos de geolocalización...';
      setTimeout(() => getLocationDirect(), 500);
    }
    
    // PASO 3: Fallback de iframe a directo
    function fallbackToDirectMode() {
      console.log('Cambiando de iframe a modo directo...');
      operationMode = 'direct';
      
      if (fallbackTimer) clearTimeout(fallbackTimer);
      initDirectMode();
    }
    
    // MANEJO DE MENSAJES DEL IFRAME
    function handleParentMessage(event) {
      const allowedOrigins = ['http:', 'https:'];
      const originProtocol = new URL(event.origin).protocol;
      
      if (!allowedOrigins.includes(originProtocol)) return;
      
      console.log('Mensaje recibido del padre:', event.data);
      
      if (!event.data || typeof event.data !== 'object') return;
      
      if (event.data.type === 'ubicacion' && !locationReceived) {
        locationReceived = true;
        clearTimeout(fallbackTimer);
        
        if (event.data.coords && 
            typeof event.data.coords.latitude === 'number' && 
            typeof event.data.coords.longitude === 'number') {
          processLocationFromParent(event.data.coords);
        } else {
          showError('Coordenadas inválidas recibidas');
        }
        
      } else if (event.data.type === 'ubicacion_error' && !locationReceived) {
        locationReceived = true;
        clearTimeout(fallbackTimer);
        
        if (event.data.isHTTP) {
          console.log('Página padre en HTTP, intentando modo directo');
          fallbackToDirectMode();
        } else {
          console.warn('Error de ubicación desde iframe:', event.data.error);
          //Mostrar mapa de Valladolid en lugar de solo error
          document.getElementById('status').innerHTML = 'Error obteniendo ubicación desde la página web. Usa el mapa de abajo.';
          showError(event.data.error || 'Error de ubicación desde la página web');
        }
      }
    }
    
    function processLocationFromParent(coords) {
      const lat = coords.latitude;
      const lng = coords.longitude;
      const accuracy = coords.accuracy || 'Desconocida';
      
      console.log('Ubicación recibida del padre:', { lat, lng, accuracy });
      setConfirmedLocation(lat, lng, accuracy, 'Recibida de la página web');
    }
    
    // GEOLOCALIZACIÓN DIRECTA
    function getLocationDirect() {
      if (!navigator.geolocation) {
        showError("Este navegador no soporta geolocalización.");
        return;
      }
      
      if (location.protocol === 'http:') {
        document.getElementById('status').innerHTML = 
          '⚠️ Conexión no segura detectada<br><small>La geolocalización puede requerir HTTPS</small>';
      }
      
      const options = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000
      };
      
      navigator.geolocation.getCurrentPosition(showPosition, handleLocationError, options);
    }
    
    function showPosition(position) {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy);
      
      console.log('Ubicación obtenida directamente:', { lat, lng, accuracy });
      setConfirmedLocation(lat, lng, accuracy, 'Obtenida directamente del navegador');
    }
    
    function handleLocationError(error) {
      let errorMsg = "Error desconocido";
      
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMsg = "Permisos de ubicación denegados por el usuario";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMsg = "Ubicación no disponible en este dispositivo";
          break;
        case error.TIMEOUT:
          errorMsg = "Tiempo de espera agotado para obtener ubicación";
          break;
      }
      
      if (location.protocol === 'http:' && error.code === error.PERMISSION_DENIED) {
        errorMsg += "<br><small>Nota: La geolocalización requiere HTTPS en navegadores modernos</small>";
      }
      
      console.warn('Error de geolocalización:', errorMsg);
      
      // Mostrar error pero con mapa de Valladolid como fallback útil
      document.getElementById('status').innerHTML = 'No se pudo obtener tu ubicación automáticamente. Usa el mapa de abajo para seleccionar tu ubicación.';
      showError(errorMsg);
    }
    
    // ESTABLECER UBICACIÓN CONFIRMADA
    function setConfirmedLocation(lat, lng, accuracy, source) {
      if (!isValidCoordinate(lat, lng)) {
        showError('Coordenadas inválidas');
        return;
      }
      
      confirmedLocation = { lat, lng };
      locationAccuracy = accuracy;
      
      // Ocultar loader y errores
      document.getElementById('loader').style.display = 'none';
      document.getElementById('error-msg').style.display = 'none';
      
      // Mostrar mapa
      showMap(lat, lng, source);
      
      // Mostrar información
      showLocationInfo(lat, lng, accuracy, source);
      
      // Mostrar opciones de cambio
      document.getElementById('location-options').style.display = 'block';
      
      // Mostrar botones de confirmación
      document.getElementById('confirm-button').style.display = 'block';
      
      // Actualizar status
      document.getElementById('status').textContent = '✅ Ubicación detectada. Revisa en el mapa y confirma si es correcta.';
    }
    
    // MOSTRAR MAPA
    function showMap(lat, lng, source) {
      const mapDiv = document.getElementById('map');
      mapDiv.style.display = 'block';
      
      if (!map) {
        map = L.map('map').setView([lat, lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
      } else {
        map.setView([lat, lng], 16);
      }
      
      if (marker) {
        marker.setLatLng([lat, lng]);
      } else {
        // Marcador arrastrable
        marker = L.marker([lat, lng], { 
          draggable: false  // Se activa solo en modo edición
        }).addTo(map);
        
        // Event listener para arrastrar
        marker.on('dragend', function(e) {
          if (isEditingMap) {
            const newPos = e.target.getLatLng();
            editingLocation = { lat: newPos.lat, lng: newPos.lng };
            updateLivePreview(newPos.lat, newPos.lng);
            console.log('📍 Marcador arrastrado a:', editingLocation);
          }
        });
      }
      
      const popupContent = \`
        <div style="text-align: center;">
          <strong>📍 Tu ubicación</strong><br>
          <small>\${lat.toFixed(6)}, \${lng.toFixed(6)}</small><br>
          <small>\${source}</small>
        </div>
      \`;
      
      marker.bindPopup(popupContent).openPopup();
    }
    
    // Funciones de edición del mapa
    function startMapEditing() {
      console.log('Iniciando edición del mapa');
      //deshabilitamos botón de acceder al form hasta que salga del modo edición
      const btn = document.getElementById('confirm-button');
      btn.disabled = true;

      if (!confirmedLocation) {
        alert('⚠️ No hay ubicación para editar');
        return;
      }
      
      isEditingMap = true;
      originalLocation = { ...confirmedLocation };
      editingLocation = { ...confirmedLocation };
      
      // Activar modo edición visual
      document.body.classList.add('editing-mode');
      document.getElementById('editing-instructions').style.display = 'block';
      document.getElementById('editing-controls').classList.add('active');
      document.getElementById('location-options').style.display = 'none';
      
      // Hacer el marcador arrastrable
      if (marker) {
        marker.setIcon(L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        }));
        marker.dragging.enable();
      }
      
      updateLivePreview(editingLocation.lat, editingLocation.lng);
    }
    
    function updateLivePreview(lat, lng) {
      const preview = document.getElementById("live-preview");
      preview.textContent = \`📍 Nueva ubicación: \${lat.toFixed(6)}, \${lng.toFixed(6)}\`;
    }
    
    function applyMapEdit() {
      if (!editingLocation) {
        console.warn('⚠️ No hay cambios para aplicar');
        return;
      }
      
      console.log('Aplicando cambios del mapa:', editingLocation);
      
      // Aplicar la nueva ubicación
      setConfirmedLocation(
        editingLocation.lat, 
        editingLocation.lng, 
        'Manual (mapa)', 
        'Editada en el mapa'
      );
      
      // Salir del modo edición
      exitMapEditing();
    }
    
    // Función para resetear a Valladolid desde cualquier estado
    function resetToValladolidPlaceholder() {
      const valladolidLat = 41.6521;
      const valladolidLng = -4.7235;
      
      if (marker) {
        marker.setLatLng([valladolidLat, valladolidLng]);
        editingLocation = { lat: valladolidLat, lng: valladolidLng };
        updateLivePreview(valladolidLat, valladolidLng);
      }
      
      if (map) {
        map.setView([valladolidLat, valladolidLng], 13);
      }
    }

    function cancelMapEdit() {
      console.log('Cancelando edición del mapa');
      
      // Si estamos en modo placeholder, resetear a Valladolid en lugar de ubicación original
      if (!originalLocation || (originalLocation.lat === 41.6521 && originalLocation.lng === -4.7235)) {
        resetToValladolidPlaceholder();
      } else if (originalLocation && marker) {
        // Comportamiento normal para ubicaciones reales
        marker.setLatLng([originalLocation.lat, originalLocation.lng]);
        editingLocation = { ...originalLocation };
      }
      
      exitMapEditing();
    }
    
    function exitMapEditing() {
      isEditingMap = false;
      
      // Desactivar modo edición visual
      document.body.classList.remove('editing-mode');
      document.getElementById('editing-instructions').style.display = 'none';
      document.getElementById('editing-controls').classList.remove('active');
      document.getElementById('location-options').style.display = 'block';
      
      //habilitamos botón de acceder al form porque se sale del modo edición
      const btn = document.getElementById('confirm-button');
      btn.disabled = false;

      // Restaurar marcador normal
      if (marker) {
        marker.setIcon(new L.Icon.Default());
        marker.dragging.disable();
      }
      
      // Limpiar variables
      originalLocation = null;
      editingLocation = null;
    }
    
    // MOSTRAR INFORMACIÓN DE UBICACIÓN
    function showLocationInfo(lat, lng, accuracy, source) {
      document.getElementById('location-info').style.display = 'block';
      document.getElementById('coord-display').textContent = \`Coordenadas: \${lat.toFixed(6)}, \${lng.toFixed(6)}\`;
    }
    
    // Mostrar opciones de ubicación
    function showLocationOptions() {
      document.getElementById('location-options').style.display = 'block';
    }
    
    // FORMULARIO MANUAL
    function showManualForm() {
      document.getElementById('manual-form').style.display = 'block';
      document.getElementById('location-options').style.display = 'none';
      
      // Pre-rellenar con ubicación actual si existe
      if (confirmedLocation) {
        document.getElementById('latInput').value = confirmedLocation.lat.toFixed(6);
        document.getElementById('lngInput').value = confirmedLocation.lng.toFixed(6);
      }
    }
    
    function hideManualForm() {
      document.getElementById('manual-form').style.display = 'none';
      document.getElementById('location-options').style.display = 'block';
    }
    
    function setManualLocation() {
      const lat = parseFloat(document.getElementById('latInput').value);
      const lng = parseFloat(document.getElementById('lngInput').value);
      
      if (!isValidCoordinate(lat, lng)) {
        alert('⚠️ Coordenadas inválidas. Revisa los valores.');
        return;
      }
      
      setConfirmedLocation(lat, lng, 'Manual', 'Introducida manualmente');
      hideManualForm();
    }
    
    // VALIDACIÓN
    function isValidCoordinate(lat, lng) {
      return (
        !isNaN(lat) && !isNaN(lng) && 
        lat >= -90 && lat <= 90 && 
        lng >= -180 && lng <= 180 &&
        lat !== 0 && lng !== 0
      );
    }
    
    // CONFIRMAR Y PROCEDER AL FORMULARIO
    function confirmAndProceed() {
      if (!confirmedLocation) {
        alert('⚠️ No hay ubicación para confirmar');
        return;
      }
      
      const { lat, lng } = confirmedLocation;
      
      // Crear timestamp único para el session ID
      const timestamp = Date.now();
      const uniqueSessionId = \`\${SESSION_ID}_\${timestamp}\`;
      
      // Formato: coordenadas|session_id_timestamp
      const locationData = \`\${lat},\${lng}|\${uniqueSessionId}\`;
      
      console.log('Ubicación confirmada:', {
        coordinates: \`\${lat}, \${lng}\`,
        sessionId: uniqueSessionId,
        accuracy: locationAccuracy
      });
      
      // Actualizar UI para mostrar que se está procesando
      document.getElementById('status').innerHTML = '🔄 Redirigiendo al formulario con tu ubicación confirmada...';
      document.getElementById('confirm-button').style.display = 'none';
      
      // Redireccionar al Forms con datos prefilled
      setTimeout(() => {
        const formUrl = FORM_URL + encodeURIComponent(locationData);
        console.log('Redirigiendo a:', formUrl);
        window.location.href = formUrl;
      }, 1500);
    }
    
    // MOSTRAR ERROR CON MAPA DE VALLADOLID
    function showError(message) {
      document.getElementById('loader').style.display = 'none';
      document.getElementById('status').innerHTML = message;
      document.getElementById('error-msg').style.display = 'block';
      
      // Mostrar mapa centrado en Valladolid como placeholder
      showPlaceholderMap();
    }
    
    // Mostrar mapa centrado en Valladolid cuando falla la geolocalización
    function showPlaceholderMap() {
      console.log('Mostrando mapa placeholder centrado en Valladolid');
      
      // Coordenadas de Valladolid (centro aproximado)
      const valladolidLat = 41.6521;
      const valladolidLng = -4.7235;
      
      // ESTABLECER como ubicación confirmada inmediatamente
      setConfirmedLocation(valladolidLat, valladolidLng, 'Placeholder', 'Centrado en Valladolid - Ajustar si necesario');
      
      // INICIAR modo edición automáticamente para que sea arrastrable
      setTimeout(() => {
        startMapEditing();
        
        // Personalizar el modo edición para placeholder
        customizePlaceholderEditing();
      }, 100); // Pequeño delay para que se complete setConfirmedLocation
    }

     // Personalizar la interfaz para el modo placeholder
    function customizePlaceholderEditing() {
      // Cambiar mensajes específicos para placeholder
      document.getElementById('status').innerHTML = '📍 Mapa centrado en Valladolid. Arrastra el marcador a tu ubicación real.';
      
      document.getElementById('instructions').innerHTML = '<div class="instruction-box"><p><strong>🔄 Ajusta tu ubicación:</strong></p><ul><li>Arrastra el marcador naranja a tu ubicación real</li><li>Usa zoom para mayor precisión</li><li>Pulsa "Confirmar ubicación" cuando esté correcto</li></ul></div>';
      
      // Cambiar color del marcador a naranja para indicar que es placeholder
      if (marker) {
        marker.setIcon(L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        }));
        
        // Actualizar popup para placeholder
        const popupContent = \`
          <div style="text-align: center;">
            <strong>📍 Ubicación placeholder</strong><br>
            <small>Valladolid (centro)</small><br>
            <small style="color: #e67e22;">⚠️ Arrastra a tu ubicación real</small>
          </div>
        \`;
        
        marker.bindPopup(popupContent).openPopup();
      }
      
      // Personalizar botones para el contexto de placeholder
      const applyBtn = document.querySelector('#editing-controls button[onclick="applyMapEdit()"]');
      const cancelBtn = document.querySelector('#editing-controls button[onclick="cancelMapEdit()"]');
      
      if (applyBtn) {
        applyBtn.innerHTML = '✅ Confirmar ubicación';
        applyBtn.title = 'Confirmar la ubicación seleccionada';
      }
      
      if (cancelBtn) {
        cancelBtn.innerHTML = '🔄 Resetear a Valladolid';
        cancelBtn.title = 'Volver al centro de Valladolid';
      }
    }

    // Sobrescribir función de error para usar el placeholder unificado
    function showError(message) {
      document.getElementById('loader').style.display = 'none';
      document.getElementById('status').innerHTML = message;
      document.getElementById('error-msg').style.display = 'block';
      
      // Mensaje específico para el error con placeholder
      document.getElementById('error-msg').innerHTML = \`
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 10px 0;">
          <p><strong>⚠️ No se pudo obtener tu ubicación automáticamente.</strong></p>
          <p>📍 Se ha cargado un mapa centrado en <strong>Valladolid</strong>. Arrastra el marcador naranja a tu ubicación real.</p>
        </div>
      \`;
      
      // Usar la función unificada
      showPlaceholderMap();
    }
 
    
    // INICIALIZACIÓN
    document.addEventListener("DOMContentLoaded", function() {
      console.log('DOM cargado, detectando contexto...');
      setTimeout(detectExecutionContext, 100);
    });
    
    // Manejo de errores global
    window.onerror = function(msg, url, line, col, error) {
      console.error('Error global:', { msg, url, line, col, error });
      if (!locationReceived && !confirmedLocation) {
        showError('Error técnico. Puedes introducir tu ubicación manualmente.');
      }
      return false;
    };
    
    console.log('Sistema de confirmación inicializado correctamente');
  </script>
</body>
</html>
  `);
  
  return html.evaluate()
    .setTitle('Confirma tu Ubicación')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ========================================
// PÁGINA DE ERROR
// ========================================

function createErrorPage(message) {
  const html = HtmlService.createHtmlOutput(`
    <div style="font-family: Arial; text-align: center; padding: 2rem;">
      <h2>❌ Error</h2>
      <p>${message}</p>
    </div>
  `);
  return html;
}

// ========================================
// TRIGGER CON SISTEMA DE LIMPIEZA
// ========================================

/**
 * TRIGGER PRINCIPAL: Procesa respuesta y programa limpieza si hay fallos
 */
function onFormSubmit(e) {
  const startTime = new Date();
  console.log('=== INICIO onFormSubmit ===', startTime.toISOString());
  
  const lock = LockService.getScriptLock();
  try {
    console.log('Obteniendo lock...');
    lock.waitLock(10000);
    console.log('Lock obtenido');
    
    const form = FormApp.getActiveForm();
    const ss = SpreadsheetApp.openById(form.getDestinationId());
    const sheet = ss.getSheets()[0];
    
    // Procesar respuesta
    const result = processLocationResponse(e, sheet);
    
    // Sistema de limpieza inteligente
    if (!result.success || !result.coordinates || !result.sessionId) {
      console.warn('Respuesta con problemas, programando limpieza diferida');
      if (CLEANUP_CONFIG.enabled && CLEANUP_CONFIG.mode === 'deferred') {
        scheduleCleanupTrigger();
      }
    }
    
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    
    console.log(`Respuesta procesada en ${duration}ms`);
    if (result.coordinates) console.log(`Coordenadas: ${result.coordinates}`);
    if (result.sessionId) console.log(`Session ID: ${result.sessionId}`);
    
  } catch (error) {
    console.error('Error en onFormSubmit:', error);
    // En caso de error, también programar limpieza
    if (CLEANUP_CONFIG.enabled && CLEANUP_CONFIG.mode === 'deferred') {
      scheduleCleanupTrigger();
    }
  } finally {
    lock.releaseLock();
    console.log('Lock liberado');
    console.log('=== FIN onFormSubmit ===');
  }
}

/**
 * Procesar respuesta y separar coordenadas|session_id
 */
function processLocationResponse(e, sheet) {
  const itemResponses = e.response.getItemResponses();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  let locationValue = null;
  let validationResult = null;
  
  // Buscar el campo de ubicación
  for (let itemResponse of itemResponses) {
    const response = itemResponse.getResponse();
    
    if (response && typeof response === 'string') {
      // Verificar si parece ser el campo de ubicación
      if (response.includes('|') || 
          response.includes(',')) {
        
        locationValue = response;
        validationResult = validateAndParseLocation(response);
        break;
      }
    }
  }
  
  if (!locationValue) {
    return {
      success: false,
      message: 'No se encontró campo de ubicación en la respuesta',
      errors: ['Campo de ubicación no encontrado']
    };
  }

  // Logging detallado del resultado de validación
  console.log('VALIDACIÓN DE UBICACIÓN:');
  console.log(`   Valor original: "${validationResult.originalValue}"`);
  console.log(`   Es válido: ${validationResult.isValid}`);
  console.log(`   Coordenadas: ${validationResult.coordinates || 'N/A'}`);
  console.log(`   Coordenadas limpias: ${validationResult.cleanCoordinates || 'N/A'}`);
  console.log(`   Session ID: ${validationResult.sessionId || 'N/A'}`);
  
  if (validationResult.errors.length > 0) {
    console.log('   Errores:', validationResult.errors);
  }
  
  // Asegurar columnas necesarias
  const { locColIndex, sessionColIndex, coordsColIndex } = ensureColumns(sheet, headers);
  
  // Obtener la última fila (recién añadida)
  const lastRow = sheet.getLastRow();
  
  try {
    // Siempre guardar el valor original
    sheet.getRange(lastRow, locColIndex + 1).setValue(locationValue);
    
    // Guardar valores procesados solo si la validación fue exitosa
    if (validationResult.isValid) {
      
      // Coordenadas limpias (solo si hay coordenadas válidas)
      if (validationResult.cleanCoordinates) {
        sheet.getRange(lastRow, coordsColIndex + 1).setValue(validationResult.cleanCoordinates);
      }
      // Si cleanCoordinates es null, COORDS_COLUMN queda vacío
      
      // Session ID (puede ser válido o "INVALID")
      if (validationResult.sessionId) {
        sheet.getRange(lastRow, sessionColIndex + 1).setValue(validationResult.sessionId);
      }
      
      console.log(`Datos procesados y guardados en fila ${lastRow}`);
      
      return {
        success: true,
        coordinates: validationResult.cleanCoordinates,
        sessionId: validationResult.sessionId,
        locationValue: locationValue,
        message: 'Datos procesados correctamente',
        isValid: true
      };
      
    } else {
      // Datos inválidos (coordenadas corruptas) - solo guardamos el original
      console.warn(`Coordenadas inválidas en fila ${lastRow}, datos rechazados`);
      
      return {
        success: false, // Esto activará la limpieza diferida
        coordinates: null,
        sessionId: null,
        locationValue: locationValue,
        message: 'Coordenadas inválidas: ' + validationResult.errors.join(', '),
        isValid: false,
        errors: validationResult.errors
      };
    }
    
  } catch (error) {
    console.error('Error guardando datos:', error);
    return {
      success: false,
      message: 'Error guardando datos: ' + error.toString(),
      errors: [error.toString()]
    };
  }
}

// ========================================
// SISTEMA DE LIMPIEZA INTELIGENTE
// ========================================

/**
 * Programar trigger de limpieza diferida
 */
function scheduleCleanupTrigger() {
  try {
    // Verificar si ya existe un trigger de limpieza
    const triggers = ScriptApp.getProjectTriggers();
    const existingCleanup = triggers.find(t => t.getHandlerFunction() === 'performDeferredCleanup');
    
    if (existingCleanup) {
      console.log('Trigger de limpieza ya existe, no se crea duplicado');
      return;
    }
    
    // Crear trigger diferido
    const delayMs = CLEANUP_CONFIG.deferredDelayMinutes * 60 * 1000;
    const triggerTime = new Date(Date.now() + delayMs);
    
    ScriptApp.newTrigger('performDeferredCleanup')
      .timeBased()
      .at(triggerTime)
      .create();
      
    console.log(`Trigger de limpieza programado para: ${triggerTime.toISOString()}`);
    
  } catch (error) {
    console.error('Error programando limpieza:', error);
  }
}

/**
 * Ejecutar limpieza diferida (se auto-elimina después)
 */
function performDeferredCleanup() {
  console.log('=== INICIO LIMPIEZA DIFERIDA ===');
  
  try {
    // Ejecutar limpieza
    const result = performCleanup();
    
    console.log('Resultado limpieza diferida:', result);
    
    // Auto-eliminar el trigger
    const triggers = ScriptApp.getProjectTriggers();
    const selfTrigger = triggers.find(t => t.getHandlerFunction() === 'performDeferredCleanup');
    if (selfTrigger) {
      ScriptApp.deleteTrigger(selfTrigger);
      console.log('Trigger de limpieza auto-eliminado');
    }
    
  } catch (error) {
    console.error('Error en limpieza diferida:', error);
  }
  
  console.log('=== FIN LIMPIEZA DIFERIDA ===');
}

/**
 * Función principal de limpieza
 */
function performCleanup() {
  const form = FormApp.getActiveForm();
  const ss = SpreadsheetApp.openById(form.getDestinationId());
  const sheet = ss.getSheets()[0];
  
  if (sheet.getLastRow() <= 1) {
    return { message: 'No hay datos para limpiar', processed: 0 };
  }
  
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const { locColIndex, sessionColIndex, coordsColIndex } = ensureColumns(sheet, headers);
  
  // Obtener todas las filas de datos
  const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
  const data = dataRange.getValues();
  
  let processedCount = 0;
  let fixedCount = 0;
  
  // Procesar cada fila
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // +2 porque empezamos desde la fila 2
    
    const locValue = row[locColIndex] || '';
    const sessionValue = row[sessionColIndex] || '';
    const coordsValue = row[coordsColIndex] || '';
    
    // Verificar si necesita procesamiento
    if (locValue && locValue.includes('|') && (!sessionValue || !coordsValue)) {
      const parts = locValue.split('|');
      const coordinates = parts[0];
      const sessionId = parts[1];
      
      console.log(`Procesando fila ${rowNum}:`, { coordinates, sessionId });
      
      try {
        // Actualizar coordenadas si falta
        if (!coordsValue && coordinates && coordinates !== 'Sin ubicación') {
          sheet.getRange(rowNum, coordsColIndex + 1).setValue(coordinates);
          fixedCount++;
        }
        
        // Actualizar session ID si falta
        if (!sessionValue && sessionId) {
          sheet.getRange(rowNum, sessionColIndex + 1).setValue(sessionId);
          fixedCount++;
        }
        
        processedCount++;
        
      } catch (error) {
        console.error(`Error procesando fila ${rowNum}:`, error);
      }
    }
  }
  
  console.log(`Limpieza completada: ${processedCount} filas procesadas, ${fixedCount} valores corregidos`);
  
  return {
    success: true,
    processed: processedCount,
    fixed: fixedCount,
    message: `Limpieza completada: ${fixedCount} valores corregidos en ${processedCount} filas`
  };
}

/**
 * Limpieza manual - para ejecutar la función desde GoogleAppsScript
 */
function manualCleanupCheck() {
  console.log('=== LIMPIEZA MANUAL INICIADA ===');
  
  try {
    const result = performCleanup();
    console.log('Limpieza manual completada:', result);
    return result;
  } catch (error) {
    console.error('Error en limpieza manual:', error);
    return { success: false, error: error.toString() };
  }
}

/**
 * Endpoint de limpieza - para ejecutar la función mediante parámetro URL
 */
function handleCleanupEndpoint(params) {
  console.log(' === ENDPOINT LIMPIEZA ===');
  
  try {
    const result = performCleanup();
    
    const html = HtmlService.createHtmlOutput(`
      <div style="font-family: Arial; padding: 2rem; text-align: center;">
        <h2>🧹 Limpieza Ejecutada</h2>
        <p><strong>Filas procesadas:</strong> ${result.processed}</p>
        <p><strong>Valores corregidos:</strong> ${result.fixed}</p>
        <p><strong>Estado:</strong> ${result.success ? '✅ Exitoso' : '❌ Error'}</p>
        <hr>
        <small>Timestamp: ${new Date().toISOString()}</small>
      </div>
    `);
    
    return html;
    
  } catch (error) {
    const html = HtmlService.createHtmlOutput(`
      <div style="font-family: Arial; padding: 2rem; text-align: center;">
        <h2>❌ Error en Limpieza</h2>
        <p>${error.toString()}</p>
      </div>
    `);
    
    return html;
  }
}

// ========================================
// GESTIÓN DE COLUMNAS 
// ========================================

/**
 * Asegurar columnas necesarias 
 */
function ensureColumns(sheet, headers) {
  let headersChanged = false;
  
  // Columna LOCALIZACION (valor completo)
  let locColIndex = headers.indexOf(LOC_COLUMN_NAME);
  if (locColIndex === -1) {
    locColIndex = headers.length;
    sheet.getRange(1, locColIndex + 1).setValue(LOC_COLUMN_NAME);
    headers.push(LOC_COLUMN_NAME);
    headersChanged = true;
    console.log('Columna LOCALIZACION creada');
  }
  
  // Columna SESSION_ID (separada)
  let sessionColIndex = headers.indexOf(SESSION_ID_COLUMN);
  if (sessionColIndex === -1) {
    sessionColIndex = headers.length;
    sheet.getRange(1, sessionColIndex + 1).setValue(SESSION_ID_COLUMN);
    headers.push(SESSION_ID_COLUMN);
    headersChanged = true;
    console.log('Columna SESSION_ID creada');
  }
  
  // Columna COORDENADAS_LIMPIAS (solo lat,lng)
  let coordsColIndex = headers.indexOf(COORDS_COLUMN);
  if (coordsColIndex === -1) {
    coordsColIndex = headers.length;
    sheet.getRange(1, coordsColIndex + 1).setValue(COORDS_COLUMN);
    headers.push(COORDS_COLUMN);
    headersChanged = true;
    console.log('Columna COORDENADAS_LIMPIAS creada');
  }
  
  if (headersChanged) {
    console.log('Headers actualizados:', headers);
  }
  
  return { locColIndex, sessionColIndex, coordsColIndex };
}

// ========================================
// GENERACIÓN DE SESSION ID
// ========================================

/**
 * Generar Session ID base (se completará con timestamp en el frontend)
 */
function generateSessionId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  
  // Formato base: S + timestamp últimos 6 dígitos + random 3 dígitos
  const sessionId = `S${timestamp.toString().slice(-6)}${random}`;
  
  console.log(`Session ID base generado: ${sessionId}`);
  return sessionId;
}

// ========================================
// CONFIGURACIÓN INICIAL
// ========================================

/**
 * CONFIGURACIÓN INICIAL del sistema
 * EJECUTAR UNA VEZ después del despliegue
 */
function setupSystem() {
  try {
    console.log('=== CONFIGURACIÓN SISTEMA ===');
    
    // 1. Limpiar triggers existentes
    const triggers = ScriptApp.getProjectTriggers();
    for (let trigger of triggers) {
      if (['onFormSubmit', 'performDeferredCleanup'].includes(trigger.getHandlerFunction())) {
        ScriptApp.deleteTrigger(trigger);
        console.log(`Trigger ${trigger.getHandlerFunction()} eliminado`);
      }
    }
    
    // 2. Crear nuevo trigger principal
    const form = FormApp.getActiveForm();
    ScriptApp.newTrigger('onFormSubmit')
      .forForm(form)
      .onFormSubmit()
      .create();
    console.log('Trigger onFormSubmit creado');
    
    // 3. Configurar mensaje de confirmación
    const deploymentId = getDeploymentId();
    const confirmationMessage = `
¡Gracias por completar el formulario de mediciones de cobertura y concentraciones de contaminantes ambientales!

Tu respuesta ha sido registrada correctamente, será visible en la web en unas horas.

El equipo de RurAirConnect.
    `.trim();
    
    form.setConfirmationMessage(confirmationMessage);
    console.log('Mensaje de confirmación configurado');
    
    // 4. Verificar spreadsheet y crear columnas
    const ss = SpreadsheetApp.openById(form.getDestinationId());
    const sheet = ss.getSheets()[0];
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    ensureColumns(sheet, headers);
    
    // 5. Configuración del sistema de limpieza
    console.log('Configuración de limpieza:', CLEANUP_CONFIG);
    
    console.log(`Spreadsheet: ${ss.getName()}`);
    console.log(`Sheet: ${sheet.getName()}`);
    
    console.log('=== CONFIGURACIÓN COMPLETADA ===');
    return { 
      success: true, 
      message: 'Sistema configurado correctamente',
      deploymentId: deploymentId,
      formId: form.getId(),
      spreadsheetId: ss.getId(),
      cleanupConfig: CLEANUP_CONFIG,
      features: [
        'Edición visual de ubicación arrastrando marcador',
        'Menú de opciones de ubicación',
        'Preview en tiempo real de cambios',
        'Sistema de limpieza inteligente diferido',
        'Compatibilidad total iframe/directo',
        'Trigger robusto con detección de fallos'
      ]
    };
    
  } catch (error) {
    console.error('Error en configuración:', error);
    return { 
      success: false, 
      message: error.toString() 
    };
  }
}

/**
 * Helper: Obtener deployment ID
 * ACTUALIZAR CON ID REAL DESPUÉS DEL DESPLIEGUE
 */
function getDeploymentId() {
  // CONFIGURAR MANUALMENTE DESPUÉS DEL DESPLIEGUE:
  const deploymentId = 'ID DE LA IMPLEMENTACIÓN DE APPS SCRIPT';
  
  if (deploymentId === 'ID DE LA IMPLEMENTACIÓN DE APPS SCRIPT') {
    console.warn('RECUERDA: Actualizar deploymentId en getDeploymentId()');
  }
  
  return deploymentId;
}

// ========================================
// FUNCIONES DE DEBUGGING Y TESTING
// ========================================

/**
 * Función de debugging para el sistema
 */
function debugSystem() {
  try {
    const form = FormApp.getActiveForm();
    const ss = SpreadsheetApp.openById(form.getDestinationId());
    const sheet = ss.getSheets()[0];
    
    const totalResponses = sheet.getLastRow() - 1;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Verificar últimas 5 respuestas
    const recentData = [];
    if (sheet.getLastRow() > 1) {
      const startRow = Math.max(2, sheet.getLastRow() - 4);
      const numRows = sheet.getLastRow() - startRow + 1;
      const recentResponses = sheet.getRange(startRow, 1, numRows, sheet.getLastColumn()).getValues();
      
      const sessionColIndex = headers.indexOf(SESSION_ID_COLUMN);
      const locColIndex = headers.indexOf(LOC_COLUMN_NAME);
      const coordsColIndex = headers.indexOf(COORDS_COLUMN);
      
      for (let i = 0; i < recentResponses.length; i++) {
        const row = recentResponses[i];
        const rowNum = startRow + i;
        recentData.push({
          row: rowNum,
          timestamp: row[0],
          sessionId: sessionColIndex !== -1 ? row[sessionColIndex] : 'N/A',
          localizacion: locColIndex !== -1 ? row[locColIndex] : 'N/A',
          coordenadas: coordsColIndex !== -1 ? row[coordsColIndex] : 'N/A'
        });
      }
    }
    
    // Verificar triggers activos
    const triggers = ScriptApp.getProjectTriggers();
    const triggerInfo = triggers.map(t => ({
      function: t.getHandlerFunction(),
      source: t.getTriggerSource(),
      type: t.getEventType()
    }));
    
    const debugInfo = {
      system: 'Sistema v2.0',
      timestamp: new Date().toISOString(),
      formId: form.getId(),
      formTitle: form.getTitle(),
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      totalResponses: totalResponses,
      headers: headers,
      columns: {
        hasLocationColumn: headers.includes(LOC_COLUMN_NAME),
        hasSessionColumn: headers.includes(SESSION_ID_COLUMN),
        hasCoordsColumn: headers.includes(COORDS_COLUMN),
        locationIndex: headers.indexOf(LOC_COLUMN_NAME),
        sessionIndex: headers.indexOf(SESSION_ID_COLUMN),
        coordsIndex: headers.indexOf(COORDS_COLUMN)
      },
      triggers: {
        total: triggers.length,
        details: triggerInfo
      },
      cleanupConfig: CLEANUP_CONFIG,
      recentResponses: recentData
    };
    
    console.log('=== ESTADO SISTEMA ===');
    console.log(JSON.stringify(debugInfo, null, 2));
    
    return debugInfo;
    
  } catch (error) {
    console.error('Error en debugging:', error);
    return { error: error.toString() };
  }
}

/**
 * Testing completo del sistema
 */
function testSystem() {
  try {
    console.log('=== TESTING SISTEMA ===');
    
    // Test 1: Verificar configuración
    const debugInfo = debugSystem();
    if (debugInfo.error) {
      throw new Error('Error en configuración: ' + debugInfo.error);
    }
    
    // Test 2: Verificar sistema de limpieza
    console.log('Testing sistema de limpieza...');
    const cleanupResult = performCleanup();
    console.log('Resultado test limpieza:', cleanupResult);
    
    // Test 3: Generar datos de prueba
    const testSessionId = generateSessionId();
    const testLocationData = `40.4168,-3.7038|${testSessionId}_${Date.now()}`;
    
    // Test 4: Verificar URLs
    const deploymentId = getDeploymentId();
    const preloadUrl = `https://script.google.com/macros/s/${deploymentId}/exec?action=preload`;
    const cleanupUrl = `https://script.google.com/macros/s/${deploymentId}/exec?action=cleanup`;
    
    console.log('=== TESTING COMPLETADO ===');
    return {
      success: true,
      debugInfo: debugInfo,
      cleanupTest: cleanupResult,
      testSessionId: testSessionId,
      testLocationData: testLocationData,
      urls: {
        preload: preloadUrl,
        cleanup: cleanupUrl
      },
      systemStatus: 'Sistema listo para producción',
      features: [
        'Edición visual en mapa',
        'Sistema de limpieza inteligente',
        'Trigger robusto',
        'Compatibilidad iframe/directo',
        'Endpoints de administración'
      ]
    };
    
  } catch (error) {
    console.error('Error en testing:', error);
    return {
      success: false,
      error: error.toString(),
      systemStatus: 'Sistema requiere revisión'
    };
  }
}

/**
 * Test manual de validación limpieza coordenadas y Session_id
 */
function testValidation() {
  console.log('=== TEST DE VALIDACIÓN ===');
  
  const testCases = [
    // Formatos correctos
    '42.123,-8.456|S123456789',
    '42.123,-8.456|S123456789_1640995200000',
    '42.123,-8.456',
    
    // Session ID inválidos (coordenadas válidas)
    '42.123,-8.456|S12345678',      // Solo 8 dígitos
    '42.123,-8.456|S1234567890',    // 10 dígitos
    '42.123,-8.456|session123',     // Sin S inicial
    '42.123,-8.456|S123456ABC',     // Letras en lugar de dígitos
    '42.123,-8.456|S123456789_',    // Timestamp vacío
    '42.123,-8.456|S123456789_abc', // Timestamp no numérico
    
    // Usuario modificó coordenadas (inválidas)
    'Estoy en casa|S123456789',
    'Madrid, España|S123456789', 
    '200,100|S123456789',           // Coordenadas fuera de rango
    '42.123,invalid|S123456789',    // Longitud inválida
    
    // Casos extremos
    '42.123,-8.456|S123456789|extra_texto',
    '42.123,-8.456|',
    '|S123456789',
    '',
    '   ',
    'usuario-escribió-cualquier-cosa'
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n--- Test ${index + 1}: "${testCase}" ---`);
    const result = validateAndParseLocation(testCase);
    console.log(`Válido: ${result.isValid}`);
    console.log(`Coordenadas: ${result.cleanCoordinates || 'N/A'}`);
    console.log(`Session ID: ${result.sessionId || 'N/A'}`);
    if (result.errors.length > 0) {
      console.log(`Errores: ${result.errors.join(', ')}`);
    }
  });
  
  console.log('=== FIN TESTS ===');
}
// ========================================
// ESTADÍSTICAS Y UTILIDADES
// ========================================

/**
 * Obtener estadísticas completas del sistema
 */
function getSystemStats() {
  try {
    const form = FormApp.getActiveForm();
    const ss = SpreadsheetApp.openById(form.getDestinationId());
    const sheet = ss.getSheets()[0];
    
    if (sheet.getLastRow() <= 1) {
      return { message: 'No hay datos para analizar' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const sessionColIndex = headers.indexOf(SESSION_ID_COLUMN);
    const locColIndex = headers.indexOf(LOC_COLUMN_NAME);
    const coordsColIndex = headers.indexOf(COORDS_COLUMN);
    
    let stats = {
      totalResponses: data.length - 1,
      withLocation: 0,
      withSessionId: 0,
      withCoordinates: 0,
      withoutLocation: 0,
      needsCleanup: 0,
      recentActivity: []
    };
    
    // Análisis de los últimos 3 días
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const timestamp = new Date(row[0]);
      
      const locValue = row[locColIndex] || '';
      const sessionValue = row[sessionColIndex] || '';
      const coordsValue = row[coordsColIndex] || '';
      
      // Contadores principales
      if (locValue && locValue !== 'Sin ubicación') {
        stats.withLocation++;
      } else {
        stats.withoutLocation++;
      }
      
      if (sessionValue) stats.withSessionId++;
      if (coordsValue) stats.withCoordinates++;
      
      // Detectar filas que necesitan limpieza
      if (locValue && locValue.includes('|') && (!sessionValue || !coordsValue)) {
        stats.needsCleanup++;
      }
      
      // Actividad reciente
      if (timestamp > threeDaysAgo) {
        stats.recentActivity.push({
          timestamp: timestamp.toISOString(),
          hasLocation: !!locValue,
          hasSession: !!sessionValue,
          hasCoords: !!coordsValue
        });
      }
    }
    
    stats.dataQuality = {
      locationCompleteness: Math.round((stats.withLocation / stats.totalResponses) * 100),
      sessionCompleteness: Math.round((stats.withSessionId / stats.totalResponses) * 100),
      coordsCompleteness: Math.round((stats.withCoordinates / stats.totalResponses) * 100)
    };
    
    console.log('Estadísticas del sistema:', stats);
    return stats;
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return { error: error.toString() };
  }
}

/**
 * Función para monitorear el estado del sistema
 */
function monitorSystemHealth() {
  try {
    const stats = getSystemStats();
    const debugInfo = debugSystem();
    
    const health = {
      timestamp: new Date().toISOString(),
      overallStatus: 'healthy',
      issues: [],
      recommendations: [],
      stats: stats,
      systemInfo: debugInfo
    };
    
    // Análisis de salud
    if (stats.needsCleanup > 0) {
      health.issues.push(`${stats.needsCleanup} filas necesitan limpieza`);
      health.recommendations.push('Ejecutar manualCleanupCheck() o usar endpoint de limpieza');
    }
    
    if (stats.dataQuality && stats.dataQuality.locationCompleteness < 90) {
      health.issues.push(`Completitud de ubicación baja: ${stats.dataQuality.locationCompleteness}%`);
      health.overallStatus = 'warning';
    }
    
    if (debugInfo.triggers.total === 0) {
      health.issues.push('No hay triggers configurados');
      health.overallStatus = 'error';
      health.recommendations.push('Ejecutar setupSystem()');
    }
    
    if (health.issues.length === 0) {
      health.overallStatus = 'healthy';
    } else if (health.issues.length > 2) {
      health.overallStatus = 'error';
    }
    
    console.log('Estado de salud del sistema:', health.overallStatus);
    if (health.issues.length > 0) {
      console.log('Problemas detectados:', health.issues);
    }
    
    return health;
    
  } catch (error) {
    console.error('Error monitoreando salud:', error);
    return {
      timestamp: new Date().toISOString(),
      overallStatus: 'error',
      error: error.toString()
    };
  }
}

/**
 * Informe completo del sistema
 */
function generateSystemReport() {
  try {
    console.log('=== GENERANDO REPORTE COMPLETO ===');
    
    const health = monitorSystemHealth();
    const testResults = testSystem();
    
    const report = {
      reportTimestamp: new Date().toISOString(),
      systemVersion: 'Sistema v2.0',
      deploymentId: getDeploymentId(),
      
      // Salud del sistema
      health: health,
      
      // Resultados de testing
      testing: testResults,
      
      // Configuración actual
      configuration: {
        cleanupConfig: CLEANUP_CONFIG,
        columns: {
          location: LOC_COLUMN_NAME,
          sessionId: SESSION_ID_COLUMN,
          coordinates: COORDS_COLUMN
        },
        formUrl: FORM_URL
      },
      
      // URLs importantes
      urls: testResults.urls || {},
      
      // Recomendaciones
      recommendations: health.recommendations || []
    };
    
    console.log('Reporte completo generado');
    return report;
    
  } catch (error) {
    console.error('Error generando report:', error);
    return {
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

// ========================================
// FUNCIONES DE MANTENIMIENTO
// ========================================

/**
 * Limpieza completa del sistema (usar con precaución)
 */
function performDeepMaintenance() {
  try {
    console.log('=== MANTENIMIENTO PROFUNDO INICIADO ===');
    
    const results = {
      triggersCleared: 0,
      dataCleanup: null,
      columnsVerified: false,
      configurationUpdated: false
    };
    
    // 1. Limpiar triggers antiguos
    const triggers = ScriptApp.getProjectTriggers();
    for (let trigger of triggers) {
      if (['onFormSubmit', 'performDeferredCleanup'].includes(trigger.getHandlerFunction())) {
        ScriptApp.deleteTrigger(trigger);
        results.triggersCleared++;
      }
    }
    
    // 2. Ejecutar limpieza de datos
    results.dataCleanup = performCleanup();
    
    // 3. Re-configurar sistema
    const setupResult = setupSystem();
    results.configurationUpdated = setupResult.success;
    
    console.log('Mantenimiento profundo completado:', results);
    return {
      success: true,
      results: results,
      message: 'Mantenimiento profundo completado exitosamente'
    };
    
  } catch (error) {
    console.error('Error en mantenimiento profundo:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Verificación rápida del sistema
 */
function quickSystemCheck() {
  try {
    const form = FormApp.getActiveForm();
    const ss = SpreadsheetApp.openById(form.getDestinationId());
    const triggers = ScriptApp.getProjectTriggers();
    
    const check = {
      formConnected: !!form,
      spreadsheetConnected: !!ss,
      triggersCount: triggers.length,
      hasMainTrigger: triggers.some(t => t.getHandlerFunction() === 'onFormSubmit'),
      timestamp: new Date().toISOString()
    };
    
    check.overallStatus = (
      check.formConnected && 
      check.spreadsheetConnected && 
      check.hasMainTrigger
    ) ? 'OK' : 'NEEDS_ATTENTION';
    
    return check;
    
  } catch (error) {
    return {
      overallStatus: 'ERROR',
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
  }
}

// ========================================
// FUNCIONES DE EXPORTACIÓN Y BACKUP
// ========================================

/**
 * Crear backup de configuración
 */
function createConfigBackup() {
  try {
    const backup = {
      timestamp: new Date().toISOString(),
      version: 'Sistema v2.0',
      configuration: {
        LOC_COLUMN_NAME,
        SESSION_ID_COLUMN,
        COORDS_COLUMN,
        FORM_URL,
        CLEANUP_CONFIG
      },
      deploymentId: getDeploymentId(),
      systemHealth: monitorSystemHealth()
    };
    
    console.log('Backup de configuración creado:', backup.timestamp);
    return backup;
    
  } catch (error) {
    console.error('Error creando backup:', error);
    return { error: error.toString() };
  }
}

/**
 * Exportar datos para análisis
 */
function exportDataForAnalysis() {
  try {
    const form = FormApp.getActiveForm();
    const ss = SpreadsheetApp.openById(form.getDestinationId());
    const sheet = ss.getSheets()[0];
    
    if (sheet.getLastRow() <= 1) {
      return { message: 'No hay datos para exportar' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const sessionColIndex = headers.indexOf(SESSION_ID_COLUMN);
    const locColIndex = headers.indexOf(LOC_COLUMN_NAME);
    const coordsColIndex = headers.indexOf(COORDS_COLUMN);
    
    const exportData = {
      timestamp: new Date().toISOString(),
      totalRecords: data.length - 1,
      headers: headers,
      locationData: [],
      summary: {
        withLocation: 0,
        withSession: 0,
        withCoordinates: 0,
        needsProcessing: 0
      }
    };
    
    // Procesar datos
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      const locationInfo = {
        rowNumber: i + 1,
        timestamp: row[0],
        location: locColIndex !== -1 ? row[locColIndex] : null,
        sessionId: sessionColIndex !== -1 ? row[sessionColIndex] : null,
        coordinates: coordsColIndex !== -1 ? row[coordsColIndex] : null
      };
      
      // Actualizar contadores
      if (locationInfo.location) exportData.summary.withLocation++;
      if (locationInfo.sessionId) exportData.summary.withSession++;
      if (locationInfo.coordinates) exportData.summary.withCoordinates++;
      if (locationInfo.location && locationInfo.location.includes('|') && 
          (!locationInfo.sessionId || !locationInfo.coordinates)) {
        exportData.summary.needsProcessing++;
      }
      
      exportData.locationData.push(locationInfo);
    }
    
    console.log('Datos exportados:', exportData.summary);
    return exportData;
    
  } catch (error) {
    console.error('Error exportando datos:', error);
    return { error: error.toString() };
  }
}

// ========================================
// FUNCIONES DE UTILIDAD FINAL
// ========================================

/**
 * Función de utilidad para formatear coordenadas
 */
/*function formatCoordinates(lat, lng, precision = 6) {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return 'Coordenadas inválidas';
  }
  
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}*/

/**
 * Validar formato de session ID estricto
 * Formato esperado: S + 6 dígitos + 3 dígitos [+ _ + timestamp]
 * Ejemplos válidos: S123456789, S123456789_1640995200000
 */
function validateSessionId(sessionId) {
  const result = {
    isValid: false,
    errors: []
  };

  if (!sessionId || typeof sessionId !== 'string') {
    result.errors.push('Session ID vacío');
    return result;
  }

  const trimmed = sessionId.trim();
  
  if (!trimmed) {
    result.errors.push('Session ID solo contiene espacios');
    return result;
  }

  // Patrón estricto: S + 9 dígitos + opcionalmente (_ + timestamp)
  const strictPattern = /^S\d{9}(_\d+)?$/;
  
  if (!strictPattern.test(trimmed)) {
    result.errors.push(`Session ID no cumple formato esperado: S + 9 dígitos [+ _ + timestamp]. Recibido: "${trimmed}"`);
    return result;
  }

  result.isValid = true;
  return result;
}

/**
 * Validación robusta del campo de ubicación con enfoque pragmático:
 *    Se guarda siempre la ubicación si es válida (aunque Session_id falle)
 *    Dato importante: Coordenadas.
 */
function validateAndParseLocation(locationValue) {
  const result = {
    isValid: false,
    coordinates: null,
    sessionId: null,
    cleanCoordinates: null,
    errors: [],
    originalValue: locationValue
  };

  // Verificar que hay contenido
  if (!locationValue || typeof locationValue !== 'string') {
    result.errors.push('Campo de ubicación vacío o no es texto');
    return result;
  }

  const trimmed = locationValue.trim();
  if (!trimmed) {
    result.errors.push('Campo de ubicación solo contiene espacios');
    return result;
  }

  // Intentar parsear el formato esperado: "lat,lng|session_id"
  if (trimmed.includes('|')) {
    const parts = trimmed.split('|');
    
    // Validar que solo hay un separador |
    if (parts.length !== 2) {
      result.errors.push(`Formato incorrecto: se esperaba "lat,lng|session_id", encontrado ${parts.length - 1} separadores |`);
      return result;
    }

    const [coordsPart, sessionPart] = parts;
    
    // Validar coordenadas (siempre estricto)
    const coordsValidation = validateCoordinates(coordsPart);
    if (coordsValidation.isValid) {
      result.coordinates = coordsPart.trim();
      result.cleanCoordinates = coordsValidation.cleanCoordinates;
    } else {
      result.errors = result.errors.concat(coordsValidation.errors);
      return result; // Si coordenadas inválidas → rechazar todo
    }

    // Validar session ID (laxo con fallback)
    const sessionValidation = validateSessionId(sessionPart);
    if (sessionValidation.isValid) {
      result.sessionId = sessionPart.trim();
    } else {
      result.sessionId = "INVALID";
      console.warn(`Session ID inválido reemplazado: "${sessionPart.trim()}" → INVALID`);
    }

    // Siempre válido si las coordenadas son correctas
    result.isValid = true;

  } else {
    // Intentar parsear solo como coordenadas (usuario eliminó session ID)
    const coordsValidation = validateCoordinates(trimmed);
    if (coordsValidation.isValid) {
      result.isValid = true;
      result.coordinates = trimmed;
      result.cleanCoordinates = coordsValidation.cleanCoordinates;
      result.sessionId = null; // SESSION_ID queda vacío
    } else {
      // No tiene formato válido de coordenadas
      // El usuario puso texto libre - guardamos original pero no procesamos
      result.errors.push('El texto no tiene formato válido de coordenadas ("lat,lng" o "lat,lng|session_id")');
    }
  }

  return result;
}

/**
 * Validar formato de coordenadas
 */
function validateCoordinates(coordsStr) {
  const result = {
    isValid: false,
    cleanCoordinates: null,
    errors: []
  };

  if (!coordsStr || typeof coordsStr !== 'string') {
    result.errors.push('Coordenadas vacías');
    return result;
  }

  const trimmed = coordsStr.trim();
  
  // Verificar formato básico lat,lng
  if (!trimmed.includes(',')) {
    result.errors.push('Coordenadas deben tener formato "latitud,longitud"');
    return result;
  }

  const parts = trimmed.split(',');
  if (parts.length !== 2) {
    result.errors.push(`Se esperaban 2 coordenadas separadas por coma, encontradas ${parts.length}`);
    return result;
  }

  const [latStr, lngStr] = parts.map(p => p.trim());

  // Validar que son números
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    result.errors.push('Las coordenadas deben ser números válidos');
    return result;
  }

  // Validar rangos geográficos
  if (lat < -90 || lat > 90) {
    result.errors.push(`Latitud fuera de rango: ${lat} (debe estar entre -90 y 90)`);
  }

  if (lng < -180 || lng > 180) {
    result.errors.push(`Longitud fuera de rango: ${lng} (debe estar entre -180 y 180)`);
  }

  // Si no hay errores de rango, es válido
  if (result.errors.length === 0) {
    result.isValid = true;
    result.cleanCoordinates = `${lat},${lng}`; // Formato normalizado
  }

  return result;
}

// ========================================
// DOCUMENTACIÓN Y AYUDA
// ========================================

/**
 * Función de ayuda con toda la documentación
 */
function showSystemHelp() {
  const help = {
    title: 'Sistema de Ubicación v2.0 - Ayuda',
    description: 'Sistema completo de confirmación de ubicación para Google Forms',
    
    mainFunctions: {
      setup: {
        function: 'setupSystem()',
        description: 'Configura el sistema completo (ejecutar una vez)',
        usage: 'Después del despliegue inicial'
      },
      
      testing: {
        function: 'testSystem()',
        description: 'Prueba completa del sistema',
        usage: 'Para verificar que todo funciona'
      },
      
      debugging: {
        function: 'debugSystem()',
        description: 'Información detallada del estado actual',
        usage: 'Para diagnosticar problemas'
      }
    },
    
    cleanupSystem: {
      automatic: {
        description: 'Sistema automático que se activa cuando hay problemas',
        configuration: CLEANUP_CONFIG
      },
      
      manual: {
        function: 'manualCleanupCheck()',
        description: 'Limpieza manual bajo demanda',
        usage: 'Cuando sospeches problemas de procesamiento'
      },
      
      endpoint: {
        url: 'https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec?action=cleanup',
        description: 'Endpoint web para ejecutar limpieza',
        usage: 'Desde tu aplicación web o navegador'
      }
    },
    
    monitoring: {
      health: {
        function: 'monitorSystemHealth()',
        description: 'Estado de salud general del sistema',
        usage: 'Monitoreo regular'
      },
      
      stats: {
        function: 'getSystemStats()',
        description: 'Estadísticas detalladas de uso',
        usage: 'Análisis de datos'
      },
      
      report: {
        function: 'generateSystemReport()',
        description: 'Reporte completo del sistema',
        usage: 'Documentación y análisis'
      }
    },
    
    maintenance: {
      quick: {
        function: 'quickSystemCheck()',
        description: 'Verificación rápida',
        usage: 'Chequeo básico diario'
      },
      
      deep: {
        function: 'performDeepMaintenance()',
        description: 'Mantenimiento profundo (usar con cuidado)',
        usage: 'Solo cuando hay problemas serios'
      }
    },
    
    urls: {
      preload: 'https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec?action=preload',
      cleanup: 'https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec?action=cleanup'
    },
    
    newFeatures: [
      'Edición visual de ubicación arrastrando el marcador',
      'Menú de opciones para cambiar ubicación',
      'Preview en tiempo real de cambios de ubicación',
      'Sistema de limpieza automática inteligente',
      'Múltiples opciones de limpieza (automática, manual, endpoint)',
      'Monitoreo de salud del sistema',
      'Funciones de mantenimiento y backup',
      'Trigger robusto con detección de fallos',
      'Compatibilidad completa iframe/acceso directo'
    ],
    
    troubleshooting: {
      'No se procesan las ubicaciones': 'Ejecutar manualCleanupCheck()',
      'Trigger no funciona': 'Ejecutar setupSystem()',
      'Datos incompletos': 'Usar endpoint de limpieza',
      'Errores en el mapa': 'Verificar conexión HTTPS',
      'Problemas de iframe': 'Revisar política de CORS'
    }
  };
  
  console.log('=== AYUDA DEL SISTEMA ===');
  console.log(JSON.stringify(help, null, 2));
  
  return help;
}
