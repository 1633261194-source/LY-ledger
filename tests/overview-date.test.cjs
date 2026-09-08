const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('date selection changes the month, clamps short months and rejects invalid dates', () => {
  const storage = new Map([['lingyu-ledger-clean-start-v1', 'true']]);
  const elements = new Map();
  const context = vm.createContext({
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    document: {
      addEventListener() {},
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, { style: {} });
        return elements.get(selector);
      }
    }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8'), context);
  assert.equal(vm.runInContext('applyOverviewDate("2024-01-31")', context), true);
  assert.equal(elements.get('#monthLabel').textContent, '2024年01月31日');
  vm.runInContext('monthOffset++; updateMonthLabel()', context);
  assert.equal(elements.get('#overviewDateInput').value, '2024-02-29');
  vm.runInContext('monthOffset++; updateMonthLabel()', context);
  assert.equal(elements.get('#overviewDateInput').value, '2024-03-31');
  assert.equal(vm.runInContext('applyOverviewDate("2025-02-30")', context), false);
  assert.equal(vm.runInContext('applyOverviewDate("")', context), false);
  assert.equal(elements.get('#overviewDateInput').value, '2024-03-31');
});
