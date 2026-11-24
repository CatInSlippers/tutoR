import { html, mount, delegate, esc } from '../core/html.js';
import * as store from '../core/store.js';
import { modal, askConfirm, askNotice } from '../core/ui.js';
import { counts, topicWeight, topicTotal, subWeight, WEIGHT_LABELS, DEFAULT_WEIGHT, saveModule, removeModule } from '../domain/catalog.js';

const collapsed = new Set(); // згорнуті модулі (живуть лише поки відкрита сторінка)
const plural = (n, [a, b, c]) => { const m = n % 100, d = n % 10; return `${n} ${m > 10 && m < 15 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c}`; };
const TOPICS = ['тема', 'теми', 'тем'], SUBS = ['підтема', 'підтеми', 'підтем'], SKILLS = ['навичка', 'навички', 'навичок'];
const dots = w => '●'.repeat(w) + '○'.repeat(5 - w);

export function renderModules(el) {
    const cat = store.get().catalog;
    mount(el, html`<div class="pwrap">
    <div class="row" style="margin:14px 0"><div class="spacer"><h2 style="margin:0">Модулі навчання</h2>
      <div class="muted">Бібліотека: модуль → тема → підтема → навички. Складність (1–5) задається темі, підтеми її успадковують, але кожній можна поставити свою. За складністю підтем у плані розподілятимуться заняття. Програма учня копіюється з бібліотеки як знімок, тому зміни тут не чіпають уже створені програми.</div></div>
      <button class="primary" data-act="catEdit" data-id="">+ Модуль</button></div>
    ${cat.length ? cat.map(m => {
        const c = counts(m), open = !collapsed.has(m.id);
        return html`<div class="card catmod">
        <div class="row"><button class="tbtn" data-act="catToggle" data-id="${m.id}" title="${open ? 'Згорнути' : 'Розгорнути'}">${open ? '▾' : '▸'}</button>
          <b class="spacer">${m.name} <span class="muted">· ${plural(c.topics, TOPICS)} · ${plural(c.subtopics, SUBS)} · ${plural(c.skills, SKILLS)} · сумарна складність ${c.weight}</span></b>
          <button class="tbtn" data-act="catEdit" data-id="${m.id}">Редагувати</button></div>
        ${open ? (m.topics.length ? m.topics.map(t => html`<div class="ct">
            <div class="ct-name">${t.name} <span class="wt" title="Складність теми ${topicWeight(t)} з 5">${dots(topicWeight(t))}</span> <span class="muted ct-sum">${t.subtopics.length ? `сума підтем ${topicTotal(t)}` : ''}</span></div>
            ${t.subtopics.map(s => html`<div class="cs"><div class="cs-name">${s.name} <span class="wt ${s.weight == null ? 'inh' : ''}" title="${s.weight == null ? 'Успадковано від теми' : 'Власна складність'}: ${subWeight(t, s)} з 5">${dots(subWeight(t, s))}</span></div>
              ${s.skills.length ? html`<div class="ct-sk">${s.skills.map(k => html`<span class="skchip">${k.name}</span>`)}</div>` : ''}</div>`)}</div>`)
                : html`<div class="ct muted">Тем ще немає. Натисни «Редагувати», щоб додати.</div>`) : ''}</div>`;
    }) : html`<div class="card muted">Бібліотека порожня. Створи перший модуль, наприклад «Алгебра», і додай до нього теми, підтеми та навички.</div>`}
  </div>`);

    delegate(el, {
        catToggle: b => { const id = +b.dataset.id; collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); renderModules(el); },
        catEdit: b => editModule(b.dataset.id ? +b.dataset.id : null)
    });
}

// ---------- вікно редагування модуля ----------
const mv = (scope) => `<button type="button" class="tbtn" data-m="up" data-s="${scope}" title="Вище">↑</button><button type="button" class="tbtn" data-m="down" data-s="${scope}" title="Нижче">↓</button><button type="button" class="danger tbtn" data-m="del" data-s="${scope}" title="Прибрати">×</button>`;

