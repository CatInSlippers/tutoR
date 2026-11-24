import { html, esc } from '../core/html.js';
import * as store from '../core/store.js';
import { modal, askConfirm, askNotice } from '../core/ui.js';
import { dateKey, dateFrom, ua, DAYS_SHORT } from '../core/dates.js';
import { allLessons } from '../domain/finance.js';
import { upcomingLessons, moduleUnits, distribute, toEntries, plannedOn, saveLessonPlan, clearLessonPlan } from '../domain/plan.js';

const OFF = ['Перенесено', 'Скасовано'];
const COLORS = {
    'Заплановано': '#4c6fff', 'Проведено': '#2e9e6b', 'Відпрацювання': '#2e9e6b',
    'Пропущено (учень)': '#e6892e', 'Пропущено (викладач)': '#9333ea'
};
const dash = () => html`<span class="muted">—</span>`;
const dots = w => '●'.repeat(w) + '○'.repeat(5 - w);
const plural = (n, [a, b, c]) => { const m = n % 100, d = n % 10; return `${n} ${m > 10 && m < 15 ? c : d === 1 ? a : d >= 2 && d <= 4 ? b : c}`; };

export function planTab(s) {
    const db = store.get(), today = dateKey(new Date());
    const list = allLessons(db, s).filter(l => !OFF.includes(l.status))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    const next = list.find(l => l.date >= today); // найближче заняття підсвічуємо
    const hwOf = l => l.id == null ? [] : db.homework.filter(h => h.lessonId === l.id);
    const hasFuture = (s.lessonPlan || []).some(e => e.date >= today);

    const head = html`<div class="sec-h"><h3>Плани й підсумки занять</h3>
    ${hasFuture ? html`<button class="tbtn" data-act="plClear" data-sid="${s.id}">Очистити теми</button>` : ''}
    <button class="primary tbtn" data-act="plGen" data-sid="${s.id}">Створити розклад</button></div>`;

    if (!list.length) return html`<div class="card">${head}<p class="muted">Занять ще немає.</p></div>`;

    return html`<div class="card">${head}
    <p class="muted" style="margin:0 0 10px">Теми й «що повторити» з’являються після кнопки «Створити розклад». ДЗ, статус і коментар беруться із занять у календарі. Тема, вписана у вікні заняття, має пріоритет над запланованою.</p>
    <div class="hist-wrap pl-wrap"><table class="hist pl">
      <tr><th>Дата</th><th>Тема</th><th>План заняття</th><th>Матеріали</th><th>ДЗ</th><th>Результат</th><th>Коментар</th></tr>
      ${list.map(l => {
        const c = COLORS[l.status] || '#777', hw = hwOf(l), pe = plannedOn(s, l.date), typed = l.topic && l.topic !== 'Заняття';
        const topicCell = typed ? html`<b>${l.topic}</b>` : pe
            ? pe.items.map(i => html`<div><b>${i.name}</b>${i.parts > 1 ? ` (${i.part}/${i.parts})` : ''}<div class="muted pl-t">${i.topic}</div></div>`) : dash();
        const withSk = pe ? pe.items.filter(i => i.skills.length) : [], nSk = withSk.reduce((a, i) => a + i.skills.length, 0); return html`<tr class="${l === next ? 'pl-next' : ''}">
          <td><b>${ua(dateFrom(l.date))}</b><br><span class="muted">${DAYS_SHORT[dateFrom(l.date).getDay()]} ${l.startTime}</span></td>
          <td>${topicCell}</td>
          <td>${nSk ? html`<details class="pl-det"><summary>Що повторити · ${plural(nSk, ['пункт', 'пункти', 'пунктів'])}</summary>
            ${withSk.map(i => html`${withSk.length > 1 ? html`<div class="pl-sh">${i.name}</div>` : ''}<ul class="pl-ul">${i.skills.map(k => html`<li>${k}</li>`)}</ul>`)}</details>` : dash()}</td>
            <td>${dash()}</td>
          <td>${hw.length ? hw.map(h => html`<div>${h.task}</div>`) : dash()}</td>
          <td><span class="hwpill" style="background:${c}22;color:${c}">${l.status}</span></td>
          <td>${l.comment ? l.comment : dash()}</td></tr>`;
    })}
    </table></div></div>`;
}

const stu = b => store.get().students.find(x => x.id === +b.dataset.sid);

