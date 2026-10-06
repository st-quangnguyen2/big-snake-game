// Renders the promo video in one go: starts the Vite dev server and headless
// Chrome, steps the game frame by frame (shim.js + director.js), mixes the
// game's own music and sounds, and encodes an MP4 with AVFoundation
// (encode.swift, macOS). See promo/README.md.
//
//   node promo/render.mjs [--lang=vi|en] [--short] [--preview[=N]] [--only=hook,title] [--base=URL] [--keep]
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')));
const LANG = args.lang ?? 'vi';
const SHORT = 'short' in args;
/** --preview saves every Nth frame (default 10) as JPEGs and skips the soundtrack and encoding. */
const PREVIEW = 'preview' in args ? Number(args.preview) || 10 : 0;
const ONLY = args.only ? args.only.split(',') : null;
const NAME = `big-snake-${SHORT ? 'short' : 'promo'}-${LANG}`;
const WORK = join(tmpdir(), 'big-snake-promo');
const FRAMES = join(WORK, NAME, 'frames');
const CHROME = args.chrome ?? process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/** CSS viewport; rendered at 1.5× → 1920×1080 (16:9) or 1080×1920 (9:16). */
const [VW, VH] = SHORT ? [720, 1280] : [1280, 720];
const FPS = 30;
const SERVER_PORT = 5199;
const DEBUG_PORT = 9334;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(0)}s`;

/** Uses --base if given, otherwise runs the project's own Vite dev server (the director needs its source modules). */
async function startServer() {
  if (args.base) return { base: args.base, stop() {} };
  const vite = spawn(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), '--port', String(SERVER_PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
  });
  const base = `http://localhost:${SERVER_PORT}`;
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(base)).ok) return { base, stop: () => vite.kill() };
    } catch { /* starting */ }
    await sleep(200);
  }
  vite.kill();
  throw new Error(`Vite dev server did not start on port ${SERVER_PORT}`);
}

async function startChrome() {
  const profile = join(WORK, 'chrome-profile');
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, `--window-size=${VW},${VH}`,
    '--lang=en-US', '--hide-scrollbars', '--no-first-run', '--ignore-gpu-blocklist', '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 75; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return { chrome, url: page.webSocketDebuggerUrl };
    } catch { /* starting */ }
    await sleep(200);
  }
  chrome.kill();
  throw new Error(`Chrome did not start (${CHROME})`);
}

/** Minimal DevTools-protocol client; page errors are echoed to the terminal. */
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      console.log('  [page error]', msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
    }
    if (msg.method === 'Runtime.exceptionThrown') console.log('  [page exception]', msg.params.exceptionDetails.exception?.description?.slice(0, 300));
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const run = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? res.exceptionDetails.text);
    return res.result.value;
  };
  return { send, run, close: () => ws.close() };
}

/** Compiles encode.swift once (rebuilt when the source changes) and returns the binary path. */
function encoder() {
  const source = join(HERE, 'encode.swift');
  const binary = join(WORK, 'encode');
  if (!existsSync(binary) || statSync(binary).mtimeMs < statSync(source).mtimeMs) {
    console.log('compiling encode.swift…');
    execFileSync('swiftc', ['-O', source, '-o', binary], { stdio: 'inherit' });
  }
  return binary;
}

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
const server = await startServer();
const { chrome, url } = await startChrome();
const page = await connect(url);
const { send, run } = page;
try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: 1.5, mobile: false });
  // Language first (localStorage needs the game's origin), then reload with virtual time installed.
  await send('Page.navigate', { url: `${server.base}/?setup` });
  await sleep(1500);
  await run(`localStorage.setItem('bigsnake.lang', ${JSON.stringify(LANG)}); 'ok'`);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(join(HERE, 'shim.js'), 'utf8') });
  await send('Page.navigate', { url: `${server.base}/?film` });
  for (let i = 0; i < 100; i++) {
    await sleep(200);
    if (await run('Boolean(window.__game && document.readyState === "complete")')) break;
  }
  await run(readFileSync(join(HERE, 'director.js'), 'utf8'));
  await run(`window.__promo.setup(${JSON.stringify({ only: ONLY, edit: SHORT ? 'short' : 'full' })})`);
  console.log(`rendering ${NAME}${PREVIEW ? ` (preview, every ${PREVIEW}th frame)` : ''}`);

  let saved = 0;
  let lastScene = '';
  for (;;) {
    const step = await run('window.__promo.step()');
    if (step.done) break;
    if (step.scene !== lastScene) {
      lastScene = step.scene;
      console.log(`  ${step.scene.padEnd(10)} frame ${step.frame}  (${elapsed()})`);
    }
    if (!PREVIEW || (step.frame - 1) % PREVIEW === 0) {
      const { data } = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
      writeFileSync(join(FRAMES, `${String(++saved).padStart(5, '0')}.jpg`), Buffer.from(data, 'base64'));
    }
    if (step.last) break;
  }
  const info = await run('window.__promo.info()');
  console.log(`${info.frames} frames (${info.seconds.toFixed(2)}s), ${info.events} sound events`);

  if (PREVIEW) {
    console.log(`preview frames: ${FRAMES}`);
  } else {
    const { bytes } = await run('window.__promo.renderAudio()');
    const parts = [];
    for (let start = 0; start < bytes; start += 1 << 20) {
      parts.push(Buffer.from(await run(`window.__promo.wavChunk(${start}, ${1 << 20})`), 'base64'));
    }
    const wav = join(WORK, NAME, 'audio.wav');
    writeFileSync(wav, Buffer.concat(parts));
    page.close();
    chrome.kill();
    const out = join(HERE, `${NAME}.mp4`);
    execFileSync(encoder(), [FRAMES, String(FPS), wav, out], { stdio: 'inherit' });
    if (!('keep' in args)) rmSync(join(WORK, NAME), { recursive: true, force: true });
  }
  console.log(`done in ${elapsed()}`);
} finally {
  page.close();
  chrome.kill();
  server.stop();
}
