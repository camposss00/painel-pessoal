import { db } from '../storage/db.js';
import { escapeHTML, formatDate, formatCurrency, getRelativeDateStatus } from '../utils/helpers.js';
import { openTaskModal } from './tasks.js';
import { openExamModal } from './studies.js';
import { openProjectModal } from './projects.js';
import { openTransactionModal } from './finance.js';
import { openHabitModal } from './habits.js';
import { openGoalModal } from './goals.js';

export function initDashboardModule() {
  const container = document.getElementById('view-dashboard');
  if (!container) return;

  setupEvents();
  renderDashboard();

  // Listen to DB events to keep dashboard reactive across all modules
  db.on('tasks:changed', () => renderDashboard());
  db.on('subjects:changed', () => renderDashboard());
  db.on('exams:changed', () => renderDashboard());
  db.on('projects:changed', () => renderDashboard());
  db.on('transactions:changed', () => renderDashboard());
  db.on('events:changed', () => renderDashboard());
  db.on('habits:changed', () => renderDashboard());
  db.on('goals:changed', () => renderDashboard());
  db.on('settings:changed', () => renderDashboard());
}

function setupEvents() {
  // Quick action shortcut buttons
  const btnDashTask = document.getElementById('dash-btn-new-task');
  const btnDashExpense = document.getElementById('dash-btn-new-expense');
  const btnDashExam = document.getElementById('dash-btn-new-exam');
  const btnDashProject = document.getElementById('dash-btn-new-project');
  const btnDashHabit = document.getElementById('dash-btn-new-habit');
  const btnDashGoal = document.getElementById('dash-btn-new-goal');

  if (btnDashTask) btnDashTask.addEventListener('click', () => openTaskModal());
  if (btnDashExpense) btnDashExpense.addEventListener('click', () => openTransactionModal('expense'));
  if (btnDashExam) btnDashExam.addEventListener('click', () => openExamModal());
  if (btnDashProject) btnDashProject.addEventListener('click', () => openProjectModal());
  if (btnDashHabit) btnDashHabit.addEventListener('click', () => openHabitModal());
  if (btnDashGoal) btnDashGoal.addEventListener('click', () => openGoalModal());
}

export async function renderDashboard() {
  const [
    tasks,
    exams,
    projects,
    transactions,
    events,
    habits,
    goals,
    subjects,
    settings
  ] = await Promise.all([
    db.tasks.getAll(),
    db.exams.getAll(),
    db.projects.getAll(),
    db.transactions.getAll(),
    db.events.getAll(),
    db.habits.getAll(),
    db.goals.getAll(),
    db.subjects.getAll(),
    db.settings.get()
  ]);

  renderGreeting(settings);
  renderStatCards(tasks, exams, transactions, habits);

  renderOverdueAlert(tasks);
  renderDashboardTasksWidget(tasks);
  renderDashboardHabitsWidget(habits);
  renderDashboardAgendaWidget(events, exams);
  renderDashboardGoalsWidget(goals);
  renderDashboardFinanceWidget(transactions);
  renderDashboardProjectsWidget(projects);
  renderDashboardStudiesAlert(subjects);

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}

function renderGreeting(settings) {
  const greetingEl = document.getElementById('dash-greeting-text');
  const dateEl = document.getElementById('dash-today-date');

  const now = new Date();
  const hours = now.getHours();

  let timeSalute = 'Olá';
  if (hours >= 5 && hours < 12) timeSalute = 'Bom dia';
  else if (hours >= 12 && hours < 18) timeSalute = 'Boa tarde';
  else timeSalute = 'Boa noite';

  const name = settings && settings.userName ? `, ${escapeHTML(settings.userName)}` : '';

  if (greetingEl) greetingEl.textContent = `${timeSalute}${name}!`;
  if (dateEl) dateEl.textContent = `Hoje é ${formatDate(now.toISOString(), 'full')}`;
}

