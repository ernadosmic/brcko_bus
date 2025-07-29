document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-component]').forEach(el => {
    window.ComponentLoader && window.ComponentLoader.load(el);
  });
});
