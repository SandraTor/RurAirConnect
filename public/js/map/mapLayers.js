/**
 * JavaScript - mapLayers
 * Funciones para gestión de capas del mapa
 * TFG - Sandra Torrero Casado
 */
import { getMarkersForGeoJSONLayer } from './geojsonLoader.js';
import { map, oms } from './map.js';
import { clusterGroup } from './clusterConfig.js';
import { updateCoverageLegend } from '../coverage/coverageLegend.js';
import { updateAirPollutionLegend } from '../airPollution/airPollutionLegend.js';
import { formatearNombreCapa } from '../utils/helpers.js'
import { notify } from '../utils/helpers.js';

const geojsonLayers = {}; // Guardar las capas por nombre
let validFiles = [];
let layerControlContainer = null;

//Carga de frontera CyL desde WFS de IDECyL
export function cargarFronteraCYL(map){
  fetch('https://idecyl.jcyl.es/geoserver/limites/ows?service=WFS&version=1.0.0&request=GetFeature' +
        '&typeName=limites:limites_cyl_autonomia' +
        '&outputFormat=application/json' +
        '&CQL_FILTER=n_auton=%27Castilla y León%27' + //filtro de servidor
        '&srsName=EPSG:4326')
    .then(res => res.json())
    .then(data => {
      const layer = L.geoJSON(data, {
        style: {
          color: '#FF6600',
          weight: 1,
          opacity: 1,
          fill: false
        }
      }).addTo(map);

      return layer;
    });
}

// --- Helpers ---
// Elimina los puntos de una capa en concreto
function removeLayerMarkers(code) {
  const markers = geojsonLayers[code];
  if (!markers) return;
  clusterGroup.removeLayers(markers);
  markers.forEach(m => oms.removeMarker(m));
  delete geojsonLayers[code];
}

// Elimina todos los puntos del mapa
function removeAllLayerMarkers() {
  Object.keys(geojsonLayers)
    .forEach(removeLayerMarkers);
}

// Deselecciona todos los checkboxes de la Interfaz de Usuario (UI)
function clearCheckboxes() {
  const checkboxes = document.getElementById('checkboxesContainer');
  if (checkboxes) checkboxes.remove();
}

// --- UI: Genera la lista checkbox para las capas ---
// Actualiza la lista de capa con los checkboxes
export function updateLayerList(layersData, category) {
  validFiles = layersData;
  clearCheckboxes();
  const container = document.createElement('div');
  container.id = 'checkboxesContainer';

  const useRadio = (category === 'contaminación aérea');

  layersData.forEach((layerObj, idx) => {
    const input = document.createElement('input');
    input.type = useRadio ? 'radio' : 'checkbox';
    input.name = useRadio ? 'layer-radio' : undefined;
    input.id = `layer-${layerObj.code}`;
    input.dataset.option = layerObj.code;

    // Listener común
    input.addEventListener('change', changeHandler);

    const label = document.createElement('label');
    label.htmlFor = input.id;

    // Usamos display_name para mostrar al usuario
    label.textContent = layerObj.display_name;

    const row = document.createElement('div');
    row.append(input, label);
    container.append(row);
  });
  layerControlContainer.append(container);
  
  //Comprobamos si ya existe el botón, para eliminarlo y volverlo a crear de manera que siempre esté debajo de los checkboxes dinámicos
  const existingBtn = document.getElementById('refreshLayersBtn');
  if (existingBtn) existingBtn.remove();

  addRefreshLayersButton();
}
 //Comportamiento unificado para radio button y checkboxes
