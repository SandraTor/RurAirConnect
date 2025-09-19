//contact-form.js
/**
 * JavaScript - Contacto
 * Validaciones formulario contacto y hCAPTCHA
 * TFG - Sandra Torrero Casado
 */
 
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");
  const campos = form.querySelectorAll("input:not([type='hidden']), textarea");
  const btnEnviar = document.getElementById("btn-enviar");
  const mensajeExito = document.getElementById("mensaje-exito");
  const captchaError = document.getElementById("captcha-error");

  const validarCampo = (campo) => {
    const errorElem = campo.parentElement.querySelector(".error");
    let valido = true;

    if (campo.required && campo.value.trim() === "") {
      errorElem.textContent = "Este campo es obligatorio.";
      valido = false;
    } else if (campo.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(campo.value)) {
      errorElem.textContent = "Correo no válido.";
      valido = false;
    } else if (campo.minLength && campo.value.length < campo.minLength) {
      errorElem.textContent = `Debe tener al menos ${campo.minLength} caracteres.`;
      valido = false;
    } else {
      errorElem.textContent = "";
    }

    campo.classList.toggle("error-input", !valido);
    errorElem.style.display = valido ? "none" : "block";
    return valido;
  };

  campos.forEach(campo => campo.addEventListener("input", () => validarCampo(campo)));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let valido = true;

    // Validar campos
    campos.forEach(campo => {
      if (!validarCampo(campo)) valido = false;
    });

    // Validar CAPTCHA - Método corregido
    let captchaToken = "";
    
    // Buscar el token de hCaptcha
    const hcaptchaResponse = document.querySelector("[name='h-captcha-response']");
    if (hcaptchaResponse) {
      captchaToken = hcaptchaResponse.value;
    }
    
    // También intentar con la API de hCaptcha
    if (!captchaToken && typeof hcaptcha !== 'undefined') {
      try {
        // Buscar el widget de hCaptcha
        const captchaWidget = document.querySelector('.h-captcha');
        if (captchaWidget) {
          const widgetId = captchaWidget.getAttribute('data-hcaptcha-widget-id');
          if (widgetId) {
            captchaToken = hcaptcha.getResponse(widgetId);
          }
        }
      } catch (error) {
        console.log("Error obteniendo respuesta de hCaptcha:", error);
      }
    }
    
    console.log("CAPTCHA token encontrado:", captchaToken);
    
    if (!captchaToken) {
      captchaError.textContent = "Por favor completa el CAPTCHA.";
      captchaError.style.display = "block";
      valido = false;
    } else {
      captchaError.style.display = "none";
    }

    if (!valido) return;

    // Crear FormData y asegurar que el CAPTCHA se incluya
    const formData = new FormData(form);
    
    // Forzar la inclusión del token de CAPTCHA
    if (captchaToken) {
      formData.set('h-captcha-response', captchaToken);
    }

    // Mostrar datos que se van a enviar
    console.log("Datos del formulario:");
    for (let [key, value] of formData.entries()) {
      console.log(`${key}: ${value}`);
    }

    // Enviar formulario
    btnEnviar.disabled = true;
    btnEnviar.classList.add("loading");
    btnEnviar.textContent = "Enviando...";

    fetch(form.action, {
      method: "POST",
      body: formData,
    })
      .then(res => {
        console.log("Respuesta bruta:", res);
        console.log("Status:", res.status);
        console.log("Status text:", res.statusText);
        
        // Intentar obtener el texto de la respuesta para depuración
        return res.text().then(text => {
          console.log("Texto de respuesta:", text);
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error("Error al parsear JSON:", e);
            console.error("Respuesta recibida:", text);
            throw new Error("Respuesta del servidor no es JSON válido: " + text.substring(0, 100));
          }
        });
      })
      .then(data => {
        console.log("Datos parseados:", data);
        if (data.success) {
          form.reset();
          mensajeExito.style.display = "block";
          mensajeExito.scrollIntoView({ behavior: "smooth" });
          
          // Resetear hCaptcha
          if (typeof hcaptcha !== 'undefined') {
            const captchaWidget = document.querySelector('.h-captcha');
            if (captchaWidget) {
              const widgetId = captchaWidget.getAttribute('data-hcaptcha-widget-id');
              if (widgetId) {
                hcaptcha.reset(widgetId);
              } else {
                hcaptcha.reset();
              }
            }
          }
        } else {
          alert("Error: " + (data.message || "Error desconocido"));
        }
      })
      .catch(err => {
        console.error("Error completo:", err);
        alert("Error del servidor: " + err.message);
      })
      .finally(() => {
        btnEnviar.disabled = false;
        btnEnviar.classList.remove("loading");
        btnEnviar.textContent = "Enviar mensaje";
      });
  });
});