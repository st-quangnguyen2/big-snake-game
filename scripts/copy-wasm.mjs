// Copies the MediaPipe Tasks Vision WASM runtime into public/ so it is served
// from the same origin and always matches the installed npm version.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dest = resolve(root, 'public/mediapipe/wasm');

if (!existsSync(src)) {
  console.error('[copy-wasm] @mediapipe/tasks-vision is not installed. Run `npm install` first.');
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
// FilesetResolver only loads the SIMD / non-SIMD builds; the ES-module build is unused.
cpSync(src, dest, { recursive: true, filter: (path) => !path.includes('vision_wasm_module_internal') });
console.log('[copy-wasm] MediaPipe WASM copied to public/mediapipe/wasm');
