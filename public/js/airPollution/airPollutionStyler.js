//airPollutionStyler.js
import { interpolateColor } from '../utils/helpers.js'
export const concentracionBreakpoints = {
  "Partículas PM 2.5": [0, 10, 20, 25, 50, 75, 800], //um/m3 BOE España - Último valor a mano para leyenda
  "Partículas PM 10": [0, 20, 40, 50, 100, 150, 1200],//um/m3 BOE España - Último valor a mano para leyenda
  "CO": [0, 4.5, 9.5, 12.5, 15.5, 30.5, 40],//ppm airnow.gov EEUU - Último valor a mano para leyenda
  "CO2": [0, 278, 421, 550, 601, 1001, 2000]
};
/*
  Calculo de color del punto según concentracion
*/
export function getColorByConcentracion(value, contaminante) {
  console.log("Contaminante recibido:", contaminante);
  if (value <= concentracionBreakpoints[contaminante][1]) return interpolateColor(value, concentracionBreakpoints[contaminante][0], concentracionBreakpoints[contaminante][1], '#a8e6cf', '#009966');  // Verde
  if (value <= concentracionBreakpoints[contaminante][2]) return interpolateColor(value, concentracionBreakpoints[contaminante][1], concentracionBreakpoints[contaminante][2], '#fff9b0', '#ffde33'); // Amarillo
  if (value <= concentracionBreakpoints[contaminante][3]) return interpolateColor(value, concentracionBreakpoints[contaminante][2], concentracionBreakpoints[contaminante][3], '#ffd699', '#ff9933'); // Naranja
  if (value <= concentracionBreakpoints[contaminante][4]) return interpolateColor(value, concentracionBreakpoints[contaminante][3], concentracionBreakpoints[contaminante][4], '#f8a37f', '#e74c3c'); // Rojo
  if (value <= concentracionBreakpoints[contaminante][5]) return interpolateColor(value, concentracionBreakpoints[contaminante][4], concentracionBreakpoints[contaminante][5], '#d47db3', '#9b59b6'); // Morado
  return interpolateColor(value, concentracionBreakpoints[contaminante][5], value, '#8e44ad', '#6c3483'); // Morado oscuro extendido
}
/*
  Estilo con el que se dibujan los puntos
*/
export function styleFeature(feature) {
    const props = feature.properties;
    const concentracionKey = Object.keys(props).find(k => k.toLowerCase().startsWith('intensidad'));
    const concentracion = concentracionKey ? parseFloat(props[concentracionKey]) : NaN;
    return {
        radius: 6,
        fillColor: getColorByConcentracion(concentracion, ""),
        color: '#333',
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
    };
}
