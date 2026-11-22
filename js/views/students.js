import { html, mount, delegate } from '../core/html.js';
import * as store from '../core/store.js';
import * as router from '../core/router.js';
import { askForm, askConfirm } from '../core/ui.js';
import { makeStudent } from '../domain/students.js';
import { DAYS, DAYS_SHORT, WEEK_ORDER, endTime } from '../core/dates.js';
import { currentSlots } from '../domain/schedule.js';
const NONE = 'Без постійного розкладу';
export function renderStudents(el) {
  const list = store.get().students;
  mount(el, html`<div class="row"><h2 class="spacer">Учні</h2><button class="primary" data-act="add">+ Учень</button></div>
    ${list.length ? html`<div class="list">${list.map(x => html`<div class="sitem" style="border-left-color:${x.color}">
    <div class="spacer"><a class="slink" href="#/student/${x.id}"><b>${x.name}</b></a><div class="muted">${x.learningGoal || 'ціль не вказана'} · ${x.lessonPrice} грн</div>
    <div class="muted">${currentSlots(x).map(s => `${DAYS_SHORT[s.weekday]} ${s.startTime}–${endTime(s.startTime, s.durationMinutes)}`).join(', ') || NONE}</div></div>
    <button class="danger" data-act="del" data-id="${x.id}" title="Видалити">×</button></div>`)}</div>`
      : html`<div class="card muted" style="margin-top:16px">Учнів ще немає. Додайте першого.</div>`}`);
  delegate(el, {
    async add() {
      const v = await askForm('Новий учень', [
        { k: 'firstName', label: 'Ім’я', required: true }, { k: 'lastName', label: 'Прізвище' }, { k: 'phone', label: 'Телефон' },
        { k: 'lessonPrice', label: 'Ціна заняття, грн', type: 'number', value: 250, min: 0, required: true },
        { k: 'weekday', label: 'День занять', options: [NONE, ...WEEK_ORDER.map(d => DAYS[d])], value: NONE },
        { k: 'startTime', label: 'Початок', type: 'time', value: '15:00' },
        { k: 'durationMinutes', label: 'Тривалість, хв', type: 'number', value: 60, min: 15 }]);
      if (!v) return;
      const slots = v.weekday === NONE ? [] : [{ weekday: DAYS.indexOf(v.weekday), startTime: v.startTime || '15:00', durationMinutes: v.durationMinutes || 60 }];
      store.update(s => s.students.push(Object.assign(makeStudent(s, v), { slots })));
    },
    async del(b) {
      const st = list.find(x => x.id === +b.dataset.id);
      if (st && await askConfirm(`Видалити учня «${st.name}» разом з його заняттями?`, 'Видалити'))
        store.update(s => { s.students = s.students.filter(x => x.id !== st.id); s.lessons = s.lessons.filter(l => l.studentId !== st.id); s.homework = s.homework.filter(h => h.studentId !== st.id); s.ops = s.ops.filter(o => o.studentId !== st.id); });
    }
  });
}
