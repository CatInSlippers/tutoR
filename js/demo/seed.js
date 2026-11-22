import { emptyData, nextId } from '../core/schema.js';
import { makeStudent } from '../domain/students.js';
import { dateKey, addDays, getMonday } from '../core/dates.js';
// Демо-дані: усі дати рахуються від сьогодні, тож календар завжди «живий».
const T = new Date(), rel = n => dateKey(addDays(T, n));
const onWeekday = (wd, weeksAgo) => dateKey(addDays(getMonday(addDays(T, -7 * weeksAgo)), (wd + 6) % 7)); // день тижня (0=Нд) у тижні «weeksAgo тому»
const ROWS = [
  ['Максим', 'Олегів', '000-000-0000', 250, { learningGoal: 'Підготовка до НМТ', stage: 'Навчається', studyStart: rel(-21), studyEnd: rel(150), slots: [{ weekday: 5, startTime: '14:00', durationMinutes: 90 }], guardian: { name: 'Анастасія Олегів', relation: 'мати', phone: '000-000-1111' } }],
  ['Дарина', 'Мельник', '000-000-2222', 300, { learningGoal: 'Підготовка до НМТ (математика)', stage: 'Навчається', format: 'Онлайн', studyStart: rel(-21), studyEnd: rel(150), slots: [{ weekday: 2, startTime: '16:00', durationMinutes: 60 }], guardian: { name: 'Ірина Мельник', relation: 'мати', phone: '000-000-2223' }, vacations: [{ start: rel(10), end: rel(16), reason: 'Канікули' }] }],
  ['Андрій', 'Шевчук', '000-000-3333', 250, { learningGoal: 'Підтягнути алгебру (8 клас)', stage: 'Навчається', studyStart: rel(-21), studyEnd: rel(60), slots: [{ weekday: 6, startTime: '10:00', durationMinutes: 60 }], guardian: { name: 'Віктор Шевчук', relation: 'батько', phone: '000-000-3334' } }]
];
export function seed() {
  const s = emptyData();
  ROWS.forEach(([firstName, lastName, phone, lessonPrice, extra]) => s.students.push(Object.assign(makeStudent(s, { firstName, lastName, phone, lessonPrice }), extra)));
  const [max, dar, and] = s.students, L = (st, wd, w, start, dur, status, extra = {}) =>
    s.lessons.push({ id: nextId(s), studentId: st.id, regular: true, slot: 0, date: onWeekday(wd, w), startTime: start, durationMinutes: dur, topic: 'Заняття', status, comment: '', ...extra });
  L(max, 5, 1, '14:00', 90, 'Проведено', { topic: 'Тригонометрія' });
  L(dar, 2, 1, '16:00', 60, 'Пропущено (учень)', { comment: 'Захворіла.' });
  L(and, 6, 1, '10:00', 60, 'Пропущено (викладач)');
  L(max, 3, 0, '18:00', 60, 'Заплановано', { regular: false, slot: undefined, topic: 'Додаткове заняття' });
  s.activities.push(
    { id: nextId(s), date: onWeekday(4, 0), startTime: '13:00', durationMinutes: 45, title: 'Підготовка матеріалів', category: 'Підготовка матеріалів' },
    { id: nextId(s), date: onWeekday(3, 0), startTime: '18:30', durationMinutes: 30, title: 'Підготовка звіту', category: 'Формування звітності' }); // перетинається з додатковим заняттям
  return s;
}
