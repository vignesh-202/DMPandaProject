class TemplateRenderer {
    /**
     * Render a template by replacing variables.
     * 
     * @param {Object} template - Template object from Appwrite
     * @param {Object} context - Variables context (user info, etc.)
     * @returns {Object} - Rendered template payload
     */
    static render(template, context = {}) {
        if (!template) return null;

        const rendered = JSON.parse(JSON.stringify(template)); // Deep copy

        // Simple variable replacement in text fields
        const replaceVars = (obj) => {
            if (typeof obj === 'string') {
                return obj.replace(/\{\{(\w+)\}\}/g, (match, key) => {
                    return context[key] !== undefined ? context[key] : match;
                });
            } else if (Array.isArray(obj)) {
                return obj.map(replaceVars);
            } else if (typeof obj === 'object' && obj !== null) {
                const newObj = {};
                for (const [key, value] of Object.entries(obj)) {
                    newObj[key] = replaceVars(value);
                }
                return newObj;
            }
            return obj;
        };

        // Render the content field
        if (rendered.content) {
            rendered.content = replaceVars(rendered.content);
        }

        // Render the payload
        if (rendered.payload) {
            if (typeof rendered.payload === 'string') {
                try {
                    rendered.payload = JSON.parse(rendered.payload);
                } catch (e) {
                    console.error('Failed to parse payload JSON:', e);
                }
            }
            rendered.payload = replaceVars(rendered.payload);
        } else if (rendered.content) {
            // Fallback: Use content as text payload
            rendered.payload = { text: rendered.content };
        } else {
            // Last resort: empty text payload
            rendered.payload = { text: '' };
        }

        return rendered;
    }
}

module.exports = TemplateRenderer;
