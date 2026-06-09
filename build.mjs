import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.mjs',
  external: [
    // Native / WASM modules that must stay external
    'sql.js',
    'better-sqlite3',
    // Keep ink and react external so their ESM/WASM internals load natively
    'ink',
    'react',
    'react-dom',
    'yoga-wasm-web',
  ],
  banner: {
    js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
    `.trim(),
  },
});

console.log('Build complete → dist/index.mjs');
