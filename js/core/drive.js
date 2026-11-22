import { getToken, invalidate } from './auth.js';
import { CONFIG } from '../config.js';
const API = 'https://www.googleapis.com/drive/v3', UP = 'https://www.googleapis.com/upload/drive/v3/files', F = 'id,version,modifiedTime';
export class DriveError extends Error { constructor(status, msg) { super(`Drive ${status}: ${msg}`); this.status = status; } }
async function call(url, opts = {}, retry = true) {
  const r = await fetch(url, { cache: 'no-store', ...opts, headers: { ...opts.headers, Authorization: 'Bearer ' + await getToken() } });
  if (r.status === 401 && retry) { invalidate(); return call(url, opts, false); }
  if (!r.ok) throw new DriveError(r.status, (await r.text()).slice(0, 300));
  return r;
}
export async function find() {
  const q = encodeURIComponent(`name='${CONFIG.FILE_NAME}' and trashed=false`);
  const j = await (await call(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(${F})`)).json();
  return j.files[0] || null;
}
export const meta = async id => (await call(`${API}/files/${id}?fields=${F}`)).json();
export const read = async id => (await call(`${API}/files/${id}?alt=media`)).text();
export async function create(text) {
  const b = 'tutor' + Math.random().toString(36).slice(2);
  const body = `--${b}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify({ name: CONFIG.FILE_NAME, parents: ['appDataFolder'] })}\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${text}\r\n--${b}--`;
  return (await call(`${UP}?uploadType=multipart&fields=${F}`, { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body })).json();
}
export const update = async (id, text) =>
  (await call(`${UP}/${id}?uploadType=media&fields=${F}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: text })).json();
