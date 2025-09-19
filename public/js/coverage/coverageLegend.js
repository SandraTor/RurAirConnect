// coverageLegend.js


import { initLegend, updateLegend } from '../utils/legendGenerator.js';  // O la ruta correspondiente
import { getColorByIntensidad, intensidadBreakpoints } from './coverageStyler.js';

export function initCoverageLegend(map) {
  initLegend(map, {
    titleText: 'Intensidad (dBm)',
    breakpoints: intensidadBreakpoints,
    getColor: getColorByIntensidad
  });
}

export function updateCoverageLegend(map) {
  updateLegend({
    titleText: 'Intensidad (dBm)',
    breakpoints: intensidadBreakpoints,
    getColor: (value) => getColorByIntensidad(value)
  });
}