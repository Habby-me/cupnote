import test from 'node:test';
import assert from 'node:assert/strict';
import { createJournalStorage, STORAGE_KEY } from '../dist/lib/storage.js';

const cup = { id: 'a', brand: 'luckin', name: '生椰拿铁', date: '2026-10-29', price: 9.9, size: '大杯', temperature: '少冰', sugar: '五分糖', note: '' };
function memory(initial = null) {
  let value = initial;
  return { getItem: () => value, setItem: (key, next) => { assert.equal(key, STORAGE_KEY); value = next; } };
}
test('first visit loads an empty journal without writing demonstration records', () => {
  const adapter = memory(), storage = createJournalStorage(adapter);
  assert.deepEqual(storage.load(), { version: 1, hasStarted: false, records: [], error: null });
  assert.equal(adapter.getItem(), null);
});
test('saved v1 records survive reload and retain the started state after deleting all cups', () => {
  const adapter = memory(), storage = createJournalStorage(adapter);
  storage.load(); storage.save([cup]);
  assert.deepEqual(createJournalStorage(adapter).load().records, [cup]);
  storage.save([]);
  assert.equal(createJournalStorage(adapter).load().hasStarted, true);
});
test('corrupt storage is preserved and protected from accidental overwrite', () => {
  const adapter = memory('{broken'), storage = createJournalStorage(adapter);
  assert.ok(storage.load().error);
  assert.throws(() => storage.save([cup]), /原有数据未能读取/);
  assert.equal(adapter.getItem(), '{broken');
  assert.equal(storage.raw(), '{broken');
});
test('malformed and duplicate persisted records also trigger recovery protection', () => {
  for (const records of [[{ ...cup, date: '2023-02-29' }], [cup, cup]]) {
    const storage = createJournalStorage(memory(JSON.stringify({ version: 1, records })));
    assert.ok(storage.load().error);
    assert.throws(() => storage.save([]));
  }
});
test('valid backup import explicitly recovers unreadable storage', () => {
  const adapter = memory('{broken'), storage = createJournalStorage(adapter);
  storage.load();
  assert.equal(storage.import([cup]).added, 1);
  assert.deepEqual(storage.load().records, [cup]);
  assert.doesNotThrow(() => storage.save([cup]));
});
test('import merges the latest persisted state and ignores repeated IDs', () => {
  const adapter = memory(), storage = createJournalStorage(adapter);
  storage.save([cup]);
  const result = storage.import([cup, { ...cup, id: 'b' }]);
  assert.equal(result.added, 1); assert.equal(result.skipped, 1);
  assert.equal(storage.load().records.length, 2);
});
test('quota errors propagate and preserve the last successful backup', () => {
  const adapter = memory(), storage = createJournalStorage(adapter);
  storage.save([cup]); const previous = adapter.getItem();
  adapter.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.throws(() => storage.save([]), /QuotaExceededError/);
  assert.throws(() => storage.import([{ ...cup, id: 'b' }]), /QuotaExceededError/);
  assert.equal(adapter.getItem(), previous);
});
test('blocked browser storage fails gracefully instead of throwing on load', () => {
  const storage = createJournalStorage({ getItem() { throw new Error('SecurityError'); } });
  assert.ok(storage.load().error);
  assert.throws(() => storage.save([cup]), /原有数据未能读取/);
});
