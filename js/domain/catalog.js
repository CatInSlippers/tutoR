import { nextId } from '../core/schema.js';

// Бібліотека: db.catalog = [{ id, name, topics: [{ id, name, weight, subtopics: [{ id, name, weight|null, skills: [{ id, name }] }] }] }]
// weight теми — складність за замовчуванням; weight підтеми null означає «як у теми».
// Заняття в плані розподілятимуться за складністю підтем (subWeight).
export const WEIGHT_LABELS = ['1 — легка', '2 — нескладна', '3 — середня', '4 — складна', '5 — дуже складна'];
export const DEFAULT_WEIGHT = 3;
export const topicWeight = t => t.weight ?? DEFAULT_WEIGHT;
export const subWeight = (t, s) => s.weight ?? topicWeight(t);
export const topicTotal = t => t.subtopics.length ? t.subtopics.reduce((a, s) => a + subWeight(t, s), 0) : topicWeight(t);
export const counts = m => ({
    topics: m.topics.length,
    subtopics: m.topics.reduce((a, t) => a + t.subtopics.length, 0),
    skills: m.topics.reduce((a, t) => a + t.subtopics.reduce((b, s) => b + s.skills.length, 0), 0),
    weight: m.topics.reduce((a, t) => a + topicTotal(t), 0)
});

const clean = name => { const n = String(name || '').trim(); if (!n) throw new Error('Назва не може бути порожньою.'); return n; };
const normWeight = w => { const n = Math.round(Number(w)); if (!(n >= 1 && n <= 5)) throw new Error('Складність має бути від 1 до 5.'); return n; };

// Навички з рядків тексту: однакові назви зберігають id, решта рядків перейменовують старі навички за порядком
function matchSkills(db, prev, lines) {
    const names = lines.map(x => String(x).trim()).filter(Boolean);
    const left = [...prev], out = new Array(names.length);
    names.forEach((n, i) => { const j = left.findIndex(s => s.name === n); if (j >= 0) out[i] = left.splice(j, 1)[0]; });
    names.forEach((n, i) => { if (!out[i]) { const s = left.shift(); out[i] = s ? { ...s, name: n } : { id: nextId(db), name: n }; } });
    return out.map(s => ({ id: s.id, name: s.name }));
}

// Створює (id = null) або повністю оновлює модуль. Усі перевірки виконуються до змін.
// v: { name, topics: [{ id|null, name, weight, subtopics: [{ id|null, name, weight|null, skills: [рядки] }] }] }
export function saveModule(db, id, v) {
    const name = clean(v.name);
    const topics = v.topics.map(t => ({
        ...t, name: clean(t.name), weight: normWeight(t.weight),
        subtopics: t.subtopics.map(s => ({ ...s, name: clean(s.name), weight: s.weight == null ? null : normWeight(s.weight) }))
    }));
    const old = id == null ? null : db.catalog.find(m => m.id === id);
    if (id != null && !old) throw new Error('Модуль не знайдено.');
    const oldTopics = new Map((old?.topics || []).map(t => [t.id, t]));
    const next = topics.map(t => {
        const pt = oldTopics.get(t.id), oldSubs = new Map((pt?.subtopics || []).map(s => [s.id, s]));
        return {
            id: pt ? pt.id : nextId(db), name: t.name, weight: t.weight,
            subtopics: t.subtopics.map(s => {
                const ps = oldSubs.get(s.id);
                return { id: ps ? ps.id : nextId(db), name: s.name, weight: s.weight, skills: matchSkills(db, ps ? ps.skills : [], s.skills) };
            })
        };
    });
    if (old) { old.name = name; old.topics = next; } else db.catalog.push({ id: nextId(db), name, topics: next });
}
export const removeModule = (db, id) => { db.catalog = db.catalog.filter(m => m.id !== id); };