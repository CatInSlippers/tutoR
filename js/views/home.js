import { html, mount } from '../core/html.js';
import { renderStudents } from './students.js';
import { renderCalendar } from './calendar.js';
export function renderHome(el) {
  mount(el, html`<div class="split"><section id="pane-students"></section><section id="pane-cal"></section></div>`);
  renderStudents(el.querySelector('#pane-students'));
  renderCalendar(el.querySelector('#pane-cal'));
}
