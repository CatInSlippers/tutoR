import { dateKey, dateFrom, addDays, inside, mins } from '../core/dates.js';
import { nextId } from '../core/schema.js';
import { makeStudent } from './students.js';
import { slotActive } from './schedule.js';
export const STATUSES = ['Заплановано', 'Проведено', 'Перенесено', 'Пропущено (учень)', 'Пропущено (викладач)', 'Скасовано', 'Відпрацювання'];
const CLS = { 'Проведено': 's-done', 'Відпрацювання': 's-done', 'Пропущено (учень)': 's-miss', 'Пропущено (викладач)': 's-missT', 'Перенесено': 's-moved', 'Скасовано': 's-moved' };
export const statusClass = l => l.unmarked ? 's-unmarked' : CLS[l.status] || '';
export const vacationOf = (s, d) => s.vacations.find(v => inside(d, v.start, v.end));

const slotsOn = (s, d) => { const k = dateKey(d); return k < s.studyStart || k > s.studyEnd || vacationOf(s, d) ? [] : s.slots.map((x, i) => ({ ...x, slot: i })).filter(x => x.weekday === d.getDay() && slotActive(x, k)); };
// Заняття учня на дату: збережені записи + згенеровані за розкладом (якщо запис не «матеріалізував» слот).
export function lessonsOf(state, s, d) {
  const key = dateKey(d), today = dateKey(new Date());
  const recs = state.lessons.filter(l => l.studentId === s.id && l.date === key), out = recs.map(r => ({ ...r }));
  slotsOn(s, d).forEach(x => {
    if (!recs.some(r => r.regular && (r.slot ?? 0) === x.slot))
      out.push({ id: null, studentId: s.id, regular: true, slot: x.slot, date: key, startTime: x.startTime, durationMinutes: x.durationMinutes, topic: 'Заняття', status: 'Заплановано', comment: '' });
  });
  out.forEach(l => {
    l.auto = l.status === 'Заплановано' && l.date < today; // минуле без відмітки вважається проведеним
    if (l.auto) l.status = 'Проведено';
    l.unmarked = false;
  });
  return out;
}

export const isLive = it => it.kind === 'activity' || !['Перенесено', 'Скасовано'].includes(it.data.status);
// Усі записи дня (заняття + справи викладача) з позначкою перетину за часом.
export function dayItems(state, d) {
  const key = dateKey(d);
  const items = [
    ...state.students.flatMap(s => lessonsOf(state, s, d).map(l => ({ kind: 'lesson', data: l, student: s, s: mins(l.startTime), e: mins(l.startTime) + l.durationMinutes }))),
    ...state.activities.filter(a => a.date === key).map(a => ({ kind: 'activity', data: a, s: mins(a.startTime), e: mins(a.startTime) + a.durationMinutes }))
  ].sort((x, y) => x.s - y.s || x.e - y.e);
  items.forEach(x => { x.clash = isLive(x) && items.some(y => y !== x && isLive(y) && y.s < x.e && x.s < y.e); });
  return items;
}

// ===== Зміни занять (викликати всередині store.update). Усі перевірки — до змін, щоб при помилці дані лишились цілими. =====
const findSlot = (st, date, t, dur) => st.slots.findIndex(x => x.weekday === dateFrom(date).getDay() && x.startTime === t && x.durationMinutes === dur && slotActive(x, date));// Знаходить або додає слот розкладу й розширює період навчання, щоб він охоплював дату заняття.
function takeSlot(st, date, t, dur) {
  let k = findSlot(st, date, t, dur);
  if (k < 0) { st.slots.push({ weekday: dateFrom(date).getDay(), startTime: t, durationMinutes: dur, activeFrom: date, activeTo: '' }); k = st.slots.length - 1; } if (date < st.studyStart) st.studyStart = date;
  if (date > st.studyEnd) st.studyEnd = dateKey(addDays(dateFrom(date), 365));
  return k;
}
const dupRegular = (s, st, date, slot) => slot >= 0 && s.lessons.some(l => l.studentId === st.id && l.date === date && l.regular && l.slot === slot);
const DUP = 'Регулярне заняття на цю дату й час уже є в календарі.';
const recOf = (s, ref) => {
  if (ref.id == null) return null;
  const r = s.lessons.find(l => l.id === ref.id);
  if (!r) throw new Error('Заняття не знайдено — можливо, його вже видалили.');
  return r;
};

