import { cleanRecord, mergeRecords, MAX_RECORDS } from './journal.js';

export const STORAGE_KEY = 'cupnote.journal.v1';

function decode(raw) {
  if (raw === null) return { version: 1, hasStarted: false, records: [] };
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !Array.isArray(data.records) || data.records.length > MAX_RECORDS) throw new Error('本地数据格式有误。');
  const records = data.records.map(cleanRecord);
  if (new Set(records.map(record => record.id)).size !== records.length) throw new Error('本地记录标识重复。');
  return { version: 1, hasStarted: Boolean(data.hasStarted || records.length), records };
}

export function createJournalStorage(storage) {
  let blocked = false;
  return {
    load() {
      try { const data = decode(storage.getItem(STORAGE_KEY)); blocked = false; return { ...data, error: null }; }
      catch (error) { blocked = true; return { records: [], hasStarted: false, error }; }
    },
    save(records) {
      if (blocked) throw new Error('原有数据未能读取。请先导出原始数据，再导入有效备份恢复。');
      const cleaned = records.map(cleanRecord);
      if (cleaned.length > MAX_RECORDS) throw new Error('记录数量超过上限。');
      if (new Set(cleaned.map(record => record.id)).size !== cleaned.length) throw new Error('记录标识重复。');
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, hasStarted: true, records: cleaned }));
      return cleaned;
    },
    import(textRecords) {
      // A validated backup is the only explicit recovery path for unreadable storage.
      let existing;
      try { existing = decode(storage.getItem(STORAGE_KEY)).records; } catch { existing = []; }
      const merged = mergeRecords(existing, textRecords);
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, hasStarted: true, records: merged.records }));
      blocked = false;
      return merged;
    },
    raw() { return storage.getItem(STORAGE_KEY); }
  };
}
