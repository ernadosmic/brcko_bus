document.addEventListener('DOMContentLoaded', function () {
    const elements = document.querySelectorAll('[data-component]');
    elements.forEach(async (element) => {
        const componentName = element.dataset.component;
        // Use a prefix from the body tag to build the correct path
        const basePath = document.body.dataset.pathPrefix || '';
        const componentPath = `${basePath}components/${componentName}.html`;

        try {
            const response = await fetch(componentPath);
            if (!response.ok) {
                throw new Error(`Could not load component: ${response.statusText}`);
            }
            const text = await response.text();
            element.innerHTML = text;
        } catch (error) {
            console.error(`Failed to load component ${componentName}:`, error);
            element.innerHTML = `<p style="color:red; text-align:center;">Error: Component '${componentName}' could not be loaded.</p>`;
        }
    });
});