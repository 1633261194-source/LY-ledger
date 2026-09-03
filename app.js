const initialTransactions = [];
const STORAGE_KEY = 'lingyu-ledger-transactions';
const RESET_KEY = 'lingyu-ledger-clean-start-v1';
const ACCOUNT_KEY = 'lingyu-ledger-accounts';
const CATEGORY_KEY = 'lingyu-ledger-categories';
const PAGE_SIZE = 8;
const categoryClassMap = { '餐饮美食': 'food', '交通出行': 'transport', '购物消费': 'shopping', '居住生活': 'living', '工资收入': 'salary', '其他收入': 'salary' };
const categoryIconMap = { '餐饮美食': '🍜', '交通出行': '🚇', '购物消费': '🛍', '居住生活': '⌂', '工资收入': '↗', '其他收入': '↗', '娱乐休闲': '♫', '其他': '•' };
const defaultCategories = [
  { id: 'expense-food', name: '餐饮美食', type: 'expense', icon: '☕', color: '#ff8f80' },
  { id: 'expense-transport', name: '交通出行', type: 'expense', icon: '↗', color: '#acd6e8' },
  { id: 'expense-shopping', name: '购物消费', type: 'expense', icon: '♥', color: '#d4c4e9' },
  { id: 'expense-living', name: '居住生活', type: 'expense', icon: '⌂', color: '#b9ddcf' },
  { id: 'expense-fun', name: '娱乐休闲', type: 'expense', icon: '♫', color: '#ffe08c' },
  { id: 'expense-other', name: '其他', type: 'expense', icon: '●', color: '#e5d9cc' },
  { id: 'income-salary', name: '工资收入', type: 'income', icon: '↗', color: '#b9ddcf' },
  { id: 'income-side', name: '其他收入', type: 'income', icon: '✿', color: '#ffe08c' }
];

let selectedType = 'expense';
let monthOffset = 0;
let detailPage = 1;
let categoryViewType = 'expense';
let newCategoryType = 'expense';

const $ = (selector) => document.querySelector(selector);
const money = (value) => `${value < 0 ? '-' : ''}¥ ${Math.abs(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const escapeHTML = (value = '') => String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const makeId = () => globalThis.crypto?.randomUUID?.() || `bill-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function legacyDateToISO(value, index) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value;
  const match = String(value || '').match(/^(\d{2})月(\d{2})日/);
  if (match) return `2024-${match[1]}-${match[2]}`;
  const date = new Date();
  if (String(value).startsWith('昨天')) date.setDate(date.getDate() - 1);
  if (!String(value).startsWith('今天') && !String(value).startsWith('昨天')) return `2024-05-${String(Math.max(1, 28 - index)).padStart(2, '0')}`;
  return date.toISOString().slice(0, 10);
}

function normalizeTransaction(item, index) {
  const noteParts = String(item.note || '').split(' · ');
  const category = item.category || noteParts[0] || '其他';
  const account = item.account || noteParts[1] || '手动记账';
  return {
    id: item.id || `legacy-${index}-${Math.abs(Number(item.amount) || 0)}`,
    icon: item.icon || categoryIconMap[category] || '•',
    iconClass: item.iconClass || categoryClassMap[category] || 'living',
    title: item.title || category,
    category,
    account,
    rawDate: item.rawDate || legacyDateToISO(item.date, index),
    amount: Number(item.amount) || 0
  };
}

if (!localStorage.getItem(RESET_KEY)) {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem('orange-ledger-transactions');
  localStorage.setItem(RESET_KEY, new Date().toISOString());
}

const legacyTransactions = localStorage.getItem('orange-ledger-transactions');
let storedTransactions;
try {
  storedTransactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || legacyTransactions || 'null');
} catch {
  storedTransactions = null;
}
let transactions = (Array.isArray(storedTransactions) ? storedTransactions : initialTransactions).map(normalizeTransaction);
let accounts;
let categories;
try { accounts = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || '[]'); } catch { accounts = []; }
try { categories = JSON.parse(localStorage.getItem(CATEGORY_KEY) || 'null') || defaultCategories; } catch { categories = defaultCategories; }
if (!Array.isArray(accounts)) accounts = [];
if (!Array.isArray(categories)) categories = [...defaultCategories];

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}
function saveAccounts() { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts)); }
function saveCategories() { localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories)); }
saveTransactions();
saveAccounts();
saveCategories();

