//main.js

/**
 * JavaScript - Funciones comunes
 * Comportamiento fragmentos
 * TFG - Sandra Torrero Casado
 */
 
// Función para cargar partials en contenedores específicos
function loadPartial(id, file, callback) {
  fetch(file)
    .then(res => {
      if (!res.ok) throw new Error(`No se pudo cargar ${file}`);
      return res.text();
    })
    .then(html => {
      document.getElementById(id).innerHTML = html;
      if (typeof callback === "function") {
        callback(); // Ejecuta el callback después de insertar el HTML
      }
    })
    .catch(err => {
      console.error(err);
      document.getElementById(id).innerHTML = `<p>Error cargando componente.</p>`;
    });
}
// Función para header compacto al hacer scroll
function initScrollHeader() {
  const header = document.querySelector('header');
  let lastScrollY = window.scrollY;
  let isCompact = false;
  const downThreshold = 100; // más tolerante al bajar
  const upThreshold = 50;    // más tolerante al subir

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    const scrollingDown = currentScrollY > lastScrollY;
    const scrollingUp = currentScrollY < lastScrollY;

    if (!header) return;

    if (scrollingDown && currentScrollY > downThreshold && !isCompact) {
      header.classList.add('compact');
      isCompact = true;
    } else if (scrollingUp && currentScrollY < upThreshold && isCompact) {
      header.classList.remove('compact');
      isCompact = false;
    }

    lastScrollY = currentScrollY;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadPartial("header", "partials/header.html", () => {
    const currentPath = window.location.pathname;
    const header = document.querySelector("header");

    if (header) {
      if (currentPath === "/map.html") {
        header.classList.add("compact");
      } else {
        initScrollHeader();
      }
    }
  });

  loadPartial("nav", "partials/nav.html");
  loadPartial("footer", "partials/footer.html");
});