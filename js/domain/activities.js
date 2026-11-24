import { nextId } from '../core/schema.js';
import { dateFrom, dateKey, addDays } from '../core/dates.js';

// Справа репетитора: { id, title, category, date, startTime, durationMinutes }
export const CATEGORIES = ['Підготовка матеріалів', 'Формування звітності', 'Планування', 'Навчання й розвиток', 'Адміністративне', 'Особисте', 'Інше'];
const MAX_REPEATS = 60;

function clean(v) {
    const title = String(v.title || v.category || '').trim();
    if (!title) throw new Error('Вкажіть назву справи.');
    if (!v.date || !v.startTime) throw new Error('Вкажіть дату й час початку.');
    if (!(v.durationMinutes >= 5)) throw new Error('Тривалість має бути не менше 5 хвилин.');
    return { title, category: v.category || CATEGORIES[0], date: v.date, startTime: v.startTime, durationMinutes: v.durationMinutes };
}

// Викликати всередині store.update. Усі перевірки — до змін.
// v.until — необов'язкова дата, до якої справа повторюється щотижня (кожне повторення — окремий запис).
export function createActivity(s, v) {
    const base = clean(v), dates = [base.date];
    if (v.until) {
        if (v.until < base.date) throw new Error('Кінець повторів раніше за початок.');
        for (let d = addDays(dateFrom(base.date), 7); dateKey(d) <= v.until; d = addDays(d, 7)) dates.push(dateKey(d));
        if (dates.length > MAX_REPEATS) throw new Error(`Забагато повторів (максимум ${MAX_REPEATS} тижнів).`);
    }
    dates.forEach(date => s.activities.push({ id: nextId(s), ...base, date }));
}
export function updateActivity(s, id, v) {
    const a = s.activities.find(x => x.id === id); if (!a) throw new Error('Справу не знайдено.');
    Object.assign(a, clean(v));
}
export const deleteActivity = (s, id) => { s.activities = s.activities.filter(a => a.id !== id); };