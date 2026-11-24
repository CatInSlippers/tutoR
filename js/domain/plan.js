import { dateKey } from '../core/dates.js';
import { allLessons } from './finance.js';
import { subWeight, topicWeight } from './catalog.js';

// План занять учня: s.lessonPlan = [{ date, items: [{ id, name, topic, skills: [назви], weight, part, parts }] }]
// Це знімок бібліотеки на момент збереження: зміни в модулях не чіпають уже розставлені теми.

// Майбутні заплановані заняття учня (по одному на дату), на які можна розставляти теми
export function upcomingLessons(db, s) {
  const today = dateKey(new Date()), seen = new Set();
  return allLessons(db, s).filter(l => l.status === 'Заплановано' && l.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .filter(l => !seen.has(l.date) && seen.add(l.date))
    .map(l => ({ date: l.date, startTime: l.startTime }));
}

// Підтеми модуля по порядку (тема без підтем рахується одним пунктом)
export function moduleUnits(m) {
  return m.topics.flatMap(t => t.subtopics.length
    ? t.subtopics.map(s => ({ id: s.id, name: s.name, topic: t.name, weight: subWeight(t, s), skills: s.skills.map(k => k.name) }))
    : [{ id: t.id, name: t.name, topic: t.name, weight: topicWeight(t), skills: [] }]);
}

// Розставляє підтеми по N заняттях. Повертає масив із N списків id (важка підтема може повторюватися в кількох заняттях).
export function distribute(units, N) {
  const out = Array.from({ length: N }, () => []), n = units.length;
  if (!n || !N) return out;
  const W = units.reduce((a, u) => a + u.weight, 0);
  if (n <= N) { // кожна підтема отримує ≥ 1 заняття, кількість занять пропорційна складності
    const ideal = units.map(u => N * u.weight / W), c = ideal.map(x => Math.max(1, Math.floor(x)));
    let diff = N - c.reduce((a, b) => a + b, 0);
    while (diff !== 0) {
      if (diff > 0) { // додаємо там, де найбільше не вистачає
        let bi = 0, bv = -Infinity; ideal.forEach((x, i) => { const v = x - c[i]; if (v > bv) { bv = v; bi = i; } });
        c[bi]++; diff--;
      } else { // забираємо там, де найбільше зайвого (але не менше одного заняття)
        let bi = -1, bv = Infinity; ideal.forEach((x, i) => { const v = x - c[i]; if (c[i] > 1 && v < bv) { bv = v; bi = i; } });
        if (bi < 0) break; c[bi]--; diff++;
      }
    }
    let k = 0; units.forEach((u, i) => { for (let j = 0; j < c[i]; j++) out[k++].push(u.id); });
    return out;
  }
  // Підтем більше, ніж занять: послідовність ділиться на N груп із найближчою до середньої сумарною складністю (динамічне програмування)
  const target = W / N, pre = [0]; units.forEach(u => pre.push(pre[pre.length - 1] + u.weight));
  const INF = 1e18, dp = Array.from({ length: N + 1 }, () => new Array(n + 1).fill(INF)), cut = Array.from({ length: N + 1 }, () => new Array(n + 1).fill(0));
  dp[0][0] = 0;
  for (let k = 1; k <= N; k++) for (let j = k; j <= n - (N - k); j++) for (let i = k - 1; i < j; i++) {
    if (dp[k - 1][i] >= INF) continue;
    const v = dp[k - 1][i] + (pre[j] - pre[i] - target) ** 2;
    if (v < dp[k][j]) { dp[k][j] = v; cut[k][j] = i; }
  }
  let j = n; for (let k = N; k >= 1; k--) { const i = cut[k][j]; for (let t = i; t < j; t++) out[k - 1].push(units[t].id); j = i; }
  return out;
}

// Перетворює розстановку на записи плану (зі знімком назв і навичок). Порожні заняття не записуються.
export function toEntries(units, dates, assign) {
  const byId = new Map(units.map(u => [u.id, u])), total = new Map(), seen = new Map();
  assign.forEach(l => new Set(l).forEach(id => total.set(id, (total.get(id) || 0) + 1)));
  return dates.map((date, i) => ({
    date,
    items: [...new Set(assign[i] || [])].filter(id => byId.has(id)).map(id => {
      const u = byId.get(id), part = (seen.get(id) || 0) + 1, parts = total.get(id), n = u.skills.length;
      seen.set(id, part);
      const skills = u.skills.slice(Math.floor((part - 1) * n / parts), Math.floor(part * n / parts));
      return { id, name: u.name, topic: u.topic, skills, weight: u.weight, part, parts };
    })
  })).filter(e => e.items.length);
}

export const plannedOn = (s, date) => (s.lessonPlan || []).find(e => e.date === date) || null;

// ===== Зміни (викликати всередині store.update) =====
// Минулі записи (історія проведених занять) лишаються, майбутні повністю замінюються новими.
export function saveLessonPlan(db, studentId, entries) {
  const st = db.students.find(x => x.id === studentId); if (!st) throw new Error('Учня не знайдено.');
  const today = dateKey(new Date());
  st.lessonPlan = (st.lessonPlan || []).filter(e => e.date < today).concat(entries.filter(e => e.date >= today)).sort((a, b) => a.date.localeCompare(b.date));
}
export function clearLessonPlan(db, studentId) {
  const st = db.students.find(x => x.id === studentId); if (!st) return;
  const today = dateKey(new Date());
  st.lessonPlan = (st.lessonPlan || []).filter(e => e.date < today);
}

// Тема заняття для показу: вписана викладачем має пріоритет, інакше запланована (зі знімка плану)
export function lessonTopic(s, l) {
  if (l.topic && l.topic !== 'Заняття') return l.topic;
  const e = plannedOn(s, l.date);
  return e ? e.items.map(i => i.name + (i.parts > 1 ? ` (${i.part}/${i.parts})` : '')).join(', ') : '';
}