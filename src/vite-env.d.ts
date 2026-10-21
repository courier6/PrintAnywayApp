/// <reference types="vite/client" />

/** pdf.js's data folders under the site root, e.g. "pdfjs/5.7.284/" (vite.config.ts). */
declare const __PDFJS_PATH__: string;

declare module '*.properties' {
  const strings: Record<string, string>;
  export default strings;
}
