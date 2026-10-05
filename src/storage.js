// Settings and high scores, persisted in localStorage.

export const DURATIONS = [2, 3, 4, 5];

const SETTINGS_KEY = 'bigsnake.settings.v1';
const RECORDS_KEY = 'bigsnake.records.v1';
const KEEP_PER_DURATION = 20;

const DEFAULT_SETTINGS = {
  duration: 3,
  control: 'camera',
  steer: 'yaw',
  sens: 5,
  invert: false,
  nod: true,
  lookUp: true,
  view: 'near',
  viewLocked: false,
  musicVolume: 60,
  sfxVolume: 80,
  muted: false,
  skin: 'green',
  head: 'classic',
  theme: 'meadow',
  appearance: 'light',
  grass: { height: 100, density: 100, size: 100, variety: 50, blades: 28 },
};

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode): the game still works, it just won't remember.
  }
}

export function loadSettings() {
  const stored = read(SETTINGS_KEY, {});
  const settings = { ...DEFAULT_SETTINGS, ...stored };
  settings.grass = { ...DEFAULT_SETTINGS.grass, ...stored.grass };
  if (!DURATIONS.includes(settings.duration)) settings.duration = DEFAULT_SETTINGS.duration;
  if (!['near', 'far', 'top', 'first'].includes(settings.view)) settings.view = DEFAULT_SETTINGS.view;
  // Older versions had a single on/off "sound" switch.
  if (stored.sound === false && stored.muted === undefined) settings.muted = true;
  delete settings.sound;
  return settings;
}

export const DEFAULT_GRASS_SETTINGS = DEFAULT_SETTINGS.grass;

export function saveSettings(settings) {
  write(SETTINGS_KEY, settings);
}

const byScore = (a, b) => b.score - a.score || a.date - b.date;

function readRecords() {
  const list = read(RECORDS_KEY, []);
  return Array.isArray(list) ? list.filter((r) => r && typeof r.score === 'number') : [];
}

/** Best records, optionally for one game duration (minutes). */
export function topRecords(duration = null, limit = 10) {
  return readRecords().filter((r) => !duration || r.duration === duration).sort(byScore).slice(0, limit);
}

export function bestScore(duration) {
  return topRecords(duration, 1)[0]?.score ?? 0;
}

/** Saves a finished game; keeps the top KEEP_PER_DURATION per duration. */
export function addRecord(record) {
  const previousBest = bestScore(record.duration);
  const entry = { ...record, id: `${record.date}-${Math.random().toString(36).slice(2, 8)}` };
  const all = [...readRecords(), entry];
  const kept = DURATIONS.flatMap((d) => all.filter((r) => r.duration === d).sort(byScore).slice(0, KEEP_PER_DURATION));
  write(RECORDS_KEY, kept);
  const rank = kept.filter((r) => r.duration === record.duration).sort(byScore).findIndex((r) => r.id === entry.id) + 1;
  return { rank, isBest: record.score > 0 && record.score > previousBest, previousBest };
}

export function clearRecords() {
  try {
    localStorage.removeItem(RECORDS_KEY);
  } catch {
    // Nothing to clear.
  }
}
