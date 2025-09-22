/**
 * JavaScript - clusterConfig
 * Trnasformación de datos GeoJSON a marcadores
 * TFG - Sandra Torrero Casado
 */
import { getColorByIntensidad } from "../coverage/coverageStyler.js";
import { getColorByConcentracion } from "../airPollution/airPollutionStyler.js";
import { getMarkerIntensidad, getMarkerConcentracion, getMarkerType  } from "../utils/helpers.js"
// Custom iconCreateFunction for clusters
export const clusterGroup = L.markerClusterGroup({
  iconCreateFunction,
  //personalización de parámetros del cluster.
  maxClusterRadius: 6
});

export function iconCreateFunction(cluster) {
  const markers = cluster.getAllChildMarkers();
  
  // Determinar el tipo de datos predominante en el cluster
  const types = markers.map(getMarkerType);
  const isConcentracion = types.some(type => type === 'concentracion');
  
  let values, avg, color;
  
  if (isConcentracion) {
    // Extraer valores de concentración
    values = markers
      .map(getMarkerConcentracion)
      .filter(val => typeof val === 'number' && !isNaN(val));
    
    avg = values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : 0;
    
    // Obtener el layerName del primer marker que tenga datos de concentración
    const firstConcentracionMarker = markers.find(m => getMarkerType(m) === 'concentracion');
    const layerName = firstConcentracionMarker ? firstConcentracionMarker.options.layerName : '';
    
    color = getColorByConcentracion(avg, layerName);
  } else {
    // Extraer valores de intensidad (comportamiento original)
    values = markers
      .map(getMarkerIntensidad)
      .filter(val => typeof val === 'number' && !isNaN(val));
    
    avg = values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : -130;
    
    color = getColorByIntensidad(avg);
  }

  const count = cluster.getChildCount();
  let size = 'small';
  if (count >= 100) size = 'large';
  else if (count >= 10) size = 'medium';

  return L.divIcon({
    html: `<div style="background:${color};"><span>${count}</span></div>`,
    className: `custom-cluster ${size}`,
    iconSize: L.point(20, 20)
  });
}