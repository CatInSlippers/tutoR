// Tagged template: усі вставки екрануються автоматично, вкладені html`` — ні.
class Raw { constructor(s) { this.s = s; } }
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const render = v => v == null || v === false ? '' : Array.isArray(v) ? v.map(render).join('') : v instanceof Raw ? v.s : esc(v);
export const html = (strs, ...vals) => new Raw(strs.reduce((o, s, i) => o + s + (i < vals.length ? render(vals[i]) : ''), ''));
export const mount = (el, tpl) => { el.innerHTML = tpl.s; };
// Делегування кліків: <button data-act="назва"> → handlers.назва(button, event)
export const delegate = (el, h) => { el.onclick = e => { const b = e.target.closest('[data-act]'); const f = b && h[b.dataset.act]; if (f) f(b, e); }; };
