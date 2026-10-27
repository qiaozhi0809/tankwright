// Copy the vendored renderer's runtime-loaded assets into dist/.
//
// The base loads these by STRING PATH at runtime — `fetch('presets/x.json')`,
// `loadImageTex('tex/...')`, the fish GLB packs, the toolbar SVGs. Vite only
// emits statically imported modules, so without this every such request hits
// the SPA fallback, returns index.html, and `boot()` dies on
// `JSON.parse('<!doctype ...')`.
//
// They belong at the dist ROOT because the code resolves them against the page
// URL, not the bundled module URL.
//
// This runs as a separate process rather than a Vite closeBundle hook: the
// recursive copy crashed the build process (0xC0000409) when inlined there.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(root, 'third_party/aquarium-editor');
const DST = resolve(root, 'dist');
const DIRS = ['presets', 'fish', 'tex', 'icons', 'assets', 'thumbs'];

mkdirSync(DST, { recursive: true });

let copied = 0;
let bytes = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else {
      copied++;
      bytes += st.size;
    }
  }
}

for (const d of DIRS) {
  const from = resolve(SRC, d);
  if (!existsSync(from)) {
    console.log(`  skip ${d} (absent)`);
    continue;
  }
  walk(from);
  cpSync(from, resolve(DST, d), { recursive: true });
  console.log(`  copied ${d}`);
}

console.log(`runtime assets: ${copied} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
