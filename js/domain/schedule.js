import { dateKey, dateFrom, addDays, mins, ua, DAYS_SHORT, endTime } from '../core/dates.js';

// Слот діє в межах activeFrom…activeTo (порожнє значення = без обмеження; старі слоти без полів теж працюють).
export const slotActive = (x, key) => (!x.activeFrom || key >= x.activeFrom) && (!x.activeTo || key <= x.activeTo);
export function slotState(x, today = dateKey(new Date())) {
    if (x.activeFrom && x.activeTo && x.activeTo < x.activeFrom) return 'empty'; // ніколи не діяв
    if (x.activeTo && x.activeTo < today) return 'closed';
    if (x.activeFrom && x.activeFrom > today) return 'future';
    return 'current';
}
export const currentSlots = (s, today) => s.slots.filter(x => slotState(x, today) === 'current');

const prevDay = key => dateKey(addDays(dateFrom(key), -1));
const stOf = (db, id) => { const st = db.students.find(x => x.id === id); if (!st) throw new Error('Учня не знайдено.'); return st; };
const rangesOverlap = (a, b) => (!a.activeTo || !b.activeFrom || b.activeFrom <= a.activeTo) && (!b.activeTo || !a.activeFrom || a.activeFrom <= b.activeTo);

function build({ weekday, start, end, from }) {
    const dur = mins(end) - mins(start);
    if (!(dur >= 15)) throw new Error('Кінець має бути пізніше за початок щонайменше на 15 хвилин.');
    if (!from) throw new Error('Вкажіть дату, з якої діє розклад.');
    return { weekday, startTime: start, durationMinutes: dur, activeFrom: from, activeTo: '' };
}
function checkOverlap(slots, slot, skip) {
    const s0 = mins(slot.startTime), e0 = s0 + slot.durationMinutes;
    slots.forEach((x, i) => {
        if (i === skip || slotState(x) === 'empty') return;
        if (x.weekday === slot.weekday && mins(x.startTime) < e0 && s0 < mins(x.startTime) + x.durationMinutes && rangesOverlap(x, slot))
            throw new Error(`Перетин із розкладом: ${DAYS_SHORT[x.weekday]} ${x.startTime}–${endTime(x.startTime, x.durationMinutes)}.`);
    });
}
// Період навчання має охоплювати дату початку нового слота
function fitStudy(st, from) {
    if (from < st.studyStart) st.studyStart = from;
    if (from > st.studyEnd) st.studyEnd = dateKey(addDays(dateFrom(from), 365));
}

// ===== Зміни розкладу (викликати всередині store.update; усі перевірки — до змін) =====
// v: { weekday (0–6), start 'HH:MM', end 'HH:MM', from 'YYYY-MM-DD' }
export function addSlot(db, studentId, v) {
    const st = stOf(db, studentId), slot = build(v);
    checkOverlap(st.slots, slot, -1);
    st.slots.push(slot); fitStudy(st, v.from);
}
// Змінити день/час з дати v.from: старий слот закривається попереднім днем, новий починається з v.from
export function changeSlot(db, studentId, idx, v) {
    const st = stOf(db, studentId), old = st.slots[idx];
    if (!old) throw new Error('Розклад не знайдено.');
    if (slotState(old) === 'closed') throw new Error('Цей розклад уже завершено.');
    if (old.activeFrom && v.from <= old.activeFrom) throw new Error(`Нова дата має бути пізнішою за початок дії цього розкладу (${ua(dateFrom(old.activeFrom))}).`);
    const slot = build(v); slot.activeTo = old.activeTo || '';
    const closed = { ...old, activeTo: prevDay(v.from) };
    checkOverlap(st.slots.map((x, i) => i === idx ? closed : x), slot, -1);
    old.activeTo = closed.activeTo; st.slots.push(slot); fitStudy(st, v.from);
}
// Припинити: занять за цим розкладом немає, починаючи з дати from
export function endSlot(db, studentId, idx, from) {
    const st = stOf(db, studentId), old = st.slots[idx];
    if (!old) throw new Error('Розклад не знайдено.');
    const last = prevDay(from);
    if (old.activeTo && last > old.activeTo) throw new Error('Цей розклад уже завершується раніше.');
    old.activeTo = last;
}