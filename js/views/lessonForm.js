import { html, esc } from '../core/html.js';
import { modal } from '../core/ui.js';
import * as store from '../core/store.js';
import { dateFrom, dateKey, addDays, hhmm, mins, ua } from '../core/dates.js';
import { STATUSES, dayItems, isLive } from '../domain/lessons.js';
import { HW_STATUSES, homeworkOf } from '../domain/homework.js';
import { currentSlots } from '../domain/schedule.js';
import { plannedOn } from '../domain/plan.js';

const WEEKLY = ['Щонеділі', 'Щопонеділка', 'Щовівторка', 'Щосереди', 'Щочетверга', "Щоп'ятниці", 'Щосуботи'];

// Діалог заняття: openLessonForm(date) — нове, openLessonForm(date, lesson) — редагування.
// Повертає значення форми, {delete:true} або null, якщо скасовано.
export async function openLessonForm(date, lesson = null) {
  const st = store.get(), edit = !!lesson, cur = edit ? st.students.find(x => x.id === lesson.studentId) : st.students[0], slot = cur && currentSlots(cur)[0];
  const L = lesson || {}, H = edit ? homeworkOf(st, L.id) : null;
  const pe = edit && cur ? plannedOn(cur, L.date) : null; // запланована тема на дату цього заняття
  const planText = pe ? pe.items.map(i => i.name + (i.parts > 1 ? ` (${i.part}/${i.parts})` : '')).join(', ') : '';

  const inner = html`
    <label>Учень</label>
    <select name="student" ${edit ? 'disabled' : ''}>${st.students.map(x => html`<option value="${x.id}" ${x === cur ? 'selected' : ''}>${x.name}</option>`)}${edit ? '' : html`<option value="new" ${cur ? '' : 'selected'}>+ Новий учень (пробне заняття)…</option>`}</select>
    <div id="newStu" hidden><div class="grid2"><div><label>Ім’я та прізвище</label><input name="ns_name"></div><div><label>Телефон</label><input name="ns_phone"></div></div></div>
    <div class="grid3">
      <div><label>Дата</label><input type="date" name="date" value="${date}" required></div>
      <div><label>Початок</label><input type="time" name="startTime" value="${L.startTime || slot?.startTime || '14:00'}" required></div>
      <div><label>Хвилин</label><input type="number" name="dur" min="15" step="5" value="${L.durationMinutes || slot?.durationMinutes || 60}" required></div>
    </div>
    <label>Статус</label><select name="status">${STATUSES.map(x => html`<option ${x === (L.status || 'Заплановано') ? 'selected' : ''}>${x}</option>`)}</select>
    ${edit && L.regular ? html`<p class="muted" style="margin:12px 0 0">Регулярне заняття за розкладом. Якщо змінити дату, на старій даті воно стане «Перенесено», а на новій з’явиться окреме заняття.</p>`
      : html`<label class="chk" style="margin-top:12px"><input type="checkbox" name="regular"> ${edit ? 'Зробити регулярним' : 'Регулярне заняття'}: <b id="regTxt"></b></label>`}
    <label>Тема</label><input name="topic" value="${L.topic && L.topic !== 'Заняття' ? L.topic : ''}" placeholder="${planText}">
    ${pe ? html`<div class="planbox"><b>Заплановано:</b>${pe.items.map(i => html`<div>${i.name}${i.parts > 1 ? ` (${i.part}/${i.parts})` : ''}${i.skills.length ? html`<div class="muted">${i.skills.join('; ')}</div>` : ''}</div>`)}
      <div class="muted" style="margin-top:4px">Якщо поле «Тема» порожнє, на занятті діє запланована тема.</div></div>` : ''}
      <label>Коментар</label><textarea name="comment" rows="2">${L.comment || ''}</textarea>
    <label class="chk" style="margin-top:12px"><input type="checkbox" name="hw" ${H ? 'checked' : ''}> Домашнє завдання</label>
    <div id="hwBox" ${H ? '' : 'hidden'}>
      <label>Опис завдання</label><textarea name="hw_task" rows="2">${H?.task || ''}</textarea>
      <label>Посилання на матеріали (необов’язково)</label><input name="hw_link" value="${H?.link || ''}" placeholder="https://…">
      <label>Здати до</label><input type="date" name="hw_due" value="${H?.dueDate || ''}">
    </div>
    <div id="note" class="warn" hidden></div>
    ${edit ? html`<button type="button" class="danger" id="del" style="margin-top:14px">${L.regular ? 'Скасувати заняття за розкладом' : 'Видалити заняття'}</button>` : ''}`.s;

  const wire = d => {
    const q = s => d.querySelector(s), f = q('form'), val = n => q(`[name=${n}]`).value;
    const same = it => edit && it.kind === 'lesson' && it.student.id === L.studentId && it.data.date === L.date && (L.id != null ? it.data.id === L.id : it.data.id === null && it.data.slot === L.slot);
    const hwChk = q('[name=hw]');
    const hwSync = fill => { // fill: true лише коли користувач сам увімкнув ДЗ — підставляємо термін за замовчуванням
      const on = hwChk.checked; q('#hwBox').hidden = !on;
      q('[name=hw_task]').required = on; q('[name=hw_due]').required = on;
      if (on && fill && !val('hw_due') && val('date')) q('[name=hw_due]').value = dateKey(addDays(dateFrom(val('date')), 7));
    };
    const refresh = () => {
      const sid = val('student'), isNew = sid === 'new', date = val('date'), t = val('startTime'), dur = +val('dur'), reg = q('[name=regular]'), notes = [];
      q('#newStu').hidden = !isNew; q('[name=ns_name]').required = isNew;
      if (q('#regTxt')) q('#regTxt').textContent = date && t ? `${WEEKLY[dateFrom(date).getDay()]} о ${t}, ${dur || '?'} хв` : '';
      if (date && t && dur > 0) {
        const s0 = mins(t), e0 = s0 + dur, clash = ['Перенесено', 'Скасовано'].includes(val('status')) ? [] :
          dayItems(st, dateFrom(date)).filter(it => !same(it) && isLive(it) && it.s < e0 && s0 < it.e).map(it => `${it.kind === 'lesson' ? it.student.firstName : it.data.title} ${hhmm(it.s)}–${hhmm(it.e)}`);
        if (clash.length) notes.push('⚠ Перетин із: ' + clash.join(', '));
        if (edit && L.regular && date !== L.date) notes.push(`Заняття на ${ua(dateFrom(L.date))} стане «Перенесено», а на ${ua(dateFrom(date))} з’явиться окреме заняття.`);
        const stu = !isNew && st.students.find(x => x.id === +sid);
        if (stu && reg?.checked) {
          if (date < stu.studyStart) notes.push(`Початок навчання учня зміниться на ${ua(dateFrom(date))}.`);
          if (date > stu.studyEnd) notes.push('Період навчання учня буде продовжено на рік від цієї дати.');
        }
      }
      if (hwChk.checked && val('hw_due') && val('date') && val('hw_due') < val('date')) notes.push('Термін здачі ДЗ раніше за дату заняття.');
      q('#note').hidden = !notes.length; q('#note').innerHTML = notes.map(esc).join('<br>');
    };
    f.addEventListener('input', refresh);
    hwChk.addEventListener('change', () => hwSync(true)); // раніше за загальний change, тож refresh побачить уже підставлені дати
    f.addEventListener('change', e => { // у новому занятті зміна учня підставляє його звичний час і тривалість
      if (e.target.name === 'student') { const s = st.students.find(x => x.id === +e.target.value), sl = s && currentSlots(s)[0]; if (sl) { q('[name=startTime]').value = sl.startTime; q('[name=dur]').value = sl.durationMinutes; } }
      refresh();
    });
    if (q('#del')) q('#del').onclick = () => d.close('delete');
    hwSync(false); refresh();
  };

  const d = await modal(edit ? `${cur.name} — ${ua(dateFrom(L.date))}` : 'Нове заняття', inner, edit ? 'Зберегти' : 'Створити', wire);
  if (d.returnValue === 'delete') return { delete: true };
  if (d.returnValue !== 'ok') return null;
  const fd = new FormData(d.querySelector('form')), g = k => String(fd.get(k) ?? '').trim(), isNew = !edit && g('student') === 'new';
  return {
    studentId: edit ? L.studentId : isNew ? null : +g('student'), newStudent: isNew ? { name: g('ns_name'), phone: g('ns_phone') } : null,
    date: g('date'), startTime: g('startTime'), durationMinutes: +g('dur'), status: g('status'),
    regular: fd.has('regular'), topic: g('topic'), comment: g('comment'),
    homework: fd.has('hw') ? { task: g('hw_task'), link: g('hw_link'), issueDate: g('date'), dueDate: g('hw_due') } : null
  };
}