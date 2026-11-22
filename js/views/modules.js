import { html, mount, delegate } from '../core/html.js';
import * as store from '../core/store.js';
import { askForm, askConfirm, askNotice } from '../core/ui.js';
import { findNode, counts, weightOf, WEIGHT_LABELS, DEFAULT_WEIGHT, addModule, addChild, renameNode, moveNode, removeNode } from '../domain/catalog.js';

const collapsed = new Set(); // згорнуті модулі (живуть лише поки відкрита сторінка)
const plural = (n, [a, b, c]) => { const m = n % 100, d = n % 10; return `${n} ${m > 10 && m < 15 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c}`; };
const TOPICS = ['тема', 'теми', 'тем'], SKILLS = ['навичка', 'навички', 'навичок'];
const dots = w => '●'.repeat(w) + '○'.repeat(5 - w);

const tools = id => html`<button class="tbtn" data-act="catMove" data-id="${id}" data-dir="-1" title="Вище">↑</button><button class="tbtn" data-act="catMove" data-id="${id}" data-dir="1" title="Нижче">↓</button><button class="tbtn" data-act="catRename" data-id="${id}" title="Редагувати">✎</button><button class="danger tbtn" data-act="catDel" data-id="${id}" title="Видалити">×</button>`;

export function renderModules(el) {
    const cat = store.get().catalog;
    mount(el, html`<div class="pwrap">
    <div class="row" style="margin:14px 0"><div class="spacer"><h2 style="margin:0">Модулі навчання</h2>
      <div class="muted">Бібліотека: модуль → теми → навички. Кожна тема має складність від 1 до 5: за нею потім розподілятиметься кількість занять у плані. З бібліотеки програма навчання учня копіюється як знімок, тому зміни тут не чіпають уже створені програми.</div></div>
      <button class="primary" data-act="catAddMod">+ Модуль</button></div>
    ${cat.length ? cat.map(m => {
        const c = counts(m), open = !collapsed.has(m.id);
        return html`<div class="card catmod">
        <div class="row"><button class="tbtn" data-act="catToggle" data-id="${m.id}" title="${open ? 'Згорнути' : 'Розгорнути'}">${open ? '▾' : '▸'}</button>
          <b class="spacer">${m.name} <span class="muted">· ${plural(c.topics, TOPICS)} · ${plural(c.skills, SKILLS)} · сумарна складність ${c.weight}</span></b>${tools(m.id)}</div>
        ${open ? html`${m.topics.map(t => html`<div class="cattopic">
            <div class="row"><b class="spacer">${t.name} <span class="wt" title="Складність ${weightOf(t)} з 5">${dots(weightOf(t))}</span></b>${tools(t.id)}</div>
            ${t.skills.map(k => html`<div class="catskill"><span class="spacer">${k.name}</span>${tools(k.id)}</div>`)}
            <button class="tbtn" data-act="catAdd" data-id="${t.id}" style="margin:6px 0 0 18px">+ навичка</button></div>`)}
          <button class="tbtn" data-act="catAdd" data-id="${m.id}" style="margin:10px 0 0 28px">+ тема</button>` : ''}</div>`;
    }) : html`<div class="card muted">Бібліотека порожня. Створи перший модуль, наприклад «Алгебра», і додай до нього теми та навички.</div>`}
  </div>`);

    const run = fn => { try { store.update(fn); } catch (e) { askNotice(e.message); } };
    const weightField = w => ({ k: 'weight', label: 'Складність теми', options: WEIGHT_LABELS, value: WEIGHT_LABELS[w - 1] });
    delegate(el, {
        catToggle: b => { const id = +b.dataset.id; collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); renderModules(el); },
        async catAddMod() {
            const v = await askForm('Новий модуль', [{ k: 'name', label: 'Назва модуля', required: true }]);
            if (v) run(db => addModule(db, v.name));
        },
        async catAdd(b) {
            const id = +b.dataset.id, f = findNode(store.get(), id); if (!f) return;
            const topic = f.level === 0;
            const v = await askForm(topic ? 'Нова тема' : 'Нова навичка',
                topic ? [{ k: 'name', label: 'Назва теми', required: true }, weightField(DEFAULT_WEIGHT)] : [{ k: 'name', label: 'Назва навички', required: true }]);
            if (v) run(db => addChild(db, id, v.name, topic ? parseInt(v.weight) : undefined));
        },
        async catRename(b) {
            const id = +b.dataset.id, f = findNode(store.get(), id); if (!f) return;
            const topic = f.level === 1, fields = [{ k: 'name', label: 'Назва', required: true, value: f.node.name }];
            if (topic) fields.push(weightField(weightOf(f.node)));
            const v = await askForm(topic ? 'Редагувати тему' : 'Перейменувати', fields);
            if (v) run(db => renameNode(db, id, v.name, topic ? parseInt(v.weight) : undefined));
        },
        catMove: b => run(db => moveNode(db, +b.dataset.id, +b.dataset.dir)),
        async catDel(b) {
            const id = +b.dataset.id, f = findNode(store.get(), id); if (!f) return;
            const q = f.level === 0 ? `Видалити модуль «${f.node.name}» разом з темами й навичками? У вже створених програмах учнів він залишиться.`
                : f.level === 1 ? `Видалити тему «${f.node.name}» разом з її навичками?` : `Видалити навичку «${f.node.name}»?`;
            if (await askConfirm(q, 'Видалити')) run(db => removeNode(db, id));
        }
    });
}