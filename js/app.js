import * as Auth from './core/auth.js';
import * as store from './core/store.js';
import * as router from './core/router.js';
import { html, mount, delegate } from './core/html.js';
import { askConfirm, askNotice, toast } from './core/ui.js';
import { renderLogin } from './views/login.js';
import { renderHome } from './views/home.js';
import { seed } from './demo/seed.js';
import { renderStudent } from './views/student.js';
import { renderModules } from './views/modules.js';
import { renderMaterials } from './views/materials.js';

const root = document.getElementById('app'), USER_KEY = 'tutor.user';
const savedUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };
let user = null, renderView = null;

// --- екрани (додавати нові сюди) ---
let navName = 'home';
const markNav = () => document.querySelectorAll('header.top .nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === navName));
const setView = (fn, nav = 'home') => { renderView = fn; navName = nav; paintView(); markNav(); };
function paintView() { const v = document.getElementById('view'); if (v && renderView && store.get()) renderView(v); }
router.route('/', () => setView(renderHome));
router.route('/student/:id', ({ id }) => setView(el => renderStudent(el, +id)));
router.route('/modules', () => setView(renderModules, 'modules'));
router.route('/materials', () => setView(renderMaterials, 'materials'));

// --- статус збереження ---
const LABELS = { loading: ['Завантаження…', ''], saved: ['Збережено', 'ok'], dirty: ['Є зміни…', 'warn'], saving: ['Зберігаю…', 'warn'], offline: ['Немає зв’язку', 'bad'], error: ['Помилка збереження', 'bad'], conflict: ['Конфлікт', 'bad'], auth: ['Потрібен вхід', 'bad'], demo: ['Демо: дані не зберігаються', 'warn'] };
function paintStatus(s, msg) {
  const el = document.getElementById('status'), b = document.getElementById('banner');
  if (!el || !b) return;
  const [t, c] = LABELS[s] || [s, '']; el.textContent = t; el.className = 'pill ' + c; el.title = msg || '';
  mount(b, s === 'conflict' ? html`<div class="banner bad">Файл на Диску змінено з іншого місця. <button data-act="keepRemote">Завантажити версію з Диска</button><button data-act="keepLocal">Залишити мою версію</button></div>`
    : s === 'auth' ? html`<div class="banner bad">Сесія Google закінчилась. <button data-act="reauth">Продовжити</button></div>`
      : s === 'error' ? html`<div class="banner bad">Не вдалося зберегти: ${msg}</div>` : html``);
}
store.subscribe(paintView);
store.subscribeStatus(paintStatus);

// --- вхід / вихід ---
function showLogin(error) {
  renderLogin(root, { user: savedUser(), error }, { signin: () => signIn('select_account'), continue: () => signIn(''), demo: startDemo });
}
async function signIn(prompt) {
  try {
    await Auth.init(); await Auth.signIn(prompt);
    const u = await Auth.userInfo(); user = { sub: u.sub, name: u.name || u.email, email: u.email };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    mount(root, html`<div class="login muted">Завантажую дані з Диска…</div>`);
    await store.openDrive(user.sub); startApp();
  } catch (e) { showLogin(e.message); }
}
function startDemo() { store.enterDemo(seed()); startApp(); }

function startApp() {
  mount(root, html`<header class="top"><h1>Система репетитора</h1>
    <nav class="nav"><a href="#/" data-nav="home">Учні й календар</a><a href="#/modules" data-nav="modules">Модулі навчання</a><a href="#/materials" data-nav="materials">Матеріали</a></nav>
    <span id="status" class="pill"></span>
    <span class="who">${store.isDemo() ? 'Демо-режим' : user.email}</span>
    <button data-act="export">Експорт</button><button data-act="import">Імпорт</button><button data-act="logout">Вийти</button></header>
    <div id="banner"></div><main id="view"></main><input type="file" id="file" accept="application/json" hidden>`);
  const file = document.getElementById('file');
  delegate(root, {
    export: () => store.exportJson(),
    import: () => file.click(),
    async logout() {
      if (store.hasUnsaved() && !await askConfirm('Є незбережені зміни. Вийти без збереження?', 'Вийти')) return;
      await store.close(); Auth.signOut(); showLogin();
    }
  });
  delegate(document.getElementById('banner'), {
    keepRemote: () => store.resolveConflict('remote'),
    keepLocal: () => store.resolveConflict('local'),
    async reauth() { await Auth.signIn(''); store.save(); }
  });
  file.onchange = async () => {
    const f = file.files[0]; file.value = ''; if (!f) return;
    if (!await askConfirm('Замінити всі поточні дані вмістом файлу?', 'Замінити')) return;
    try { store.importJson(await f.text()); toast('Дані імпортовано'); } catch (e) { askNotice('Не вдалося імпортувати: ' + e.message); }
  };
  const st = store.getStatus(); paintStatus(st.status, st.msg);
  router.start(() => router.go('/'));
}

addEventListener('unhandledrejection', e => toast('Помилка: ' + (e.reason?.message || e.reason)));
Auth.init().catch(() => { }); // завантажуємо Google-скрипт наперед, щоб вікно входу не блокувалося
showLogin();
