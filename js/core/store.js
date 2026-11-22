import * as Drive from './drive.js';
import { AuthError } from './auth.js';
import { CONFIG } from '../config.js';
import { emptyData, migrate } from './schema.js';

let data = null, mode = null, userKey = null, fileId = null, version = null;
let status = 'idle', statusMsg = '', rev = 0, savedRev = 0, saving = false, timer = null, retry = null;
const dataSubs = new Set(), statusSubs = new Set();

// --- локальна копія в IndexedDB: щоб не втратити незбережені зміни при закритті вкладки ---
const idb = () => new Promise((ok, fail) => { const r = indexedDB.open('tutor', 1); r.onupgradeneeded = () => r.result.createObjectStore('cache'); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
const idbDo = async (m, ...a) => { try { const db = await idb(); return await new Promise((ok, fail) => { const q = db.transaction('cache', m === 'get' ? 'readonly' : 'readwrite').objectStore('cache')[m](...a); q.onsuccess = () => ok(q.result); q.onerror = () => fail(q.error); }); } catch { return undefined; } };
const cacheKey = () => 'data:' + userKey;
const cachePut = () => idbDo('put', { data, version, fileId, dirty: savedRev !== rev }, cacheKey());

function setStatus(s, msg = '') { status = s; statusMsg = msg; statusSubs.forEach(f => f(s, msg)); }
const notify = () => dataSubs.forEach(f => f());
export const subscribe = f => (dataSubs.add(f), () => dataSubs.delete(f));
export const subscribeStatus = f => (statusSubs.add(f), () => statusSubs.delete(f));
export const getStatus = () => ({ status, msg: statusMsg });
export const get = () => data;
export const isDemo = () => mode === 'demo';
export const hasUnsaved = () => mode === 'drive' && savedRev !== rev;

// Єдина точка змін: store.update(s => { s.students.push(...) })
export function update(fn) {
  fn(data); rev++; notify();
  if (mode !== 'drive') return;
  cachePut();
  if (status !== 'conflict' && status !== 'auth') setStatus('dirty');
  clearTimeout(timer); timer = setTimeout(save, CONFIG.SAVE_DELAY_MS);
}

export async function save() {
  if (mode !== 'drive' || saving || savedRev === rev || status === 'conflict') return;
  clearTimeout(timer); clearTimeout(retry); saving = true; setStatus('saving');
  const at = rev;
  try {
    const m = await Drive.meta(fileId);
    if (m.version !== version) { setStatus('conflict'); return; } // файл змінили деінде
    const r = await Drive.update(fileId, JSON.stringify(data));
    version = r.version; savedRev = at; await cachePut();
    setStatus(savedRev === rev ? 'saved' : 'dirty');
  } catch (e) {
    if (e instanceof AuthError) setStatus('auth', e.message);
    else if (e instanceof TypeError) { setStatus('offline'); retry = setTimeout(save, 15000); }
    else setStatus('error', e.message);
  } finally { saving = false; }
  if (status === 'dirty') timer = setTimeout(save, CONFIG.SAVE_DELAY_MS);
}

const adopt = f => { fileId = f.id; version = f.version; };
export async function openDrive(key) {
  mode = 'drive'; userKey = key; setStatus('loading');
  const cached = await idbDo('get', cacheKey());
  let f = await Drive.find();
  if (!f) { data = emptyData(); f = await Drive.create(JSON.stringify(data)); adopt(f); rev = savedRev = 0; setStatus('saved'); return; }
  adopt(f);
  if (cached?.dirty && cached.fileId === f.id) { // є незбережені локальні зміни з минулого сеансу
    data = migrate(cached.data); rev = 1; savedRev = 0;
    if (cached.version !== f.version) { setStatus('conflict'); return; }
    setStatus('dirty'); timer = setTimeout(save, 500); return;
  }
  data = migrate(JSON.parse(await Drive.read(f.id))); rev = savedRev = 0; setStatus('saved');
}

export async function resolveConflict(keep) {
  if (status !== 'conflict') return;
  const m = await Drive.meta(fileId);
  if (keep === 'local') { version = m.version; setStatus('dirty'); return save(); }
  data = migrate(JSON.parse(await Drive.read(fileId))); version = m.version; rev = savedRev = 0;
  await cachePut(); setStatus('saved'); notify();
}

export function enterDemo(seedData) { mode = 'demo'; data = seedData; rev = savedRev = 0; setStatus('demo'); }
export async function close() {
  clearTimeout(timer); clearTimeout(retry);
  if (userKey) await idbDo('delete', cacheKey());
  data = mode = userKey = fileId = version = null; rev = savedRev = 0; setStatus('idle');
}

export function exportJson() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  a.download = `tutor-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function importJson(text) {
  const d = migrate(JSON.parse(text));
  update(s => { Object.keys(s).forEach(k => delete s[k]); Object.assign(s, d); });
}

addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
addEventListener('beforeunload', e => { if (hasUnsaved()) { e.preventDefault(); e.returnValue = ''; } });
