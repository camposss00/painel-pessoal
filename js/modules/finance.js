import { db } from '../storage/db.js';
import { escapeHTML, formatDate, formatCurrency, showToast, showConfirmModal } from '../utils/helpers.js';

let selectedMonth = new Date().getMonth(); // 0-11
let selectedYear = new Date().getFullYear();
let chartInstance = null;

export function initFinanceModule() {
  const container = document.getElementById('view-finance');
  if (!container) return;

  setupMonthYearSelector();
  setupEvents();
  renderFinance();

  db.on('transactions:changed', () => renderFinance());
}

function setupMonthYearSelector() {
  const monthSelect = document.getElementById('finance-month-select');
  const yearSelect = document.getElementById('finance-year-select');
  if (!monthSelect || !yearSelect) return;

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  monthSelect.innerHTML = monthNames.map((name, idx) => `
    <option value="${idx}" ${idx === selectedMonth ? 'selected' : ''}>${name}</option>
  `).join('');

  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
  yearSelect.innerHTML = years.map(y => `
    <option value="${y}" ${y === selectedYear ? 'selected' : ''}>${y}</option>
  `).join('');

  monthSelect.addEventListener('change', (e) => {
    selectedMonth = parseInt(e.target.value, 10);
    renderFinance();
  });

  yearSelect.addEventListener('change', (e) => {
    selectedYear = parseInt(e.target.value, 10);
    renderFinance();
  });
}

function setupEvents() {
  const btnNewTx = document.getElementById('btn-new-transaction');
  if (btnNewTx) {
    btnNewTx.addEventListener('click', () => openTransactionModal('expense'));
  }

  const txForm = document.getElementById('transaction-form');
  if (txForm) {
    txForm.addEventListener('submit', handleTransactionFormSubmit);
  }
}

export async function renderFinance() {
  const allTransactions = await db.transactions.getAll();

  // Calculate Overall Balance (Total all-time)
  let totalAllIncomes = 0;
  let totalAllExpenses = 0;

  allTransactions.forEach(tx => {
    const val = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      totalAllIncomes += val;
    } else {
      totalAllExpenses += val;
    }
  });

  const overallBalance = totalAllIncomes - totalAllExpenses;

  // Filter for Selected Month & Year
  const monthlyTransactions = allTransactions.filter(tx => {
    if (!tx.date) return false;
    const d = new Date(tx.date.length === 10 ? `${tx.date}T00:00:00` : tx.date);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  });

  // Calculate Monthly Totals
  let monthIncomes = 0;
  let monthExpenses = 0;
  const categoryExpenses = {};

  monthlyTransactions.forEach(tx => {
    const val = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      monthIncomes += val;
    } else {
      monthExpenses += val;
      const cat = tx.category || 'Outros';
      categoryExpenses[cat] = (categoryExpenses[cat] || 0) + val;
    }
  });

  const monthBalance = monthIncomes - monthExpenses;

  // Update Summary DOM Cards
  const overallBalEl = document.getElementById('finance-overall-balance');
  const monthIncomeEl = document.getElementById('finance-month-income');
  const monthExpenseEl = document.getElementById('finance-month-expense');
  const monthNetEl = document.getElementById('finance-month-net');

  if (overallBalEl) overallBalEl.textContent = formatCurrency(overallBalance);
  if (monthIncomeEl) monthIncomeEl.textContent = formatCurrency(monthIncomes);
  if (monthExpenseEl) monthExpenseEl.textContent = formatCurrency(monthExpenses);
  if (monthNetEl) {
    monthNetEl.textContent = formatCurrency(monthBalance);
    monthNetEl.style.color = monthBalance >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  }

  // Render Transactions Table
  renderTransactionsTable(monthlyTransactions);

  // Render Top Expenses Widget
  renderTopExpenses(monthlyTransactions, monthExpenses);

  // Render Category Breakdown & Chart
  renderChartAndBreakdown(categoryExpenses, monthExpenses, monthIncomes);
}

function renderTopExpenses(monthlyTransactions, totalMonthExpenses) {
  const container = document.getElementById('finance-top-expenses-list');
  if (!container) return;

  const expenses = monthlyTransactions
    .filter(t => t.type === 'expense')
    .sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))
    .slice(0, 5);

  if (expenses.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:10px 0;">Nenhuma despesa para listar.</p>';
    return;
  }

  container.innerHTML = expenses.map(t => {
    const val = Number(t.amount) || 0;
    const pct = totalMonthExpenses > 0 ? Math.round((val / totalMonthExpenses) * 100) : 0;
    return `
      <div class="widget-item" style="margin-bottom:6px;">
        <div>
          <strong style="font-size:0.875rem;">${escapeHTML(t.description)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">${escapeHTML(t.category || 'Geral')} &bull; ${formatDate(t.date)}</div>
        </div>
        <div style="text-align:right;">
          <span style="color:var(--color-danger); font-weight:700; font-size:0.9rem;">- ${formatCurrency(val)}</span>
          <div style="font-size:0.7rem; color:var(--text-muted);">${pct}% do mês</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTransactionsTable(transactions) {
  const container = document.getElementById('transactions-table-body');
  if (!container) return;

  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (transactions.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: var(--space-6); color: var(--text-muted);">
          Nenhuma movimentação registrada neste mês.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = transactions.map(tx => {
    const isIncome = tx.type === 'income';
    const amountClass = isIncome ? 'amount-income' : 'amount-expense';
    const sign = isIncome ? '+' : '-';

    return `
      <tr>
        <td>${formatDate(tx.date)}</td>
        <td>
          <strong>${escapeHTML(tx.description)}</strong>
        </td>
        <td>
          <span class="badge badge-gray">${escapeHTML(tx.category || 'Geral')}</span>
        </td>
        <td class="${amountClass}">
          ${sign} ${formatCurrency(tx.amount)}
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 2px;">
            <button class="btn-icon btn-edit-tx" data-id="${tx.id}" title="Editar">
              <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
            </button>
            <button class="btn-icon btn-delete-tx" data-id="${tx.id}" title="Excluir">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }

  container.querySelectorAll('.btn-edit-tx').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tx = await db.transactions.getById(btn.dataset.id);
      if (tx) openTransactionModal(tx);
    });
  });

  container.querySelectorAll('.btn-delete-tx').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      showConfirmModal({
        title: 'Excluir Transação',
        message: 'Deseja realmente excluir esta movimentação financeira?',
        confirmText: 'Excluir',
        danger: true,
        onConfirm: async () => {
          await db.transactions.delete(id);
          showToast('Transação excluída.', 'info');
        }
      });
    });
  });
}

