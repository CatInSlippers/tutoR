import { nextId } from '../core/schema.js';

// Бібліотека модулів: db.catalog = [{ id, name, topics: [{ id, name, weight, skills: [{ id, name }] }] }]
// weight — коефіцієнт складності теми (1–5): за ним пізніше розподілятиметься кількість занять у плані.
export const WEIGHT_LABELS = ['1 — легка', '2 — нескладна', '3 — середня', '4 — складна', '5 — дуже складна'];
export const DEFAULT_WEIGHT = 3;
export const weightOf = t => t.weight ?? DEFAULT_WEIGHT; // старі теми без коефіцієнта вважаються середніми

const clean = name => { const n = String(name || '').trim(); if (!n) throw new Error('Назва не може бути порожньою.'); return n; };
const normWeight = w => { const n = Math.round(Number(w)); if (!(n >= 1 && n <= 5)) throw new Error('Складність має бути від 1 до 5.'); return n; };

// level: 0 — модуль, 1 — тема, 2 — навичка
export function findNode(db, id) {
    const cat = db.catalog;
    for (let i = 0; i < cat.length; i++) {
        if (cat[i].id === id) return { list: cat, i, node: cat[i], level: 0 };
        const ts = cat[i].topics;
        for (let j = 0; j < ts.length; j++) {
            if (ts[j].id === id) return { list: ts, i: j, node: ts[j], level: 1 };
            const ks = ts[j].skills;
            for (let k = 0; k < ks.length; k++) if (ks[k].id === id) return { list: ks, i: k, node: ks[k], level: 2 };
        }
    }
    return null;
}
export const counts = m => ({
    topics: m.topics.length,
    skills: m.topics.reduce((a, t) => a + t.skills.length, 0),
    weight: m.topics.reduce((a, t) => a + weightOf(t), 0)
});

// ===== Зміни (викликати всередині store.update; усі перевірки — до змін) =====
export function addModule(db, name) { db.catalog.push({ id: nextId(db), name: clean(name), topics: [] }); }
export function addChild(db, parentId, name, weight) { // до модуля додається тема (зі складністю), до теми — навичка
    const f = findNode(db, parentId); if (!f || f.level === 2) throw new Error('Не знайдено, куди додати.');
    const nm = clean(name);
    if (f.level === 0) f.node.topics.push({ id: nextId(db), name: nm, weight: normWeight(weight ?? DEFAULT_WEIGHT), skills: [] });
    else f.node.skills.push({ id: nextId(db), name: nm });
}
export function renameNode(db, id, name, weight) { // weight враховується лише для тем
    const f = findNode(db, id); if (!f) throw new Error('Не знайдено.');
    const nm = clean(name), w = f.level === 1 && weight != null ? normWeight(weight) : null;
    f.node.name = nm; if (w != null) f.node.weight = w;
}
export function moveNode(db, id, dir) {
    const f = findNode(db, id); if (!f) return;
    const j = f.i + dir; if (j < 0 || j >= f.list.length) return;
    [f.list[f.i], f.list[j]] = [f.list[j], f.list[f.i]];
}
export function removeNode(db, id) {
    const f = findNode(db, id); if (f) f.list.splice(f.i, 1);
}