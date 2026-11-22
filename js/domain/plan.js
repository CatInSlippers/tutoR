import { dateKey } from '../core/dates.js';
import { nextId } from '../core/schema.js';
import { allLessons } from './finance.js';

const HELD = ['Проведено', 'Відпрацювання'];
const OFF = ['Перенесено', 'Скасовано'];

// Програма учня: s.plan = [{ id, name, topics: [{ id, name }] }] (модулі → теми).
// Розклад тем: s.sched = [{ date, tids: [id тем], locked }] — locked означає «закріплено вручну».
export const topicList = s => (s.plan || []).flatMap(m => m.topics.map(t => ({ id: t.id, name: t.name, mod: m.name })));

// Тема заняття: те, що викладач вписав у заняття, інакше теми з розкладу на цю дату
export function topicOf(s, l) {
  if (l.topic && l.topic !== 'Заняття') return l.topic;
  const e = (s.sched || []).find(x => x.date === l.date), T = topicList(s);
  return e ? e.tids.map(id => T.find(t => t.id === id)?.name).filter(Boolean).join(', ') : '';
}

export function findNode(s, id) {
  const plan = s.plan || [];
  let i = plan.findIndex(m => m.id === id);
  if (i >= 0) return { list: plan, i, node: plan[i], isMod: true };
  for (const m of plan) { i = m.topics.findIndex(t => t.id === id); if (i >= 0) return { list: m.topics, i, node: m.topics[i], isMod: false }; }
  return null;
}

// Автоматичний розклад тем. Тема вважається пройденою, коли вона стоїть у проведеному занятті.
// Тем ≥ занять: кожне заняття отримує ⌊T/L⌋ тем, залишок — по одній першим заняттям.
// Тем < занять: кожна тема займає ⌊L/T⌋ занять, залишок — першим темам.
// Лишається: закріплене вручну (поки заняття існує) та історія проведених занять; решта перераховується.
export function autoPlan(db, s) {
  const T = topicList(s), ids = new Set(T.map(t => t.id)), today = dateKey(new Date());
  const live = allLessons(db, s).filter(l => !OFF.includes(l.status));
  const liveDates = new Set(live.map(l => l.date));
  const heldDates = new Set(live.filter(l => HELD.includes(l.status)).map(l => l.date));
  const heldNames = new Set(live.filter(l => HELD.includes(l.status)).map(l => l.topic));
  const upcoming = [...new Set(live.filter(l => l.status === 'Заплановано' && l.date >= today).map(l => l.date))].sort();

  s.sched = (s.sched || []).filter(e => e.locked ? liveDates.has(e.date) : heldDates.has(e.date))
    .map(e => ({ ...e, tids: e.tids.filter(id => ids.has(id)) }));
  const fixed = new Set(s.sched.flatMap(e => e.tids));
  const pool = T.filter(t => !fixed.has(t.id) && !heldNames.has(t.name));
  const dates = upcoming.filter(d => !s.sched.some(e => e.date === d));
  const n = pool.length, m = dates.length;
  if (n && m) {
    if (n >= m) {
      const b = Math.floor(n / m), r = n % m; let k = 0;
      dates.forEach((d, i) => { const c = b + (i < r ? 1 : 0); s.sched.push({ date: d, tids: pool.slice(k, k + c).map(t => t.id), locked: false }); k += c; });
    } else {
      const b = Math.floor(m / n), r = m % n; let k = 0;
      pool.forEach((t, i) => { const c = b + (i < r ? 1 : 0); for (let j = 0; j < c; j++) s.sched.push({ date: dates[k + j], tids: [t.id], locked: false }); k += c; });
    }
  }
  s.sched.sort((a, b) => a.date.localeCompare(b.date));
}

// ===== Зміни (викликати всередині store.update). Після кожної — розклад тем перераховується. =====
const stOf = (db, id) => {
  const st = db.students.find(x => x.id === id); if (!st) throw new Error('Учня не знайдено.');
  st.plan = st.plan || []; st.sched = st.sched || []; return st;
};
const clean = name => { const n = String(name || '').trim(); if (!n) throw new Error('Назва не може бути порожньою.'); return n; };

export function addModule(db, sid, name) {
  const st = stOf(db, sid); st.plan.push({ id: nextId(db), name: clean(name), topics: [] }); autoPlan(db, st);
}
export function addTopic(db, sid, modId, name) {
  const st = stOf(db, sid), m = st.plan.find(x => x.id === modId); if (!m) throw new Error('Модуль не знайдено.');
  m.topics.push({ id: nextId(db), name: clean(name) }); autoPlan(db, st);
}
export function renameNode(db, sid, id, name) {
  const st = stOf(db, sid), f = findNode(st, id); if (!f) throw new Error('Не знайдено.');
  f.node.name = clean(name); autoPlan(db, st);
}
export function moveNode(db, sid, id, dir) {
  const st = stOf(db, sid), f = findNode(st, id); if (!f) return;
  const j = f.i + dir; if (j < 0 || j >= f.list.length) return;
  [f.list[f.i], f.list[j]] = [f.list[j], f.list[f.i]]; autoPlan(db, st);
}
export function removeNode(db, sid, id) {
  const st = stOf(db, sid), f = findNode(st, id); if (!f) return;
  const gone = new Set(f.isMod ? f.node.topics.map(t => t.id) : [id]);
  f.list.splice(f.i, 1);
  st.sched.forEach(e => { e.tids = e.tids.filter(t => !gone.has(t)); });
  autoPlan(db, st);
}
export function addTopicToDate(db, sid, date, tid) {
  const st = stOf(db, sid);
  let e = st.sched.find(x => x.date === date);
  if (!e) { e = { date, tids: [], locked: true }; st.sched.push(e); }
  if (!e.tids.includes(tid)) e.tids.push(tid);
  e.locked = true; autoPlan(db, st);
}
export function removeTopicFromDate(db, sid, date, tid) {
  const st = stOf(db, sid), e = st.sched.find(x => x.date === date); if (!e) return;
  e.tids = e.tids.filter(t => t !== tid); e.locked = true; autoPlan(db, st);
}
export function unlockDate(db, sid, date) {
  const st = stOf(db, sid), e = st.sched.find(x => x.date === date); if (e) e.locked = false; autoPlan(db, st);
}
export function unlockAll(db, sid) {
  const st = stOf(db, sid); st.sched.forEach(e => { e.locked = false; }); autoPlan(db, st);
}