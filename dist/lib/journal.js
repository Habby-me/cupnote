import { BRANDS } from './brands.js';

export const SIZES = ['小杯', '中杯', '大杯', '超大杯', '标准杯'];
export const TEMPERATURES = ['正常冰', '少冰', '去冰', '常温', '温', '热'];
export const SUGARS = ['标准糖', '七分糖', '五分糖', '三分糖', '不另外加糖'];
export const MAX_RECORDS = 10000;

// Local noon keeps calendar dates independent of UTC conversions and DST edges.
export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function validDate(key) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const date = parseDate(key);
  return date.getFullYear() >= 1900 && date.getFullYear() <= 2200 && dateKey(date) === key;
}

export function validRecord(record) {
  if (!record || typeof record !== 'object') return false;
  const { id, brand, name, date, price, size, temperature, sugar, note } = record;
  return typeof id === 'string' && id.length > 0 && id.length <= 100
    && typeof brand === 'string' && Object.hasOwn(BRANDS, brand)
    && typeof name === 'string' && name.trim().length > 0 && name.length <= 40
    && validDate(date) && typeof price === 'number' && Number.isFinite(price) && price >= 0 && price <= 9999
    && SIZES.includes(size) && TEMPERATURES.includes(temperature) && SUGARS.includes(sugar)
    && typeof note === 'string' && note.length <= 120;
}

export function cleanRecord(record) {
  if (!validRecord(record)) throw new Error('饮品记录格式有误。');
  const { id, brand, name, date, price, size, temperature, sugar, note } = record;
  return { id, brand, name: name.trim(), date, price: Math.round((price + Number.EPSILON) * 100) / 100, size, temperature, sugar, note: note.trim() };
}

export function calendarDays(year, month) {
  const offset = (new Date(year, month, 1, 12).getDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(year, month + 1, 0).getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month, 1 - offset + index, 12);
    return { key: dateKey(date), day: date.getDate(), current: date.getMonth() === month };
  });
}

export function filterRecords(records, { year, month, type = 'all', query = '' } = {}) {
  const prefix = year === undefined ? null : `${year}-${String(month + 1).padStart(2, '0')}`;
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return records.filter(record => {
    const brand = BRANDS[record.brand];
    const searchable = `${record.name} ${brand.name} ${brand.en} ${record.note}`.toLocaleLowerCase();
    return (!prefix || record.date.startsWith(prefix)) && (type === 'all' || brand.type === type)
      && words.every(word => searchable.includes(word));
  });
}

export function monthSummary(records) {
  const counts = new Map();
  let cents = 0;
  for (const record of records) {
    cents += Math.round(record.price * 100);
    counts.set(record.brand, (counts.get(record.brand) || 0) + 1);
  }
  const favorite = [...counts].sort((a, b) => b[1] - a[1])[0];
  return { cups: records.length, cost: cents / 100, favoriteBrand: favorite?.[0] || null, favoriteCount: favorite?.[1] || 0 };
}

export function parseBackup(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('无法读取，请选择有效的 Cupnote JSON 备份。'); }
  if (!data || data.version !== 1 || !Array.isArray(data.records) || data.records.length > MAX_RECORDS || !data.records.every(validRecord)) {
    throw new Error('备份格式有误，未导入任何记录。');
  }
  return data.records.map(cleanRecord);
}

// IDs distinguish two identical drinks on the same day. Never deduplicate by name.
export function mergeRecords(existing, incoming) {
  const records = existing.map(cleanRecord);
  const ids = new Set(records.map(record => record.id));
  let added = 0;
  for (const record of incoming) {
    if (ids.has(record.id)) continue;
    records.push(cleanRecord(record));
    ids.add(record.id);
    added++;
  }
  if (records.length > MAX_RECORDS) throw new Error('记录已超过 10000 条，请分开保存备份。');
  return { records, added, skipped: incoming.length - added };
}

export function toCSV(records) {
  const cell = value => {
    let text = String(value);
    // Spreadsheet apps can interpret untrusted cells as formulas, even if quoted.
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const rows = [['日期', '品牌', '饮品', '实付金额', '杯型', '温度', '甜度', '随手记'],
    ...[...records].sort((a, b) => a.date.localeCompare(b.date)).map(record => [record.date, BRANDS[record.brand].name, record.name, record.price.toFixed(2), record.size, record.temperature, record.sugar, record.note])];
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function makeDemo(today) {
  const seeds = [[2, 'luckin', '生椰拿铁', 9.9], [4, 'chagee', '伯牙绝弦', 16], [7, 'starbucks', '馥芮白', 30], [7, 'heytea', '多肉葡萄', 18], [8, 'guming', '云岭茉莉白', 14], [10, 'luckin', '丝绒拿铁', 12.9], [13, 'heytea', '纯绿妍茶后', 15], [15, 'chagee', '花田乌龙', 16], [15, 'luckin', '美式咖啡', 9.9], [17, 'nayuki', '霸气橙子', 19], [19, 'luckin', '生椰拿铁', 9.9], [21, 'chabaidao', '豆乳玉麒麟', 15], [23, 'starbucks', '冰美式', 25], [23, 'coco', '奶茶三兄弟', 14], [24, 'mixue', '冰鲜柠檬水', 4], [26, 'guming', '超A芝士葡萄', 18], [today.getDate(), 'luckin', '生椰拿铁', 9.9], [today.getDate(), 'chagee', '伯牙绝弦', 16]];
  return seeds.map(([day, brand, name, price], index) => ({ id: `demo-${index}`, date: dateKey(new Date(today.getFullYear(), today.getMonth(), day, 12)), brand, name, price, size: '大杯', temperature: index % 4 === 0 ? '去冰' : '少冰', sugar: index % 3 === 0 ? '三分糖' : '五分糖', note: index === 16 ? '忙里偷闲的午后，还是这一口椰香最治愈。' : index === 17 ? '下班路上，给自己一点小奖励。' : '' }));
}
