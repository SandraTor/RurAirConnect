/**
 * JavaScript - Resultados
 * Maneja la visualización de datos de señal y contaminación
 * TFG - Sandra Torrero Casado
 */

import { showNotification } from './utils/helpers.js';


// Configurar localización española para Chart.js
Chart.defaults.locale = 'es-ES';
luxon.Settings.defaultLocale = 'es';

class RurAirDashboard {
    constructor() {
        this.charts = {};
        this.currentDataType = 'signal';
        this.apiBaseUrl = '/api/resultados.php';
        
        // Mapa de colores para operadores
        this.operatorColors = {
            'Vodafone': '#e60000',     // Rojo característico de Vodafone
            'Orange': '#ff6600',       // Naranja de Orange
            'Yoigo': '#9d4edd',       // Morado de Yoigo
            'O2': '#0066cc',          // Azul de O2
            'Pepephone': '#ff3366',   // Rosa/rojo de Pepephone
            'Digi': '#00cc66',        // Verde de Digi
            'Lowi': '#ffcc00',        // Amarillo de Lowi
            'Movistar': '#0099ff',    // Azul claro de Movistar
            'Otro': '#95a5a6'         // Gris para operadores no identificados
        };
        
        // Mapa de abreviaciones para móvil
        this.operatorAbbreviations = {
            'Vodafone': 'VOD',
            'Orange': 'ORG',
            'Yoigo': 'YOI',
            'O2': 'O2',
            'Pepephone': 'PEPE',
            'Digi': 'DIGI',
            'Lowi': 'LOWI',
            'Movistar': 'MOV',
            'Otro': 'OTRO'
        };
        
        this.init();
    }

    /**
     * Inicializa el dashboard
     */
    async init() {
        try {
            this.setupEventListeners();
            await this.loadCatalogs();
            showNotification('Dashboard cargado correctamente', 'success');
        } catch (error) {
            console.error('Error initializing dashboard:', error);
            showNotification('Error al inicializar el dashboard', 'error');
        }
    }

