
/**
 * JavaScript - legendGenerator
 * Funciones para creación y actualización de leyenda
 * TFG - Sandra Torrero Casado
 */
let legendControl;

export function initLegend(map, config) {
  legendControl = L.control({ position: 'bottomright' });

   legendControl.onAdd = function () {
    const container = L.DomUtil.create('div', 'legend leaflet-control');
    container.id = 'legend-container';

    const content = createGradientLegend(config); // Solo contenido interno
    container.appendChild(content);
    return container;
  };

  legendControl.addTo(map);
}

export function updateLegend(config) {
  const container = legendControl?.getContainer();
  if (container) {
    container.innerHTML = '';
    const content = createGradientLegend(config);
    container.appendChild(content);
  }
}

function createGradientLegend({ titleText, breakpoints, getColor, contaminante }) {
  const legendContainer = document.createDocumentFragment();

  // Título
  const title = document.createElement('div');
  title.className = 'legend-title';
  title.innerHTML = `<strong>${titleText}</strong>`;
  legendContainer.appendChild(title);

  const min = breakpoints[0];
  const max = breakpoints[breakpoints.length - 1];

  // Configuración de espaciado
  const minSegmentWidth = 20; // Ancho mínimo por segmento en píxeles
  const maxSegmentWidth = 60; // Ancho máximo por segmento en píxeles
  const numSegments = breakpoints.length - 1;

  // Calcular los anchos proporcionales originales
  const totalRange = max - min;
  const originalWidths = [];
  let totalProportionalWidth = 0;
  
  for (let i = 0; i < numSegments; i++) {
    const segmentRange = breakpoints[i + 1] - breakpoints[i];
    const proportionalWidth = (segmentRange / totalRange) * 200; // Base de 200px
    originalWidths.push(proportionalWidth);
    totalProportionalWidth += proportionalWidth;
  }

  // Ajustar anchos aplicando límites mín/máx
  const adjustedWidths = [];
  let totalAdjustedWidth = 0;
  
  for (let i = 0; i < numSegments; i++) {
    let adjustedWidth = originalWidths[i];
    
    // Aplicar límites
    if (adjustedWidth < minSegmentWidth) {
      adjustedWidth = minSegmentWidth;
    } else if (adjustedWidth > maxSegmentWidth) {
      adjustedWidth = maxSegmentWidth;
    }
    
    adjustedWidths.push(adjustedWidth);
    totalAdjustedWidth += adjustedWidth;
  }

  // El ancho total del canvas será la suma de los anchos ajustados
  const canvasWidth = Math.max(120, Math.min(300, totalAdjustedWidth));

  // Contenedor principal
  const wrapper = document.createElement('div');
  wrapper.className = 'legend-gradient-container';
  wrapper.style.width = "100%"

  // Canvas de gradiente
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = 16;
  canvas.className = 'legend-gradient-canvas';
  canvas.style.width = "100%";
  wrapper.appendChild(canvas);

  // Calcular posiciones acumulativas para ticks y etiquetas
  const positions = [0]; // Posición inicial
  let accumulatedWidth = 0;
  
  for (let i = 0; i < adjustedWidths.length; i++) {
    accumulatedWidth += adjustedWidths[i];
    positions.push(accumulatedWidth);
  }

  // Línea horizontal con marcas (ticks)
  const lineWrapper = document.createElement('div');
  lineWrapper.className = 'legend-line-wrapper';

  const line = document.createElement('div');
  line.className = 'legend-line';
  lineWrapper.appendChild(line);

  // Añadir ticks basados en las posiciones calculadas
  positions.forEach((pos, index) => {
    const percent = (pos / canvasWidth) * 100;

    const tick = document.createElement('div');
    tick.className = 'legend-tick';
    tick.style.left = `${percent}%`;
    lineWrapper.appendChild(tick);
  });

  // Etiquetas min y max
  const minLabel = document.createElement('span');
  minLabel.innerText = min;
  minLabel.className = 'legend-minmax legend-minmax-left';
  lineWrapper.appendChild(minLabel);

  const maxLabel = document.createElement('span');
  maxLabel.innerText = max;
  maxLabel.className = 'legend-minmax legend-minmax-right';
  lineWrapper.appendChild(maxLabel);

  wrapper.appendChild(lineWrapper);

  // Etiquetas intermedias (sin min/max)
  const labels = document.createElement('div');
  labels.className = 'legend-labels';

  for (let i = 1; i < breakpoints.length - 1; i++) {
    const percent = (positions[i] / canvasWidth) * 100;

    const label = document.createElement('span');
    label.className = 'legend-label';
    label.innerText = breakpoints[i];
    label.style.left = `${percent}%`;

    labels.appendChild(label);
  }

  wrapper.appendChild(labels);
  legendContainer.appendChild(wrapper);

  // Pintar gradiente respetando los anchos ajustados
  const ctx = canvas.getContext('2d');
  
  for (let x = 0; x < canvas.width; x++) {
    // Determinar en qué segmento estamos
    let segmentIndex = 0;
    let segmentStartX = 0;
    
    for (let i = 0; i < adjustedWidths.length; i++) {
      const segmentEndX = segmentStartX + (adjustedWidths[i] / canvasWidth) * canvas.width;
      
      if (x >= segmentStartX && x < segmentEndX) {
        segmentIndex = i;
        break;
      }
      
      segmentStartX = segmentEndX;
    }
    
    // Calcular la posición relativa dentro del segmento
    const segmentWidth = (adjustedWidths[segmentIndex] / canvasWidth) * canvas.width;
    const relativeX = x - segmentStartX;
    const relativePos = segmentWidth > 0 ? relativeX / segmentWidth : 0;
    
    // Interpolar el valor dentro del segmento
    const startValue = breakpoints[segmentIndex];
    const endValue = breakpoints[segmentIndex + 1];
    const value = startValue + (endValue - startValue) * relativePos;
    
    let color;
    try {
      color = getColor.length === 2
        ? getColor(value, contaminante)
        : getColor(value);
    } catch (err) {
      console.warn("Error al obtener color para la leyenda:", err);
      color = "#808080";
    }
    ctx.fillStyle = color;
    ctx.fillRect(x, 0, 1, canvas.height);
  }

  return legendContainer;
}