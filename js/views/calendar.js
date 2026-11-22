import { html, mount, delegate } from '../core/html.js';
import * as store from '../core/store.js';
import { dateKey, dateFrom, addDays, getMonday, ua, DAYS_SHORT, hhmm } from '../core/dates.js';
import { askNotice, askConfirm } from '../core/ui.js';
import { openLessonForm } from './lessonForm.js';
import { saveHomework } from '../domain/homework.js';
import { dayItems, vacationOf, statusClass, createLesson, findLesson, updateLesson, deleteLesson } from '../domain/lessons.js';

let mode = 'week', anchor = new Date(); // стан навігації живе між перемальовуваннями
const pad = n => String(n).padStart(2, '0');

function chip(it, compact) {
  const t = hhmm(it.s) + '–' + hhmm(it.e), warn = it.clash ? '⚠ перетин' : '';
  if (it.kind === 'lesson') {
    const l = it.data, s = it.student, sub = l.status !== 'Заплановано' && !l.auto ? l.status : '';
    const hw = l.id != null && store.get().homework.some(h => h.lessonId === l.id);
    return html`<div class="chip ${statusClass(l)} ${it.clash ? 'conflict' : ''}" style="border-left-color:${s.color}" data-act="open" data-lid="${l.id ?? ''}" data-sid="${s.id}" data-date="${l.date}" data-slot="${l.slot ?? ''}" title="${s.name} ${t}${sub ? ' · ' + sub : ''}${hw ? ' · є ДЗ' : ''}"><b>${s.firstName}</b>${hw ? ' 📝' : ''} ${t}${!compact && (sub || warn) ? html`<small>${[sub, warn].filter(Boolean).join(' · ')}</small>` : ''}</div>`;
  }
  const a = it.data;
  return html`<div class="chip act ${it.clash ? 'conflict' : ''}" title="${a.title} ${t}"><b>${a.title}</b> ${t}${!compact && warn ? html`<small>${warn}</small>` : ''}</div>`;
}

const LEGEND = [['#e8eefc', 'заплановано'], ['#e3f4e6', 'проведено'], ['#fde4e4', 'пропустив учень'], ['#efe3fb', 'пропустив викладач'], ['#fff1dc', 'не відмічено'], ['#eee', 'справа викладача']];

// Дата за замовчуванням для нового заняття: сьогодні, якщо воно в поточному діапазоні, інакше початок діапазону
const defaultDate = () => {
  const t = new Date();
  if (mode === 'week') { const ws = getMonday(anchor); return dateKey(t >= ws && t < addDays(ws, 7) ? t : ws); }
  return dateKey(t.getMonth() === anchor.getMonth() && t.getFullYear() === anchor.getFullYear() ? t : new Date(anchor.getFullYear(), anchor.getMonth(), 1));
};
async function addLesson(date) {
  const v = await openLessonForm(date); if (!v) return;
  anchor = dateFrom(v.date); // після збереження календар переходить до дати нового заняття
  try { store.update(s => { const rec = createLesson(s, v); saveHomework(s, rec, v.homework); }); } catch (e) { askNotice(e.message); }
}

async function editLesson(ref) {
  const l = findLesson(store.get(), ref); if (!l) return askNotice('Заняття не знайдено.');
  const v = await openLessonForm(l.date, l); if (!v) return;
  try {
    if (v.delete) {
      if (!await askConfirm(l.regular ? 'Скасувати це заняття за розкладом? Воно залишиться в історії зі статусом «Скасовано».' : 'Видалити це заняття?', l.regular ? 'Скасувати заняття' : 'Видалити')) return;
      store.update(s => deleteLesson(s, l));
    } else {
      anchor = dateFrom(v.date);
      store.update(s => { const rec = updateLesson(s, l, v); saveHomework(s, rec, v.homework, l.id); });
    }
  } catch (e) { askNotice(e.message); }
}

export function renderCalendar(el) {
  const st = store.get(), today = dateKey(new Date());
  let title, body;
  if (mode === 'week') {
    const ws = getMonday(anchor); title = `${ua(ws)} – ${ua(addDays(ws, 6))}`;
    body = html`<div class="wk">${[0, 1, 2, 3, 4, 5, 6].map(i => {
      const d = addDays(ws, i), key = dateKey(d), items = dayItems(st, d);
      const vac = st.students.map(s => ({ s, v: vacationOf(s, d) })).filter(x => x.v);
      return html`<div class="wday ${key === today ? 'today' : ''}"><div class="wh">${DAYS_SHORT[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}</div>
        ${vac.map(x => html`<span class="vac">${x.s.firstName}: ${x.v.reason}</span>`)}
        ${items.length ? items.map(x => chip(x, false)) : html`<div class="none">—</div>`}<button class="addday" data-act="addday" data-day="${key}" title="Додати заняття">+</button></div>`;
    })}</div>`;
  } else {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1), gs = getMonday(first), m = first.getMonth(), cells = [];
    title = first.toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    for (let i = 0; i < 42; i++) {
      const d = addDays(gs, i); if (i >= 35 && d.getMonth() !== m) break;
      const key = dateKey(d), items = dayItems(st, d);
      cells.push(html`<div class="mcell ${d.getMonth() !== m ? 'out' : ''} ${key === today ? 'today' : ''}"><span class="mnum" data-act="day" data-day="${key}">${d.getDate()}</span>
        ${items.slice(0, 3).map(x => chip(x, true))}${items.length > 3 ? html`<span class="more" data-act="day" data-day="${key}">+${items.length - 3} ще</span>` : ''}</div>`);
    }
    body = html`<div class="mgrid">${DAYS_SHORT.slice(1).concat(DAYS_SHORT[0]).map(n => html`<div class="mh">${n}</div>`)}${cells}</div>`;
  }
  mount(el, html`<div class="cal-head"><div><h2>Календар</h2><div class="muted">${title}</div></div>
    <div class="row"><button class="primary" data-act="add">+ Заняття</button><button data-act="prev" title="Назад">‹</button><button class="todaybtn" data-act="today" title="Сьогодні">${new Date().getDate()}</button><button data-act="next" title="Вперед">›</button>
    <button class="${mode === 'week' ? 'primary' : ''}" data-act="week">Тиждень</button><button class="${mode === 'month' ? 'primary' : ''}" data-act="month">Місяць</button></div></div>
    ${body}<div class="legend">${LEGEND.map(([c, t]) => html`<span><i style="background:${c}"></i>${t}</span>`)}</div>`);

  const shift = n => { anchor = mode === 'week' ? addDays(anchor, 7 * n) : new Date(anchor.getFullYear(), anchor.getMonth() + n, 1); renderCalendar(el); };
  delegate(el, {
    add: () => addLesson(defaultDate()),
    open: b => editLesson({ id: b.dataset.lid === '' ? null : +b.dataset.lid, studentId: +b.dataset.sid, date: b.dataset.date, slot: b.dataset.slot === '' ? null : +b.dataset.slot }), addday: b => addLesson(b.dataset.day),
    prev: () => shift(-1), next: () => shift(1),
    today: () => { anchor = new Date(); renderCalendar(el); },
    week: () => { const t = new Date(); if (mode !== 'week') anchor = anchor.getFullYear() === t.getFullYear() && anchor.getMonth() === t.getMonth() ? t : new Date(anchor.getFullYear(), anchor.getMonth(), 1); mode = 'week'; renderCalendar(el); },
    month: () => { mode = 'month'; renderCalendar(el); },
    day: b => { mode = 'week'; anchor = new Date(b.dataset.day + 'T00:00:00'); renderCalendar(el); }
  });
}
