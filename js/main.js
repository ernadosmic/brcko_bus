document.addEventListener('DOMContentLoaded', () => {
  const basePath = document.body.dataset.pathPrefix || '';
  document.querySelectorAll('[data-component]').forEach(el => {
    window.ComponentLoader && window.ComponentLoader.load(el, basePath);
  });
});