function renderChartAndBreakdown(categoryExpenses, totalExpenses, totalIncomes) {
  const breakdownListEl = document.getElementById('finance-category-breakdown');
  const chartCanvas = document.getElementById('finance-chart');

  // Breakdown list
  const categories = Object.keys(categoryExpenses);
  if (breakdownListEl) {
    if (categories.length === 0) {
      breakdownListEl.innerHTML = '<p style="color:var(--text-muted); font-size:0.85rem; padding:10px 0;">Nenhuma despesa para exibir breakdown.</p>';
    } else {
      breakdownListEl.innerHTML = categories
        .sort((a, b) => categoryExpenses[b] - categoryExpenses[a])
        .map(cat => {
          const val = categoryExpenses[cat];
          const pct = totalExpenses > 0 ? Math.round((val / totalExpenses) * 100) : 0;
          return `
            <div style="margin-bottom: 8px;">
              <div style="display:flex; justify-content:space-between; font-size:0.85rem; margin-bottom:2px;">
                <span>${escapeHTML(cat)}</span>
                <span>${formatCurrency(val)} (${pct}%)</span>
              </div>
              <div style="background:var(--bg-card-hover); height:6px; border-radius:var(--radius-full); overflow:hidden;">
                <div style="background:var(--primary); height:100%; width:${pct}%;"></div>
              </div>
            </div>
          `;
        }).join('');
    }
  }

  // Chart rendering with Chart.js
  if (!chartCanvas) return;

  if (typeof Chart === 'undefined') {
    return; // Chart.js CDN not ready or offline
  }

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const ctx = chartCanvas.getContext('2d');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const legendColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#141d2e' : '#ffffff';

  if (categories.length === 0) {
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Sem despesas'],
        datasets: [{
          data: [1],
          backgroundColor: [isDark ? '#1e293b' : '#e2e8f0'],
          borderColor: borderColor
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false }
        }
      }
    });
    return;
  }

  const palette = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: categories,
      datasets: [{
        data: categories.map(c => categoryExpenses[c]),
        backgroundColor: palette.slice(0, categories.length),
        borderWidth: 2,
        borderColor: borderColor
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            font: { size: 11 },
            color: legendColor
          }
        }
      }
    }
  });
}

export function openTransactionModal(param = 'expense') {
  const modal = document.getElementById('transaction-modal');
  const form = document.getElementById('transaction-form');
  const titleEl = document.getElementById('transaction-modal-title');
  if (!modal || !form) return;

  form.reset();

  const isEditing = typeof param === 'object' && param !== null;
  const idInput = document.getElementById('transaction-id');

  if (isEditing) {
    if (titleEl) titleEl.textContent = 'Editar Movimentação';
    if (idInput) idInput.value = param.id;
    document.getElementById('transaction-type').value = param.type || 'expense';
    document.getElementById('transaction-amount').value = param.amount || '';
    document.getElementById('transaction-description').value = param.description || '';
    document.getElementById('transaction-category').value = param.category || '';
    document.getElementById('transaction-date').value = param.date || '';
  } else {
    if (titleEl) titleEl.textContent = 'Nova Movimentação Financeira';
    if (idInput) idInput.value = '';
    const defaultType = typeof param === 'string' ? param : 'expense';
    document.getElementById('transaction-type').value = defaultType;
    document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
  }

  modal.classList.add('active');
  document.getElementById('transaction-description').focus();
}

async function handleTransactionFormSubmit(e) {
  e.preventDefault();
  const idInput = document.getElementById('transaction-id');
  const id = idInput ? idInput.value : '';
  const description = document.getElementById('transaction-description').value.trim();
  const type = document.getElementById('transaction-type').value;
  const amount = parseFloat(document.getElementById('transaction-amount').value);
  const category = document.getElementById('transaction-category').value.trim();
  const date = document.getElementById('transaction-date').value;

  if (!description || isNaN(amount) || amount <= 0 || !date) {
    showToast('Preencha descrição, valor e data corretamente.', 'error');
    return;
  }

  if (id) {
    await db.transactions.update(id, {
      description,
      type,
      amount,
      category: category || (type === 'income' ? 'Salário/Receita' : 'Outros'),
      date
    });
    showToast('Movimentação atualizada com sucesso!', 'success');
  } else {
    await db.transactions.create({
      description,
      type,
      amount,
      category: category || (type === 'income' ? 'Salário/Receita' : 'Outros'),
      date
    });
    showToast('Movimentação adicionada com sucesso!', 'success');
  }

  document.getElementById('transaction-modal').classList.remove('active');
}
