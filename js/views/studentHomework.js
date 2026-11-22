import { html } from '../core/html.js';
import * as store from '../core/store.js';
import { askForm, askConfirm } from '../core/ui.js';
import { dateKey, dateFrom, ua } from '../core/dates.js';
import { HW_STATUSES } from '../domain/homework.js';

const COLORS = { 'Видано': '#4c6fff', 'Виконано': '#2e9e6b', 'З помилками': '#e6892e', 'Не виконано': '#c62828' };
const day = s => s ? ua(dateFrom(s)) : '—';
const isUrl = u => /^https?:\/\//i.test(u || ''); // посилання робимо клікабельним лише для http(s)
const linkRow = (label, u) => isUrl(u) ? html`<div><a href="${u}" target="_blank" rel="noopener">${label}</a></div>` : u ? html`<div class="muted">${label}: ${u}</div>` : '';

export function homeworkTab(s) {
    const db = store.get(), today = dateKey(new Date());
    const list = db.homework.filter(h => h.studentId === s.id)
        .sort((a, b) => b.issueDate.localeCompare(a.issueDate) || b.id - a.id);
    const overdue = h => h.status === 'Видано' && h.dueDate && h.dueDate < today;
    if (!list.length) return html`<div class="card muted">Домашніх завдань ще немає. Додай ДЗ у діалозі заняття в календарі.</div>`;

    const count = f => list.filter(f).length;
    const stats = html`<div class="hwstats">
    <span>Усього: <b>${list.length}</b></span>
    <span>Очікують перевірки: <b>${count(h => h.status === 'Видано')}</b></span>
    <span class="late">Прострочено: <b>${count(overdue)}</b></span>
  </div>`;

    return html`${stats}<div class="hwlist">${list.map(h => {
        const c = COLORS[h.status] || '#777', over = overdue(h);
        const lesson = db.lessons.find(l => l.id === h.lessonId), topic = lesson && lesson.topic && lesson.topic !== 'Заняття' ? lesson.topic : '';
        return html`<div class="card hw ${over ? 'over' : ''}">
      <div class="row"><b class="spacer">${h.task}</b><span class="hwpill" style="background:${c}22;color:${c}">${h.status}</span></div>
      <div class="muted">Видано ${day(h.issueDate)}${topic ? ' · ' + topic : ''}</div>
      ${linkRow('Матеріали', h.link)}${linkRow('Фото роботи', h.photoLink)}
      <div class="hwmeta">
        <span>Здати до: ${day(h.dueDate)} ${over ? html`<b class="late">· прострочено</b>` : ''}</span>
        <span>Здано: ${day(h.submittedDate)}</span>
        ${h.grade ? html`<span>Оцінка: <b>${h.grade}</b></span>` : ''}
      </div>
      ${h.comment ? html`<p class="hwcomment">${h.comment}</p>` : ''}
      <div class="row"><button data-act="hwCheck" data-id="${h.id}">Перевірити</button><button class="danger" data-act="hwDel" data-id="${h.id}">Видалити</button></div>
    </div>`;
    })}</div>`;
}

// Обробники кліків вкладки. Після store.update екран перемальовується сам (підписка на store).
export const hwHandlers = {
    async hwCheck(b) {
        const h = store.get().homework.find(x => x.id === +b.dataset.id); if (!h) return;
        const v = await askForm('Перевірка ДЗ', [
            { k: 'status', label: 'Статус', options: HW_STATUSES, value: h.status },
            { k: 'submittedDate', label: 'Дата здачі', type: 'date', value: h.submittedDate },
            { k: 'grade', label: 'Оцінка (необов’язково)', value: h.grade },
            { k: 'photoLink', label: 'Посилання на фото роботи (необов’язково)', value: h.photoLink },
            { k: 'comment', label: 'Коментар (необов’язково)', value: h.comment }]);
        if (!v) return;
        store.update(db => { const x = db.homework.find(t => t.id === h.id); if (x) Object.assign(x, v); });
    },
    async hwDel(b) {
        const id = +b.dataset.id;
        if (await askConfirm('Видалити це домашнє завдання?', 'Видалити'))
            store.update(db => { db.homework = db.homework.filter(x => x.id !== id); });
    }
};