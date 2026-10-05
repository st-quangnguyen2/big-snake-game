// Vietnamese / English UI text. Static HTML uses data-i18n* attributes (filled by
// applyI18n); code uses t(key, vars). Model data (fruit, animals, skins…) keeps
// its own { vi, en } names next to the model, read with tr().

export const LANGS = ['vi', 'en'];
const LANG_KEY = 'bigsnake.lang';

const STRINGS = {
  vi: {
    locale: 'vi-VN',
    'lang.label': 'Ngôn ngữ',

    'hud.score': 'ĐIỂM',
    'hud.length': '🐍 Dài',
    'hud.best': '🏆 Kỷ lục',
    'hud.caught': 'Đã bắt được',
    'hud.pause': 'Tạm dừng (Esc)',
    'hud.boost': '⚡ TĂNG TỐC',
    'hud.noFace': '⚠️ Không thấy khuôn mặt',

    'menu.tagline': 'Lắc đầu để điều khiển rắn săn mồi!',
    'menu.pausedNote': '⏸ Ván đang tạm dừng — chỉnh xong bấm <b>Tiếp tục chơi</b> (Esc: quay lại)',
    'menu.tabPlay': '🎮 Chơi',
    'menu.tabCustom': '🎨 Tuỳ biến',
    'menu.tabSettings': '⚙️ Cài đặt',
    'menu.duration': '⏱️ Thời gian chơi',
    'menu.durationNote': '(áp dụng từ ván sau)',
    'menu.control': '🎮 Điều khiển',
    'menu.camera': '📷 Camera (đầu & cổ)',
    'menu.keyboard': '⌨️ Bàn phím',
    'menu.start': '▶ Bắt đầu',
    'menu.continue': '▶ Tiếp tục chơi',
    'menu.quitRound': 'Thoát ván, về menu chính',
    'menu.best': 'Kỷ lục {minutes} phút: <b>{score}</b>',
    'menu.library': 'Xem thư viện model 3D →',
    minutes: '{n} phút',

    'custom.skin': '🐍 Màu rắn',
    'custom.head': '😃 Kiểu đầu',
    'custom.theme': '🗺️ Sân chơi',
    'custom.appearance': '🌗 Chế độ sáng / tối',
    'custom.light': '☀️ Sáng',
    'custom.dark': '🌙 Tối',
    'custom.auto': '🖥️ Theo máy',
    'custom.grass': '🌱 Cỏ trong sân',
    'custom.grassReset': 'Mặc định',
    'grass.height': '📏 Độ cao',
    'grass.density': '🌾 Độ rậm',
    'grass.blades': '🌱 Số phiến',
    'grass.size': '🌿 Cụm cỏ',
    'grass.variety': '🎲 Đa dạng',
    'grass.hint': 'Đa dạng cao: cỏ mọc thành từng mảng to nhỏ khác nhau khắp sân.',

    'settings.view': '🎥 Góc nhìn',
    'settings.viewNote': '(đổi nhanh bằng phím C)',
    'settings.lock': '🔒 Khoá góc nhìn khi chơi — ngẩng đầu hay phím C không đổi góc (phím L)',
    'settings.sound': '🔊 Âm thanh',
    'settings.music': '🎵 Nhạc nền',
    'settings.sfx': '🔔 Hiệu ứng',
    'settings.mute': 'Tắt tiếng (phím M)',
    'settings.head': '🎯 Điều khiển bằng đầu',
    'settings.steer': 'Cách lái',
    'settings.steerYaw': 'Xoay đầu trái / phải',
    'settings.steerRoll': 'Nghiêng đầu về vai',
    'settings.sens': 'Độ nhạy:',
    'settings.nod': 'Cúi đầu nhẹ để tăng tốc',
    'settings.lookUp': 'Ngẩng đầu lên để nhìn toàn cảnh',
    'settings.invert': 'Đảo chiều lái',

    'view.near': '🐍 Gần',
    'view.far': '🔭 Xa',
    'view.top': '🛰️ Trên cao',
    'view.first': '👁️ Thứ nhất',
    'view.firstLong': '👁️ Góc nhìn thứ nhất',

    'records.title': '🏆 Bảng kỷ lục',
    'records.all': 'Tất cả',
    'records.score': 'Điểm',
    'records.time': 'Thời gian',
    'records.length': 'Dài',
    'records.date': 'Ngày',
    'records.empty': 'Chưa có kỷ lục nào — chơi ngay nhé!',
    'records.clear': 'Xoá kỷ lục',
    'records.confirmClear': 'Xoá toàn bộ bảng kỷ lục?',

    'howto.title': '📖 Cách chơi',
    'howto.list': `<li>🍎 Trái cây: 10–30 điểm</li>
<li>🐭 Thú nhỏ: 35–70 điểm — chúng sẽ bỏ chạy!</li>
<li>⭐ Táo vàng: 100 điểm, chỉ xuất hiện 10 giây</li>
<li>🔥 Ăn liên tiếp để nhân combo, tối đa ×3</li>
<li>⛰️ Lên dốc chậm lại, xuống dốc nhanh hơn · 🟤 Vũng bùn làm rắn chậm</li>
<li>🌿 Bò xuyên qua bụi quả và cỏ cao — chúng sẽ rẽ ra</li>
<li>💥 Đâm vào hàng rào, đá, gốc cây, thân cây to hay thân mình: mất 10 điểm và rắn ngắn lại</li>`,

    'loading.start': 'Đang khởi động…',
    'loading.camera': 'Đang bật camera…',
    'tracker.insecure': 'Trình duyệt không cho phép dùng camera ở đây (cần mở bằng https:// hoặc localhost).',
    'tracker.permission': 'Đang xin quyền dùng camera…',
    'tracker.runtime': 'Đang tải bộ xử lý MediaPipe…',
    'tracker.model': 'Đang tải model nhận diện khuôn mặt…',
    'tracker.cancelled': 'Đã huỷ hiệu chỉnh.',
    'tracker.noFace': 'Không nhận diện được khuôn mặt. Hãy nhìn thẳng vào camera và thử lại.',

    'error.title': '😕 Chưa dùng được camera',
    'error.keyboard': '⌨️ Chơi bằng bàn phím',
    'error.retry': 'Thử lại',
    'error.NotAllowedError': 'Bạn chưa cho phép dùng camera. Hãy bấm biểu tượng camera trên thanh địa chỉ để cho phép, rồi bấm "Thử lại".',
    'error.NotFoundError': 'Không tìm thấy camera nào trên máy.',
    'error.OverconstrainedError': 'Không tìm thấy camera phù hợp.',
    'error.NotReadableError': 'Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi thử lại.',
    'error.generic': 'Không khởi động được nhận diện khuôn mặt: {message}',
    menu: 'Menu',

    'calib.title': '🎯 Hiệu chỉnh camera',
    'calib.searching': 'Đang tìm khuôn mặt…',
    'calib.found': '✓ Đã thấy khuôn mặt',
    'calib.steps': `<li>Ngồi cách màn hình 50–80 cm, mặt ở giữa khung hình và đủ sáng.</li>
<li>Nhìn thẳng vào màn hình, bấm <b>Hiệu chỉnh</b> và giữ yên 1 giây.</li>
<li>Thử <b id="calib-steer-hint">xoay đầu sang trái / phải</b>: thanh bên dưới phải chạy cùng chiều.</li>
<li>Cúi đầu nhẹ → <b>tăng tốc</b>; ngẩng đầu lên → <b>nhìn toàn cảnh</b>.</li>`,
    'calib.hintYaw': 'xoay đầu sang trái / phải',
    'calib.hintRoll': 'nghiêng đầu sang trái / phải',
    'calib.look': '👀 NHÌN XA',
    'calib.angles': 'Xoay {yaw}° · Cúi {pitch}° · Nghiêng {roll}°',
    'calib.calibrate': '🎯 Hiệu chỉnh',
    'calib.recalibrate': '🎯 Hiệu chỉnh lại',
    'calib.invert': '⇄ Đảo chiều',
    'calib.back': '← Menu',
    'calib.play': 'Vào game ▶',
    'calib.hold': 'Giữ yên…',
    'calib.done': '✓ Xong! Thử xoay đầu để kiểm tra hướng lái.',
    'calib.already': 'Đã hiệu chỉnh trước đó — có thể vào game ngay.',
    'calib.inverted': 'Đã đảo chiều lái.',
    'calib.normal': 'Đã trả về chiều lái mặc định.',

    'pause.title': '⏸ Tạm dừng',
    'pause.text': 'Nhấn Esc hoặc nút Tiếp tục để chơi tiếp.',
    'pause.faceTitle': '🙈 Không thấy khuôn mặt',
    'pause.faceText': 'Hãy nhìn vào camera — game sẽ tự chơi tiếp khi thấy lại khuôn mặt.',
    'pause.music': '🎵 Nhạc',
    'pause.mute': 'Tắt tiếng',
    'pause.resume': '▶ Tiếp tục',
    'pause.settings': '⚙️ Cài đặt',
    'pause.holdStill': 'Nhìn thẳng & giữ yên…',
    'pause.quit': 'Thoát',

    'over.title': '⏰ Hết giờ!',
    'over.badge': '🏆 KỶ LỤC MỚI!',
    'over.rank': 'Hạng #{rank} trong bảng {minutes} phút',
    'over.unranked': 'Chưa lọt vào bảng kỷ lục — cố lên nhé!',
    'over.length': 'độ dài',
    'over.fruits': 'trái cây',
    'over.animals': 'thú nhỏ',
    'over.golden': 'táo vàng',
    'over.again': '↻ Chơi lại',

    'countdown.go': 'BẮT ĐẦU!',
    'countdown.resume': 'TIẾP TỤC!',
    'catch.fruit': 'Trái cây',
    'eat.caught': 'Bắt được {name}!',
    'hit.wall': 'Đâm vào hàng rào!',
    'hit.obstacle': 'Đâm phải vật cản!',
    'hit.self': 'Cắn phải thân mình!',
    'hit.shrink': 'Rắn ngắn lại',
    'hit.oops': 'Ối!',
    'golden.title': '⭐ Táo vàng!',
    'golden.sub': 'Nhanh lên, chỉ có 10 giây',

    'lock.lock': 'Khoá góc nhìn (L)',
    'lock.unlock': 'Mở khoá góc nhìn (L)',
    'lock.isLocked': '🔒 Góc nhìn đang khoá',
    'lock.pressL': 'Bấm L để mở khoá',
    'lock.locked': '🔒 Đã khoá góc nhìn hiện tại',
    'lock.unlocked': '🔓 Đã mở khoá góc nhìn',
    'lock.unlockedSub': 'Ngẩng đầu / phím C lại đổi được góc',

    'hint.steerYaw': '↔ Xoay đầu để lái',
    'hint.steerRoll': '↔ Nghiêng đầu để lái',
    'hint.nod': 'Cúi đầu: tăng tốc',
    'hint.look': 'Ngẩng đầu: nhìn xa',
    'hint.lock': 'L: khoá góc nhìn',
    'hint.pause': 'Esc: tạm dừng',
    'hint.keys': '← → / A D: lái · Space: tăng tốc · ↓ / S: nhìn xa · C: đổi góc nhìn · L: khoá góc nhìn · Esc: tạm dừng',

    'viewer.title': 'Big Snake 3D – Thư viện model',
    'viewer.subtitle': 'Thư viện model 3D',
    'viewer.help': 'Kéo chuột để xoay · Cuộn để phóng to · Chuột phải để di chuyển · ↑/↓ chuyển model',
    'viewer.rotate': 'Tự xoay',
    'viewer.anim': 'Hoạt ảnh',
    'viewer.theme': 'Theme sân',
    'viewer.night': 'Ban đêm',
    'viewer.reset': 'Đặt lại góc nhìn',
  },

  en: {
    locale: 'en-GB',
    'lang.label': 'Language',

    'hud.score': 'SCORE',
    'hud.length': '🐍 Length',
    'hud.best': '🏆 Best',
    'hud.caught': 'Caught',
    'hud.pause': 'Pause (Esc)',
    'hud.boost': '⚡ BOOST',
    'hud.noFace': '⚠️ Can’t see your face',

    'menu.tagline': 'Steer the snake with your head!',
    'menu.pausedNote': '⏸ Round paused — when you’re done, press <b>Continue</b> (Esc: back)',
    'menu.tabPlay': '🎮 Play',
    'menu.tabCustom': '🎨 Customize',
    'menu.tabSettings': '⚙️ Settings',
    'menu.duration': '⏱️ Round length',
    'menu.durationNote': '(applies from the next round)',
    'menu.control': '🎮 Controls',
    'menu.camera': '📷 Camera (head & neck)',
    'menu.keyboard': '⌨️ Keyboard',
    'menu.start': '▶ Start',
    'menu.continue': '▶ Continue',
    'menu.quitRound': 'Quit round, back to main menu',
    'menu.best': 'Best ({minutes} min): <b>{score}</b>',
    'menu.library': 'Browse the 3D model library →',
    minutes: '{n} min',

    'custom.skin': '🐍 Snake color',
    'custom.head': '😃 Head style',
    'custom.theme': '🗺️ Arena',
    'custom.appearance': '🌗 Light / dark mode',
    'custom.light': '☀️ Light',
    'custom.dark': '🌙 Dark',
    'custom.auto': '🖥️ System',
    'custom.grass': '🌱 Grass',
    'custom.grassReset': 'Default',
    'grass.height': '📏 Height',
    'grass.density': '🌾 Density',
    'grass.blades': '🌱 Blades',
    'grass.size': '🌿 Clump size',
    'grass.variety': '🎲 Variety',
    'grass.hint': 'High variety: grass grows in patches of different sizes across the arena.',

    'settings.view': '🎥 Camera view',
    'settings.viewNote': '(press C to switch)',
    'settings.lock': '🔒 Lock the view while playing — raising your chin or pressing C won’t change it (L key)',
    'settings.sound': '🔊 Sound',
    'settings.music': '🎵 Music',
    'settings.sfx': '🔔 Effects',
    'settings.mute': 'Mute (M key)',
    'settings.head': '🎯 Head control',
    'settings.steer': 'Steering',
    'settings.steerYaw': 'Turn head left / right',
    'settings.steerRoll': 'Tilt head toward a shoulder',
    'settings.sens': 'Sensitivity:',
    'settings.nod': 'Nod slightly to boost',
    'settings.lookUp': 'Raise your chin for an overview',
    'settings.invert': 'Invert steering',

    'view.near': '🐍 Near',
    'view.far': '🔭 Far',
    'view.top': '🛰️ Top',
    'view.first': '👁️ First person',
    'view.firstLong': '👁️ First person',

    'records.title': '🏆 High scores',
    'records.all': 'All',
    'records.score': 'Score',
    'records.time': 'Time',
    'records.length': 'Length',
    'records.date': 'Date',
    'records.empty': 'No records yet — go play!',
    'records.clear': 'Clear records',
    'records.confirmClear': 'Clear all high scores?',

    'howto.title': '📖 How to play',
    'howto.list': `<li>🍎 Fruit: 10–30 points</li>
<li>🐭 Small animals: 35–70 points — they run away!</li>
<li>⭐ Golden apple: 100 points, only around for 10 seconds</li>
<li>🔥 Eat in quick succession to build a combo, up to ×3</li>
<li>⛰️ Uphill is slower, downhill faster · 🟤 Mud slows you down</li>
<li>🌿 Slither through berry bushes and tall grass — they part around you</li>
<li>💥 Hitting the fence, rocks, stumps, big tree trunks or your own body: −10 points and the snake shrinks</li>`,

    'loading.start': 'Starting…',
    'loading.camera': 'Turning on the camera…',
    'tracker.insecure': 'The browser does not allow camera access here (open the page via https:// or localhost).',
    'tracker.permission': 'Asking for camera permission…',
    'tracker.runtime': 'Loading the MediaPipe runtime…',
    'tracker.model': 'Loading the face detection model…',
    'tracker.cancelled': 'Calibration cancelled.',
    'tracker.noFace': 'Couldn’t detect your face. Look straight at the camera and try again.',

    'error.title': '😕 Camera unavailable',
    'error.keyboard': '⌨️ Play with keyboard',
    'error.retry': 'Retry',
    'error.NotAllowedError': 'Camera access is blocked. Click the camera icon in the address bar to allow it, then press "Retry".',
    'error.NotFoundError': 'No camera was found on this device.',
    'error.OverconstrainedError': 'No suitable camera was found.',
    'error.NotReadableError': 'The camera is being used by another app. Close that app and try again.',
    'error.generic': 'Could not start face tracking: {message}',
    menu: 'Menu',

    'calib.title': '🎯 Camera calibration',
    'calib.searching': 'Looking for your face…',
    'calib.found': '✓ Face detected',
    'calib.steps': `<li>Sit 50–80 cm from the screen, face centred in the frame and well lit.</li>
<li>Look straight at the screen, press <b>Calibrate</b> and hold still for 1 second.</li>
<li>Try <b id="calib-steer-hint">turning your head left / right</b>: the bar below should move the same way.</li>
<li>Nod slightly → <b>boost</b>; raise your chin → <b>overview</b>.</li>`,
    'calib.hintYaw': 'turning your head left / right',
    'calib.hintRoll': 'tilting your head left / right',
    'calib.look': '👀 LOOK',
    'calib.angles': 'Turn {yaw}° · Nod {pitch}° · Tilt {roll}°',
    'calib.calibrate': '🎯 Calibrate',
    'calib.recalibrate': '🎯 Recalibrate',
    'calib.invert': '⇄ Invert',
    'calib.back': '← Menu',
    'calib.play': 'Play ▶',
    'calib.hold': 'Hold still…',
    'calib.done': '✓ Done! Turn your head to check the steering direction.',
    'calib.already': 'Already calibrated — you can start right away.',
    'calib.inverted': 'Steering inverted.',
    'calib.normal': 'Steering back to normal.',

    'pause.title': '⏸ Paused',
    'pause.text': 'Press Esc or Resume to keep playing.',
    'pause.faceTitle': '🙈 Can’t see your face',
    'pause.faceText': 'Look at the camera — the game resumes by itself once it sees your face again.',
    'pause.music': '🎵 Music',
    'pause.mute': 'Mute',
    'pause.resume': '▶ Resume',
    'pause.settings': '⚙️ Settings',
    'pause.holdStill': 'Look straight & hold still…',
    'pause.quit': 'Quit',

    'over.title': '⏰ Time’s up!',
    'over.badge': '🏆 NEW RECORD!',
    'over.rank': 'Rank #{rank} in the {minutes}-minute table',
    'over.unranked': 'Not in the high scores this time — keep going!',
    'over.length': 'length',
    'over.fruits': 'fruit',
    'over.animals': 'animals',
    'over.golden': 'golden apples',
    'over.again': '↻ Play again',

    'countdown.go': 'GO!',
    'countdown.resume': 'GO!',
    'catch.fruit': 'Fruit',
    'eat.caught': '{name} caught!',
    'hit.wall': 'Hit the fence!',
    'hit.obstacle': 'Hit an obstacle!',
    'hit.self': 'Bit your own body!',
    'hit.shrink': 'The snake shrinks',
    'hit.oops': 'Oops!',
    'golden.title': '⭐ Golden apple!',
    'golden.sub': 'Hurry, it’s gone in 10 seconds',

    'lock.lock': 'Lock view (L)',
    'lock.unlock': 'Unlock view (L)',
    'lock.isLocked': '🔒 The view is locked',
    'lock.pressL': 'Press L to unlock',
    'lock.locked': '🔒 Current view locked',
    'lock.unlocked': '🔓 View unlocked',
    'lock.unlockedSub': 'Raising your chin / C changes the view again',

    'hint.steerYaw': '↔ Turn your head to steer',
    'hint.steerRoll': '↔ Tilt your head to steer',
    'hint.nod': 'Nod: boost',
    'hint.look': 'Chin up: overview',
    'hint.lock': 'L: lock view',
    'hint.pause': 'Esc: pause',
    'hint.keys': '← → / A D: steer · Space: boost · ↓ / S: overview · C: change view · L: lock view · Esc: pause',

    'viewer.title': 'Big Snake 3D – Model library',
    'viewer.subtitle': '3D model library',
    'viewer.help': 'Drag to rotate · Scroll to zoom · Right-drag to pan · ↑/↓ to switch models',
    'viewer.rotate': 'Auto-rotate',
    'viewer.anim': 'Animation',
    'viewer.theme': 'Arena theme',
    'viewer.night': 'Night',
    'viewer.reset': 'Reset view',
  },
};

function storedLang() {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
}

/** Saved choice first, otherwise Vietnamese for Vietnamese browsers and English for everyone else. */
function initialLang() {
  const saved = storedLang();
  if (LANGS.includes(saved)) return saved;
  const preferred = navigator.languages?.length ? navigator.languages : [navigator.language];
  return preferred.some((l) => /^vi\b/i.test(l ?? '')) ? 'vi' : 'en';
}

let lang = initialLang();

export const getLang = () => lang;

export function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  try {
    localStorage.setItem(LANG_KEY, next);
  } catch {
    // Not remembered in private mode; the switch still works for this visit.
  }
}

/** UI text for `key` with {placeholders} filled from `vars`; falls back to Vietnamese, then the key. */
export function t(key, vars) {
  const text = STRINGS[lang][key] ?? STRINGS.vi[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : text;
}

/** A model's { vi, en } text (plain strings pass through). */
export function tr(value) {
  if (value == null || typeof value === 'string') return value ?? '';
  return value[lang] ?? value.vi;
}

/** Fills every data-i18n / -html / -title / -aria element under `root` and reveals the page. */
export function applyI18n(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of root.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  document.documentElement.lang = lang;
  document.documentElement.classList.remove('i18n-pending');
}
