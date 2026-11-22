import { CONFIG } from '../config.js';
export class AuthError extends Error {}
let client = null, token = null, expires = 0, ready = null;
const loadScript = () => new Promise((ok, fail) => {
  if (window.google?.accounts?.oauth2) return ok();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok;
  s.onerror = () => fail(new AuthError('Не вдалося завантажити Google Identity Services. Перевірте інтернет.'));
  document.head.append(s);
});
export const init = () => ready || (ready = loadScript().then(() => {
  client = google.accounts.oauth2.initTokenClient({ client_id: CONFIG.CLIENT_ID, scope: CONFIG.SCOPES, callback: () => {} });
}).catch(e => { ready = null; throw e; }));
const ERR = { popup_closed: 'Вікно входу було закрито.', popup_failed_to_open: 'Браузер заблокував вікно входу.' };
function request(prompt) {
  if (CONFIG.CLIENT_ID.startsWith('YOUR_')) throw new AuthError('Вкажіть CLIENT_ID у js/config.js');
  return new Promise((ok, fail) => {
    client.callback = r => {
      if (r.error) return fail(new AuthError(r.error_description || r.error));
      if (!google.accounts.oauth2.hasGrantedAllScopes(r, ...CONFIG.SCOPES.split(' ')))
        return fail(new AuthError('Потрібен дозвіл на збереження даних у Google Диску (папка застосунку).'));
      token = r.access_token; expires = Date.now() + (r.expires_in - 60) * 1000; ok(token);
    };
    client.error_callback = e => fail(new AuthError(ERR[e.type] || e.type || 'Помилка входу'));
    client.requestAccessToken({ prompt });
  });
}
export const signIn = (prompt = 'select_account') => request(prompt);
export const getToken = async () => (token && Date.now() < expires) ? token : request('');
export const invalidate = () => { token = null; };
export const signOut = () => { token = null; expires = 0; };
export async function userInfo() {
  const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + await getToken() } });
  if (!r.ok) throw new AuthError('Не вдалося отримати профіль Google.');
  return r.json();
}
