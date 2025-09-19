//participa.js

/**
 * JavaScript - Participa
 * Carga en el iframe el códgio de Google Apps Scripts que redirecciona al formulario
 * TFG - Sandra Torrero Casado
 */
 
// Función para ocultar el loading cuando el iframe carga
function hideLoading() {
    const loading = document.getElementById('loadingSpinner');
    if (loading) {
        loading.style.display = 'none';
    }
}

// Función para mostrar error si el iframe no carga
function showError() {
    const loading = document.getElementById('loadingSpinner');
    if (loading) {
        loading.innerHTML = '<span style="color: #d32f2f;">Error al cargar el formulario. <a href="#" onclick="reloadForm()">Reintentar</a></span>';
    }
}

// Función para recargar el formulario
function reloadForm() {
    const iframe = document.getElementById('googleForm');
    iframe.src = iframe.src;
    document.getElementById('loadingSpinner').style.display = 'flex';
    document.getElementById('loadingSpinner').innerHTML = '<div class="spinner"></div><span>Cargando formulario...</span>';
}

// Ajustar altura dinámicamente en móviles
function adjustHeight() {
    if (window.innerWidth <= 480) {
        const wrapper = document.getElementById('formWrapper');
        wrapper.style.height = (window.innerHeight * 0.6) + 'px';
    }
}

// Función para obtener ubicación y pasarla a Google Apps Script
function obtenerUbicacionYEnviar() {
    console.log('Iniciando obtención de ubicación...');
    
    if (!navigator.geolocation) {
        console.error('❌ Geolocalización no soportada');
        enviarErrorAlIframe('Geolocalización no soportada en este navegador');
        return;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 15000, // 15 segundos
        maximumAge: 300000 // 5 minutos cache
    };
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            console.log('📍 Ubicación obtenida:', position.coords);
            
            locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            
            // Si el iframe ya está listo, enviar inmediatamente
            if (iframeReady) {
                enviarUbicacionAlIframe();
            }
        },
        function(error) {
            console.error('❌ Error obteniendo ubicación:', error);
            
            let errorMsg = 'Error desconocido';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMsg = 'Permisos de ubicación denegados';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMsg = 'Ubicación no disponible';
                    break;
                case error.TIMEOUT:
                    errorMsg = 'Tiempo de espera agotado';
                    break;
            }
            
            enviarErrorAlIframe(errorMsg);
        },
        options
    );
}

// Enviar ubicación al iframe
function enviarUbicacionAlIframe() {
    if (!locationData || locationSent) {
        return;
    }
    
    const iframe = document.getElementById('googleForm');
    if (!iframe || !iframe.contentWindow) {
        console.warn('Iframe no disponible para enviar ubicación');
        return;
    }
    
    console.log('Enviando ubicación al iframe:', locationData);
    
    try {
        iframe.contentWindow.postMessage({
            type: 'ubicacion',
            coords: locationData
        }, '*');
        
        locationSent = true;
        console.log('Ubicación enviada al iframe');
        
    } catch (error) {
        console.error('Error enviando ubicación:', error);
        enviarErrorAlIframe('Error de comunicación con el formulario');
    }
}

// Enviar error al iframe
function enviarErrorAlIframe(errorMessage) {
    const iframe = document.getElementById('googleForm');
    if (!iframe || !iframe.contentWindow) {
        console.warn('Iframe no disponible para enviar error');
        return;
    }
    
    console.log('Enviando error al iframe:', errorMessage);
    
    try {
        iframe.contentWindow.postMessage({
            type: 'ubicacion_error',
            error: errorMessage
        }, '*');
    } catch (error) {
        console.error('Error enviando mensaje de error:', error);
    }
}

// Listener para mensajes del iframe
function handleIframeMessage(event) {
    // Verificar origen por seguridad
    if (!event.origin.includes('script.google.com')) {
        return;
    }
    
    console.log('📨 Mensaje recibido del iframe:', event.data);
    
    if (event.data.type === 'iframe_listo') {
        console.log('Iframe reporta estar listo');
        iframeReady = true;
        
        // Si ya tenemos ubicación, enviarla
        if (locationData && !locationSent) {
            enviarUbicacionAlIframe();
        }
    }
}

// Inicialización cuando carga la página
function inicializarSistema() {
    console.log('Inicializando sistema de ubicación...');
    
    // Configurar listener para mensajes del iframe
    window.addEventListener('message', handleIframeMessage);
    
    // Obtener ubicación inmediatamente
    obtenerUbicacionYEnviar();
    
    console.log('Sistema inicializado');
}


// Ejecutar cuando cargue la página
window.onload = obtenerUbicacionYEnviar;

// Event listeners
window.addEventListener('orientationchange', function() {
    setTimeout(adjustHeight, 500);
});

window.addEventListener('load', function() {
    adjustHeight();
    inicializarSistema();
});