    /**
     * Configura los event listeners
     */
    setupEventListeners() {
        // Toggle between data types
        document.querySelectorAll('input[name="dataType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentDataType = e.target.value;
                this.toggleFilters();
            });
        });

        // Load data buttons
        const signalBtn = document.getElementById('load-signal-data');
        const pollutionBtn = document.getElementById('load-pollution-data');

        if (signalBtn) {
            signalBtn.addEventListener('click', () => this.loadSignalData());
        }

        if (pollutionBtn) {
            pollutionBtn.addEventListener('click', () => this.loadPollutionData());
        }

        //Agrupación temporal inteligente en función del periodo de analisis
        const periodSelect = document.getElementById('pollution-months');
        const groupingSelect = document.getElementById('time-grouping');
        
        if (periodSelect && groupingSelect) {
            periodSelect.addEventListener('change', () => {
                this.updateTimeGroupingOptions();
            });
            
            // Configurar opciones iniciales
            this.updateTimeGroupingOptions();
        }
    }
    /**
     * Obtiene la configuración de visualización temporal para el eje X del gráfico
     * Esta configuración solo afecta a la presentación de las etiquetas del eje temporal,
     * no modifica los puntos de datos generados por el backend.
     * 
     * @param {number} monthsBack - Número de meses hacia atrás para el período de análisis
     * @param {string} groupBy - Tipo de agrupación temporal: 'day', 'week' o 'month'
     * @returns {Object} Configuración de Chart.js para el eje temporal con propiedades:
     *   - unit: Unidad base del tiempo (day/week/month)
     *   - round: Redondeo de fechas a la unidad especificada
     *   - stepSize: Intervalo entre etiquetas mostradas para evitar saturación visual
     *   - displayFormats: Formatos de fecha según el nivel de zoom automático
     */
    getVisualizationConfig(monthsBack, groupBy) {
        const isMobile = window.innerWidth <= 768;
        const configs = {
            day: {
                timeConfig: {
                    unit: 'day',
                    round: 'day', //Redondear al día más cercano.
                    stepSize: monthsBack <= 1 ? 2 : (monthsBack <= 3 ? 5 : 7), //muestra cada 2 días, cada 5 o cada 7 en función del nº de meses de análisis
                    displayFormats: {
                        day: isMobile ? 'dd-LLL' : 'dd/MM',//Luxon
                        week: isMobile ? 'dd-LLL' : 'dd/MM',
                        month: isMobile ? 'LLL' : 'MMM yyyy'
                    }
                }
            },
            week: {
                timeConfig: {
                    unit: 'week',
                    round: 'week', 
                    stepSize: monthsBack <= 3 ? 1 : 2,
                    displayFormats: {
                        week: 'dd/MM',
                        month: 'LLL' //Luxon
                    }
                }
            },
            month: {
                timeConfig: {
                    unit: 'month',
                    round: 'month',
                    stepSize: 1,
                    displayFormats: {
                        month: 'LLL yyyy',
                        year: 'yyyy'
                    }
                }
            }
        };
        
        return configs[groupBy] || configs.day;
    }
    /**
     * Actualiza las opciones de agrupación temporal según el período seleccionado
     */
    updateTimeGroupingOptions() {
        const periodSelect = document.getElementById('pollution-months');
        const groupingSelect = document.getElementById('time-grouping');
        
        if (!periodSelect || !groupingSelect) return;
        
        const selectedMonths = parseInt(periodSelect.value);
        const currentGrouping = groupingSelect.value;
        
        // Configuraciones recomendadas según el período
        const groupingConfig = {
            1: {
                recommended: 'day',
                available: ['day'],
                disabled: ['week', 'month'],
                message: 'Para 1 mes se recomienda agrupación diaria'
            },
            3: {
                recommended: 'day',
                available: ['day', 'week'],
                disabled: ['month'],
                message: 'Para 3 meses se recomienda agrupación diaria o semanal'
            },
            6: {
                recommended: 'week',
                available: ['week', 'month'],
                disabled: ['day'],
                message: 'Para 6 meses se recomienda agrupación semanal'
            },
            12: {
                recommended: 'month',
                available: ['week', 'month'],
                disabled: ['day'],
                message: 'Para 1 año se recomienda agrupación mensual para mejor visualización'
            }
        };
        
        const config = groupingConfig[selectedMonths];
        
        if (!config) return;
        
        // Actualizar opciones del select
        const options = groupingSelect.querySelectorAll('option');
        options.forEach(option => {
            const value = option.value;
            
            if (config.disabled.includes(value)) {
                option.disabled = true;
                option.style.color = '#999';
                option.textContent = option.textContent.replace(' (recomendado)', '').replace(' (óptimo para datos extensos)', '') + ' (no recomendado)';
            } else {
                option.disabled = false;
                option.style.color = '';
                
                // Limpiar texto previo y agregar indicadores
                let baseText = option.textContent.replace(/ \(.*\)/, '');
                
                if (value === config.recommended) {
                    option.textContent = baseText + ' (recomendado)';
                } else if (selectedMonths === 12 && value === 'month') {
                    option.textContent = baseText + ' (óptimo para datos extensos)';
                } else {
                    option.textContent = baseText;
                }
            }
        });
        
        // Auto-seleccionar la opción recomendada si la actual está deshabilitada
        if (config.disabled.includes(currentGrouping)) {
            groupingSelect.value = config.recommended;
            
            // Mostrar notificación explicativa
            showNotification(config.message, 'info', 4000);
        }
    }
    /**
     * Alterna entre filtros de señal y contaminación
     */
    toggleFilters() {
        const signalFilters = document.getElementById('signal-filters');
        const pollutionFilters = document.getElementById('pollution-filters');

        if (this.currentDataType === 'signal') {
            signalFilters?.classList.add('active');
            pollutionFilters?.classList.remove('active');
        } else {
            signalFilters?.classList.remove('active');
            pollutionFilters?.classList.add('active');
        }

        // Hide charts when switching
        document.getElementById('charts-section')?.classList.remove('active');
    }

    /**
     * Carga los catálogos de tipos de señal y contaminantes
     */
    async loadCatalogs() {
        try {
            // Load signal types
            const signalResponse = await fetch(`/api/get_metadata_bbdd.php?action=categories`);
            const signalSelect = document.getElementById('signal-type');
            
            if (signalSelect) {
                signalSelect.innerHTML = '<option value="">Seleccione un tipo...</option>';
                
                const signalData = await signalResponse.json();

                if (Array.isArray(signalData)) {
                const filteredSignals = signalData.filter(type => type !== 'contaminación aérea');

                filteredSignals.forEach(type => {
                    signalSelect.innerHTML += `<option value="${type}">${type.toUpperCase()}</option>`;
                });
            }
            }

            // Load pollutant types
            const pollutantResponse = await fetch(`/api/get_metadata_bbdd.php?category=contaminación aérea`);
            const pollutantSelect = document.getElementById('pollutant-type');
            
            if (pollutantSelect) {
                pollutantSelect.innerHTML = '<option value="">Seleccione un contaminante...</option>';
                
                const pollutantData = await pollutantResponse.json();

                if (Array.isArray(pollutantData)) {
                    pollutantData.forEach(type => {
                        pollutantSelect.innerHTML += `<option value="${type.code}">${type.display_name} (${type.unit})</option>`;
                    });
                }
            }

        } catch (error) {
            console.error('Error loading catalogs:', error);
            showNotification('Error cargando los catálogos de datos', 'error');
        }
    }

    /**
     * Carga y visualiza datos de señal
     */
    async loadSignalData() {
        const signalType = document.getElementById('signal-type')?.value;
        const daysBack = document.getElementById('signal-days')?.value;

        if (!signalType) {
            showNotification('Por favor selecciona un tipo de señal', 'warning');
            return;
        }

        const button = document.getElementById('load-signal-data');
        this.setLoadingState(button, true, 'Cargando datos...');

        try {
            const params = {
                action: 'get_signal_charts',
                signal_type: signalType,
                ...(daysBack && { days_back: daysBack })
            };

            const response = await this.fetchAPI(null, params);

            if (response.success) {
                this.renderSignalChart(response.data);
                showNotification('Datos de señal cargados correctamente', 'success');
            } else {
                this.showError(response.message || 'Error cargando datos de señal');
            }

        } catch (error) {
            console.error('Error loading signal data:', error);
            this.showError('Error de conexión al cargar datos de señal');
        } finally {
            this.setLoadingState(button, false, '📊 Cargar Datos de Señal');
        }
    }

    /**
     * Carga y visualiza datos de contaminación
     */
    async loadPollutionData() {
        const pollutantCode = document.getElementById('pollutant-type')?.value;
        const monthsBack = document.getElementById('pollution-months')?.value;
        const timeGrouping = document.getElementById('time-grouping')?.value;

        if (!pollutantCode) {
            showNotification('Por favor selecciona un contaminante', 'warning');
            return;
        }

        const button = document.getElementById('load-pollution-data');
        this.setLoadingState(button, true, 'Cargando datos...');

        try {
            const params = {
                action: 'get_pollution_charts',
                pollutant_code: pollutantCode,
                months_back: monthsBack,
                group_by: timeGrouping
            };

            const response = await this.fetchAPI(null, params);

            if (response.success) {
                this.renderPollutionChart(response.data);
                showNotification('Datos de contaminación cargados correctamente', 'success');
            } else {
                this.showError(response.message || 'Error cargando datos de contaminación');
            }

        } catch (error) {
            console.error('Error loading pollution data:', error);
            this.showError('Error de conexión al cargar datos de contaminación');
        } finally {
            this.setLoadingState(button, false, '🌿 Cargar Datos de Contaminación');
        }
    }

    /**
     * Renderiza gráficos de señal
     */
    renderSignalChart(chartData) {
        const container = document.getElementById('charts-container');
        const chartsSection = document.getElementById('charts-section');
        
        if (!container || !chartsSection) return;

        // Clear previous charts
        this.destroyCharts();
        container.innerHTML = '';

        // Filtrar datos "Sin provincia"
        const filteredData = chartData.data.filter(item => 
            item.provincia && item.provincia.toLowerCase() !== 'sin provincia'
        );

        // Group data by province
        const provinceData = {};
        filteredData.forEach(item => {
            if (!provinceData[item.provincia]) {
                provinceData[item.provincia] = [];
            }
            provinceData[item.provincia].push(item);
        });

        // Calcular provincias únicas después del filtrado
        const provincesCount = Object.keys(provinceData).length;

        // Create summary stats
        const summary = chartData.data_summary;
        container.innerHTML = `
            <div class="stats-summary">
                <div class="stat-card">
                    <span class="stat-value">${summary.total_measurements}</span>
                    <div class="stat-label">Mediciones</div>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${summary.avg_signal_strength} dBm</span>
                    <div class="stat-label">Señal Promedio</div>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${provincesCount}</span>
                    <div class="stat-label">Provincias</div>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${summary.operators_covered}</span>
                    <div class="stat-label">Operadores</div>
                </div>
            </div>
        `;

        // Verificar si hay datos después del filtrado
        if (Object.keys(provinceData).length === 0) {
            this.showError('No hay datos disponibles para mostrar (solo se encontraron datos sin provincia)');
            return;
        }

        // Create chart for each province
        Object.keys(provinceData).forEach(provincia => {
            const chartContainer = document.createElement('div');
            chartContainer.className = 'chart-container';
            const chartId = `chart-${provincia.replace(/\s+/g, '-').toLowerCase()}`;
            chartContainer.innerHTML = `
                <h3 class="chart-title">📡 ${chartData.signal_type} - ${provincia}</h3>
                <canvas id="${chartId}" class="chart-canvas"></canvas>
            `;
            container.appendChild(chartContainer);

            this.createSignalBarChart(chartId, provinceData[provincia], provincia);
        });

        chartsSection.classList.add('active');
    }

    /**
     * Renderiza gráficos de contaminación
     */
    renderPollutionChart(chartData) {
        const container = document.getElementById('charts-container');
        const chartsSection = document.getElementById('charts-section');
        
        if (!container || !chartsSection) return;

        // Clear previous charts
        this.destroyCharts();
        container.innerHTML = '';

        // Filtrar datos "Sin provincia"
        const filteredData = chartData.data.filter(item => 
            item.provincia && item.provincia.toLowerCase() !== 'sin provincia'
        );

        // Group data by province
        const provinceData = {};
        filteredData.forEach(item => {
            if (!provinceData[item.provincia]) {
                provinceData[item.provincia] = [];
            }
            provinceData[item.provincia].push(item);
        });

        // Calcular provincias únicas después del filtrado
        const provincesCount = Object.keys(provinceData).length;

        // Create summary stats
        const summary = chartData.data_summary;
        const unit = summary.pollutant_unit || '';
        const fromDate = new Date(summary.date_range.from).toLocaleDateString('es-ES');
        const toDate = new Date(summary.date_range.to).toLocaleDateString('es-ES');

        container.innerHTML = `
            <div class="stats-summary">
                <div class="stat-card">
                    <span class="stat-value">${summary.total_measurements}</span>
                    <div class="stat-label">Mediciones</div>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${summary.avg_concentration} ${unit}</span>
                    <div class="stat-label">Concentración Media</div>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${provincesCount}</span>
                    <div class="stat-label">Provincias</div>
                </div>
                <div class="stat-card">
                    <span class="stat-value">${fromDate} - ${toDate}</span>
                    <div class="stat-label">Período</div>
                </div>
            </div>
        `;

        // Obtener nombre del contaminante desde el dropdown seleccionado
        const pollutantSelect = document.getElementById('pollutant-type');
        const selectedOption = pollutantSelect.options[pollutantSelect.selectedIndex];
        const pollutantDisplayName = selectedOption.text;
        
        // Create main chart container con clase específica para gráficos de líneas
        const chartContainer = document.createElement('div');
        chartContainer.className = 'chart-container line-chart'; // ← NUEVA CLASE
        chartContainer.innerHTML = `
            <h3 class="chart-title">🌿 ${pollutantDisplayName} - Evolución Temporal</h3>
            <canvas id="pollution-chart" class="chart-canvas"></canvas>
        `;
        container.appendChild(chartContainer);

        this.createPollutionLineChart('pollution-chart', chartData);
        chartsSection.classList.add('active');
    }

    /**
     * Detecta si es vista móvil
     */
    isMobileView() {
        return window.innerWidth <= 768;
    }

    /**
     * Crea un gráfico de barras para datos de señal
     */
    createSignalBarChart(canvasId, data, provincia) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const isMobile = this.isMobileView();
        
        // Usar abreviaciones en móvil o cuando hay muchos operadores (>6), nombres completos en escritorio
        const labels = data.map(item => {
        const operatorName = item.operator_name;
        return (data.length > 6 || isMobile) ? 
            (this.operatorAbbreviations[operatorName] || operatorName) : 
            operatorName;
        });
        
        const values = data.map(item => item.avg_signal_strength);
        
        // Asignar colores basados en el operador
        const colors = data.map(item => {
            const operatorName = item.operator_name;
            return this.operatorColors[operatorName] || this.operatorColors['Otro'];
        });

        this.charts[canvasId] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Intensidad de Señal (dBm)',
                    data: values,
                    backgroundColor: colors,
                    borderColor: colors.map(color => color + 'DD'),
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        bottom: 25
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: '#3498db',
                        borderWidth: 1,
                        callbacks: {
                            title: function(context) {
                                // Obtener el nombre completo del operador desde el dataset
                                const dataIndex = context[0].dataIndex;
                                const fullOperatorName = data[dataIndex].operator_name;
                                return fullOperatorName;
                            },
                            label: function(context) {
                                const dataPoint = data[context.dataIndex];
                                return [
                                    `Intensidad: ${context.parsed.y} dBm`,
                                    `Calidad: ${dataPoint.quality_level}`,
                                    `Mediciones: ${dataPoint.measurement_count}`,
                                    `Fiabilidad: ${dataPoint.reliability}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        min: Math.min(...values) - 5,
                        max: Math.max(...values) + 5,
                        title: {
                            display: true,
                            text:'Intensidad de Señal (dBm)',
                            font: {
                                weight: 'bold',
                                size: isMobile ? 12 : 16
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            font: {
                                size: isMobile ? 10 : 14
                            }
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Operadores',
                            font: {
                                weight: 'bold',
                                size: isMobile ? 12 : 16
                            }
                        },
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45, // 45° tanto en móvil como escritorio
                            minRotation: 0,
                            autoSkip: false,
                            font: {
                                size: isMobile ? 10 : 14
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    /**
     * Crea un gráfico de líneas para datos de contaminación
     */
    createPollutionLineChart(canvasId, chartData) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const isMobile = this.isMobileView();
        
        // Filtrar datos "Sin provincia"
        const filteredData = chartData.data.filter(item => 
            item.provincia && item.provincia.toLowerCase() !== 'sin provincia'
        );
        
        if (filteredData.length === 0) {
            this.showError('No hay datos disponibles para mostrar (solo se encontraron datos sin provincia)');
            return;
        }
        
        // Group data by province
        const provinceData = {};
        filteredData.forEach(item => {
            if (!provinceData[item.provincia]) {
                provinceData[item.provincia] = {
                    dates: [],
                    values: []
                };
            }
            provinceData[item.provincia].dates.push(item.fecha);
            provinceData[item.provincia].values.push(item.avg_concentration);
        });

        const colors = ['#3498db', '#27ae60', '#e67e22', '#e74c3c', '#9b59b6', '#f1c40f', '#34495e', '#95a5a6', '#e91e63'];
        
        // Detectar si solo hay una fecha
        const allDates = filteredData.map(item => new Date(item.fecha).toDateString());
        const uniqueDates = [...new Set(allDates)];
        const singleDate = uniqueDates.length === 1;

        // Obtener configuración de visualización actual
        const monthsBack = parseInt(document.getElementById('pollution-months')?.value || 3);
        const groupBy = document.getElementById('time-grouping')?.value || 'day';
        const visualConfig = this.getVisualizationConfig(monthsBack, groupBy);
        
        const provincesCount = Object.keys(provinceData).length;
        
        // Estrategia adaptativa para la leyenda según número de provincias
        let legendConfig;
        
        if (provincesCount <= 3) {
            // Pocas provincias: leyenda arriba
            legendConfig = {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    boxWidth: isMobile ? 10 : 15,
                    padding: isMobile ? 12 : 15,
                    font: {
                        weight: 'bold',
                        size: isMobile ? 12 : 14
                    }
                }
            };
        } else if (provincesCount <= 6) {
            // Medio: leyenda lateral en escritorio, arriba compacta en móvil
            legendConfig = {
                position: isMobile ? 'top' : 'right',
                labels: {
                    usePointStyle: true,
                    boxWidth: isMobile ? 8 : 12,
                    padding: isMobile ? 8 : 10,
                    font: {
                        weight: 'bold',
                        size: isMobile ? 10 : 12
                    },
                    generateLabels: function(chart) {
                        const labels = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                        // Truncar nombres largos en móvil
                        if (isMobile) {
                            labels.forEach(label => {
                                if (label.text.length > 10) {
                                    label.text = label.text.substring(0, 8) + '...';
                                }
                            });
                        }
                        return labels;
                    }
                }
            };
        } else {
            // Muchas provincias: leyenda externa o colapsada
            legendConfig = {
                display: false // Ocultamos la leyenda y la crearemos externamente
            };
        }

        // Create datasets for each province
        const datasets = Object.keys(provinceData).map((provincia, index) => {
            const dataPoints = provinceData[provincia].dates.map((date, i) => ({
                x: new Date(date),
                y: provinceData[provincia].values[i]
            }));
            
            return {
                label: provincia,
                data: dataPoints,
                borderColor: colors[index % colors.length],
                backgroundColor: colors[index % colors.length] + '20',
                borderWidth: singleDate ? 0 : 3,
                fill: false,
                tension: singleDate ? 0 : 0.4,
                pointRadius: singleDate ? 8 : (groupBy === 'month' ? 6 : 4),
                pointHoverRadius: singleDate ? 10 : (groupBy === 'month' ? 8 : 6),
                pointBackgroundColor: colors[index % colors.length],
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                showLine: !singleDate
            };
        });

        // Ajustar padding dinámicamente según la leyenda
        const layoutPadding = {
            bottom: isMobile ? 15 : 25
        };
        
        if (legendConfig.position === 'right' && !isMobile) {
            layoutPadding.right = 120; // Espacio para leyenda lateral
        } else if (provincesCount > 6) {
            layoutPadding.top = 0; // Sin leyenda interna, más espacio para gráfico
            layoutPadding.bottom = 50; // Espacio para leyenda externa
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false, // IMPORTANTE: permite que el gráfico use todo el espacio
                layout: {
                    padding: layoutPadding
                },
                plugins: {
                    legend: legendConfig,
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: '#3498db',
                        borderWidth: 1,
                        titleFont: {
                            size: isMobile ? 12 : 14
                        },
                        bodyFont: {
                            size: isMobile ? 11 : 13
                        },
                        // MEJORA 3: Tooltip mejorado para muchas provincias
                        filter: function(tooltipItem) {
                            // En móvil con muchas provincias, mostrar solo valores significativos
                            if (isMobile && provincesCount > 6) {
                                return tooltipItem.parsed.y > 0;
                            }
                            return true;
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            ...visualConfig.timeConfig,
                            displayFormats: singleDate ? 
                                { hour: 'HH:mm' } : 
                                visualConfig.timeConfig.displayFormats
                        },
                        adapters: {
                            date: luxon
                        },
                        title: {
                            display: true,
                            text: singleDate ? 'Hora' : 'Fecha',
                            font: {
                                weight: 'bold',
                                size: isMobile ? 12 : 14
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            maxRotation: isMobile ? 45 : 30,
                            minRotation: 0,
                            maxTicksLimit: groupBy === 'month' ? 12 : (isMobile ? 6 : 12),
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: `Concentración (${chartData.data_summary.pollutant_unit || ''})`,
                            font: {
                                weight: 'bold',
                                size: isMobile ? 12 : 14
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            maxTicksLimit: isMobile ? 6 : 10,
                            precision: 2,
                            font: {
                                size: isMobile ? 10 : 12
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                animation: {
                    duration: 1500,
                    easing: 'easeOutQuart'
                },
                elements: {
                    point: {
                        hoverRadius: singleDate ? 12 : 6
                    }
                }
            }
        });

        //Crear leyenda externa para muchas provincias
        if (provincesCount > 6) {
            this.createExternalLegend(canvasId, datasets, colors);
        }
    }

    // Crear leyenda externa personalizada
    createExternalLegend(canvasId, datasets, colors) {
        const canvas = document.getElementById(canvasId);
        const container = canvas.closest('.chart-container');
        
        // Crear contenedor de leyenda externa
        let legendContainer = container.querySelector('.external-legend');
        if (!legendContainer) {
            legendContainer = document.createElement('div');
            legendContainer.className = 'external-legend';
            container.appendChild(legendContainer);
        }
        
        const isMobile = this.isMobileView();
        
        // Crear elementos de leyenda
        const legendHTML = datasets.map((dataset, index) => {
            const color = colors[index % colors.length];
            const shortName = isMobile && dataset.label.length > 8 ? 
                dataset.label.substring(0, 6) + '...' : dataset.label;
                
            return `
                <div class="legend-item" data-dataset-index="${index}">
                    <div class="legend-color" style="background-color: ${color}"></div>
                    <span class="legend-text" title="${dataset.label}">${shortName}</span>
                </div>
            `;
        }).join('');
        
        legendContainer.innerHTML = `
            <div class="legend-header">Provincias:</div>
            <div class="legend-items">${legendHTML}</div>
        `;
        
        // Agregar funcionalidad de toggle
        legendContainer.querySelectorAll('.legend-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const datasetIndex = parseInt(e.currentTarget.dataset.datasetIndex);
                const chart = this.charts[canvasId];
                const isVisible = chart.isDatasetVisible(datasetIndex);
                
                chart.setDatasetVisibility(datasetIndex, !isVisible);
                chart.update();
                
                // Actualizar estilo visual
                e.currentTarget.classList.toggle('legend-disabled', isVisible);
            });
        });
    }
    /**
     * Destruye todos los gráficos activos
     */
    destroyCharts() {
        Object.keys(this.charts).forEach(key => {
            if (this.charts[key]) {
                this.charts[key].destroy();
                delete this.charts[key];
            }
        });
    }

    /**
     * Realiza peticiones a la API
     */
    async fetchAPI(action, params = {}) {
        try {
            const url = new URL(this.apiBaseUrl, window.location.origin);
            
            if (action) {
                url.searchParams.set('action', action);
            }
            
            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
                    url.searchParams.set(key, params[key]);
                }
            });

            const response = await fetch(url.toString());
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Fetch API error:', error);
            throw error;
        }
    }

    /**
     * Establece el estado de carga de un botón
     */
    setLoadingState(button, loading, text) {
        if (!button) return;
        
        button.disabled = loading;
        button.textContent = loading ? '⏳ ' + text : text;
    }

    /**
     * Muestra un mensaje de error
     */
    showError(message) {
        const container = document.getElementById('charts-container');
        const chartsSection = document.getElementById('charts-section');
        
        if (container && chartsSection) {
            container.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
            chartsSection.classList.add('active');
        }
        
        showNotification(message, 'error');
    }
}    

// Inicializar el dashboard cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Verificar que estamos en la página correcta
    if (document.querySelector('.dashboard-main')) {
        new RurAirDashboard();
    }
});

// Export for potential use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RurAirDashboard;
}
