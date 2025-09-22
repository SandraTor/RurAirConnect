/**
 * JavaScript - geojsonLoader
 * Trnasformación de datos GeoJSON a marcadores
 * TFG - Sandra Torrero Casado
 */
 import { getColorByIntensidad } from "../coverage/coverageStyler.js";
 import { getColorByConcentracion, concentracionBreakpoints} from "../airPollution/airPollutionStyler.js";
 import { createCircleIcon } from "../utils/helpers.js";
/**
 * Given GeoJSON data, returns an array of L.Marker objects.
 * @param {Object} data - GeoJSON data
 * @param {string} layerName - Name of the layer
 * @returns {Object} - {markers: L.Marker[], isEmpty: boolean, message?: string}
 */
export function getMarkersForGeoJSONLayer(data, layerName) {
  const markers = [];
  // Validación de datos vacíos o inválidos
  if (!data || !data.features) {
    return {
      markers: [],
      isEmpty: true,
      message: "No se recibieron datos válidos del servidor"
    };
  }

  if (!Array.isArray(data.features) || data.features.length === 0) {
    return {
      markers: [],
      isEmpty: true,
      message: `No hay datos disponibles para ${layerName}`
    };
  }

  // Filtrar features válidos (que tengan geometría y coordenadas)
  const validFeatures = data.features.filter(feature => 
    feature.geometry && 
    feature.geometry.coordinates && 
    Array.isArray(feature.geometry.coordinates) &&
    feature.geometry.coordinates.length >= 2
  );

  if (validFeatures.length === 0) {
    return {
      markers: [],
      isEmpty: true,
      message: `Los datos de ${layerName} no contienen ubicaciones válidas`
    };
  }

  const esContaminante = Object.hasOwn(concentracionBreakpoints, layerName);
  console.log("esContaminante y layerName:", esContaminante, layerName);

  L.geoJSON({...data, features: validFeatures},{ //... = operador de propagación (spread operator) clonar un objeto pero cambiar solo una propiedad
    pointToLayer: (feature, latlng) => {
      const props = feature.properties;
      const coords = feature.geometry.coordinates;
      
      let valor, color, tipo;

      if (esContaminante) {
        
        const valueKey = Object.keys(props).find(k => k.includes("avg")        );
        valor = valueKey ? parseFloat(props[valueKey]) : NaN;
        color = getColorByConcentracion(valor, layerName);
        tipo = "Concentración";
        console.log("getColorByConcentracion(valor, layerName);", valor, layerName);
      } else {
        const intensidadKey = Object.keys(props).find(k => k.includes("avg"));
        valor = intensidadKey ? parseFloat(props[intensidadKey]) : NaN;
        color = getColorByIntensidad(valor);
        tipo = "Intensidad";
      }

      const marker = L.marker(latlng, {
        icon: createCircleIcon(color),
        [tipo.toLowerCase()]: valor,
        layerName: layerName
      });

      let unidad = props['pollutant_unit'] || 'dBm';

      let popupHtml = `<strong>Capa:</strong> ${props['operator_name'] || props['pollutant_name'] || 'Desconocido'}`;
      popupHtml += `<br><strong>${tipo}:</strong> ${valor} <strong> </strong> ${unidad}`;
      popupHtml += `<br><strong>Días desde la medición:</strong> ${props['data_age_days']}`;
      popupHtml += `<br><strong>Longitud y Latitud:</strong>${coords}`;
      popupHtml += `<br><strong>Nº de medidas agrupadas:</strong>${props['measurement_count']}`;
      marker.bindPopup(popupHtml);

      markers.push(marker);
      return marker;
    }
  });

  return {
    markers: markers,
    isEmpty: false,
    totalFeatures: data.features.length,
    validFeatures: validFeatures.length
  };
}
