import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { parseProperties } from './src/i18n/properties';

const STRINGS_FILE = fileURLToPath(new URL('./src/i18n/en.properties', import.meta.url));

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Lets the app `import strings from './en.properties'` and fills the
 * {{t:key}} tokens in index.html's static landing copy from the same file.
 */
function propertiesPlugin(): Plugin {
  return {
    name: 'properties',
    transform(code, id) {
      if (!id.endsWith('.properties')) return null;
      return { code: `export default ${JSON.stringify(parseProperties(code))};`, map: null };
    },
    transformIndexHtml(html) {
      const strings = parseProperties(readFileSync(STRINGS_FILE, 'utf8'));
      return html.replace(/\{\{t:([\w.-]+)\}\}/g, (_, key: string) => {
        if (!(key in strings)) throw new Error(`index.html: unknown string key "${key}"`);
        return escapeHtml(strings[key]);
      });
    },
    handleHotUpdate({ file, server }) {
      if (!file.endsWith('.properties')) return;
      server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

export default defineConfig({
  // Served from https://printanyway.app/
  base: '/',
  plugins: [propertiesPlugin(), react()],
});
