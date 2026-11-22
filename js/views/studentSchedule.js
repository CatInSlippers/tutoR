import { html } from '../core/html.js';
import * as store from '../core/store.js';
import { askForm, askNotice } from '../core/ui.js';
import { dateKey, dateFrom, ua, DAYS, WEEK_ORDER, endTime } from '../core/dates.js';
import { slotState, addSlot, changeSlot, endSlot } from '../domain/schedule.js';

const label = x => `${DAYS[x.weekday]} ${x.startTime}–${endTime(x.startTime, x.durationMinutes)}`;
const range = x => [x.activeFrom && `з ${ua(dateFrom(x.activeFrom))}`, x.activeTo && `до ${ua(dateFrom(x.activeTo))}`].filter(Boolean).join(' ');
const byDay = (a, b) => WEEK_ORDER.indexOf(a.x.weekday) - WEEK_ORDER.indexOf(b.x.weekday) || a.x.startTime.localeCompare(b.x.startTime);

export function scheduleCard(s) {
    const today = dateKey(new Date());
    const items = s.slots.map((x, i) => ({ x, i, st: slotState(x, today) })).filter(r => r.st !== 'empty').sort(byDay);
    const live = items.filter(r => r.st !== 'closed'), old = items.filter(r => r.st === 'closed');
    const row = r => html`<div class="slot"><span class="spacer"><b>${label(r.x)}</b> <span class="muted">${r.st === 'future' ? 'ще не діє, ' : ''}${range(r.x)}</span></span>
    <button class="tbtn" data-act="slotChange" data-sid="${s.id}" data-i="${r.i}">Змінити</button>
    <button class="danger tbtn" data-act="slotEnd" data-sid="${s.id}" data-i="${r.i}">Припинити</button></div>`;
    return html`<div class="card"><div class="sec-h"><h3>Розклад занять</h3>
      <button class="primary tbtn" data-act="slotAdd" data-sid="${s.id}">+ День</button></div>
    ${live.length ? live.map(row) : html`<p class="muted">Постійного розкладу немає. Заняття можна додавати окремо в календарі.</p>`}
    ${old.length ? html`<details style="margin-top:10px"><summary class="muted">Попередній розклад (${old.length})</summary>
      ${old.map(r => html`<div class="slot old"><span>${label(r.x)} · ${range(r.x)}</span></div>`)}</details>` : ''}</div>`;
}

const fields = (x, fromLabel, from) => [
    { k: 'weekday', label: 'День', options: WEEK_ORDER.map(d => DAYS[d]), value: DAYS[x ? x.weekday : 1] },
    { k: 'start', label: 'Початок', type: 'time', required: true, value: x ? x.startTime : '17:00' },
    { k: 'end', label: 'Кінець', type: 'time', required: true, value: x ? endTime(x.startTime, x.durationMinutes) : '18:00' },
    { k: 'from', label: fromLabel, type: 'date', required: true, value: from }];
const run = fn => { try { store.update(fn); } catch (e) { askNotice(e.message); } };
const slotOf = b => store.get().students.find(x => x.id === +b.dataset.sid)?.slots[+b.dataset.i];
const norm = v => ({ ...v, weekday: DAYS.indexOf(v.weekday) });

export const schedHandlers = {
    async slotAdd(b) {
        const v = await askForm('Новий день занять', fields(null, 'Діє з дати (заняття за минулі дати вважатимуться проведеними)', dateKey(new Date())));
        if (v) run(db => addSlot(db, +b.dataset.sid, norm(v)));
    },
    async slotChange(b) {
        const x = slotOf(b); if (!x) return;
        const v = await askForm('Змінити розклад', fields(x, 'Новий день і час діють з дати (до неї — як було)', dateKey(new Date())));
        if (v) run(db => changeSlot(db, +b.dataset.sid, +b.dataset.i, norm(v)));
    },
    async slotEnd(b) {
        const x = slotOf(b); if (!x) return;
        const v = await askForm(`Припинити: ${label(x)}`, [{ k: 'from', label: 'Занять за цим розкладом немає, починаючи з дати', type: 'date', required: true, value: dateKey(new Date()) }]);
        if (v) run(db => endSlot(db, +b.dataset.sid, +b.dataset.i, v.from));
    }
};