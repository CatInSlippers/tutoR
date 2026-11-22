import { esc } from './html.js';
// Діалоги на нативному <dialog>: валідація полів і Esc працюють без додаткового коду.
export function modal(title, inner, ok = 'Зберегти', onOpen) {
  const d = document.getElementById('dlg');
  // «ОК» першим у DOM, щоб Enter у полі підтверджував форму; візуально він справа завдяки row-reverse
  d.innerHTML = `<form method="dialog"><h3 style="margin-top:0">${esc(title)}</h3>${inner}<div class="row" style="flex-direction:row-reverse;justify-content:flex-start;margin-top:16px"><button class="primary" value="ok">${esc(ok)}</button><button value="cancel" formnovalidate>Скасувати</button></div></form>`;
  return new Promise(res => { d.addEventListener('close', () => res(d), { once: true }); d.showModal(); if (onOpen) onOpen(d); });
}
export const askConfirm = async (text, ok = 'Так') => (await modal('Підтвердіть дію', `<p>${esc(text)}</p>`, ok)).returnValue === 'ok';
export const askNotice = text => modal('Увага', `<p>${esc(text)}</p>`, 'Зрозуміло').then(() => {});
// fields: [{k,label,type?,value?,options?,required?,min?}] → Promise<значення | null>
export async function askForm(title, fields, ok = 'Зберегти') {
  const inner = fields.map(f => `<label>${esc(f.label)}</label>` + (f.options
    ? `<select name="${f.k}">${f.options.map(o => `<option ${o === f.value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
    : `<input name="${f.k}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.required ? 'required' : ''} ${f.min !== undefined ? `min="${f.min}"` : ''} ${f.type === 'number' ? 'step="any"' : ''}>`)).join('');
  const d = await modal(title, inner, ok);
  if (d.returnValue !== 'ok') return null;
  const fd = new FormData(d.querySelector('form')), v = {};
  for (const f of fields) { const x = String(fd.get(f.k) ?? '').trim(); v[f.k] = f.type === 'number' ? Number(x) : x; }
  return v;
}
let tt;
export function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.hidden = false; clearTimeout(tt); tt = setTimeout(() => t.hidden = true, 3500); }