function renderStatCards(tasks, exams, transactions, habits) {
  // 1. Pending & Overdue Tasks
  const pendingTasks = tasks.filter(t => !t.completed).length;
  const todayStr = new Date().toISOString().split('T')[0];
  const overdueCount = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length;

  const statTasksEl = document.getElementById('dash-stat-tasks');
  const statTasksSubEl = document.getElementById('dash-stat-tasks-sub');
  if (statTasksEl) statTasksEl.textContent = pendingTasks;
  if (statTasksSubEl) {
    statTasksSubEl.textContent = overdueCount > 0 ? `${overdueCount} atrasada(s)` : 'Em dia';
    statTasksSubEl.style.color = overdueCount > 0 ? 'var(--color-danger)' : 'var(--text-muted)';
  }

  // 2. Habits of today
  const doneHabitsToday = habits.filter(h => (h.history || []).includes(todayStr)).length;
  const statHabitsEl = document.getElementById('dash-stat-habits');
  const statHabitsSubEl = document.getElementById('dash-stat-habits-sub');
  if (statHabitsEl) statHabitsEl.textContent = `${doneHabitsToday}/${habits.length}`;
  if (statHabitsSubEl) {
    statHabitsSubEl.textContent = habits.length > 0 ? `${Math.round((doneHabitsToday / habits.length) * 100)}% concluídos hoje` : 'Nenhum hábito cadastrado';
  }

  // 3. Next Exam
  const upcomingExams = exams
    .filter(e => e.date >= todayStr)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const statExamEl = document.getElementById('dash-stat-exam');
  const statExamSubEl = document.getElementById('dash-stat-exam-sub');
  if (statExamEl) {
    if (upcomingExams.length > 0) {
      const rel = getRelativeDateStatus(upcomingExams[0].date);
      statExamEl.textContent = rel.status === 'today' ? 'Hoje!' : rel.label;
      if (statExamSubEl) statExamSubEl.textContent = upcomingExams[0].title;
    } else {
      statExamEl.textContent = '--';
      if (statExamSubEl) statExamSubEl.textContent = 'Sem provas agendadas';
    }
  }

  // 4. Financial Balance
  let totalIncomes = 0;
  let totalExpenses = 0;
  transactions.forEach(tx => {
    const val = Number(tx.amount) || 0;
    if (tx.type === 'income') totalIncomes += val;
    else totalExpenses += val;
  });
  const balance = totalIncomes - totalExpenses;
  const statBalEl = document.getElementById('dash-stat-balance');
  if (statBalEl) {
    statBalEl.textContent = formatCurrency(balance);
    statBalEl.style.color = balance >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  }
}

