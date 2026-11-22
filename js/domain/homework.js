import { nextId } from '../core/schema.js';

export const HW_STATUSES = ['Видано', 'Виконано', 'З помилками', 'Не виконано'];

// ДЗ заняття (поки що одне на заняття). Викликати з готовим станом: homeworkOf(store.get(), lessonId)
export const homeworkOf = (s, lessonId) => lessonId == null ? null : s.homework.find(h => h.lessonId === lessonId) || null;

// Усередині store.update. v === null — прибрати ДЗ.
// prevId — id заняття до редагування: якщо заняття перенесли, ДЗ їде за ним.
export function saveHomework(s, lessonRec, v, prevId = null) {
    const from = prevId != null ? prevId : lessonRec.id;
    const i = s.homework.findIndex(h => h.lessonId === from);
    if (!v) { if (i >= 0) s.homework.splice(i, 1); return; }
    if (i >= 0) Object.assign(s.homework[i], v, { lessonId: lessonRec.id });
    else s.homework.push({ id: nextId(s), studentId: lessonRec.studentId, lessonId: lessonRec.id, status: 'Видано', submittedDate: '', grade: '', comment: '', ...v });
}