// ---------- вікно «Створити розклад» ----------
async function generate(b) {
    const db = store.get(), s = stu(b); if (!s) return;
    if (!db.catalog.length) return askNotice('Бібліотека модулів порожня. Спершу створи модуль на сторінці «Модулі навчання».');
    const lessons = upcomingLessons(db, s);
    if (!lessons.length) return askNotice('У календарі немає майбутніх запланованих занять цього учня.');

    let cur = null; // поточна розстановка: { units, dates, assign }
    const inner = `<div class="gen-top">
      <div><label>Модуль</label><select id="gMod">${db.catalog.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></div>
      <div><label>На скількох найближчих заняттях (є ${lessons.length})</label><input id="gN" type="number" min="1" max="${lessons.length}" value="${lessons.length}"></div>
      <button type="button" id="gRun" class="tbtn">Розставити заново</button></div>
    <div id="gInfo"></div><div id="gList"></div>`;

    const wire = d => {
        const q = x => d.querySelector(x), list = q('#gList');
        const mod = () => db.catalog.find(m => m.id === +q('#gMod').value);
        const paint = () => {
            const byId = new Map(cur.units.map(u => [u.id, u])), total = new Map(), seen = new Map();
            cur.assign.forEach(l => l.forEach(id => total.set(id, (total.get(id) || 0) + 1)));
            const missing = cur.units.filter(u => !total.has(u.id)), W = cur.units.reduce((a, u) => a + u.weight, 0);
            q('#gInfo').innerHTML = `<p class="muted" style="margin:10px 0 0">Підтем: ${cur.units.length} · сумарна складність ${W} · занять: ${cur.dates.length}. Зайву підтему прибери «×», потрібну додай зі списку під заняттям.</p>`
                + (cur.units.length ? '' : '<div class="gwarn">У цьому модулі ще немає підтем.</div>')
                + (missing.length ? `<div class="gwarn">Не розставлено: ${missing.map(u => esc(u.name)).join('; ')}</div>` : '');
            list.innerHTML = cur.dates.map((l, i) => {
                const items = cur.assign[i], sum = items.reduce((a, id) => a + (byId.get(id)?.weight || 0), 0);
                const chips = items.map(id => {
                    const u = byId.get(id), part = (seen.get(id) || 0) + 1; seen.set(id, part);
                    return `<span class="tchip">${esc(u.name)}${total.get(id) > 1 ? ` (${part}/${total.get(id)})` : ''} <span class="wt">${dots(u.weight)}</span><button type="button" data-rm="${id}" data-i="${i}" title="Прибрати із заняття">×</button></span>`;
                }).join('');
                return `<div class="gl"><div class="gl-date"><b>${ua(dateFrom(l.date))}</b><span class="muted">${DAYS_SHORT[dateFrom(l.date).getDay()]} ${l.startTime}</span><span class="muted gl-w">складність ${sum}</span></div>
          <div>${chips || '<span class="muted">без теми</span>'}</div>
          <select class="gl-add" data-i="${i}"><option value="">+ додати підтему…</option>${cur.units.filter(u => !items.includes(u.id)).map(u => `<option value="${u.id}">${esc(u.topic)}: ${esc(u.name)}</option>`).join('')}</select></div>`;
            }).join('');
        };
        const run = () => {
            const n = Math.min(lessons.length, Math.max(1, parseInt(q('#gN').value) || 1)); q('#gN').value = n;
            const units = moduleUnits(mod());
            cur = { units, dates: lessons.slice(0, n), assign: distribute(units, n) }; paint();
        };
        q('#gMod').onchange = run; q('#gN').onchange = run; q('#gRun').onclick = run;
        q('#gN').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); run(); } }; // Enter не має зберігати форму
        list.onclick = e => {
            const x = e.target.closest('[data-rm]'); if (!x) return;
            const i = +x.dataset.i; cur.assign[i] = cur.assign[i].filter(id => id !== +x.dataset.rm); paint();
        };
        list.onchange = e => {
            const sel = e.target.closest('.gl-add'); if (!sel || !sel.value) return;
            const i = +sel.dataset.i, id = +sel.value;
            if (!cur.assign[i].includes(id)) cur.assign[i].push(id);
            paint();
        };
        run();
    };

    const d = await modal(`Створити розклад: ${s.name}`, inner, 'Зберегти розклад', wire);
    if (d.returnValue !== 'ok' || !cur) return;
    const entries = toEntries(cur.units, cur.dates.map(l => l.date), cur.assign);
    try { store.update(db2 => saveLessonPlan(db2, s.id, entries)); } catch (e) { askNotice(e.message); }
}

export const planHandlers = {
    plGen: generate,
    async plClear(b) {
        if (await askConfirm('Прибрати розставлені теми для майбутніх занять? Історія проведених занять збережеться.', 'Прибрати'))
            store.update(db => clearLessonPlan(db, +b.dataset.sid));
    }
};