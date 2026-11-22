import { html } from '../core/html.js';
import * as store from '../core/store.js';
import { askForm, askConfirm, askNotice } from '../core/ui.js';
import { dateKey, dateFrom, ua } from '../core/dates.js';
import { finance, addOp, updateOp, deleteOp } from '../domain/finance.js';

const money = n => (Math.round(n * 100) / 100).toLocaleString('uk-UA') + ' грн';

// Одна виписка: заняття (нараховано) і операції (внесено) в хронологічному порядку з наростаючим балансом.
export function financeTab(s) {
    const db = store.get(), f = finance(db, s), P = f.pack, first = f.rows.find(r => !r.paid);
    const events = [
        ...f.view.map(r => ({ kind: 'lesson', date: r.l.date, r, order: 0 })),
        ...f.unmarked.map(l => ({ kind: 'unmarked', date: l.date, l, order: 0 })),
        ...f.pays.map(o => ({ kind: 'op', date: o.date, o, order: 1 })) // в один день спершу заняття, потім оплата
    ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);

    let bal = 0;
    const ledger = events.map(e => {
        if (e.kind === 'lesson') bal -= e.r.charged ? s.lessonPrice : 0;
        else if (e.kind === 'op') bal += e.o.type === 'refund' ? -e.o.amount : e.o.amount;
        return { ...e, bal };
    });

    const balCell = b => html`<td class="${b < -0.005 ? 'late' : b > 0.005 ? 'good' : ''}">${b > 0.005 ? '+' : ''}${money(b)}</td>`;

    const lessonRow = ({ r, bal }) => {
        const k = f.rows.indexOf(r);
        const end = P ? Math.min(f.rows.length, (Math.floor(k / f.N) + 1) * f.N) : k + 1; // скільки занять має бути покрито цією оплатою
        const need = Math.round(Math.max(0, end * s.lessonPrice - f.received) * 100) / 100;
        const canPay = r.charged && !r.paid && (!P || r === first);
        const status = !r.charged ? html`<span class="muted">не стосується</span>`
            : r.paid ? html`оплачено ${ua(dateFrom(r.paid))}${r.delay ? html` <span class="late">· затримка ${r.delay} дн.</span>` : ''}`
                : html`${canPay ? html`<button class="primary tbtn" data-act="finPay" data-sid="${s.id}" data-sum="${need}" title="Покриє також усі попередні заняття">Оплата надійшла</button> ` : ''}${r.pending
                    ? html`<small>очікується до ${ua(dateFrom(r.due))}</small>`
                    : html`<b class="late">борг · прострочено ${r.delay} дн.</b>`}`;
        return html`<tr><td>${ua(dateFrom(r.l.date))}</td><td>Заняття · ${r.l.status}${r.future ? ' (в пакеті)' : ''}</td>
      <td>${r.charged ? money(s.lessonPrice) : '—'}</td><td></td>${balCell(bal)}<td>${status}</td></tr>`;
    };

    const unmarkedRow = ({ l, bal }) => html`<tr class="unm"><td>${ua(dateFrom(l.date))}</td><td>Заняття · не відмічено</td><td>—</td><td></td>${balCell(bal)}
    <td><small>Відмітьте статус у календарі, після цього з’явиться нарахування</small></td></tr>`;

    const opRow = ({ o, bal }) => html`<tr class="oprow"><td>${ua(dateFrom(o.date))}</td><td>${o.type === 'refund' ? 'Повернення' : 'Оплата'}${o.note ? html` <span class="muted">· ${o.note}</span>` : ''}</td>
    <td></td><td>${o.type === 'refund' ? '−' : '+'}${money(o.amount)}</td>${balCell(bal)}
    <td><button class="tbtn" data-act="finEdit" data-id="${o.id}" title="Виправити">✎</button> <button class="danger tbtn" data-act="finDel" data-id="${o.id}" title="Видалити">×</button></td></tr>`;

    const summary = f.debt ? html`<b class="late">Борг: ${money(f.debt)}</b>`
        : f.overpaid ? html`<b class="good">Переплата: ${money(f.overpaid)}</b>` : html`<b>Боргу немає</b>`;

    return html`<div class="card">
    <div class="row" style="margin-bottom:12px"><span class="spacer">${summary}</span>
      <button class="primary" data-act="finAdd" data-t="payment" data-sid="${s.id}">+ Оплата</button><button data-act="finAdd" data-t="refund" data-sid="${s.id}">+ Повернення</button></div>
    <div class="hist-wrap"><table class="hist">
      <tr><th>Дата</th><th>Подія</th><th>Нараховано</th><th>Внесено</th><th>Баланс</th><th>Оплата</th></tr>
      ${ledger.map(x => x.kind === 'lesson' ? lessonRow(x) : x.kind === 'op' ? opRow(x) : unmarkedRow(x))}
      ${ledger.length ? '' : html`<tr><td colspan="6">Платних занять і операцій ще немає.</td></tr>`}
    </table></div></div>`;
}

const opForm = (title, o = {}, sum = '') => askForm(title, [
    { k: 'amount', label: 'Сума, грн', type: 'number', min: 0.01, required: true, value: o.amount ?? sum },
    { k: 'date', label: 'Дата', type: 'date', required: true, value: o.date || dateKey(new Date()) },
    { k: 'note', label: 'Примітка (необов’язково)', value: o.note }]);

const run = fn => { try { store.update(fn); } catch (e) { askNotice(e.message); } };

export const finHandlers = {
    async finAdd(b) {
        const sid = +b.dataset.sid, type = b.dataset.t, st = store.get().students.find(x => x.id === sid); if (!st) return;
        const debt = finance(store.get(), st).debt;
        const v = await opForm(type === 'refund' ? 'Повернення коштів' : 'Нова оплата', {}, type === 'payment' && debt ? debt : '');
        if (v) run(db => addOp(db, { studentId: sid, type, ...v }));
    },
    async finPay(b) {
        const sid = +b.dataset.sid, v = await opForm('Оплата надійшла', {}, b.dataset.sum);
        if (v) run(db => addOp(db, { studentId: sid, type: 'payment', ...v }));
    },
    async finEdit(b) {
        const id = +b.dataset.id, o = store.get().ops.find(x => x.id === id); if (!o) return;
        const v = await opForm('Виправити операцію', o);
        if (v) run(db => updateOp(db, id, v));
    },
    async finDel(b) {
        const id = +b.dataset.id;
        if (await askConfirm('Видалити цю операцію? Борг учня перерахується.', 'Видалити')) run(db => deleteOp(db, id));
    }
};