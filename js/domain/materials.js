import { nextId } from '../core/schema.js';

// Матеріал: { id, name, type, price, link, studentIds, note, date, archived }
// price — загальна вартість (0 = безкоштовний), ділиться порівну між учнями матеріалу.
export const TYPES = ['Підручник', 'Збірник задач', 'Зошит', 'Відео', 'Онлайн-курс', 'Тести', 'Конспект / шпаргалка', 'Власний матеріал', 'Інше'];
export const isFree = m => !(m.price > 0);
export const sharePerStudent = m => m.price > 0 && m.studentIds.length ? m.price / m.studentIds.length : null;
export const isUrl = u => /^https?:\/\//i.test(u || '');
export const materialsOf = (db, studentId) => db.materials.filter(m => !m.archived && m.studentIds.includes(studentId));

function clean(db, v) {
    const name = String(v.name || '').trim();
    if (!name) throw new Error('Вкажіть назву матеріалу.');
    const price = v.price === '' || v.price == null ? 0 : Number(v.price);
    if (!(price >= 0)) throw new Error('Ціна має бути числом не менше 0.');
    const link = String(v.link || '').trim();
    if (link && !isUrl(link)) throw new Error('Посилання має починатися з http:// або https://');
    if (!v.date) throw new Error('Вкажіть дату додавання.');
    return {
        name, type: TYPES.includes(v.type) ? v.type : TYPES[TYPES.length - 1], price, link, note: String(v.note || '').trim(), date: v.date,
        studentIds: [...new Set(v.studentIds || [])].filter(id => db.students.some(s => s.id === id))
    };
}

// Усі зміни викликати всередині store.update; перевірки — до змін.
export function saveMaterial(db, id, v) {
    const c = clean(db, v);
    if (id == null) { db.materials.push({ id: nextId(db), archived: false, ...c }); return; }
    const m = db.materials.find(x => x.id === id); if (!m) throw new Error('Матеріал не знайдено.');
    Object.assign(m, c);
}
export function setArchived(db, id, flag) {
    const m = db.materials.find(x => x.id === id); if (m) m.archived = !!flag;
}
export function deleteMaterial(db, id) {
    const m = db.materials.find(x => x.id === id); if (!m) return;
    if (!isFree(m)) throw new Error('Платний матеріал не видаляється, щоб не зникла витрата. Заархівуйте його.');
    db.materials = db.materials.filter(x => x.id !== id);
}