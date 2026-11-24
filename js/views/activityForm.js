import { html } from '../core/html.js';
import { modal } from '../core/ui.js';
import * as store from '../core/store.js';
import { dateFrom, hhmm, mins } from '../core/dates.js';
import { dayItems, isLive } from '../domain/lessons.js';
import { CATEGORIES } from '../domain/activities.js';

// Діалог справи: openActivityForm(date) — нова, openActivityForm(date, activity) — редагування.
// Повертає значення форми, {delete:true} або null, якщо скасовано.
export async function openActivityForm(date, act = null) {
    const st = store.get(), edit = !!act, A = act || {};
    const cats = !A.category || CATEGORIES.includes(A.category) ? CATEGORIES : [A.category, ...CATEGORIES]; // власну категорію зі старих даних не губимо
    const inner = html`
    <label>Назва</label><input name="title" value="${A.title || ''}" placeholder="${A.category || CATEGORIES[0]}">
    <label>Категорія</label><select name="category">${cats.map(c => html`<option ${c === (A.category || CATEGORIES[0]) ? 'selected' : ''}>${c}</option>`)}</select>
    <div class="grid3">
      <div><label>Дата</label><input type="date" name="date" value="${date}" required></div>
      <div><label>Початок</label><input type="time" name="startTime" value="${A.startTime || '13:00'}" required></div>
      <div><label>Хвилин</label><input type="number" name="dur" min="5" step="5" value="${A.durationMinutes || 60}" required></div>
    </div>
    ${edit ? '' : html`<label>Повторювати щотижня до (необов’язково)</label><input type="date" name="until">`}
    <div id="note" class="warn" hidden></div>
    ${edit ? html`<button type="button" class="danger" id="del" style="margin-top:14px">Видалити справу</button>` : ''}`.s;

    const wire = d => {
        const q = x => d.querySelector(x), val = n => q(`[name=${n}]`).value;
        const refresh = () => {
            const day = val('date'), t = val('startTime'), dur = +val('dur'); let msg = '';
            if (day && t && dur > 0) {
                const s0 = mins(t), e0 = s0 + dur;
                const clash = dayItems(st, dateFrom(day)).filter(it => !(edit && it.kind === 'activity' && it.data.id === A.id) && isLive(it) && it.s < e0 && s0 < it.e)
                    .map(it => `${it.kind === 'lesson' ? it.student.firstName : it.data.title} ${hhmm(it.s)}–${hhmm(it.e)}`);
                if (clash.length) msg = '⚠ Перетин із: ' + clash.join(', ');
            }
            q('#note').hidden = !msg; q('#note').textContent = msg;
        };
        q('form').addEventListener('input', refresh);
        q('[name=category]').addEventListener('change', () => { q('[name=title]').placeholder = val('category'); }); // порожня назва = категорія
        if (q('#del')) q('#del').onclick = () => d.close('delete');
        refresh();
    };

    const d = await modal(edit ? 'Справа' : 'Нова справа', inner, edit ? 'Зберегти' : 'Створити', wire);
    if (d.returnValue === 'delete') return { delete: true };
    if (d.returnValue !== 'ok') return null;
    const fd = new FormData(d.querySelector('form')), g = k => String(fd.get(k) ?? '').trim();
    return { title: g('title') || g('category'), category: g('category'), date: g('date'), startTime: g('startTime'), durationMinutes: +g('dur'), until: g('until') };
}