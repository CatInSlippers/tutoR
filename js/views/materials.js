import { html, mount, delegate, esc } from '../core/html.js';
import * as store from '../core/store.js';
import { modal, askConfirm, askNotice } from '../core/ui.js';
import { dateKey, dateFrom, ua } from '../core/dates.js';
import { TYPES, isFree, isUrl, sharePerStudent, materialsOf, saveMaterial, setArchived, deleteMaterial } from '../domain/materials.js';

const money = n => (Math.round(n * 100) / 100).toLocaleString('uk-UA') + ' грн';
const ACTIVE = ['Навчається', 'Пробний']; // без запиту пропонуємо лише діючих учнів
// Фільтри живуть у пам'яті сторінки, тож переживають перемальовування
let q = '', fType = '', showArch = false;

const nameOf = (db, id) => db.students.find(s => s.id === id)?.name || '';
function matches(db, m) {
  const hay = `${m.name} ${m.type} ${m.note} ${m.studentIds.map(id => nameOf(db, id)).join(' ')}`.toLowerCase();
  return (!q.trim() || hay.includes(q.trim().toLowerCase())) && (!fType || m.type === fType) && (showArch || !m.archived);
}

function listView() {
  const db = store.get();
  const list = db.materials.filter(m => matches(db, m)).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  if (!db.materials.length) return html`<div class="card muted">Матеріалів ще немає. Додай перший: підручник, збірник, відео чи посилання на курс.</div>`;
  if (!list.length) return html`<div class="card muted">Нічого не знайдено. Зміни пошук або фільтри.</div>`;
  const total = list.reduce((a, m) => a + (m.price || 0), 0);
  return html`<div class="muted" style="margin-bottom:8px">Показано: ${list.length} · вартість ${money(total)}</div>
    <div class="card"><div class="hist-wrap"><table class="hist">
      <tr><th>Матеріал</th><th>Тип</th><th>Ціна</th><th>Учні</th><th></th></tr>
      ${list.map(m => {
    const sh = sharePerStudent(m), names = m.studentIds.map(id => nameOf(db, id));
    return html`<tr class="${m.archived ? 'mat-arch' : ''}">
        <td><b>${m.name}</b>${isUrl(m.link) ? html` <a href="${m.link}" target="_blank" rel="noopener" title="Відкрити матеріал">↗</a>` : ''}${m.archived ? html` <span class="skchip">архів</span>` : ''}
          <div class="muted" style="font-size:12px">додано ${ua(dateFrom(m.date))}${m.note ? ' · ' + m.note : ''}</div></td>
        <td>${m.type}</td>
        <td>${isFree(m) ? html`<span class="muted">безкоштовно</span>` : html`${money(m.price)}${sh ? html`<div class="muted" style="font-size:12px">по ${money(sh)} на учня</div>` : ''}`}</td>
        <td>${names.length ? html`${names.slice(0, 3).map(n => html`<span class="skchip">${n}</span> `)}${names.length > 3 ? html`<span class="skchip" title="${names.slice(3).join(', ')}">+${names.length - 3}</span>` : ''}` : html`<span class="muted">—</span>`}</td>
        <td><button class="tbtn" data-act="matEdit" data-id="${m.id}">Редагувати</button></td></tr>`;
  })}
    </table></div></div>`;
}

export function renderMaterials(el) {
  mount(el, html`<div class="pwrap">
    <div class="row" style="margin:14px 0"><div class="spacer"><h2 style="margin:0">Матеріали</h2>
      <div class="muted">Підручники, збірники, відео й курси. Ціна матеріалу ділиться порівну між учнями, які ним користуються.</div></div>
      <button class="primary" data-act="matEdit" data-id="">+ Матеріал</button></div>
    <div class="mat-tools">
      <input id="mq" type="search" placeholder="Пошук за назвою, типом, приміткою, учнем…" value="${q}">
      <select id="mt"><option value="">Усі типи</option>${TYPES.map(t => html`<option ${t === fType ? 'selected' : ''}>${t}</option>`)}</select>
      <label class="chk"><input type="checkbox" id="ma" ${showArch ? 'checked' : ''}> Показати архівні</label></div>
    <div id="mlist"></div></div>`);

  const paint = () => mount(el.querySelector('#mlist'), listView()); // перемальовуємо лише таблицю, щоб поле пошуку не втрачало фокус
  paint();
  el.querySelector('#mq').oninput = e => { q = e.target.value; paint(); };
  el.querySelector('#mt').onchange = e => { fType = e.target.value; paint(); };
  el.querySelector('#ma').onchange = e => { showArch = e.target.checked; paint(); };
  delegate(el, { matEdit: b => editMaterial(b.dataset.id ? +b.dataset.id : null) });
}

