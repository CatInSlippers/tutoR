import { html, mount, delegate } from '../core/html.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import { ua, dateFrom, DAYS_SHORT, endTime } from '../core/dates.js';
import { homeworkTab, hwHandlers } from './studentHomework.js';
import { financeTab, finHandlers } from './studentFinance.js';
import { scheduleCard, schedHandlers } from './studentSchedule.js';
import { currentSlots } from '../domain/schedule.js';
import { finance } from '../domain/finance.js';
import { planTab, planHandlers } from './studentPlan.js';

const TABS = [['info', 'Основне'], ['hw', 'Домашнє завдання'], ['pay', 'Оплата за заняття'], ['plan', 'План занять']];
const STAGES = ['Пробний', 'Навчається', 'Закінчив навчання', 'Одноразове заняття'];
const FORMATS = ['Офлайн', 'Онлайн'];
const PAY_TYPES = ['За заняття', 'Пакет'];
const PAY_METHODS = ['Переказ на картку', 'Готівка', 'Змішаний', 'Інше'];

let tab = 'info', lastId = null, editing = false; // стан живе між перемальовуваннями

// ---------- перегляд ----------
// Порожні необов'язкові поля на сторінці не показуємо
const row = (label, val) => val ? html`<div class="irow"><span class="muted">${label}</span><span>${val}</span></div>` : '';
const card = (title, body) => html`<div class="card"><div class="sec-h"><h3>${title}</h3></div>${body}</div>`;
const soon = text => html`<div class="card muted">${text}</div>`;
const slotText = x => `${DAYS_SHORT[x.weekday]} ${x.startTime}–${endTime(x.startTime, x.durationMinutes)}`;
const fact = (label, val) => val ? html`<span><i>${label}</i>${val}</span>` : '';

function infoTab(s) {
  const g = s.guardian || {};
  const guardian = [g.name, g.relation && `(${g.relation})`, g.phone].filter(Boolean).join(' ');
  return html`<div class="info-cols">
    <div class="col">
      ${scheduleCard(s)}
      ${card('Навчання', html`${row('Мета', s.learningGoal)}${row('Статус', s.stage)}${row('Формат', s.format)}
        ${row('Період', `${ua(dateFrom(s.studyStart))} – ${ua(dateFrom(s.studyEnd))}`)}${row('Рівень', s.learningLevel)}`)}
    </div>
    <div class="col">
      ${card('Контакти', html`${row('Телефон', s.phone)}${row('Email', s.email)}${row('Опікун', guardian)}`)}
      ${card('Оплата', html`${row('Ціна заняття', `${s.lessonPrice} грн`)}
        ${row('Тип оплати', s.payType === 'Пакет' ? `Пакет, ${s.packSize} занять` : s.payType)}${row('Спосіб', s.payMethod)}`)}
    </div>
  </div>`;
}

// ---------- редагування ----------
const inp = (label, name, val, type = 'text', req = false, min = null) =>
  html`<div><label>${label}</label><input name="${name}" type="${type}" value="${val ?? ''}" ${req ? 'required' : ''} ${min != null ? html`min="${min}"` : ''} ${type === 'number' ? 'step="any"' : ''}></div>`;
const sel = (label, name, opts, val) => {
  const list = opts.includes(val) || !val ? opts : [val, ...opts]; // поточне значення не губимо, навіть якщо його немає у списку
  return html`<div><label>${label}</label><select name="${name}">${list.map(o => html`<option ${o === val ? 'selected' : ''}>${o}</option>`)}</select></div>`;
};

function editForm(s) {
  const g = s.guardian || {};
  return html`<form id="sform">
    <div id="ferr" class="errbox" hidden></div>
    <div class="info-cols">
      <div class="col">
        ${card('Навчання', html`${inp('Мета', 'learningGoal', s.learningGoal)}
          <div class="grid2">${sel('Статус', 'stage', STAGES, s.stage)}${sel('Формат', 'format', FORMATS, s.format)}</div>
          <div class="grid2">${inp('Початок навчання', 'studyStart', s.studyStart, 'date', true)}${inp('Кінець навчання', 'studyEnd', s.studyEnd, 'date', true)}</div>
          <label>Рівень</label><textarea name="learningLevel" rows="3">${s.learningLevel || ''}</textarea>
          <p class="muted" style="margin:10px 0 0">Розклад змінюється в картці «Розклад занять».</p>`)}
      </div>
      <div class="col">
        ${card('Контакти', html`<div class="grid2">${inp('Ім’я', 'firstName', s.firstName, 'text', true)}${inp('Прізвище', 'lastName', s.lastName)}</div>
          <div class="grid2">${inp('Телефон', 'phone', s.phone)}${inp('Email', 'email', s.email, 'email')}</div>
          <h4 class="subh">Опікун</h4>
          ${inp('Ім’я опікуна', 'gName', g.name)}
          <div class="grid2">${inp('Ким доводиться', 'gRel', g.relation)}${inp('Телефон опікуна', 'gPhone', g.phone)}</div>`)}
        ${card('Оплата', html`${inp('Ціна заняття, грн', 'lessonPrice', s.lessonPrice, 'number', true, 0)}
          ${sel('Тип оплати', 'payType', PAY_TYPES, s.payType)}
          <div id="packBox">${inp('Занять у пакеті', 'packSize', s.packSize, 'number', false, 1)}</div>
          ${sel('Спосіб оплати', 'payMethod', PAY_METHODS, s.payMethod)}`)}
      </div>
    </div>
    <div class="form-actions"><button type="button" data-act="cancel">Скасувати</button><button class="primary">Зберегти</button></div>
  </form>`;
}

