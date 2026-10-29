import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarDays, cleanRecord, dateKey, filterRecords, makeDemo, mergeRecords, monthSummary, parseBackup, parseDate, toCSV, validDate, validRecord } from '../dist/lib/journal.js';

const cup = (overrides = {}) => ({ id: 'a', brand: 'luckin', name: '生椰拿铁', date: '2026-10-29', price: 9.9, size: '大杯', temperature: '少冰', sugar: '五分糖', note: '', ...overrides });

test('calendar keeps leap day and Monday-first padding', () => {
  const days = calendarDays(2024, 1);
  assert.equal(days.length, 35);
  assert.equal(days[0].key, '2024-01-29');
  assert.equal(days.filter(day => day.current).length, 29);
  assert.equal(days.at(-1).key, '2024-03-03');
});
test('six-week months include all 31 dates without duplicating any cell', () => {
  const days = calendarDays(2026, 2);
  assert.equal(days.length, 42);
  assert.equal(new Set(days.map(day => day.key)).size, 42);
  assert.equal(days.filter(day => day.current).length, 31);
});
test('calendar crosses the December boundary', () => {
  assert.equal(calendarDays(2026, 11).at(-1).key, '2027-01-03');
});
test('local dates round trip without converting to UTC', () => {
  for (const date of ['2024-02-29', '2026-03-08', '2026-11-01', '1900-01-01', '2200-12-31']) assert.equal(dateKey(parseDate(date)), date);
});
for (const date of ['2023-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-1-01', '1899-12-31', '2201-01-01', '', null]) {
  test(`reject invalid date ${String(date)}`, () => assert.equal(validDate(date), false));
}
test('record validation rejects malformed and prototype-derived brand values', () => {
  for (const overrides of [{ brand: '__proto__' }, { brand: ['luckin'] }, { id: '' }, { name: '   ' }, { name: 'a'.repeat(41) }, { price: -1 }, { price: NaN }, { price: Infinity }, { price: '9.9' }, { size: '巨杯' }, { temperature: '' }, { sugar: '糖' }, { note: 'a'.repeat(121) }]) assert.equal(validRecord(cup(overrides)), false);
  assert.equal(validRecord(null), false);
  assert.equal(validRecord(cup({ price: 0 })), true);
});
test('normalization rounds cents, trims text and discards unexpected properties', () => {
  const record = cleanRecord(cup({ name: ' 拿铁 ', note: ' 好喝 ', price: 1.005, token: 'untrusted' }));
  assert.equal(record.price, 1.01);
  assert.equal(record.name, '拿铁');
  assert.equal(record.note, '好喝');
  assert.equal(Object.hasOwn(record, 'token'), false);
});
test('monthly totals sum integer cents and handle empty months', () => {
  const summary = monthSummary([cup({ price: .1 }), cup({ id: 'b', price: .2 })]);
  assert.equal(summary.cost, .3);
  assert.equal(summary.cups, 2);
  assert.equal(summary.favoriteBrand, 'luckin');
  assert.equal(summary.favoriteCount, 2);
  assert.equal(monthSummary([]).favoriteBrand, null);
});
test('search combines month, type, brand, drink name and note words', () => {
  const data = [cup({ note: '午后奖励' }), cup({ id: 'b', brand: 'chagee', name: '伯牙绝弦' }), cup({ id: 'c', date: '2026-09-29' })];
  assert.equal(filterRecords(data, { year: 2026, month: 9, type: 'coffee', query: 'LUCKIN 午后' }).length, 1);
  assert.equal(filterRecords(data, { query: '瑞幸 拿铁' }).length, 2);
  assert.equal(filterRecords(data, { type: 'tea', query: '伯牙' })[0].id, 'b');
  assert.equal(filterRecords(data, { query: '不存在' }).length, 0);
});
test('merge skips duplicate IDs but keeps two identical cups with different IDs', () => {
  const original = [cup()];
  const result = mergeRecords(original, [cup(), cup({ id: 'b' }), cup({ id: 'b' })]);
  assert.equal(result.added, 1);
  assert.equal(result.skipped, 2);
  assert.equal(result.records.length, 2);
  assert.equal(original.length, 1);
});
test('backup validation rejects the entire import when a later record is invalid', () => {
  assert.throws(() => parseBackup(JSON.stringify({ version: 1, records: [cup(), cup({ date: '2023-02-29' })] })), /格式有误/);
  assert.throws(() => parseBackup('{bad'), /无法读取/);
  assert.throws(() => parseBackup('null'), /格式有误/);
  assert.throws(() => parseBackup(JSON.stringify({ version: 2, records: [] })), /格式有误/);
  assert.throws(() => parseBackup(JSON.stringify({ version: 1, records: Array(10001).fill(cup()) })), /格式有误/);
});
test('old v1 backups still import and normalize records', () => {
  assert.deepEqual(parseBackup(JSON.stringify({ version: 1, records: [cup()] })), [cup()]);
  assert.deepEqual(parseBackup(JSON.stringify({ version: 1, records: [] })), []);
});
test('CSV supports Chinese, commas, quotes and multiline notes', () => {
  const csv = toCSV([cup({ name: '椰,香"拿铁', note: '第一行\n第二行' })]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"椰,香""拿铁"'));
  assert.ok(csv.includes('"第一行\n第二行"'));
  assert.ok(csv.includes('"9.90"'));
});
test('CSV neutralizes spreadsheet formulas in untrusted drink names and notes', () => {
  for (const text of ['=HYPERLINK("https://example.com")', '+SUM(1,1)', '@SUM(1,1)', '-1+2', '  =1+1', '\t=1']) {
    assert.ok(toCSV([cup({ name: text })]).includes(`"'${text.replaceAll('"', '""')}"`));
  }
});
test('demo records stay valid in short months and never mutate the date input', () => {
  const date = new Date(2026, 1, 28, 12);
  const records = makeDemo(date);
  assert.equal(records.length, 18);
  assert.ok(records.every(validRecord));
  assert.equal(date.getDate(), 28);
  assert.equal(records.filter(r => r.date === dateKey(date)).length, 2);
});
