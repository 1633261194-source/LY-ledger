const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Shanghai', locale: 'zh-CN', reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const fixture = Array.from({ length: 9 }, (_, i) => ({ id: `expense-${i}`, rawDate: '2024-02-29', amount: -10.1, title: `午餐 ${i + 1}`, category: '餐饮美食', account: '现金' }));
    fixture.push({ id: 'income', rawDate: '2024-02-29', amount: 100, category: '其他收入' });
    fixture.push({ id: 'other-date', rawDate: '2024-03-01', amount: -999, category: '交通出行' });
    await page.addInitScript(records => {
      if (!localStorage.getItem('browser-fixture-loaded')) {
        localStorage.setItem('lingyu-ledger-clean-start-v1', 'true');
        localStorage.setItem('lingyu-ledger-transactions', JSON.stringify(records));
        localStorage.setItem('lingyu-ledger-sound', 'off');
        localStorage.setItem('browser-fixture-loaded', 'true');
      }
    }, fixture);
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    const text = selector => page.locator(selector).textContent();
    const chooseDate = async date => {
      await page.locator('#dailyDateInput').fill(date);
      await page.locator('#dailyDateInput').dispatchEvent('change');
    };
    const checkOverflow = async () => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'page must fit viewport');
      for (const selector of ['.daily-date-controls', '.daily-summary', '#dailyTransactionList', '.filter-bar']) {
        const element = page.locator(selector);
        if (await element.isVisible()) {
          assert.equal(await element.evaluate(el => el.scrollWidth > el.clientWidth + 1), false, `${selector} must fit`);
        }
      }
    };
    await chooseDate('2024-02-29');
    assert.equal(await text('#dailyExpense'), '¥ 90.90');
    assert.equal(await text('#dailyIncome'), '¥ 100.00');
    assert.equal(await text('#dailyBalance'), '¥ 9.10');
    assert.equal(await page.locator('#dailyTransactionList .transaction-row').count(), 5);
    await page.locator('#nextDayBtn').click();
    assert.equal(await page.locator('#dailyDateInput').inputValue(), '2024-03-01');
    assert.equal(await text('#dailyExpense'), '¥ 999.00');
    await page.locator('#prevDayBtn').click();
    await checkOverflow();
    await page.screenshot({ path: path.join(os.tmpdir(), 'lingyu-daily-desktop.png'), fullPage: true });

    await page.locator('#viewDailyBillsBtn').click();
    assert.equal(await text('#filteredCount'), '10');
    assert.equal(await text('#detailExpense'), '¥ 90.90');
    assert.equal(await page.locator('#detailTransactionList .detail-row').count(), 8);
    await page.locator('#nextPageBtn').click();
    assert.equal(await page.locator('#detailTransactionList .detail-row').count(), 2);
    await page.locator('#prevPageBtn').click();
    await page.locator('#typeFilter').selectOption('expense');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportBillsBtn').click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const csv = Buffer.concat(chunks).toString('utf8');
    assert.equal(csv.trim().split('\r\n').length, 10);
    assert.equal(csv.includes('2024-03-01'), false);

    await page.locator('[data-edit-id="expense-8"]').click();
    await page.locator('#billForm [name="amount"]').fill('20.20');
    await page.locator('#billForm [type="submit"]').click();
    assert.equal(await text('#detailExpense'), '¥ 101.00');
    await page.locator('[data-edit-id="expense-8"]').click();
    await page.locator('#billForm [name="date"]').fill('2024-03-01');
    await page.locator('#billForm [type="submit"]').click();
    assert.equal(await text('#filteredCount'), '8');
    assert.equal(await text('#detailExpense'), '¥ 80.80');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('[data-delete-id="expense-7"]').click();
    assert.equal(await text('#detailExpense'), '¥ 70.70');
    await page.locator('#detailMonthFilter').selectOption('2024-03');
    assert.equal(await page.locator('#detailDateFilter').inputValue(), '');
    assert.equal(await text('#filteredCount'), '2');
    await page.locator('#detailDateFilter').fill('2024-02-29');
    await page.locator('#detailDateFilter').dispatchEvent('change');
    assert.equal(await page.locator('#detailMonthFilter').inputValue(), 'all');
    await page.locator('#resetFiltersBtn').click();
    assert.equal(await page.locator('#detailDateFilter').inputValue(), '');
    assert.equal(await text('#filteredCount'), '10');

    await page.locator('[data-section="overview"]').click();
    assert.equal(await text('#dailyExpense'), '¥ 70.70');
    await chooseDate('2024-03-02');
    assert.equal(await page.locator('#dailyEmpty').isVisible(), true);
    await page.locator('#addDailyBillBtn').click();
    assert.equal(await page.locator('#billForm [name="date"]').inputValue(), '2024-03-02');
    await page.locator('#billForm [name="amount"]').fill('15.25');
    await page.locator('#billForm [name="note"]').fill('下午茶');
    await page.locator('#billForm [type="submit"]').click();
    assert.equal(await text('#dailyExpense'), '¥ 15.25');
    assert.equal(await page.locator('#dailyEmpty').isVisible(), false);
    await page.reload();
    await chooseDate('2024-03-02');
    assert.equal(await text('#dailyExpense'), '¥ 15.25');
    await page.locator('#dailyTodayBtn').click();
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    assert.equal(await page.locator('#dailyDateInput').inputValue(), today);

    for (const width of [390, 320, 768, 1100]) {
      await page.setViewportSize({ width, height: 844 });
      await chooseDate('2024-02-29');
      await checkOverflow();
      if (width === 390) await page.screenshot({ path: path.join(os.tmpdir(), 'lingyu-daily-mobile.png'), fullPage: true });
      await page.locator('#viewDailyBillsBtn').click();
      await checkOverflow();
      if (width === 390) await page.screenshot({ path: path.join(os.tmpdir(), 'lingyu-daily-detail-mobile.png'), fullPage: true });
      await page.locator(width <= 700 ? '[data-mobile-section="overview"]' : '[data-section="overview"]').click();
    }
    assert.deepEqual(errors, []);
    console.log('Browser checks passed: totals, dates, pagination, export, edits, deletion, creation, persistence, and 5 viewport sizes.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
