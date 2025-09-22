/**
 * JavaScript - map
 * Inicialización del mapa, botón para ocultar capas
 * TFG - Sandra Torrero Casado
 */
import { initCoverageLegend } from '../coverage/coverageLegend.js';
import { clusterGroup } from './clusterConfig.js';
import { cargarFronteraCYL } from './mapLayers.js'

export const map = L.map('map', {
  center: [41.5, -4.70], // Centro aproximado de Castilla y León
  zoom: 7
});

// Límites ampliados de Castilla y León, para que ninguna provincia quede fuera
const castillayLeonBounds = [
  [39.85, -7.2],   // Extremo suroeste
  [43.25, -1.3]     // Extremo noreste
];
let vistaInicialAjustada = false;
function ajustarVista() {
  const mapContainer = document.getElementById('map');

  if (!vistaInicialAjustada) {
    map.invalidateSize(); //Fuerza a recalcular tamaño real contenedor mapa antes de centrar
    
    const alto = mapContainer.clientHeight;
    const ancho = mapContainer.clientWidth;

    map.fitBounds(castillayLeonBounds, {
      paddingTopLeft: [ancho * 0.05, alto * 0.05],
      paddingBottomRight: [ancho * 0.05, alto * 0.05],
      maxZoom: 30
    });
    vistaInicialAjustada = true;
  }
}

// Botón flotante personalizado para mostrar/ocultar capas
const LayerToggleControl = L.Control.extend({
  options: { position: 'topleft' },

  onAdd: function (map) {
    const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');

    const button = L.DomUtil.create('a', '', container);
    button.innerHTML = '🗂️';
    button.href = '#';
    button.title = 'Mostrar/ocultar capas';

    // Estilo extra para que parezca un botón de mapa
    button.style.textAlign = 'center';
    button.style.fontSize = '18px';
    button.style.lineHeight = '26px';

    // Evitar que el click haga zoom al mapa
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(button, 'click', function (e) {
      L.DomEvent.preventDefault(e);
      const lc = document.getElementById('layerControl');
      if (lc) {
        lc.style.display = (lc.style.display === 'none' ? 'block' : 'none');
      }
    });

    return container;
  }
});

// Añadir control al mapa
map.addControl(new LayerToggleControl());

// Empujamos un poco hacia abajo el botón para que quede debajo del zoom
document.querySelector('.leaflet-top.leaflet-left')
  .appendChild(document.querySelector('.leaflet-control:last-child'));


//Centramos zoom y dibujamos frontera de Castilla y León cuando el mapa está listo.
//Observer para que se reajuste cuando cambie las dimensiones del contenedor del mapa.
map.whenReady(() => {
 
  ajustarVista(); //Ajusta mapa en la carga inicial

  const mapContainer = document.getElementById('map');
  cargarFronteraCYL(map);
  const resizeObserver = new ResizeObserver(() => {
    vistaInicialAjustada=false; //Al detectar movimiento reencuadramos
    ajustarVista();//Ajusta mapa al detectar cambios en dimensiones ventana
  });
  resizeObserver.observe(mapContainer);

});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  //maxZoom: 19
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);


map.addLayer(clusterGroup);

window.map = map;
window.layers = {};
initCoverageLegend(map); // Inicializa directamente con valores de cobertura

// OMS constructor detection
let OMSConstructor = null;
if (typeof window.OverlappingMarkerSpiderfier === 'function') {
  OMSConstructor = window.OverlappingMarkerSpiderfier;
} else if (
  typeof window.OverlappingMarkerSpiderfier === 'object' &&
  typeof window.OverlappingMarkerSpiderfier.OverlappingMarkerSpiderfier === 'function'
) {
  OMSConstructor = window.OverlappingMarkerSpiderfier.OverlappingMarkerSpiderfier;
} else {
  throw new Error('OverlappingMarkerSpiderfier is not available as a constructor.');
}
export const oms = new OMSConstructor(map);