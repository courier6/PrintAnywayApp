/// <reference types="vite/client" />

declare module '*.properties' {
  const strings: Record<string, string>;
  export default strings;
}
