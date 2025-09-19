//menu-toggle.js
function attachMenuToggle() {
  console.log('attachMenuToggle called');
  const toggleBtn = document.getElementById("menu-toggle");
  const navMenu = document.getElementById("nav-menu");

  console.log('toggleBtn found:', !!toggleBtn);
  console.log('navMenu found:', !!navMenu);

  if (toggleBtn && !toggleBtn.hasAttribute('data-listener')) {
    console.log('Adding event listener to menu toggle');

    toggleBtn.addEventListener("click", () => {
      console.log('Click event fired!');
      console.log('navMenu before toggle:', navMenu);
      console.log('navMenu classes before:', navMenu.className);

      const isVisible = navMenu.classList.toggle("visible");
      
      console.log('navMenu classes after:', navMenu.className);
      console.log('Menu visibility toggled:', isVisible);

      navMenu.setAttribute("aria-hidden", !isVisible);
    });
    toggleBtn.setAttribute('data-listener', 'true');
  } else {
    console.log('toggleBtn not found or already has listener');
  }
}

document.addEventListener("DOMContentLoaded", () => {
  attachMenuToggle();

  // Cierra el menú si se hace click fuera
  document.addEventListener("click", e => {
    const toggleBtn = document.getElementById("menu-toggle");
    const navMenu = document.getElementById("nav-menu");
    if (navMenu && toggleBtn && !navMenu.contains(e.target) && !toggleBtn.contains(e.target)) {
      navMenu.classList.remove("visible");
      navMenu.setAttribute("aria-hidden", "true");
    }
  });

  window.addEventListener("resize", attachMenuToggle);

  // Use MutationObserver to detect changes in the DOM
  const observer = new MutationObserver(attachMenuToggle);
  observer.observe(document.body, { childList: true, subtree: true });
});