async function changeHandler(e) {
  const code = e.target.dataset.option;
  const isRadio = e.target.type === 'radio';
  const category = document.getElementById('categorySelect').value;

  if (isRadio) {
    // Al cambiar radio: limpiar todo y añadir sólo la nueva
    removeAllLayerMarkers();
    document.querySelectorAll('input[type="radio"]').forEach(r => {
      if (r !== e.target) r.checked = false;
    });
  }

  if (e.target.checked) {
    const params = prepareAPIParams(category, code);
    const requestBody = {
      category: category,
      ...params
    }
    console.log('API Request:', requestBody); // DEBUG: Ver qué se está enviando
    
    try {

      const res = await fetch(`/api/get_geojson.php`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('Response status:', res.status, res.statusText);

      if (!res.ok) {
          const errorText = await res.text();
          console.error('HTTP Error:', errorText);
          notify.dataError();
          e.target.checked = false; // Desmarcar el checkbox/radio
          return;
        }
        
        const responseText = await res.text();
        console.log('Raw response:', responseText.substring(0, 200) + '...');
        
        let data;
        try {
          data = JSON.parse(responseText);
          console.log('Parsed JSON:', data);
        } catch (jsonError) {
          console.error('JSON Parse Error:', jsonError.message);
          console.error('Full response:', responseText);
          showNotification('Error al procesar la respuesta del servidor', 'error');
          e.target.checked = false;
          return;
        }

        // Para el nombre formateado, usamos el display_name del label
        const label = document.querySelector(`label[for="${e.target.id}"]`);
        const displayName = label ? label.textContent : formatearNombreCapa(code);
        
        const result = getMarkersForGeoJSONLayer(data, displayName);
      
        if (result.isEmpty) {
          notify.dataEmpty(displayName);
          e.target.checked = false; // Desmarcar ya que no hay datos
          return;
        }

        // Mostrar información sobre los datos cargados
        if (result.validFeatures < result.totalFeatures) {
          notify.dataPartialyLoaded(result.validFeatures, result.totalFeatures);
        } else {
          notify.dataLoaded(result.markers.length);
        }

        geojsonLayers[code] = result.markers;
        clusterGroup.addLayers(result.markers);
        result.markers.forEach(m => oms.addMarker(m));
        
      } catch (networkError) {
        console.error('Network Error:', networkError);
        notify.connectionError();
        e.target.checked = false;
      }
    } else {
      removeLayerMarkers(code);
    }

  if (category === 'contaminación aérea' && e.target.checked) {
    const selectedRadio = document.querySelector('input[name="layer-radio"]:checked');
    const label = document.querySelector(`label[for="${selectedRadio?.id}"]`);
    const labelText = label?.textContent; //es lo mismo que (label !== null && label !== undefined) ? label.textContent : undefined;
    // Obtener la unidad desde los metadatos cargados (validFiles) usando el código seleccionado
    const pollutantMetadata = validFiles.find(item => item.code === code);
    const unit = pollutantMetadata?.unit;
    console.log("Contaminante recibido:", labelText, "Unidad:", unit);
    updateAirPollutionLegend(map, labelText, unit);
  } else {
    updateCoverageLegend(map);
  }
}

function prepareAPIParams(category, element) {
  const params = {};
  
  if (category === 'contaminación aérea') {
    // Parámetros específicos para contaminación
    params.pollutants = [element]; // Directamente del elemento
    params.provinces = null;             // Futuro: filtro por provincias
    params.date_from = null;             // Futuro: fecha desde
    params.date_to = null;               // Futuro: fecha hasta
    params.min_reliability = 2;          // Valor por defecto
    params.aggregate_by_week = false;    // Futuro: agregación semanal
    params.bbox = null;                  // Futuro: bounding box
    
  } else {
    // Parámetros específicos para señal móvil
    params.operators = [element];  // Directamente del elemento
    params.provinces = null;             // Futuro: filtro por provincias
    params.days_back = null;             
    params.bbox = null;                  // Futuro: bounding box
    params.min_quality = null;           // Futuro: calidad mínima
    params.use_precise_grid = false;     // Futuro: cuadrícula precisa
  }
  
  return params;
}

// --- Fetch & Render Categories ---
// Fetch categories and populate the dropdown
async function fetchCategories() {

  try {
    const res = await fetch('/api/get_metadata_bbdd.php?action=categories');
    const categories = await res.json();
    populateCategoryDropdown(categories);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
  }
}

// Populate category dropdown
function populateCategoryDropdown(categories) {
  
  const sel = document.getElementById('categorySelect');
  sel.innerHTML = '<option value="">Selecciona una categoría</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = formatearNombreCapa(category);
    sel.append(option);
  });

  if (!sel._listenerAdded) {
    sel.addEventListener('change', e => {
      const category = e.target.value;
      clearCheckboxes();
      removeAllLayerMarkers();
      if (category) fetchAvailableLayers(category);
    });
    sel._listenerAdded = true;
  }
}

// --- Fetch layers for one category ---
// Fetch and display layers for the selected category
export async function fetchAvailableLayers(category) {
  if (!category) return;
  try {
    //const res = await fetch(`/api/list_geojson.php?category=${encodeURIComponent(category)}`);
    const res = await fetch(`/api/get_metadata_bbdd.php?category=${category}`);
    const layersData = await res.json();
    // Verificamos que sea un array de objetos con la estructura esperada
    if (Array.isArray(layersData) && layersData.every(item => 
        typeof item === 'object' && 'code' in item && 'display_name' in item)) {
      updateLayerList(layersData, category);
    } else if (Array.isArray(layersData) && layersData.every(item => typeof item === 'string')) {
      // Fallback para compatibilidad con el formato anterior
      console.warn('Recibido formato anterior (array de strings), convirtiendo...');
      const convertedData = layersData.map(code => ({
        code: code,
        display_name: formatearNombreCapa(code)
      }));
      updateLayerList(convertedData, category);
    } else {
      console.error('Expected array of layer objects with code and display_name', layersData);
    }
  } catch (error) {
    console.error('Error fetching or parsing available layers:', error);
  }
}

// --- “Recargar capas” button handler ---
// Refresh layers for the current category
function handleRefreshLayers() {
  // mimic a re‐select of the current category
  const sel = document.getElementById('categorySelect');
  const category = sel.value;
  clearCheckboxes();
  if (category) fetchAvailableLayers(category);
  removeAllLayerMarkers();
  updateCoverageLegend(sel.value, []); //con geojson en directorio
}

// Add refresh button once
// Ensure the refresh button is added to the UI
function addRefreshLayersButton() {
  if (!layerControlContainer || document.getElementById('refreshLayersBtn')) return;
  const btn = document.createElement('button');
  btn.id = 'refreshLayersBtn';
  btn.textContent = 'Recargar capas';
  btn.className = 'refreshLayersBtn';
  btn.style.marginBottom = '8px';
  btn.addEventListener('click', handleRefreshLayers);
  layerControlContainer.append(btn);
}

// --- Init on DOM load ---
// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  layerControlContainer = document.getElementById('layerControl');
  fetchCategories();
  //addRefreshLayersButton();
});
