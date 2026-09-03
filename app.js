const initialTransactions = [
  { icon: '🍜', iconClass: 'food', title: '和风拉面', note: '餐饮美食 · 微信支付', date: '今天 12:36', amount: -48 },
  { icon: '↗', iconClass: 'salary', title: '六月工资', note: '工资收入 · 招商银行', date: '06月01日', amount: 12000 },
  { icon: '🚇', iconClass: 'transport', title: '地铁通勤', note: '交通出行 · 交通卡', date: '昨天 08:12', amount: -6 },
  { icon: '🛍', iconClass: 'shopping', title: '夏日衬衫', note: '购物消费 · 淘宝', date: '05月30日', amount: -199 },
  { icon: '☕', iconClass: 'food', title: '咖啡', note: '餐饮美食 · 星巴克', date: '05月29日', amount: -32 }
];
const chartData = [{income:420,expense:220},{income:680,expense:310},{income:320,expense:190},{income:780,expense:410},{income:540,expense:280},{income:910,expense:360},{income:760,expense:420}];
const STORAGE_KEY = 'lingyu-ledger-transactions';
const legacyTransactions = localStorage.getItem('orange-ledger-transactions');
let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || legacyTransactions || 'null') || initialTransactions;
if (!localStorage.getItem(STORAGE_KEY) && legacyTransactions) localStorage.setItem(STORAGE_KEY, legacyTransactions);
let selectedType = 'expense';
let monthOffset = 0;

const $ = (selector) => document.querySelector(selector);
const money = (value) => `${value < 0 ? '-' : ''}¥ ${Math.abs(value).toLocaleString('zh-CN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;

function renderChart() {
  $('#bars').innerHTML = chartData.map((day) => `<div class="bar-group"><i class="bar income" style="height:${day.income / 12}%" title="收入 ${money(day.income)}"></i><i class="bar expense" style="height:${day.expense / 12}%" title="支出 ${money(day.expense)}"></i></div>`).join('');
}

function renderTransactions() {
  const list = $('#transactionList');
  list.innerHTML = transactions.slice(0, 5).map((item) => `<div class="transaction-row"><span class="transaction-icon ${item.iconClass}">${item.icon}</span><div class="transaction-copy"><strong>${item.title}</strong><small>${item.note}</small></div><div class="transaction-amount ${item.amount < 0 ? 'expense' : 'income'}">${item.amount < 0 ? '-' : '+'}${money(Math.abs(item.amount))}<small>${item.date}</small></div></div>`).join('');
  $('#transactionCount').textContent = transactions.length;
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2400);
}

function openModal() {
  const modal = $('#billModal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  const date = new Date();
  $('#billForm [name="date"]').value = date.toISOString().slice(0, 10);
  setTimeout(() => $('#billForm [name="amount"]').focus(), 100);
}
function closeModal() {
  $('#billModal').classList.remove('open');
  $('#billModal').setAttribute('aria-hidden', 'true');
  $('#billForm').reset();
}

function updateMonthLabel() {
  const base = new Date(2024, 5 + monthOffset, 1);
  $('#monthLabel').textContent = `${base.getFullYear()}年${String(base.getMonth() + 1).padStart(2, '0')}月`;
}

document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  renderChart();
  renderTransactions();
  updateMonthLabel();
  $('#addBillBtn').addEventListener('click', openModal);
  $('#closeModal').addEventListener('click', closeModal);
  $('#cancelModal').addEventListener('click', closeModal);
  $('#billModal').addEventListener('click', (event) => { if (event.target.id === 'billModal') closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
  document.querySelectorAll('.type-option').forEach((button) => button.addEventListener('click', () => {
    selectedType = button.dataset.type;
    document.querySelectorAll('.type-option').forEach((item) => item.classList.toggle('active', item === button));
  }));
  $('#billForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    const amount = Number(form.get('amount'));
    if (!amount || amount <= 0) return;
    const category = form.get('category');
    const classMap = { '餐饮美食':'food','交通出行':'transport','购物消费':'shopping','居住生活':'living','工资收入':'salary' };
    const icons = { '餐饮美食':'🍜','交通出行':'🚇','购物消费':'🛍','居住生活':'⌂','工资收入':'↗','娱乐休闲':'♫','其他':'•' };
    transactions.unshift({ icon: icons[category] || '•', iconClass: classMap[category] || 'living', title: form.get('note') || category, note: `${category} · 手动记账`, date: '刚刚', amount: selectedType === 'expense' ? -amount : amount });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    renderTransactions();
    closeModal();
    showToast('账单已保存');
  });
  $('#prevMonth').addEventListener('click', () => { monthOffset -= 1; updateMonthLabel(); showToast('已切换到上个月'); });
  $('#nextMonth').addEventListener('click', () => { monthOffset += 1; updateMonthLabel(); showToast('已切换到下个月'); });
  $('#searchToggle').addEventListener('click', () => showToast('搜索功能即将上线'));
  $('#editBudgetBtn').addEventListener('click', () => showToast('预算编辑已准备好'));
  $('#viewBudgetBtn').addEventListener('click', () => showToast('已打开完整预算视图'));
  $('#viewAllBtn').addEventListener('click', () => showToast(`共 ${transactions.length} 笔账单`));
  $('#viewInsightBtn').addEventListener('click', () => showToast('正在生成消费分析'));
  $('#profileBtn').addEventListener('click', () => showToast('个人设置即将上线'));
  document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');
    const sectionName = item.querySelector('.nav-icon').nextElementSibling.textContent;
    $('#currentSection').textContent = sectionName;
    if (item.dataset.section !== 'overview') showToast(`${sectionName}正在建设中`);
  }));
});
