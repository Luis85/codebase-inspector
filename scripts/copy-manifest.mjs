import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
copyFileSync(fileURLToPath(new URL('../manifest.json', import.meta.url)),
             fileURLToPath(new URL('../dist/manifest.json', import.meta.url)));