function readForm(form) {
  const fd = new FormData(form), g = k => String(fd.get(k) ?? '').trim();
  return {
    firstName: g('firstName'), lastName: g('lastName'), phone: g('phone'), email: g('email'),
    guardian: { name: g('gName'), relation: g('gRel'), phone: g('gPhone') },
    learningGoal: g('learningGoal'), stage: g('stage'), format: g('format'),
    studyStart: g('studyStart'), studyEnd: g('studyEnd'), learningLevel: g('learningLevel'),
    lessonPrice: Number(g('lessonPrice')), payType: g('payType'), packSize: Math.max(1, Math.round(Number(g('packSize')) || 4)), payMethod: g('payMethod')
  };
}
const validate = v =>
  !v.firstName ? 'Вкажіть ім’я учня.'
    : v.studyEnd < v.studyStart ? 'Кінець навчання не може бути раніше за початок.'
      : !(v.lessonPrice >= 0) ? 'Ціна заняття має бути числом не менше 0.' : '';

// ---------- екран ----------
export function renderStudent(el, id) {
  const db = store.get(), s = db.students.find(x => x.id === id);
  if (!s) return router.go('/');
  if (id !== lastId) { tab = 'info'; editing = false; lastId = id; }
  const body = editing && tab === 'info' ? editForm(s) : PANELS[tab](s);

  // бейджі на вкладках: що потребує уваги, не відкриваючи вкладку
  const hwOpen = db.homework.filter(h => h.studentId === s.id && h.status === 'Видано').length;
  const debt = finance(db, s).debt;
  const badges = { hw: hwOpen ? [hwOpen, ''] : null, pay: debt > 0.005 ? ['борг', 'bad'] : null };
  const sched = currentSlots(s).map(slotText).join(', ');

  mount(el, html`<div class="pwrap">
    <button data-act="back">← До списку</button>
    <div class="shead" style="border-left-color:${s.color}">
      <div class="spacer">
        <div class="row"><h2>${s.name}</h2><span class="pill">${s.stage}</span></div>
        <div class="muted">${s.learningGoal || 'ціль не вказана'}</div>
        <div class="facts">${fact('Розклад', sched || 'без постійного розкладу')}${fact('Ціна', `${s.lessonPrice} грн`)}${fact('Телефон', s.phone)}</div>
      </div>
      ${editing ? '' : html`<button data-act="edit">Редагувати</button>`}
    </div>
    <div class="tabs">${TABS.map(([k, t]) => html`<button class="tab ${k === tab ? 'on' : ''}" data-act="tab" data-tab="${k}">${t}${badges[k] ? html`<span class="tbadge ${badges[k][1]}">${badges[k][0]}</span>` : ''}</button>`)}</div>
    <div class="panel">${body}</div>
  </div>`);

  const form = el.querySelector('#sform');
  if (form) { // поле «Занять у пакеті» показуємо лише для пакетної оплати
    const sync = () => { form.querySelector('#packBox').hidden = form.payType.value !== 'Пакет'; };
    form.addEventListener('change', sync); sync();
    form.onsubmit = e => {
      e.preventDefault();
      const v = readForm(form), err = validate(v);
      if (err) { const b = form.querySelector('#ferr'); b.textContent = err; b.hidden = false; return; }
      editing = false;
      store.update(d => {
        const x = d.students.find(t => t.id === id); if (!x) return;
        Object.assign(x, v, { name: `${v.firstName} ${v.lastName}`.trim() });
        if (v.payType !== 'Пакет') x.packSize = s.packSize || 4; // розмір пакета не міняємо, якщо оплата за заняття
      });
    };
  }
  delegate(el, {
    back: () => router.go('/'),
    tab: b => { tab = b.dataset.tab; editing = false; renderStudent(el, id); },
    edit: () => { tab = 'info'; editing = true; renderStudent(el, id); },
    cancel: () => { editing = false; renderStudent(el, id); },
    ...hwHandlers,
    ...finHandlers,
    ...schedHandlers,
    ...planHandlers
  });
}

const PANELS = {
  info: infoTab,
  hw: homeworkTab,
  pay: financeTab,
  plan: planTab
};