const subRow = (s = {}) => `<div class="sr" data-id="${s.id ?? ''}">
  <div class="sr-head"><input class="sr-name" value="${esc(s.name || '')}" placeholder="Назва підтеми" required>
    <select class="sr-w" title="Складність підтеми"><option value="">як у теми</option>${WEIGHT_LABELS.map((l, i) => `<option value="${i + 1}" ${s.weight === i + 1 ? 'selected' : ''}>${l}</option>`).join('')}</select>${mv('sub')}</div>
  <textarea class="sr-sk" rows="2" placeholder="Навчики: кожен пункт з нового рядка">${esc((s.skills || []).map(k => k.name).join('\n'))}</textarea></div>`;

const topicRow = (t = {}) => {
    const w = t.weight ?? DEFAULT_WEIGHT;
    return `<div class="tr" data-id="${t.id ?? ''}">
    <div class="tr-head"><input class="tr-name" value="${esc(t.name || '')}" placeholder="Назва теми" required>
      <select class="tr-w" title="Складність теми (її успадковують підтеми)">${WEIGHT_LABELS.map((l, i) => `<option value="${i + 1}" ${i + 1 === w ? 'selected' : ''}>${l}</option>`).join('')}</select>${mv('top')}</div>
    <div class="sl">${(t.subtopics || []).map(subRow).join('')}</div>
    <button type="button" class="tbtn" data-m="addsub" style="margin-top:6px">+ Підтема</button></div>`;
};

async function editModule(id) {
    const m = id == null ? null : store.get().catalog.find(x => x.id === id);
    if (id != null && !m) return;
    const inner = html`<label>Назва модуля</label><input name="mname" value="${m?.name || ''}" required>
    <div class="tl-head"><b>Теми</b><span class="muted">складність теми успадковують її підтеми, якщо не задано свою</span></div>
    <div id="tlist"></div>
    <button type="button" id="addTopic" class="tbtn" style="margin-top:8px">+ Тема</button>
    ${m ? html`<div><button type="button" class="danger" id="delMod" style="margin-top:16px">Видалити модуль</button></div>` : ''}`.s;

    const wire = d => {
        const list = d.querySelector('#tlist');
        list.innerHTML = (m ? m.topics : []).map(topicRow).join('');
        d.querySelector('#addTopic').onclick = () => { list.insertAdjacentHTML('beforeend', topicRow()); list.lastElementChild.querySelector('.tr-name').focus(); };
        list.addEventListener('click', e => {
            const b = e.target.closest('[data-m]'); if (!b) return;
            const a = b.dataset.m;
            if (a === 'addsub') { const sl = b.closest('.tr').querySelector('.sl'); sl.insertAdjacentHTML('beforeend', subRow()); sl.lastElementChild.querySelector('.sr-name').focus(); return; }
            const row = b.closest(b.dataset.s === 'sub' ? '.sr' : '.tr');
            if (a === 'del') row.remove();
            else if (a === 'up' && row.previousElementSibling) row.parentElement.insertBefore(row, row.previousElementSibling);
            else if (a === 'down' && row.nextElementSibling) row.parentElement.insertBefore(row.nextElementSibling, row);
        });
        const del = d.querySelector('#delMod'); if (del) del.onclick = () => d.close('delete');
    };

    const d = await modal(m ? `Модуль: ${m.name}` : 'Новий модуль', inner, 'Зберегти', wire);
    if (d.returnValue === 'delete') {
        if (await askConfirm(`Видалити модуль «${m.name}» разом з темами, підтемами й навичками? У вже створених програмах учнів він залишиться.`, 'Видалити'))
            store.update(db => removeModule(db, id));
        return;
    }
    if (d.returnValue !== 'ok') return;
    const data = {
        name: d.querySelector('[name=mname]').value,
        topics: [...d.querySelectorAll('#tlist > .tr')].map(r => ({
            id: r.dataset.id ? +r.dataset.id : null,
            name: r.querySelector('.tr-name').value, weight: +r.querySelector('.tr-w').value,
            subtopics: [...r.querySelectorAll('.sl > .sr')].map(s => ({
                id: s.dataset.id ? +s.dataset.id : null,
                name: s.querySelector('.sr-name').value,
                weight: s.querySelector('.sr-w').value ? +s.querySelector('.sr-w').value : null,
                skills: s.querySelector('.sr-sk').value.split('\n')
            }))
        }))
    };
    try { store.update(db => saveModule(db, id, data)); } catch (e) { askNotice(e.message); }
}