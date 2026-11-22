import { dateKey, addDays } from '../core/dates.js';
import { nextId } from '../core/schema.js';
export const PALETTE = ['#4c6fff', '#e6892e', '#2e9e6b', '#c2410c', '#9333ea', '#0891b2'];
// Викликати всередині store.update(s => s.students.push(makeStudent(s, {...})))
export function makeStudent(s, { firstName, lastName = '', phone = '', lessonPrice = 250 }) {
  return {
    id: nextId(s), color: PALETTE[s.students.length % PALETTE.length], firstName, lastName,
    name: `${firstName} ${lastName}`.trim(), phone, email: '', guardian: { name: '', relation: '', phone: '' },
    payer: 'guardian', payerOther: '', learningGoal: '', format: 'Офлайн', stage: 'Пробний',
    studyStart: dateKey(new Date()), studyEnd: dateKey(addDays(new Date(), 365)),
    slots: [], vacations: [], lessonPrice, payType: 'За заняття', packSize: 4, payMethod: 'Переказ на картку',
    learningLevel: '', course: [], plan: []
  };
}
