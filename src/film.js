// Film mode for recording promo footage: open the game with ?film in the URL.
// Shortcut keys hide the HUD, switch to cinematic camera moves, slow time down,
// drive the snake, and drop prey right in front of it on cue. A small panel
// lists the keys and their current state (` hides it before recording).
import { t, tr } from './i18n.js';
import { THEMES } from './themes.js';
import { SKINS, HEAD_STYLES } from './models/snakeModel.js';

export const FILM = new URLSearchParams(window.location.search).has('film');

const HUD_STATES = ['full', 'clean', 'none'];
const CAMERAS = [null, 'orbit', 'side', 'flyover'];
const SPEEDS = [1, 0.5, 0.25];
/** Spaced so the snake eats them within the combo window: ×1.5, ×2 … up to ×3. */
const FRUIT_TRAIL = ['apple', 'orange', 'banana', 'grape', 'watermelon'];
const OTHER_ANIMALS = ['mouse', 'chick', 'frog'];

const next = (list, value) => list[(list.indexOf(value) + 1) % list.length];

export class FilmMode {
  /** settings / updateSetting / isDark come from main.js so theme, skin and night changes are the real settings. */
  constructor({ game, settings, updateSetting, isDark }) {
    this.game = game;
    this.settings = settings;
    this.updateSetting = updateSetting;
    this.isDark = isDark;
    this.hud = 'full';
    game.film.enabled = true;

    this.panel = document.createElement('div');
    this.panel.className = 'film-panel open';
    document.body.append(this.panel);
    this.render();
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  actions() {
    const { game, settings } = this;
    const film = game.film;
    const playing = game.mode === 'playing';
    const onlyPlaying = (fn) => () => playing && fn();
    const actions = {
      Backquote: () => this.panel.classList.toggle('open'),
      KeyH: () => {
        this.hud = next(HUD_STATES, this.hud);
        document.body.dataset.hud = this.hud;
      },
      KeyV: () => game.setFilmCamera(next(CAMERAS, film.camera)),
      KeyZ: () => { film.timeScale = next(SPEEDS, film.timeScale); },
      KeyU: () => { film.autopilot = !film.autopilot; },
      KeyF: onlyPlaying(() => FRUIT_TRAIL.forEach((type, i) => game.spawnAhead('fruit', type, 4 + i * 2.5))),
      // Far enough that it starts calm and bolts as the snake closes in.
      KeyR: onlyPlaying(() => game.spawnAhead('animal', 'rabbit', 9)),
      KeyX: onlyPlaying(() => game.spawnAhead('animal', OTHER_ANIMALS[Math.floor(Math.random() * OTHER_ANIMALS.length)], 6, (Math.random() - 0.5) * 2)),
      KeyG: onlyPlaying(() => game.spawnAhead('fruit', 'golden', 8)),
      KeyT: onlyPlaying(() => { game.stats.timeLeft = Math.min(game.stats.timeLeft, 12); }),
      KeyN: () => this.updateSetting('appearance', this.isDark() ? 'light' : 'dark'),
      KeyQ: () => this.updateSetting('skin', next(Object.keys(SKINS), settings.skin)),
      KeyE: () => this.updateSetting('head', next(Object.keys(HEAD_STYLES), settings.head)),
    };
    Object.keys(THEMES).forEach((id, i) => { actions[`Digit${i + 1}`] = () => this.updateSetting('theme', id); });
    return actions;
  }

  onKey(e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    const action = this.actions()[e.code];
    if (!action) return;
    action();
    this.render();
  }

  render() {
    const { film } = this.game;
    const { settings } = this;
    const theme = THEMES[settings.theme];
    const head = HEAD_STYLES[settings.head];
    const row = (key, label, value) => `<kbd>${key}</kbd><span>${label}${value ? ` · <b>${value}</b>` : ''}</span>`;
    this.panel.innerHTML = `
      <h4>${t('film.title')} <small><kbd>\`</kbd> ${t('film.hide')}</small></h4>
      <div class="rows">
        ${row('H', 'HUD', t(`film.hud.${this.hud}`))}
        ${row('V', t('film.camera'), t(`film.cam.${film.camera ?? 'game'}`))}
        ${row('Z', t('film.speed'), `${film.timeScale}×`)}
        ${row('U', t('film.autopilot'), t(film.autopilot ? 'film.on' : 'film.off'))}
        ${row('F', t('film.fruits'))}
        ${row('R', t('film.rabbit'))}
        ${row('X', t('film.animal'))}
        ${row('G', t('film.golden'))}
        ${row('T', t('film.lastSeconds'))}
        ${row(`1–${Object.keys(THEMES).length}`, t('film.theme'), `${theme.emoji} ${tr(theme.name)}`)}
        ${row('N', t('film.night'), t(this.isDark() ? 'film.nightOn' : 'film.nightOff'))}
        ${row('Q', t('film.skin'), tr(SKINS[settings.skin].name))}
        ${row('E', t('film.head'), `${head.emoji} ${tr(head.name)}`)}
      </div>
      <p>${t('film.footer')}</p>`;
  }
}
