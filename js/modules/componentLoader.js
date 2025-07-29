(function(global) {
  async function load(element, basePath = '') {
    const name = element.dataset.component;
    if (!name) return;
    const path = `${basePath}components/${name}.html`;
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`Failed to load component: ${name}`);
      element.innerHTML = await resp.text();
    } catch (err) {
      console.error(err);
    }
  }
  global.ComponentLoader = { load };
})(window);