// ---------- вікно матеріалу ----------
async function editMaterial(id) {
  const db = store.get(), m = id == null ? null : db.materials.find(x => x.id === id);
  if (id != null && !m) return;
  const M = m || {};
  const inner = html`<label>Назва</label><input name="name" value="${M.name || ''}" required>
    <div class="grid2">
      <div><label>Тип</label><select name="type">${TYPES.map(t => html`<option ${t === (M.type || TYPES[0]) ? 'selected' : ''}>${t}</option>`)}</select></div>
      <div><label>Ціна, грн (порожньо — безкоштовний)</label><input type="number" name="price" min="0" step="any" value="${M.price > 0 ? M.price : ''}"></div>
    </div>
    <label>Посилання (необов’язково)</label><input name="link" value="${M.link || ''}" placeholder="https://…">
    <label>Дата додавання</label><input type="date" name="date" value="${M.date || dateKey(new Date())}" required>
    <label>Хто використовує</label>
    ${db.students.length ? html`<div id="stuChips" class="stu-chips"></div>
      <div class="stu-add"><input id="stuQ" type="search" placeholder="Додати учня: почни вводити ім’я…" autocomplete="off"><div id="stuSug" class="stu-sug" hidden></div></div>`
      : html`<p class="muted">Учнів ще немає.</p>`}
    <label>Примітка (необов’язково)</label><textarea name="note" rows="2">${M.note || ''}</textarea>
    ${m ? html`<div class="row" style="margin-top:14px;gap:8px"><button type="button" id="arch">${m.archived ? 'Повернути з архіву' : 'Архівувати'}</button>${isFree(m) ? html`<button type="button" class="danger" id="del">Видалити</button>` : ''}</div>` : ''}`.s;

  const wire = d => {
    const a = d.querySelector('#arch'), x = d.querySelector('#del');
    if (a) a.onclick = () => d.close('archive');
    if (x) x.onclick = () => d.close('delete');

    const chips = d.querySelector('#stuChips'), qi = d.querySelector('#stuQ'), sug = d.querySelector('#stuSug');
    if (!chips) return;
    const sel = new Set((M.studentIds || []).filter(i => db.students.some(s => s.id === i)));
    const stu = i => db.students.find(s => s.id === i);
    // Вибрані учні: чипи зі схованими полями, які читає форма при збереженні
    const paintChips = () => {
      chips.innerHTML = [...sel].map(i => `<span class="tchip">${esc(stu(i).name)}<button type="button" data-rm="${i}" title="Прибрати">×</button><input type="hidden" name="stu" value="${i}"></span>`).join('')
        || '<span class="muted">Нікого не додано</span>';
    };
    const paintSug = () => {
      const t = qi.value.trim().toLowerCase();
      const pool = db.students.filter(s => !sel.has(s.id) && (t ? s.name.toLowerCase().includes(t) || (s.phone || '').includes(t) : ACTIVE.includes(s.stage)))
        .sort((x, y) => x.name.localeCompare(y.name, 'uk'));
      sug.innerHTML = pool.length
        ? pool.slice(0, 8).map(s => `<button type="button" class="sug" data-add="${s.id}">${esc(s.name)} <span class="muted">${esc(s.stage || '')}</span></button>`).join('')
        + (pool.length > 8 ? `<div class="muted sug-more">ще ${pool.length - 8}: уточни пошук</div>` : '')
        : `<div class="muted sug-more">${t ? 'Нікого не знайдено' : 'Усіх діючих учнів уже додано. Почни вводити ім’я.'}</div>`;
      sug.hidden = false;
    };
    const add = i => { sel.add(i); qi.value = ''; paintChips(); paintSug(); qi.focus(); };
    chips.onclick = e => { const b = e.target.closest('[data-rm]'); if (b) { sel.delete(+b.dataset.rm); paintChips(); } };
    sug.onmousedown = e => { const b = e.target.closest('[data-add]'); if (b) { e.preventDefault(); add(+b.dataset.add); } }; // mousedown, щоб поле не втратило фокус раніше за клік
    qi.onfocus = paintSug; qi.oninput = paintSug; qi.onblur = () => { sug.hidden = true; };
    qi.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const f = sug.querySelector('[data-add]'); if (f) add(+f.dataset.add); } }; // Enter не має зберігати форму
    paintChips();
  };

  const d = await modal(m ? 'Матеріал' : 'Новий матеріал', inner, 'Зберегти', wire);
  const run = fn => { try { store.update(fn); } catch (e) { askNotice(e.message); } };
  if (d.returnValue === 'archive') return run(s => setArchived(s, id, !m.archived));
  if (d.returnValue === 'delete') {
    if (await askConfirm(`Видалити матеріал «${m.name}»?`, 'Видалити')) run(s => deleteMaterial(s, id));
    return;
  }
  if (d.returnValue !== 'ok') return;
  const fd = new FormData(d.querySelector('form')), g = k => String(fd.get(k) ?? '').trim();
  const v = { name: g('name'), type: g('type'), price: g('price'), link: g('link'), date: g('date'), note: g('note'), studentIds: fd.getAll('stu').map(Number) };
  run(s => saveMaterial(s, id, v));
}

// Картка «Матеріали» для сторінки учня (лише перегляд; керування на сторінці «Матеріали»)
export function studentMaterials(s) {
  const db = store.get(), list = materialsOf(db, s.id);
  if (!list.length) return html`<p class="muted" style="margin:6px 0 0">Матеріалів немає. Додай учня до матеріалу на сторінці «Матеріали».</p>`;
  return html`${list.map(m => html`<div class="irow"><span>${isUrl(m.link) ? html`<a href="${m.link}" target="_blank" rel="noopener">${m.name}</a>` : m.name}</span><span class="muted">${m.type}</span></div>`)}`;
}