function renderOverdueAlert(tasks) {
  const container = document.getElementById('dash-overdue-alert-container');
  if (!container) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const overdueTasks = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr);

  if (overdueTasks.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div style="background:var(--color-danger-bg); border:1px solid rgba(239, 68, 68, 0.3); border-radius:var(--radius-lg); padding:var(--space-4) var(--space-5); margin-bottom:var(--space-6); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--space-3);">
      <div style="display:flex; align-items:center; gap:var(--space-3);">
        <i data-lucide="alert-circle" style="color:var(--color-danger); width:24px; height:24px; flex-shrink:0;"></i>
        <div>
          <strong style="color:var(--color-danger); font-size:0.95rem;">Atenção: Você tem ${overdueTasks.length} tarefa${overdueTasks.length > 1 ? 's' : ''} atrasada${overdueTasks.length > 1 ? 's' : ''}!</strong>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Priorize as tarefas pendentes cujo prazo já expirou.</p>
        </div>
      </div>
      <button class="btn btn-danger-outline btn-sm" onclick="navigateToView('view-tasks')">Ver Tarefas Atrasadas</button>
    </div>
  `;
}

function renderDashboardTasksWidget(tasks) {
  const container = document.getElementById('dash-tasks-widget');
  if (!container) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const pendingTasks = tasks.filter(t => !t.completed);

  // Score tasks: overdue get top priority, then high priority today, then other pendings
  pendingTasks.sort((a, b) => {
    const aOverdue = a.dueDate && a.dueDate < todayStr ? 1 : 0;
    const bOverdue = b.dueDate && b.dueDate < todayStr ? 1 : 0;
    if (aOverdue !== bOverdue) return bOverdue - aOverdue;

    const pWeight = { high: 3, medium: 2, low: 1 };
    if ((pWeight[b.priority] || 0) !== (pWeight[a.priority] || 0)) {
      return (pWeight[b.priority] || 0) - (pWeight[a.priority] || 0);
    }

    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    return 0;
  });

  const displayTasks = pendingTasks.slice(0, 5);

  if (displayTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-4);">
        <p class="empty-state-desc" style="margin-bottom:0;">Todas as tarefas concluídas! Parabéns pelo foco.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = displayTasks.map(t => {
    const relDate = t.dueDate ? getRelativeDateStatus(t.dueDate) : null;
    const isOverdue = t.dueDate && t.dueDate < todayStr;
    const priorityBadgeClass = t.priority === 'high' ? 'badge-high' : t.priority === 'medium' ? 'badge-medium' : 'badge-low';
    const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };

    return `
      <div class="widget-item ${isOverdue ? 'widget-item-overdue' : ''}">
        <label class="task-checkbox-wrapper" style="flex:1; cursor:pointer;">
          <input type="checkbox" class="dash-task-toggle" data-id="${t.id}" style="display:none;">
          <span class="custom-checkbox" style="margin-right:8px;">
            <i data-lucide="check" style="width: 14px; height: 14px;"></i>
          </span>
          <span style="font-size:0.9rem; font-weight:500;">${escapeHTML(t.title)}</span>
        </label>
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="badge ${priorityBadgeClass}">${priorityLabels[t.priority] || 'Normal'}</span>
          ${relDate ? `<span style="font-size:0.75rem; color:${isOverdue ? 'var(--color-danger)' : 'var(--text-muted)'}; font-weight:${isOverdue ? '600' : 'normal'};">${relDate.label}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.dash-task-toggle').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      await db.tasks.toggleComplete(e.target.dataset.id);
    });
  });
}

function renderDashboardHabitsWidget(habits) {
  const container = document.getElementById('dash-habits-widget');
  if (!container) return;

  if (habits.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-4);">
        <p class="empty-state-desc" style="margin-bottom:0;">Nenhum hábito cadastrado ainda.</p>
      </div>
    `;
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  container.innerHTML = habits.slice(0, 5).map(h => {
    const isDone = (h.history || []).includes(todayStr);

    return `
      <div class="widget-item" style="padding:0.6rem 0.85rem;">
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="btn-icon dash-habit-toggle" data-id="${h.id}" title="${isDone ? 'Concluído hoje (clique para desfazer)' : 'Marcar feito hoje'}" style="color:${isDone ? 'var(--color-success)' : 'var(--text-light)'};">
            <i data-lucide="${isDone ? 'check-circle-2' : 'circle'}" style="width:18px; height:18px;"></i>
          </button>
          <span style="font-size:0.9rem; font-weight:500; ${isDone ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${escapeHTML(h.name)}</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:0.8rem; font-weight:600;">🔥 ${h.streak || 0}d</span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.dash-habit-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      await db.habits.toggleDay(btn.dataset.id, todayStr);
    });
  });
}

function renderDashboardAgendaWidget(events, exams) {
  const container = document.getElementById('dash-agenda-widget');
  if (!container) return;

  const todayStr = new Date().toISOString().split('T')[0];

  const upcomingItems = [
    ...events.map(ev => ({ type: 'event', title: ev.title, date: ev.date, detail: 'Evento' })),
    ...exams.map(ex => ({ type: 'exam', title: ex.title, date: ex.date, detail: ex.subjectName || 'Avaliação' }))
  ]
    .filter(i => i.date >= todayStr)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 4);

  if (upcomingItems.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-4);">
        <p class="empty-state-desc" style="margin-bottom:0;">Nenhum compromisso ou prova agendada.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = upcomingItems.map(it => {
    const rel = getRelativeDateStatus(it.date);
    return `
      <div class="widget-item">
        <div>
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="badge ${it.type === 'exam' ? 'badge-purple' : 'badge-warning'}">${it.type === 'exam' ? 'Prova' : 'Agenda'}</span>
            <strong style="font-size:0.9rem;">${escapeHTML(it.title)}</strong>
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            ${escapeHTML(it.detail)} &bull; ${formatDate(it.date)}
          </div>
        </div>
        <span class="badge badge-gray">${rel.status === 'today' ? 'Hoje!' : rel.label}</span>
      </div>
    `;
  }).join('');
}

function renderDashboardGoalsWidget(goals) {
  const container = document.getElementById('dash-goals-widget');
  if (!container) return;

  const activeGoals = goals.filter(g => g.status === 'active').slice(0, 4);

  if (activeGoals.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-4);">
        <p class="empty-state-desc" style="margin-bottom:0;">Nenhuma meta em andamento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = activeGoals.map(g => {
    const milestones = g.milestones || [];
    const completed = milestones.filter(m => m.completed).length;
    const progress = milestones.length > 0 ? Math.round((completed / milestones.length) * 100) : (g.status === 'completed' ? 100 : 0);

    return `
      <div style="background:var(--bg-card-hover); padding:10px 12px; border-radius:var(--radius-md); margin-bottom:6px; border:1px solid var(--border-subtle);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
          <strong style="font-size:0.875rem;">${escapeHTML(g.title)}</strong>
          <span style="font-size:0.75rem; font-weight:700; color:var(--primary);">${progress}%</span>
        </div>
        <div style="background:var(--border-subtle); height:6px; border-radius:var(--radius-full); overflow:hidden;">
          <div style="background:var(--primary); height:100%; width:${progress}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderDashboardFinanceWidget(transactions) {
  const container = document.getElementById('dash-finance-widget');
  if (!container) return;

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  let monthIncomes = 0;
  let monthExpenses = 0;

  transactions.forEach(tx => {
    if (!tx.date) return;
    const d = new Date(tx.date.length === 10 ? `${tx.date}T00:00:00` : tx.date);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      const val = Number(tx.amount) || 0;
      if (tx.type === 'income') monthIncomes += val;
      else monthExpenses += val;
    }
  });

  const monthNet = monthIncomes - monthExpenses;

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:var(--space-3);">
      <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--space-2) 0; border-bottom:1px solid var(--border-light);">
        <span style="font-size:0.875rem; color:var(--text-muted);">Entradas deste mês:</span>
        <strong style="color:var(--color-success);">${formatCurrency(monthIncomes)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--space-2) 0; border-bottom:1px solid var(--border-light);">
        <span style="font-size:0.875rem; color:var(--text-muted);">Gastos deste mês:</span>
        <strong style="color:var(--color-danger);">${formatCurrency(monthExpenses)}</strong>
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; padding:var(--space-2) 0;">
        <span style="font-size:0.875rem; color:var(--text-muted); font-weight:600;">Saldo do mês:</span>
        <strong style="font-size:1.1rem; color:${monthNet >= 0 ? 'var(--color-success)' : 'var(--color-danger)'};">${formatCurrency(monthNet)}</strong>
      </div>
    </div>
  `;
}

function renderDashboardProjectsWidget(projects) {
  const container = document.getElementById('dash-projects-widget');
  if (!container) return;

  const active = projects
    .filter(p => p.status === 'desenvolvimento' || p.status === 'planejamento')
    .slice(0, 4);

  if (active.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-4);">
        <p class="empty-state-desc" style="margin-bottom:0;">Nenhum projeto em andamento no momento.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = active.map(p => {
    const tasks = p.tasks || [];
    const completed = tasks.filter(t => t.completed).length;
    const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

    return `
      <div class="widget-item">
        <div>
          <strong style="font-size:0.9rem;">${escapeHTML(p.name)}</strong>
          <div style="font-size:0.75rem; color:var(--text-muted);">
            ${p.tasks && p.tasks.length > 0 ? `${pct}% concluído` : (p.technologies || 'Sem tags')}
          </div>
        </div>
        <span class="badge ${p.status === 'desenvolvimento' ? 'badge-purple' : 'badge-low'}">
          ${p.status === 'desenvolvimento' ? 'Desenvolvimento' : 'Planejamento'}
        </span>
      </div>
    `;
  }).join('');
}

function renderDashboardStudiesAlert(subjects) {
  const container = document.getElementById('dash-studies-attention-widget');
  if (!container) return;

  const needingAttention = [];
  subjects.forEach(s => {
    const grades = s.grades || [];
    if (grades.length > 0) {
      const sum = grades.reduce((acc, g) => acc + Number(g.value), 0);
      const avg = sum / grades.length;
      if (avg < 7.0) {
        needingAttention.push({ name: s.name, avg: avg.toFixed(1) });
      }
    }
  });

  if (needingAttention.length === 0) {
    container.innerHTML = `
      <div style="padding:10px 0; color:var(--text-muted); font-size:0.85rem;">
        Todas as matérias avaliadas estão com média satisfatória (&ge; 7.0)!
      </div>
    `;
    return;
  }

  container.innerHTML = needingAttention.map(item => `
    <div class="widget-item" style="border-left:3px solid var(--color-warning);">
      <span style="font-size:0.875rem; font-weight:600;">${escapeHTML(item.name)}</span>
      <span class="badge badge-medium">Média: ${item.avg}</span>
    </div>
  `).join('');
}
