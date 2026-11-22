import { html, mount, delegate } from '../core/html.js';
export function renderLogin(el, { user, error }, handlers) {
  mount(el, html`<div class="login card"><h1>Система репетитора</h1>
    <p class="muted">Дані зберігаються у вашому Google Диску, у прихованій папці застосунку. Ніхто, крім вас, їх не бачить.</p>
    ${error ? html`<div class="errbox">${error}</div>` : ''}
    <div class="stack">
      ${user ? html`<button class="primary" data-act="continue">Продовжити як ${user.name}</button><button data-act="signin">Інший акаунт</button>`
             : html`<button class="primary" data-act="signin">Увійти через Google</button>`}
      <button data-act="demo">Спробувати демо без входу</button>
    </div></div>`);
  delegate(el, handlers);
}
