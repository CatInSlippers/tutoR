import { html } from '../core/html.js';
import * as store from '../core/store.js';
import { dateKey, dateFrom, ua, DAYS_SHORT } from '../core/dates.js';
import { allLessons } from '../domain/finance.js';

const OFF = ['Перенесено', 'Скасовано'];
const COLORS = {
    'Заплановано': '#4c6fff', 'Проведено': '#2e9e6b', 'Відпрацювання': '#2e9e6b',
    'Пропущено (учень)': '#e6892e', 'Пропущено (викладач)': '#9333ea'
};
const dash = () => html`<span class="muted">—</span>`;

export function planTab(s) {
    const db = store.get(), today = dateKey(new Date());
    const list = allLessons(db, s).filter(l => !OFF.includes(l.status))
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    const next = list.find(l => l.date >= today); // найближче заняття підсвічуємо
    const hwOf = l => l.id == null ? [] : db.homework.filter(h => h.lessonId === l.id);

    if (!list.length) return html`<div class="card muted">Занять ще немає.</div>`;

    return html`<div class="card"><div class="sec-h"><h3>Плани й підсумки занять</h3></div>
    <p class="muted" style="margin:0 0 10px">Тема, домашнє завдання, статус і коментар беруться із занять у календарі. План заняття та матеріали заповнюватимуться у вікні заняття.</p>
    <div class="hist-wrap pl-wrap"><table class="hist pl">
      <tr><th>Дата</th><th>Тема</th><th>План заняття</th><th>Матеріали</th><th>ДЗ</th><th>Результат</th><th>Коментар</th></tr>
      ${list.map(l => {
        const c = COLORS[l.status] || '#777', hw = hwOf(l);
        return html`<tr class="${l === next ? 'pl-next' : ''}">
          <td><b>${ua(dateFrom(l.date))}</b><br><span class="muted">${DAYS_SHORT[dateFrom(l.date).getDay()]} ${l.startTime}</span></td>
          <td>${l.topic && l.topic !== 'Заняття' ? html`<b>${l.topic}</b>` : dash()}</td>
          <td>${dash()}</td>
          <td>${dash()}</td>
          <td>${hw.length ? hw.map(h => html`<div>${h.task}</div>`) : dash()}</td>
          <td><span class="hwpill" style="background:${c}22;color:${c}">${l.status}</span></td>
          <td>${l.comment ? l.comment : dash()}</td></tr>`;
    })}
    </table></div></div>`;
}

export const planHandlers = {}; // поки що вкладка лише для перегляду