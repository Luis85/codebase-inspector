// The only place that reaches Node's filesystem and path modules; src/adapters/fallow/node-process-access.ts is the only place that reaches Node's process module (Part 7 Z14).
//
// window.require, not a bundled import: Obsidian injects its own CommonJS require, and
// the renderer's window.require is Electron's real one. (The spike settled which;
// window.require is correct either way.) A static import would also trip
// no-nodejs-modules in eslint-plugin-obsidianmd, which isDesktopOnly does not exempt.
//
// node:original-fs, not fs: Electron patches fs to be asar-aware; original-fs is
// unpatched and correct for walking an arbitrary tree. This is what Obsidian's
// first-party obsidian-importer uses.
import { Platform } from 'obsidian';

export const fs = Platform.isDesktopApp ? window.require('node:original-fs') : null;
export const fsPromises = fs ? fs.promises : null;
export const nodePath = Platform.isDesktopApp ? window.require('node:path') : null;
