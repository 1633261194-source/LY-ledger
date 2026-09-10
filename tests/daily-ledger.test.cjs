const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function ledger(records = []) {
  const storage = new Map([
    ['lingyu-ledger-clean-start-v1', 'true'],
    ['lingyu-ledger-transactions', JSON.stringify(records)]
  ]);
  const elements = new Map();
  const context = vm.createContext({
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, { style: {}, value: '' });
        return elements.get(selector);
      }
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), context);
  return { run: source => vm.runInContext(source, context), el: selector => elements.get(selector) };
}

test('daily totals isolate the selected date, include all records, and escape bill titles', () => {
  const records = Array.from({ length: 7 }, (_, i) => ({ id: `bill-${i}`, rawDate: '2024-02-29', amount: -.1, title: '<b>Lunch</b>' }));
  records.push({ id: 'income', rawDate: '2024-02-29', amount: .7 });
  records.push({ id: 'yesterday', rawDate: '2024-02-28', amount: -999 });
  records.push({ id: 'other-year', rawDate: '2025-02-28', amount: -500 });
  const { run, el } = ledger(records);
  run('applyOverviewDate("2024-02-29")');
  assert.equal(el('#dailyExpense').textContent, '¥ 0.70');
  assert.equal(el('#dailyIncome').textContent, '¥ 0.70');
  assert.equal(el('#dailyBalance').textContent, '¥ 0.00');
  assert.equal(el('#dailyEmpty').hidden, true);
  assert.equal(el('#dailyTransactionList').innerHTML.match(/class="transaction-row"/g).length, 5);
  assert.match(el('#dailyTransactionList').innerHTML, /&lt;b&gt;Lunch&lt;\/b&gt;/);
  run('shiftOverviewDay(1)');
  assert.equal(el('#dailyDateInput').value, '2024-03-01');
  assert.equal(el('#dailyExpense').textContent, '¥ 0.00');
  assert.equal(el('#dailyEmpty').hidden, false);
  assert.equal(el('#dailyTransactionList').innerHTML, '');
  run('shiftOverviewDay(-1)');
  assert.equal(el('#dailyExpense').textContent, '¥ 0.70');
});

test('daily navigation crosses years, handles short months, and respects date bounds', () => {
  const { run, el } = ledger();
  run('applyOverviewDate("2024-12-31"); shiftOverviewDay(1)');
  assert.equal(el('#dailyDateInput').value, '2025-01-01');
  run('applyOverviewDate("2025-01-31"); monthOffset++; updateMonthLabel()');
  assert.equal(el('#dailyDateInput').value, '2025-02-28');
  run('shiftOverviewDay(1)');
  assert.equal(el('#dailyDateInput').value, '2025-03-01');
  run('applyOverviewDate("1900-01-01"); shiftOverviewDay(-1)');
  assert.equal(el('#dailyDateInput').value, '1900-01-01');
  assert.equal(el('#prevDayBtn').disabled, true);
  run('applyOverviewDate("9999-12-31"); shiftOverviewDay(1)');
  assert.equal(el('#dailyDateInput').value, '9999-12-31');
  assert.equal(el('#nextDayBtn').disabled, true);
});

test('date filtering composes with type and keyword, and refreshes after edits and deletion', () => {
  const { run, el } = ledger([
    { id: 'expense', rawDate: '2024-02-29', amount: -12.34, title: 'Lunch' },
    { id: 'income', rawDate: '2024-02-29', amount: 100 },
    { id: 'other', rawDate: '2024-03-01', amount: -90 }
  ]);
  run(`
    $('#billSearch').value = '';
    $('#typeFilter').value = 'all';
    $('#categoryFilter').value = 'all';
    $('#detailMonthFilter').value = 'all';
    $('#detailDateFilter').value = '2024-02-29';
    applyOverviewDate('2024-02-29');
    renderDetailTransactions();
  `);
  assert.equal(el('#filteredCount').textContent, 2);
  assert.equal(el('#detailExpense').textContent, el('#dailyExpense').textContent);
  run(`$('#typeFilter').value = 'expense'; $('#billSearch').value = 'lunch'; renderDetailTransactions()`);
  assert.equal(el('#filteredCount').textContent, 1);
  run(`transactions[0].rawDate = '2024-03-01'; renderDailyLedger(); renderDetailTransactions()`);
  assert.equal(el('#dailyExpense').textContent, '¥ 0.00');
  assert.equal(el('#filteredCount').textContent, 0);
  run(`transactions = []; renderDailyLedger()`);
  assert.equal(el('#dailyIncome').textContent, '¥ 0.00');
  assert.equal(el('#dailyEmpty').hidden, false);
});
