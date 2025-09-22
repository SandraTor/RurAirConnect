
/**
 * JavaScript - helpers
 * Funciones auxiliares
 * TFG - Sandra Torrero Casado
 */
// Extraer intensidad del marcador
export function getMarkerIntensidad(marker) {
  if (marker.options && typeof marker.options.intensidad !== 'undefined') {
    return marker.options.intensidad;
  }
  if (marker.feature && marker.feature.properties && typeof marker.feature.properties.Intensidad !== 'undefined') {
    return parseFloat(marker.feature.properties.Intensidad);
  }
  return null;
}

// Función para extraer concentración
export function getMarkerConcentracion(marker) {
  if (marker.options && typeof marker.options.concentración !== 'undefined') {
    return marker.options.concentración;
  }
  return null;
}

// Función para determinar el tipo de datos del marker
export function getMarkerType(marker) {
  if (marker.options) {
    if (typeof marker.options.concentración !== 'undefined') {
      return 'concentracion';
    }
    if (typeof marker.options.intensidad !== 'undefined') {
      return 'intensidad';
    }
  }
  return 'intensidad'; // default fallback
}


/*
  Gradiente de color para reflejar cambios en la misma franja de intensidad.
*/
export function interpolateColor(value, min, max, colorMin, colorMax) {
  const ratio = (value - min) / (max - min);
  const hex = (color) => color.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16));
  const [r1, g1, b1] = hex(colorMin);
  const [r2, g2, b2] = hex(colorMax);
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  return `rgb(${r},${g},${b})`;
}

/**
 * Creates a custom circular div icon for Leaflet markers.
 * @param {string} color - The fill color for the circle.
 * @returns {L.DivIcon} - A Leaflet div icon representing a colored circle.
 */
export function createCircleIcon(color) {
  return L.divIcon({
    className: 'custom-circle-marker',
    html: `<span style="
      display: block;
      width: 16px;
      height: 16px;
      background: ${color};
      border: 2px solid #333;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      "></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8]
  });
}

export function formatearNombreCapa(filename) {
  // Quitar la extensión .geojson
  let nombre = filename.replace(/\.geojson$/i, '');

  // Caso especial: PM_25 → PM 2.5
  if (nombre === "Concentración_PM_25") return "Concentración PM 2.5";

  // Reemplazar todos los guiones bajos por espacios
  nombre = nombre.replace(/_/g, ' ');

  return nombre;
}
/**
 * Sistema de notificaciones reutilizable
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duración en ms (default: 4000)
 * @param {boolean} allowMultiple - Permitir múltiples notificaciones (default: false)
 */
export function showNotification(message, type = 'info', duration = 4000, allowMultiple = false) {
  // Remover notificación anterior si no se permiten múltiples
  if (!allowMultiple) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
  }

  const notification = document.createElement('div');
  notification.className = `notification notification--${type}`;
  notification.textContent = message;
  
  // Añadir botón de cierre opcional
  const closeBtn = document.createElement('span');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    position: absolute;
    top: 4px;
    right: 8px;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    opacity: 0.7;
  `;
  closeBtn.addEventListener('click', () => removeNotification(notification));
  notification.appendChild(closeBtn);
  document.body.appendChild(notification);

  // Auto-remove después de la duración especificada
  const timeoutId = setTimeout(() => {
    removeNotification(notification);
  }, duration);

  // Guardar el timeoutId para poder cancelarlo si se cierra manualmente
  notification._timeoutId = timeoutId;

  return notification;
}

/**
 * Remueve una notificación con animación
 * @param {HTMLElement} notification 
 */
function removeNotification(notification) {
  if (!notification.parentNode) return;
  
  // Cancelar timeout si existe
  if (notification._timeoutId) {
    clearTimeout(notification._timeoutId);
  }
  
  notification.classList.add('notification--slide-out');
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 300);
}

/**
 * Notificaciones específicas para casos comunes
 */
export const notify = {
  success: (message, duration) => showNotification(message, 'success', duration),
  error: (message, duration) => showNotification(message, 'error', duration),
  warning: (message, duration) => showNotification(message, 'warning', duration),
  info: (message, duration) => showNotification(message, 'info', duration),
  
  // Notificaciones específicas
  dataLoaded: (count) => showNotification(`Se cargaron ${count} puntos`, 'success', 3000),
  dataPartialyLoaded: (count, total) => showNotification(`Se cargaron ${count} puntos de ${total}`, 'warning', 3000),
  dataEmpty: (layerName) => showNotification(`No hay datos disponibles para ${layerName}`, 'warning', 5000),
  dataError: () => showNotification('Error al cargar los datos del servidor', 'error', 6000),
  connectionError: () => showNotification('Error de conexión al servidor', 'error', 6000)
};