// Заняття за посиланням {id | slot, studentId, date}: збережене або згенероване за розкладом.
export function findLesson(s, ref) {
  const st = s.students.find(x => x.id === ref.studentId);
  return st ? lessonsOf(s, st, dateFrom(ref.date)).find(l => ref.id != null ? l.id === ref.id : l.id === null && l.slot === ref.slot) || null : null;
}

// v: {studentId | newStudent:{name,phone}, date, startTime, durationMinutes, status, regular, topic, comment}
export function createLesson(s, v) {
  let st = v.newStudent ? null : s.students.find(x => x.id === v.studentId);
  if (!v.newStudent && !st) throw new Error('Учня не знайдено.');
  if (v.regular && st && dupRegular(s, st, v.date, findSlot(st, v.date, v.startTime, v.durationMinutes))) throw new Error(DUP);
  if (v.newStudent) {
    const [firstName, ...rest] = v.newStudent.name.trim().split(/\s+/);
    st = makeStudent(s, { firstName, lastName: rest.join(' '), phone: v.newStudent.phone });
    st.stage = 'Пробний'; st.studyStart = v.date; st.studyEnd = dateKey(addDays(dateFrom(v.date), 365));
    s.students.push(st);
  }
  const rec = { id: nextId(s), studentId: st.id, regular: !!v.regular, date: v.date, startTime: v.startTime, durationMinutes: v.durationMinutes, topic: v.topic || 'Заняття', status: v.status, comment: v.comment || '' };
  if (v.regular) rec.slot = takeSlot(st, v.date, v.startTime, v.durationMinutes);
  s.lessons.push(rec);
  return rec;
}

// orig — заняття, яке редагували (результат findLesson); v — значення форми. Повертає запис, що тепер є цим заняттям.
export function updateLesson(s, orig, v) {
  const st = s.students.find(x => x.id === orig.studentId);
  if (!st) throw new Error('Учня не знайдено.');
  const rec = recOf(s, orig);
  const f = { status: v.status, date: v.date, startTime: v.startTime, durationMinutes: v.durationMinutes, topic: v.topic || 'Заняття', comment: v.comment || '' };
  if (orig.regular && v.date !== orig.date) { // перенесення регулярного: на старій даті «Перенесено», на новій — окреме заняття
    if (rec) rec.status = 'Перенесено';
    else s.lessons.push({ id: nextId(s), studentId: st.id, regular: true, slot: orig.slot, date: orig.date, startTime: orig.startTime, durationMinutes: orig.durationMinutes, topic: orig.topic, comment: '', status: 'Перенесено' });
    const moved = { id: nextId(s), studentId: st.id, regular: false, ...f };
    s.lessons.push(moved);
    return moved;
  }
  if (!rec) { const n = { id: nextId(s), studentId: st.id, regular: true, slot: orig.slot, ...f }; s.lessons.push(n); return n; } // згенероване → зберігаємо запис
  const toRegular = !orig.regular && v.regular;
  if (toRegular && dupRegular(s, st, v.date, findSlot(st, v.date, v.startTime, v.durationMinutes))) throw new Error(DUP);
  Object.assign(rec, f);
  if (toRegular) { rec.regular = true; rec.slot = takeSlot(st, v.date, v.startTime, v.durationMinutes); }
  return rec;
}

// Регулярне заняття скасовується (лишається в історії), окреме — видаляється разом із ДЗ.
export function deleteLesson(s, orig) {
  const rec = recOf(s, orig);
  if (!orig.regular) {
    s.lessons.splice(s.lessons.indexOf(rec), 1);
    s.homework = s.homework.filter(h => h.lessonId !== rec.id);
    return;
  }
  if (rec) rec.status = 'Скасовано';
  else s.lessons.push({ id: nextId(s), studentId: orig.studentId, regular: true, slot: orig.slot, date: orig.date, startTime: orig.startTime, durationMinutes: orig.durationMinutes, topic: orig.topic, comment: '', status: 'Скасовано' });
}