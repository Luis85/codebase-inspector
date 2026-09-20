// Vite serves `?raw` imports as the file's text. Declared here (rather than reading the
// file through node:fs) because `import.meta.url` is not a file: URL under vitest's
// jsdom environment, which is where the acceptance suite runs.
declare module '*.feature?raw' {
  const content: string;
  export default content;
}
