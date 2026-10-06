# Promo video renderer

Renders the Big Snake 3D promo video straight from the game: every frame is captured in headless Chrome while a
script plays the scenes, the soundtrack is mixed from the game's own synthesized music and sound effects, and the
result is encoded to MP4.

| Command | Output |
| --- | --- |
| `npm run promo` | `promo/big-snake-promo-vi.mp4` — 57 s, 16:9, 1920×1080 |
| `npm run promo -- --lang=en` | `promo/big-snake-promo-en.mp4` |
| `npm run promo -- --short` | `promo/big-snake-short-vi.mp4` — 15 s, 9:16, 1080×1920 for TikTok / Reels / Shorts |
| `npm run promo -- --short --lang=en` | `promo/big-snake-short-en.mp4` |

A full render takes about 2–3 minutes (the short cut about 1 minute). The MP4s are git-ignored.

## Requirements

- **macOS** with the Xcode Command Line Tools (`swiftc`): encoding uses AVFoundation (H.264 + AAC), so no ffmpeg is needed.
- **Google Chrome** at the default location, or pass `--chrome=/path/to/chrome` (or set `CHROME_PATH`).
- The project's dependencies installed (`npm install`). The renderer starts its own Vite dev server on port 5199;
  pass `--base=http://localhost:5173` to use a dev server that is already running instead.

## Options

| Option | Effect |
| --- | --- |
| `--lang=vi` / `--lang=en` | Language of the captions and the in-game interface (default `vi`) |
| `--short` | The 15-second vertical cut instead of the 57-second video |
| `--preview[=N]` | Save only every Nth frame (default 10) as JPEGs in the temp folder, no sound or MP4 — for checking layout quickly |
| `--only=hook,title` | Render just these scenes (names below) |
| `--keep` | Keep the frames and `audio.wav` in `$TMPDIR/big-snake-promo/` after encoding |

## Scenes

| Full video (`director.js` → `SCENES`) | Short cut (`SHORT`) |
| --- | --- |
| `hook` – the player's face (illustration) turns, the snake turns with it | `hook` |
| `handsfree` – "No controller. No keyboard." | `rabbit` – nod to boost, catch the rabbit |
| `title` – logo over an arena flyover | `themes` – five arenas in a row from above |
| `combo` – two fruit trails, combo up to ×3 | `finale` – last two seconds, NEW RECORD, logo |
| `rabbit` – nod to boost and catch a fleeing rabbit | |
| `golden` – golden apple, 100 points | |
| `world` – slow motion at grass height through a berry bush and mud | |
| `themes` – chin up to the overview, then five arenas and night | |
| `style` – close-up while the snake changes color and head style | |
| `climax` – last seconds, Time's up, NEW RECORD, confetti | |
| `logo` – logo over the night arena | |

## How it works

- **`shim.js`** is injected before the game loads and replaces the page clock: time only moves when the renderer
  advances one frame (1/30 s). Timers, `requestAnimationFrame` and CSS / Web Animations are stepped by hand, so the
  game, popups and captions stay frame-exact no matter how long a frame takes to render. `Math.random` is seeded, so
  every render is identical.
- **`director.js`** runs inside the game page (opened with `?film`, see the main README). Each scene places the snake,
  picks the camera and HUD mode, steers or boosts, drops prey with film-mode helpers, and shows captions, the logo and
  the face illustration as HTML overlays. Every sound the game plays is logged with its video time.
- **Sound**: after the last frame, the logged sounds and the game's music tracks are replayed into an
  `OfflineAudioContext` and saved as a WAV, lifted to a normal video loudness with a soft limiter.
- **`encode.swift`** turns the JPEG frames and the WAV into the MP4.
- **`render.mjs`** ties it together: dev server, headless Chrome (DevTools protocol), frame capture, sound, encoding.

To change a caption, edit the `L('vi text', 'en text')` calls in `director.js`; scene lengths are the `end` checks of
each scene. The face in the hook scenes is an illustration — a real recording of a player can be cut in over it.
