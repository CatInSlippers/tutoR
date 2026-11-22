// Роути за location.hash: route('/student/:id', ({id}) => ...)
const routes = []; 
let notFound = () => {}, started = false;
export const route = (path, fn) => {
  const keys = [];
  const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
  routes.push({ re, keys, fn });
};
export function dispatch() {
  const h = location.hash.slice(1) || '/';
  for (const r of routes) {
    const m = h.match(r.re);
    if (m) { const p = {}; r.keys.forEach((k, i) => p[k] = decodeURIComponent(m[i + 1])); return r.fn(p); }
  }
  notFound(h);
}
export function start(nf) { if (nf) notFound = nf; if (!started) { addEventListener('hashchange', dispatch); started = true; } dispatch(); }
export const go = h => { location.hash = h; };
