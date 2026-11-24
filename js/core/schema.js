export const SCHEMA_VERSION = 2;
export const emptyData = () => ({
  schemaVersion: SCHEMA_VERSION, seq: 1, // seq — лічильник id для всіх сутностей
  settings: { chargeMissed: false, graceDays: 0, debtDays: 3, taxPct: 0, taxFixed: 0 },
  students: [], lessons: [], activities: [], ops: [], plan: [], homework: [], notes: [],
  materials: [], expenses: [], catalog: [], templates: []
});
export const nextId = s => s.seq++;
export function migrate(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Некоректний формат даних');
  const v = d.schemaVersion || 0;
  if (v > SCHEMA_VERSION) throw new Error('Дані створені новішою версією застосунку');
  // v2: у бібліотеці між темою й навичками з'явилась підтема. Колишні «навички» тем стають підтемами
  // (без власної складності, тобто успадковують складність теми), а справжні навички вводяться заново.
  if (v < 2) d = { ...d, catalog: (d.catalog || []).map(m => ({ ...m, topics: (m.topics || []).map(({ skills = [], ...t }) => ({ ...t, subtopics: skills.map(k => ({ id: k.id, name: k.name, weight: null, skills: [] })) })) })) };
  const base = emptyData();
  return { ...base, ...d, settings: { ...base.settings, ...d.settings }, schemaVersion: SCHEMA_VERSION };
}