function formatDate(rawDate) {
  const date = new Date(`${rawDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return rawDate;
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function selectedMonthDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
}

function selectedMonthKey() {
  const date = selectedMonthDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function metricHTML(value) {
  const [whole, decimals] = Math.abs(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split('.');
  return `${value < 0 ? '-' : ''}¥ ${whole}<span>.${decimals}</span>`;
}

function renderChart() {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = localDateKey(date);
    const records = transactions.filter((item) => item.rawDate === key);
    return {
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      income: records.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0),
      expense: Math.abs(records.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0))
    };
  });
  const maxValue = Math.max(1, ...days.flatMap((day) => [day.income, day.expense]));
  $('#bars').innerHTML = days.map((day) => `<div class="bar-group"><i class="bar income" style="height:${day.income ? Math.max(4, day.income / maxValue * 88) : 2}%" title="收入 ${money(day.income)}"></i><i class="bar expense" style="height:${day.expense ? Math.max(4, day.expense / maxValue * 88) : 2}%" title="支出 ${money(day.expense)}"></i></div>`).join('');
  document.querySelector('.x-axis').innerHTML = days.map((day) => `<span>${day.label}</span>`).join('');
  $('#weeklyTotal').textContent = money(days.reduce((sum, day) => sum + day.income, 0));
  const top = Math.ceil(maxValue / 10) * 10 || 4;
  $('#chartYAxis').innerHTML = [top, top * .75, top * .5, top * .25, 0].map((value) => `<span>¥${Number.isInteger(value) ? value : value.toFixed(1)}</span>`).join('');
}

function renderOverviewSummary() {
  const monthRecords = transactions.filter((item) => item.rawDate.startsWith(selectedMonthKey()));
  const income = monthRecords.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const expense = Math.abs(monthRecords.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0));
  const balance = income - expense;
  const savingsRate = income > 0 ? Math.round(balance / income * 100) : 0;
  $('#incomeValue').innerHTML = metricHTML(income);
  $('#expenseValue').innerHTML = metricHTML(expense);
  $('#balanceValue').innerHTML = metricHTML(balance);
  $('#savingsRateValue').innerHTML = `${savingsRate}<span class="unit">%</span>`;
  $('#savingsProgress').style.width = `${Math.min(100, Math.max(0, savingsRate))}%`;
}

function renderInsight() {
  const monthExpenses = transactions.filter((item) => item.amount < 0 && item.rawDate.startsWith(selectedMonthKey()));
  const total = Math.abs(monthExpenses.reduce((sum, item) => sum + item.amount, 0));
  if (!monthExpenses.length) {
    $('#insightContent').innerHTML = '<div class="insight-empty"><strong>还没有消费记录</strong><span>记下第一笔支出后，小狗会帮你分析钱花在哪里。</span></div>';
    return;
  }
  const totals = monthExpenses.reduce((result, item) => {
    result[item.category] = (result[item.category] || 0) + Math.abs(item.amount);
    return result;
  }, {});
  const [category, amount] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  const percentage = total ? Math.round(amount / total * 1000) / 10 : 0;
  $('#insightContent').innerHTML = `<div class="insight-highlight"><span class="insight-kicker">本月消费最高</span><strong>${escapeHTML(category)}</strong><span class="insight-amount">${money(amount)}</span><div class="insight-bar"><i style="width:${percentage}%"></i></div><p>占本月总支出的 <b>${percentage}%</b></p></div><div class="insight-tip"><span>✦</span><p><strong>小狗发现</strong><br>数据来自你本月记录的 ${monthExpenses.length} 笔真实支出。</p></div>`;
}

function renderDashboard() {
  renderChart();
  renderOverviewSummary();
  renderInsight();
}

function findCategory(name, type) {
  return categories.find((category) => category.name === name && (!type || category.type === type));
}

function categoryColor(name) {
  return findCategory(name)?.color || '#e5d9cc';
}

function renderAnalysisMonthOptions() {
  const select = $('#analysisMonthSelect');
  const current = localDateKey(new Date()).slice(0, 7);
  const previous = select.value || current;
  const months = [...new Set([current, ...transactions.map((item) => item.rawDate.slice(0, 7))])].sort().reverse();
  select.innerHTML = months.map((month) => {
    const [year, number] = month.split('-');
    return `<option value="${month}">${year}年${number}月</option>`;
  }).join('');
  select.value = months.includes(previous) ? previous : months[0];
}

function renderSpendingAnalysis() {
  const month = $('#analysisMonthSelect').value || localDateKey(new Date()).slice(0, 7);
  const expenses = transactions.filter((item) => item.amount < 0 && item.rawDate.startsWith(month));
  const total = Math.abs(expenses.reduce((sum, item) => sum + item.amount, 0));
  const activeDays = new Set(expenses.map((item) => item.rawDate)).size;
  $('#analysisExpense').textContent = money(total);
  $('#analysisAverage').textContent = money(activeDays ? total / activeDays : 0);
  $('#analysisCount').textContent = `${expenses.length} 笔`;
  $('#analysisRecordHint').textContent = `${expenses.length} 笔有效记录`;

  const totals = expenses.reduce((result, item) => {
    result[item.category] = (result[item.category] || 0) + Math.abs(item.amount);
    return result;
  }, {});
  const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  let cursor = 0;
  const segments = ranked.map(([name, amount]) => {
    const start = cursor;
    cursor += total ? amount / total * 100 : 0;
    return `${categoryColor(name)} ${start}% ${cursor}%`;
  });
  $('#categoryDonut').style.background = segments.length ? `conic-gradient(${segments.join(',')})` : '#eee6dc';
  $('#categoryDonut').innerHTML = `<div><strong>${money(total)}</strong><span>总支出</span></div>`;
  $('#categoryLegend').innerHTML = ranked.length ? ranked.slice(0, 5).map(([name, amount]) => `<div class="donut-legend-row"><span><i style="background:${categoryColor(name)}"></i>${escapeHTML(name)}</span><strong>${money(amount)}</strong><small>${total ? (amount / total * 100).toFixed(1) : 0}%</small></div>`).join('') : '<p class="analysis-empty-copy">本月还没有支出记录<br>记账后这里会出现分类占比。</p>';

  const weekly = [0, 0, 0, 0, 0];
  expenses.forEach((item) => { weekly[Math.min(4, Math.floor((Number(item.rawDate.slice(8, 10)) - 1) / 7))] += Math.abs(item.amount); });
  const weeklyMax = Math.max(1, ...weekly);
  $('#weeklyAnalysisChart').innerHTML = weekly.map((amount, index) => `<div class="week-column"><strong>${amount ? money(amount) : '¥0'}</strong><i class="week-bar" style="height:${amount ? Math.max(5, amount / weeklyMax * 78) : 2}%"></i><span>第${index + 1}周</span></div>`).join('');
  $('#categoryRanking').innerHTML = ranked.length ? ranked.map(([name, amount], index) => `<div class="ranking-row"><span class="ranking-number">${index + 1}</span><span class="ranking-name"><i style="background:${categoryColor(name)}"></i>${escapeHTML(name)}</span><span class="ranking-track"><i style="width:${total ? amount / total * 100 : 0}%;background:${categoryColor(name)}"></i></span><strong class="ranking-amount">${money(amount)}</strong></div>`).join('') : '<div class="analysis-empty-copy">还没有可以排行的消费分类。</div>';
}

function renderAccounts() {
  const list = $('#accountList');
  const totals = accounts.map((account) => {
    const flow = transactions.filter((item) => item.account === account.name).reduce((sum, item) => sum + item.amount, 0);
    return { ...account, currentBalance: Number(account.openingBalance || 0) + flow, count: transactions.filter((item) => item.account === account.name).length };
  });
  $('#totalAccountBalance').textContent = money(totals.reduce((sum, account) => sum + account.currentBalance, 0));
  $('#accountCount').textContent = accounts.length;
  $('#accountEmpty').hidden = accounts.length !== 0;
  list.innerHTML = totals.map((account) => {
    const symbols = { '现金': '¥', '银行卡': '▤', '支付平台': '▣', '储蓄账户': '♡', '其他': '●' };
    return `<article class="account-card" style="--account-color:${escapeHTML(account.color)}"><div class="account-card-head"><span class="account-symbol">${symbols[account.type] || '●'}</span><button class="account-delete" data-account-delete="${escapeHTML(account.id)}" title="删除账户" aria-label="删除 ${escapeHTML(account.name)}">×</button></div><h3>${escapeHTML(account.name)}</h3><span>${escapeHTML(account.type)}</span><strong>${money(account.currentBalance)}</strong><div class="account-card-foot"><span>初始 ${money(Number(account.openingBalance || 0))}</span><span>${account.count} 笔账单</span></div></article>`;
  }).join('');
}

function renderCategories() {
  const visible = categories.filter((category) => category.type === categoryViewType);
  $('#expenseCategoryCount').textContent = categories.filter((category) => category.type === 'expense').length;
  $('#incomeCategoryCount').textContent = categories.filter((category) => category.type === 'income').length;
  $('#categoryManageList').innerHTML = visible.length ? visible.map((category) => {
    const used = transactions.filter((item) => item.category === category.name && (category.type === 'income' ? item.amount > 0 : item.amount < 0)).length;
    return `<article class="category-manage-card" style="--category-color:${escapeHTML(category.color)}"><span class="category-manage-icon">${escapeHTML(category.icon)}</span><div class="category-manage-copy"><strong>${escapeHTML(category.name)}</strong><span>${used} 笔账单使用</span></div><button class="category-delete" data-category-delete="${escapeHTML(category.id)}" title="删除分类" aria-label="删除 ${escapeHTML(category.name)}">×</button></article>`;
  }).join('') : '<div class="management-empty"><img src="assets/character-avatar.png" alt=""><strong>这个分组还没有分类</strong><span>点击右上角新增一个符合你习惯的分类。</span></div>';
  document.querySelectorAll('[data-category-tab]').forEach((button) => button.classList.toggle('active', button.dataset.categoryTab === categoryViewType));
}

function renderBillFormOptions() {
  const categorySelect = $('#billForm [name="category"]');
  const accountSelect = $('#billForm [name="account"]');
  const matching = categories.filter((category) => category.type === selectedType);
  categorySelect.innerHTML = matching.length ? matching.map((category) => `<option value="${escapeHTML(category.name)}">${escapeHTML(category.icon)} ${escapeHTML(category.name)}</option>`).join('') : '<option value="未分类">未分类</option>';
  accountSelect.innerHTML = '<option value="未设置账户">未设置账户</option>' + accounts.map((account) => `<option value="${escapeHTML(account.name)}">${escapeHTML(account.name)}</option>`).join('');
}

function openNamedModal(id) {
  const modal = $(`#${id}`);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

function closeNamedModal(id) {
  const modal = $(`#${id}`);
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.querySelector('form')?.reset();
}

function transactionIcon(item) {
  return `<span class="transaction-icon ${escapeHTML(item.iconClass)}">${escapeHTML(item.icon)}</span>`;
}

function renderTransactions() {
  const recent = [...transactions].sort((a, b) => b.rawDate.localeCompare(a.rawDate)).slice(0, 5);
  $('#transactionList').innerHTML = recent.length ? recent.map((item) => `<div class="transaction-row">${transactionIcon(item)}<div class="transaction-copy"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.category)} · ${escapeHTML(item.account)}</small></div><div class="transaction-amount ${item.amount < 0 ? 'expense' : 'income'}">${item.amount < 0 ? '-' : '+'}${money(Math.abs(item.amount))}<small>${formatDate(item.rawDate)}</small></div></div>`).join('') : '<div class="overview-empty"><img src="assets/character-avatar.png" alt=""><strong>从今天开始记账吧</strong><span>点击右上角“记一笔”，记录你的第一笔真实账单。</span></div>';
  $('#transactionCount').textContent = transactions.length;
  document.querySelectorAll('.nav-count').forEach((count) => { count.textContent = transactions.length; });
}

function buildFilterOptions() {
  const categorySelect = $('#categoryFilter');
  const monthSelect = $('#detailMonthFilter');
  const previousCategory = categorySelect.value || 'all';
  const previousMonth = monthSelect.value || 'all';
  const categories = [...new Set(transactions.map((item) => item.category))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  const months = [...new Set(transactions.map((item) => item.rawDate.slice(0, 7)))].sort().reverse();
  categorySelect.innerHTML = '<option value="all">全部分类</option>' + categories.map((category) => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('');
  monthSelect.innerHTML = '<option value="all">全部月份</option>' + months.map((month) => {
    const [year, number] = month.split('-');
    return `<option value="${month}">${year}年${number}月</option>`;
  }).join('');
  categorySelect.value = categories.includes(previousCategory) ? previousCategory : 'all';
  monthSelect.value = months.includes(previousMonth) ? previousMonth : 'all';
}

function getFilteredTransactions() {
  const query = $('#billSearch').value.trim().toLocaleLowerCase('zh-CN');
  const type = $('#typeFilter').value;
  const category = $('#categoryFilter').value;
  const month = $('#detailMonthFilter').value;
  return [...transactions]
    .filter((item) => type === 'all' || (type === 'income' ? item.amount > 0 : item.amount < 0))
    .filter((item) => category === 'all' || item.category === category)
    .filter((item) => month === 'all' || item.rawDate.startsWith(month))
    .filter((item) => !query || `${item.title} ${item.category} ${item.account}`.toLocaleLowerCase('zh-CN').includes(query))
    .sort((a, b) => b.rawDate.localeCompare(a.rawDate) || b.id.localeCompare(a.id));
}

function renderDetailTransactions() {
  const filtered = getFilteredTransactions();
  const income = filtered.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const expense = Math.abs(filtered.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0));
  $('#detailIncome').textContent = money(income);
  $('#detailExpense').textContent = money(expense);
  $('#detailBalance').textContent = money(income - expense);
  $('#filteredCount').textContent = filtered.length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  detailPage = Math.min(Math.max(detailPage, 1), totalPages);
  const pageItems = filtered.slice((detailPage - 1) * PAGE_SIZE, detailPage * PAGE_SIZE);
  $('#detailTransactionList').innerHTML = pageItems.map((item) => `<div class="detail-row" data-id="${escapeHTML(item.id)}"><div class="detail-primary">${transactionIcon(item)}<div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.account)}</small></div></div><div class="detail-category"><span><i class="category-dot ${escapeHTML(item.iconClass)}"></i>${escapeHTML(item.category)}</span><small>${item.amount < 0 ? '日常支出' : '收入入账'}</small></div><time class="detail-date" datetime="${item.rawDate}">${formatDate(item.rawDate)}</time><div class="detail-money ${item.amount > 0 ? 'income' : 'expense'}">${item.amount > 0 ? '+' : '-'}${money(Math.abs(item.amount))}</div><button class="delete-bill" data-delete-id="${escapeHTML(item.id)}" title="删除这笔账单" aria-label="删除 ${escapeHTML(item.title)}">×</button></div>`).join('');

  $('#emptyState').hidden = filtered.length !== 0;
  $('#pageInfo').textContent = `第 ${detailPage} / ${totalPages} 页`;
  $('#prevPageBtn').disabled = detailPage <= 1;
  $('#nextPageBtn').disabled = detailPage >= totalPages;
  const activeFilters = [$('#typeFilter').value !== 'all', $('#categoryFilter').value !== 'all', $('#detailMonthFilter').value !== 'all', Boolean($('#billSearch').value.trim())].filter(Boolean).length;
  $('#filterHint').textContent = activeFilters ? `已启用 ${activeFilters} 个筛选条件` : '按时间从近到远';
}

function renderAllTransactions() {
  renderTransactions();
  buildFilterOptions();
  renderDetailTransactions();
  renderDashboard();
  renderAnalysisMonthOptions();
  renderSpendingAnalysis();
  renderAccounts();
  renderCategories();
  renderBillFormOptions();
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function openModal() {
  renderBillFormOptions();
  const modal = $('#billModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  $('#billForm [name="date"]').value = new Date().toISOString().slice(0, 10);
  window.setTimeout(() => $('#billForm [name="amount"]').focus(), 100);
}

function closeModal() {
  $('#billModal').classList.remove('open');
  $('#billModal').setAttribute('aria-hidden', 'true');
  $('#billForm').reset();
}

function updateMonthLabel() {
  const base = selectedMonthDate();
  $('#monthLabel').textContent = `${base.getFullYear()}年${String(base.getMonth() + 1).padStart(2, '0')}月`;
}

function setView(section, focusSearch = false) {
  const views = {
    overview: { id: 'overviewView', label: '总览' },
    transactions: { id: 'transactionsView', label: '账单明细' },
    insights: { id: 'insightsView', label: '消费分析' },
    accounts: { id: 'accountsView', label: '账户管理' },
    categories: { id: 'categoriesView', label: '分类管理' }
  };
  if (!views[section]) section = 'overview';
  Object.entries(views).forEach(([name, view]) => { $(`#${view.id}`).hidden = name !== section; });
  $('#currentSection').textContent = views[section].label;
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.section === section));
  document.querySelectorAll('.mobile-nav-item').forEach((item) => item.classList.toggle('active', item.dataset.mobileSection === section));
  if (section === 'transactions') {
    renderDetailTransactions();
    if (focusSearch) window.setTimeout(() => $('#billSearch').focus(), 80);
  }
  if (section === 'insights') renderSpendingAnalysis();
  if (section === 'accounts') renderAccounts();
  if (section === 'categories') renderCategories();
  $('#mobileManageMenu').hidden = true;
  history.replaceState(null, '', section === 'overview' ? `${location.pathname}${location.search}` : `#${section}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exportFilteredBills() {
  const rows = getFilteredTransactions();
  if (!rows.length) {
    showToast('当前没有可导出的账单');
    return;
  }
  const csvCell = (value) => `"${String(value).replace(/"/g, '""')}"`;
  const lines = [['日期', '账单', '分类', '账户', '类型', '金额'], ...rows.map((item) => [item.rawDate, item.title, item.category, item.account, item.amount > 0 ? '收入' : '支出', Math.abs(item.amount).toFixed(2)])];
  const csv = `\uFEFF${lines.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `玲钰记账-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast(`已导出 ${rows.length} 笔账单`);
}

document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  renderAllTransactions();
  updateMonthLabel();

  $('#addBillBtn').addEventListener('click', openModal);
  $('#mobileAddBillBtn').addEventListener('click', openModal);
  $('#closeModal').addEventListener('click', closeModal);
  $('#cancelModal').addEventListener('click', closeModal);
  $('#billModal').addEventListener('click', (event) => { if (event.target.id === 'billModal') closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

  document.querySelectorAll('.type-option').forEach((button) => button.addEventListener('click', () => {
    selectedType = button.dataset.type;
    document.querySelectorAll('.type-option').forEach((item) => item.classList.toggle('active', item === button));
    renderBillFormOptions();
  }));

  $('#billForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const amount = Number(form.get('amount'));
    if (!amount || amount <= 0) return;
    const category = form.get('category');
    const categoryConfig = findCategory(category, selectedType);
    transactions.unshift({
      id: makeId(),
      icon: categoryConfig?.icon || categoryIconMap[category] || '•',
      iconClass: categoryClassMap[category] || 'living',
      title: form.get('note').trim() || category,
      category,
      account: form.get('account') || '未设置账户',
      rawDate: form.get('date'),
      amount: selectedType === 'expense' ? -amount : amount
    });
    saveTransactions();
    detailPage = 1;
    renderAllTransactions();
    closeModal();
    showToast('账单已保存，小狗记下啦');
  });

  ['billSearch', 'typeFilter', 'categoryFilter', 'detailMonthFilter'].forEach((id) => {
    const eventName = id === 'billSearch' ? 'input' : 'change';
    $(`#${id}`).addEventListener(eventName, () => { detailPage = 1; renderDetailTransactions(); });
  });

  $('#resetFiltersBtn').addEventListener('click', () => {
    $('#billSearch').value = '';
    $('#typeFilter').value = 'all';
    $('#categoryFilter').value = 'all';
    $('#detailMonthFilter').value = 'all';
    detailPage = 1;
    renderDetailTransactions();
    showToast('筛选条件已清除');
  });
  $('#prevPageBtn').addEventListener('click', () => { detailPage -= 1; renderDetailTransactions(); });
  $('#nextPageBtn').addEventListener('click', () => { detailPage += 1; renderDetailTransactions(); });
  $('#exportBillsBtn').addEventListener('click', exportFilteredBills);
  $('#clearBillsBtn').addEventListener('click', () => {
    if (!transactions.length) {
      showToast('账单已经是空的');
      return;
    }
    if (!window.confirm(`确定清空全部 ${transactions.length} 笔账单吗？此操作无法撤销。`)) return;
    transactions = [];
    detailPage = 1;
    saveTransactions();
    renderAllTransactions();
    showToast('全部账单已清空');
  });
  $('#detailTransactionList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-delete-id]');
    if (!button) return;
    const item = transactions.find((bill) => bill.id === button.dataset.deleteId);
    if (!item || !window.confirm(`确定删除“${item.title}”这笔账单吗？`)) return;
    transactions = transactions.filter((bill) => bill.id !== item.id);
    saveTransactions();
    renderAllTransactions();
    showToast('账单已删除');
  });

  $('#prevMonth').addEventListener('click', () => { monthOffset -= 1; updateMonthLabel(); renderOverviewSummary(); renderInsight(); });
  $('#nextMonth').addEventListener('click', () => { monthOffset += 1; updateMonthLabel(); renderOverviewSummary(); renderInsight(); });
  $('#searchToggle').addEventListener('click', () => setView('transactions', true));
  $('#viewAllBtn').addEventListener('click', () => setView('transactions'));
  $('#editBudgetBtn').addEventListener('click', () => showToast('预算编辑即将上线'));
  $('#viewBudgetBtn').addEventListener('click', () => showToast('预算设置功能即将上线'));
  $('#viewInsightBtn').addEventListener('click', () => setView('insights'));
  $('#profileBtn').addEventListener('click', () => showToast('个人设置即将上线'));

  document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => {
    if (['overview', 'transactions', 'insights', 'accounts', 'categories'].includes(item.dataset.section)) setView(item.dataset.section);
    else showToast(`${item.querySelector('.nav-icon').nextElementSibling.textContent}正在建设中`);
  }));
  document.querySelectorAll('.mobile-nav-item[data-mobile-section]').forEach((item) => item.addEventListener('click', () => setView(item.dataset.mobileSection)));

  $('#analysisMonthSelect').addEventListener('change', renderSpendingAnalysis);

  const openAccountModal = () => openNamedModal('accountModal');
  $('#addAccountBtn').addEventListener('click', openAccountModal);
  $('#emptyAddAccountBtn').addEventListener('click', openAccountModal);
  $('#accountForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const name = String(form.get('name') || '').trim();
    const openingBalance = Number(form.get('balance'));
    if (!name || !Number.isFinite(openingBalance)) return;
    if (accounts.some((account) => account.name.toLocaleLowerCase('zh-CN') === name.toLocaleLowerCase('zh-CN'))) {
      showToast('已经有同名账户了');
      return;
    }
    accounts.push({ id: makeId(), name, type: form.get('type'), openingBalance, color: form.get('color') });
    saveAccounts();
    renderAccounts();
    renderBillFormOptions();
    closeNamedModal('accountModal');
    showToast('账户已添加');
  });
  $('#accountList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-account-delete]');
    if (!button) return;
    const account = accounts.find((item) => item.id === button.dataset.accountDelete);
    if (!account) return;
    const used = transactions.filter((item) => item.account === account.name).length;
    const message = used ? `确定删除“${account.name}”吗？已有 ${used} 笔账单会保留原账户名称。` : `确定删除“${account.name}”吗？`;
    if (!window.confirm(message)) return;
    accounts = accounts.filter((item) => item.id !== account.id);
    saveAccounts();
    renderAccounts();
    renderBillFormOptions();
    showToast('账户已删除，历史账单不受影响');
  });

  document.querySelectorAll('[data-category-tab]').forEach((button) => button.addEventListener('click', () => {
    categoryViewType = button.dataset.categoryTab;
    renderCategories();
  }));
  $('#addCategoryBtn').addEventListener('click', () => {
    newCategoryType = categoryViewType;
    $('#categoryForm [name="type"]').value = newCategoryType;
    document.querySelectorAll('[data-new-category-type]').forEach((button) => button.classList.toggle('active', button.dataset.newCategoryType === newCategoryType));
    openNamedModal('categoryModal');
  });
  document.querySelectorAll('[data-new-category-type]').forEach((button) => button.addEventListener('click', () => {
    newCategoryType = button.dataset.newCategoryType;
    $('#categoryForm [name="type"]').value = newCategoryType;
    document.querySelectorAll('[data-new-category-type]').forEach((item) => item.classList.toggle('active', item === button));
  }));
  $('#categoryForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const name = String(form.get('name') || '').trim();
    if (!name) return;
    if (categories.some((category) => category.name.toLocaleLowerCase('zh-CN') === name.toLocaleLowerCase('zh-CN'))) {
      showToast('已经有同名分类了');
      return;
    }
    categories.push({ id: makeId(), name, type: newCategoryType, icon: form.get('icon'), color: form.get('color') });
    categoryViewType = newCategoryType;
    saveCategories();
    renderCategories();
    renderBillFormOptions();
    closeNamedModal('categoryModal');
    showToast('分类已添加');
  });
  $('#categoryManageList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-category-delete]');
    if (!button) return;
    const category = categories.find((item) => item.id === button.dataset.categoryDelete);
    if (!category) return;
    const used = transactions.filter((item) => item.category === category.name).length;
    const message = used ? `确定删除“${category.name}”吗？已有 ${used} 笔账单会保留原分类名称。` : `确定删除“${category.name}”吗？`;
    if (!window.confirm(message)) return;
    categories = categories.filter((item) => item.id !== category.id);
    saveCategories();
    renderCategories();
    renderBillFormOptions();
    showToast('分类已删除，历史账单不受影响');
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeNamedModal(button.dataset.closeModal)));
  ['accountModal', 'categoryModal'].forEach((id) => $(`#${id}`).addEventListener('click', (event) => { if (event.target.id === id) closeNamedModal(id); }));
  $('#mobileManageBtn').addEventListener('click', (event) => {
    event.stopPropagation();
    $('#mobileManageMenu').hidden = !$('#mobileManageMenu').hidden;
  });
  document.querySelectorAll('[data-manage-section]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.manageSection)));
  document.addEventListener('click', (event) => {
    if (!event.target.closest('#mobileManageMenu')) $('#mobileManageMenu').hidden = true;
  });

  const initialView = window.location.hash.slice(1);
  setView(['transactions', 'insights', 'accounts', 'categories'].includes(initialView) ? initialView : 'overview');
});
