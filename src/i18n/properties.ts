/**
 * Parses the UTF-8 .properties subset described at the top of en.properties.
 * Shared by the browser bundle (via the Vite plugin) and vite.config.ts, so it
 * must stay import-free.
 */
export function parseProperties(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq === -1) throw new Error(`properties line ${i + 1}: missing "=": ${line}`);
    const key = line.slice(0, eq).trim();
    if (key in out) throw new Error(`properties line ${i + 1}: duplicate key "${key}"`);
    out[key] = line.slice(eq + 1).trim();
  });
  return out;
}
