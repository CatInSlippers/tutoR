import { dateKey, dateFrom, addDays } from '../core/dates.js';
import { nextId } from '../core/schema.js';
import { lessonsOf } from './lessons.js';

// Заняття, за які нараховуються гроші: проведені, відпрацьовані й пропуски учня (якщо діє списання)
const PAID = ['Проведено', 'Відпрацювання', 'Пропущено (учень)'];
const daysBetween = (a, b) => Math.round((dateFrom(b) - dateFrom(a)) / 864e5);

// Усі заняття учня: згенеровані за розкладом у періоді навчання + збережені записи поза ним.
export function allLessons(state, s) {
    const out = [], today = dateKey(new Date());
    for (let d = dateFrom(s.studyStart); dateKey(d) <= s.studyEnd; d = addDays(d, 1)) out.push(...lessonsOf(state, s, d));
    state.lessons.filter(l => l.studentId === s.id && (l.date < s.studyStart || l.date > s.studyEnd))
        .forEach(l => { // той самий принцип, що в lessonsOf: минуле без відмітки вважається проведеним
            const auto = l.status === 'Заплановано' && l.date < today;
            out.push({ ...l, auto, status: auto ? 'Проведено' : l.status, unmarked: false });
        });
    return out;
}

// Пропуск учня: рішення на занятті (l.charge) → правило учня (s.chargeMissed) → загальне правило (settings.chargeMissed).
// Пропуск викладача не списується ніколи.
export const stuRule = (state, s) => s.chargeMissed === 'yes' ? true : s.chargeMissed === 'no' ? false : !!state.settings.chargeMissed;
const chargeRule = (state, l, s) => l.charge === 'yes' ? true : l.charge === 'no' ? false : stuRule(state, s);

// Фінанси учня. Внесені кошти покривають заняття по черзі, від найстарішого.
export function finance(state, s) {
    const today = dateKey(new Date()), cost = s.lessonPrice, L = allLessons(state, s);
    const pays = state.ops.filter(o => o.studentId === s.id).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    let run = 0;
    const steps = pays.map(o => { run += o.type === 'refund' ? -o.amount : o.amount; return { date: o.date, total: run, id: o.id }; });
    const net = run;
    const view = L.filter(l => PAID.includes(l.status)).sort((a, b) => a.date.localeCompare(b.date))
        .map(l => ({ l, charged: l.status !== 'Пропущено (учень)' || chargeRule(state, l, s) }));
    const N = Math.max(1, parseInt(s.packSize) || 4), g = state.settings.graceDays || 0, pack = s.payType === 'Пакет';
    if (pack) { // пакет оплачується наперед: дописуємо майбутні заняття поточного (і наступного, якщо вже почалося) пакета
        const fut = L.filter(l => l.status === 'Заплановано' && !l.unmarked).sort((x, y) => x.date.localeCompare(y.date));
        let n = view.filter(r => r.charged).length, i = 0;
        while (i < fut.length && (n % N !== 0 || fut[i].date <= today)) { view.push({ l: fut[i], charged: true, future: true }); n++; i++; }
    }
    const chg = view.filter(r => r.charged);
    let cum = 0;
    chg.forEach((r, k) => {
        cum += cost;
        const base = pack ? chg[Math.floor(k / N) * N].l.date : r.l.date;
        r.due = dateKey(addDays(dateFrom(base), g));
        const c = net + 1e-9 >= cum ? steps.find(x => x.total + 1e-9 >= cum) : null;
        r.paid = c ? c.date : null; r.opId = c ? c.id : null;
        r.delay = Math.max(0, daysBetween(r.due, r.paid || today));
        r.late = r.delay > 0; r.pending = !r.paid && r.due >= today;
    });
    const rows = chg, paidRows = rows.filter(r => r.paid), earned = rows.length * cost;
    const ds = paidRows.map(r => r.delay).sort((x, y) => x - y);
    const median = ds.length ? (ds[(ds.length - 1) >> 1] + ds[ds.length >> 1]) / 2 : 0;
    const paidN = Math.floor(net / Math.max(1, cost) + 1e-9), usedN = rows.filter(r => !r.future && r.l.status !== 'Заплановано').length;
    return {
        view, rows, pays, pack, N, earned, received: net, debt: Math.max(0, earned - net), overpaid: Math.max(0, net - earned),
        unmarked: L.filter(l => l.unmarked).sort((x, y) => x.date.localeCompare(y.date)),
        paidN, usedN, onTime: paidRows.filter(r => !r.late).length, paidLate: paidRows.filter(r => r.late).length,
        overdue: rows.filter(r => !r.paid && r.late).length, median,
        avgDelay: paidRows.length ? paidRows.reduce((a, r) => a + r.delay, 0) / paidRows.length : 0
    };
}

// ===== Операції (викликати всередині store.update). type: 'payment' | 'refund' =====
export function addOp(s, { studentId, type, date, amount, note }) {
    if (!(amount > 0)) throw new Error('Сума має бути більшою за 0.');
    s.ops.push({ id: nextId(s), studentId, type, date, amount, note: note || '' });
}
export function updateOp(s, id, { date, amount, note }) {
    const o = s.ops.find(x => x.id === id); if (!o) throw new Error('Операцію не знайдено.');
    if (!(amount > 0)) throw new Error('Сума має бути більшою за 0.');
    Object.assign(o, { date, amount, note: note || '' });
}
export const deleteOp = (s, id) => { s.ops = s.ops.filter(o => o.id !== id); };