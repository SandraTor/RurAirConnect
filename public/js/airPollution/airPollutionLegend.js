// airPollutionLegend.js
import { initLegend, updateLegend } from '../utils/legendGenerator.js';
import { getColorByConcentracion, concentracionBreakpoints } from './airPollutionStyler.js';

export function initCoverageLegend(map) {
  initLegend(map, {
    titleText: 'Intensidad (dBm)',
    breakpoints: concentracionBreakpoints,
    getColor: getColorByConcentracion(value, "")
  });
}

export function updateAirPollutionLegend(map, contaminante, unit) {
  console.log("Contaminante recibido:", contaminante, "Unidad:", unit);
  updateLegend({
    titleText: unit ? `${contaminante} (${unit})` : contaminante,
    breakpoints: concentracionBreakpoints[contaminante],
    getColor: (value, contaminante) => getColorByConcentracion(value, contaminante),
    contaminante: contaminante
  });
}