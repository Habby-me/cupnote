import { test, expect } from 'playwright/test';
import { readFile } from 'node:fs/promises';

const sample = (overrides = {}) => ({ id: 'test-a', brand: 'luckin', name: '生椰拿铁', date: '2026-10-29', price: 9.9, size: '大杯', temperature: '少冰', sugar: '五分糖', note: '午后奖励', ...overrides });
async function seed(page, records = [sample()]) {
  await page.addInitScript(data => localStorage.setItem('cupnote.journal.v1', JSON.stringify({ version: 1, hasStarted: true, records: data })), records);
}
async function add(page, name = '香草拿铁') {
  await page.locator('#add-record').click();
  await page.locator('#drink-name').fill(name);
  await page.locator('#drink-price').fill('12.50');
  const date = await page.locator('#drink-date').inputValue();
  await page.locator('#record-form button[type=submit]').click();
  await expect(page.locator('#record-dialog')).toBeHidden();
  return date;
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-29T12:00:00+08:00') });
});

test('first cup replaces demo data, a second cup gets a badge, and edits survive reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#demo-banner')).toBeVisible();
  const date = await add(page);
  await expect(page.locator('#demo-banner')).toBeHidden();
  await expect(page.locator('#stat-cups')).toHaveText('1');
  await add(page, '伯牙绝弦');
  await expect(page.locator('#stat-cost')).toHaveText('25');
  await expect(page.locator(`[data-date="${date}"] .cup-count`)).toHaveText('+1');
  await page.locator('#day-records [data-open-record]').first().click();
  await page.locator('#drink-name').fill('改成冰拿铁');
  await page.locator('#record-form button[type=submit]').click();
  await expect(page.locator('#record-dialog')).toBeHidden();
  await expect(page.locator('#stat-cups')).toHaveText('2');
  await expect(page.locator('#stat-cost')).toHaveText('25');
  await page.reload();
  await page.locator(`[data-date="${date}"]`).click();
  await expect(page.locator('#day-records .receipt-name').first()).toHaveText('改成冰拿铁');
  await expect(page.locator('#stat-cost')).toHaveText('25');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cupnote.journal.v1')).records.every(r => !r.id.startsWith('demo-')))).toBe(true);
});

test('search and drink filters update both calendar and receipt wall', async ({ page }) => {
  await seed(page, [sample(), sample({ id: 'b', brand: 'chagee', name: '伯牙绝弦' })]);
  await page.goto('/');
  await page.locator('#search-input').fill('LUCKIN 午后');
  await expect(page.locator('#search-count')).toHaveText('本月找到 1 杯');
  await expect(page.locator('.calendar-day .mini-receipt')).toHaveCount(1);
  await page.locator('.view-switch [data-view=wall]').click();
  await expect(page.locator('.wall-card')).toHaveCount(1);
  await page.locator('#clear-search').click();
  await page.locator('[data-filter=tea]').click();
  await expect(page.locator('.wall-card .receipt-name')).toHaveText('伯牙绝弦');
  await page.locator('#search-input').fill('不存在');
  await expect(page.locator('#search-empty')).toBeVisible();
  await page.locator('#reset-filters').click();
  await expect(page.locator('.wall-card')).toHaveCount(2);
});

test('repeat creates a new cup and delete can be undone', async ({ page }) => {
  await seed(page); await page.goto('/');
  await page.locator('[data-date="2026-10-29"]').click();
  await page.locator('[data-repeat-record]').first().click();
  await expect(page.locator('#drink-name')).toHaveValue('生椰拿铁');
  await expect(page.locator('#drink-note')).toHaveValue('');
  await page.locator('#record-form button[type=submit]').click();
  await expect(page.locator('#stat-cups')).toHaveText('2');
  await page.locator('[data-delete-record]').first().click();
  await page.locator('#confirm-delete').click();
  await expect(page.locator('#stat-cups')).toHaveText('1');
  await page.locator('#toast-action').click();
  await expect(page.locator('#stat-cups')).toHaveText('2');
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('cupnote.journal.v1')).records.map(r => r.id));
  expect(new Set(ids).size).toBe(2);
});

test('JSON and CSV downloads contain only real records and imports skip duplicate IDs', async ({ page }) => {
  await seed(page); await page.goto('/');
  await page.locator('#backup-open').click();
  const jsonDownload = page.waitForEvent('download');
  await page.locator('#export-data').click();
  const json = JSON.parse(await readFile(await (await jsonDownload).path(), 'utf8'));
  expect(json.records).toHaveLength(1);
  const csvDownload = page.waitForEvent('download');
  await page.locator('#export-csv').click();
  const csv = await readFile(await (await csvDownload).path(), 'utf8');
  expect(csv).toContain('生椰拿铁'); expect(csv).toContain('9.90');
  await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, records: [...json.records, sample({ id: 'new-id' })] })) });
  await expect(page.locator('#stat-cups')).toHaveText('2');
  await expect(page.locator('#toast')).toContainText('跳过 1 条');
});

test('corrupt local data stays intact until a validated backup explicitly recovers it', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cupnote.journal.v1', '{broken'));
  await page.goto('/');
  await add(page);
  expect(await page.evaluate(() => localStorage.getItem('cupnote.journal.v1'))).toBe('{broken');
  await page.locator('#backup-open').click();
  await expect(page.locator('#raw-data-action')).toBeVisible();
  const download = page.waitForEvent('download');
  await page.locator('#raw-data-action').click();
  expect(await readFile(await (await download).path(), 'utf8')).toBe('{broken');
  await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, records: [sample()] })) });
  await expect(page.locator('#stat-cups')).toHaveText('1');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cupnote.journal.v1')).records[0].id)).toBe('test-a');
});

test('imported text is escaped and invalid imports leave the journal untouched', async ({ page }) => {
  await seed(page); await page.goto('/');
  await page.locator('#backup-open').click();
  const importFile = records => page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, records })) });
  await importFile([sample({ id: 'bad', date: '2023-02-29' })]);
  await expect(page.locator('#toast')).toContainText('格式有误');
  await expect(page.locator('#stat-cups')).toHaveText('1');
  await importFile([sample({ id: 'html', name: '<img src=x onerror=alert(1)>', note: '<script>alert(1)</script>' })]);
  await expect(page.locator('#stat-cups')).toHaveText('2');
  await page.locator('[data-date="2026-10-29"]').click();
  await expect(page.locator('#day-records img, #day-records script')).toHaveCount(0);
  await expect(page.locator('#day-records .receipt-name').last()).toHaveText('<img src=x onerror=alert(1)>');
});

test('calendar is navigable by keyboard and the form fits a narrow screen', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-date="2026-10-29"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-date="2026-10-30"]')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#month-title')).toContainText('11月');
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.locator('#add-record').click();
  expect(await page.locator('#record-dialog').evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.locator('#record-dialog')).toBeHidden();
  await expect(page.locator('#add-record')).toBeFocused();
});
