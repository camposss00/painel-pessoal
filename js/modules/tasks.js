import { db } from '../storage/db.js';
import { escapeHTML, formatDate, getRelativeDateStatus, showToast, showConfirmModal } from '../utils/helpers.js';

let currentFilter = 'all'; // all, pending, today, overdue, future, completed
let currentPriority = 'all'; // all, high, medium, low
let currentCategory = 'all';
let searchQuery = '';

export function initTasksModule() {
  const container = document.getElementById('view-tasks');
  if (!container) return;

  setupEvents();
  renderTasks();

  // Listen to DB changes
  db.on('tasks:changed', () => {
    renderTasks();
    updateTaskCounters();
  });

  updateTaskCounters();
}

function setupEvents() {
  // New task button
  const btnNewTask = document.getElementById('btn-new-task');
  if (btnNewTask) {
    btnNewTask.addEventListener('click', () => openTaskModal());
  }

  // Task form submission
  const taskForm = document.getElementById('task-form');
  if (taskForm) {
    taskForm.addEventListener('submit', handleTaskFormSubmit);
  }

  // Search input
  const searchInput = document.getElementById('task-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderTasks();
    });
  }

  // Filter chips (status / timeline)
  const filterChips = document.querySelectorAll('.task-filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter || 'all';
      renderTasks();
    });
  });

  // Priority filter select
  const prioritySelect = document.getElementById('task-priority-filter');
  if (prioritySelect) {
    prioritySelect.addEventListener('change', (e) => {
      currentPriority = e.target.value;
      renderTasks();
    });
  }

  // Category filter select
  const categorySelect = document.getElementById('task-category-filter');
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      currentCategory = e.target.value;
      renderTasks();
    });
  }
}

export async function updateTaskCounters() {
  const tasks = await db.tasks.getAll();
  const pendingCount = tasks.filter(t => !t.completed).length;

  const todayStr = new Date().toISOString().split('T')[0];
  const overdueCount = tasks.filter(t => !t.completed && t.dueDate && t.dueDate < todayStr).length;

  // Sidebar counter
  const badgeEl = document.getElementById('nav-task-count');
  if (badgeEl) {
    badgeEl.textContent = pendingCount;
    badgeEl.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }

  // Tasks header counter
  const headerCountEl = document.getElementById('tasks-pending-header-count');
  if (headerCountEl) {
    if (overdueCount > 0) {
      headerCountEl.innerHTML = `<span style="color:var(--color-danger); font-weight:600;">${overdueCount} atrasada${overdueCount === 1 ? '' : 's'}</span> &bull; ${pendingCount} pendente${pendingCount === 1 ? '' : 's'}`;
    } else {
      headerCountEl.textContent = `${pendingCount} pendente${pendingCount === 1 ? '' : 's'}`;
    }
  }
}

export async function renderTasks() {
  const listContainer = document.getElementById('tasks-list-container');
  if (!listContainer) return;

  const allTasks = await db.tasks.getAll();
  const todayStr = new Date().toISOString().split('T')[0];

  // Populate dynamic category filter options
  updateCategoryFilterOptions(allTasks);

  // Apply filters
  let filtered = allTasks.filter(task => {
    // Status & Timeline Filter
    if (currentFilter === 'pending' && task.completed) return false;
    if (currentFilter === 'completed' && !task.completed) return false;
    if (currentFilter === 'today') {
      if (task.completed) return false;
      if (!task.dueDate || task.dueDate !== todayStr) return false;
    }
    if (currentFilter === 'overdue') {
      if (task.completed) return false;
      if (!task.dueDate || task.dueDate >= todayStr) return false;
    }
    if (currentFilter === 'future') {
      if (task.completed) return false;
      if (!task.dueDate || task.dueDate <= todayStr) return false;
    }

    // Priority filter
    if (currentPriority !== 'all' && task.priority !== currentPriority) return false;

    // Category filter
    if (currentCategory !== 'all' && task.category !== currentCategory) return false;

    // Search query
    if (searchQuery) {
      const matchTitle = (task.title || '').toLowerCase().includes(searchQuery);
      const matchDesc = (task.description || '').toLowerCase().includes(searchQuery);
      const matchCat = (task.category || '').toLowerCase().includes(searchQuery);
      if (!matchTitle && !matchDesc && !matchCat) return false;
    }

    return true;
  });

  // Sort: Overdue first, then pending by due date, then completed
  filtered.sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    if (a.dueDate && b.dueDate) {
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="check-square"></i></div>
        <h4 class="empty-state-title">Nenhuma tarefa encontrada</h4>
        <p class="empty-state-desc">
          ${allTasks.length === 0 ? 'Você ainda não cadastrou tarefas. Comece criando sua primeira tarefa acima!' : 'Nenhuma tarefa corresponde aos filtros aplicados.'}
        </p>
        ${allTasks.length === 0 ? '<button class="btn btn-primary btn-sm" id="btn-empty-add-task"><i data-lucide="plus"></i> Criar Tarefa</button>' : ''}
      </div>
    `;

    const emptyAddBtn = document.getElementById('btn-empty-add-task');
    if (emptyAddBtn) {
      emptyAddBtn.addEventListener('click', () => openTaskModal());
    }

    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
    return;
  }

  const recurrenceLabels = {
    'daily': 'Diária',
    'weekly': 'Semanal',
    'monthly': 'Mensal'
  };

  listContainer.innerHTML = filtered.map(task => {
    const relDate = task.dueDate ? getRelativeDateStatus(task.dueDate) : null;
    let dateClass = '';
    let dateIcon = 'calendar';

    if (relDate && !task.completed) {
      if (relDate.status === 'overdue') {
        dateClass = 'overdue';
        dateIcon = 'alert-circle';
      } else if (relDate.status === 'today') {
        dateClass = 'today';
        dateIcon = 'clock';
      }
    }

    const priorityBadgeClass = task.priority === 'high' ? 'badge-high' : task.priority === 'medium' ? 'badge-medium' : 'badge-low';
    const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };

    return `
      <div class="task-item ${task.completed ? 'completed' : ''} ${dateClass === 'overdue' && !task.completed ? 'task-item-overdue' : ''}" data-id="${task.id}">
        <label class="task-checkbox-wrapper" title="${task.completed ? 'Marcar como pendente' : 'Marcar como concluída'}">
          <input type="checkbox" class="task-toggle" data-id="${task.id}" ${task.completed ? 'checked' : ''} style="display:none;">
          <span class="custom-checkbox">
            <i data-lucide="check" style="width: 14px; height: 14px;"></i>
          </span>
        </label>
        
        <div class="task-content">
          <div class="task-title">${escapeHTML(task.title)}</div>
          ${task.description ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${escapeHTML(task.description)}</div>` : ''}
          <div class="task-meta">
            <span class="badge ${priorityBadgeClass}">${priorityLabels[task.priority] || 'Normal'}</span>
            ${task.category ? `<span class="badge badge-gray"><i data-lucide="tag" style="width:11px; height:11px;"></i> ${escapeHTML(task.category)}</span>` : ''}
            ${task.recurrence && task.recurrence !== 'none' ? `
              <span class="badge badge-purple" title="Tarefa recorrente ${recurrenceLabels[task.recurrence] || ''}">
                <i data-lucide="repeat" style="width:11px; height:11px;"></i> ${recurrenceLabels[task.recurrence] || task.recurrence}
              </span>
            ` : ''}
            ${task.dueDate ? `
              <span class="task-date ${dateClass}">
                <i data-lucide="${dateIcon}" style="width:12px; height:12px;"></i>
                ${formatDate(task.dueDate)} (${relDate ? relDate.label : ''})
              </span>
            ` : ''}
          </div>
        </div>

        <div class="task-actions">
          <button class="btn-icon btn-edit-task" data-id="${task.id}" title="Editar">
            <i data-lucide="edit-2" style="width:16px; height:16px;"></i>
          </button>
          <button class="btn-icon btn-delete-task" data-id="${task.id}" title="Excluir">
            <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }

  // Attach item action handlers
  listContainer.querySelectorAll('.task-toggle').forEach(chk => {
    chk.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const task = await db.tasks.getById(id);
      
      // If task has recurrence and is being marked as completed:
      if (task && !task.completed && task.recurrence && task.recurrence !== 'none') {
        const nextDate = calculateNextRecurrenceDate(task.dueDate, task.recurrence);
        await db.tasks.update(id, {
          completed: false,
          dueDate: nextDate
        });
        showToast(`Tarefa recorrente concluída! Próximo vencimento: ${formatDate(nextDate)}`, 'success');
      } else {
        await db.tasks.toggleComplete(id);
      }
    });
  });

  listContainer.querySelectorAll('.btn-edit-task').forEach(btn => {
    btn.addEventListener('click', async () => {
      const task = await db.tasks.getById(btn.dataset.id);
      if (task) openTaskModal(task);
    });
  });

  listContainer.querySelectorAll('.btn-delete-task').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const task = await db.tasks.getById(id);
      showConfirmModal({
        title: 'Excluir Tarefa',
        message: `Deseja realmente excluir a tarefa "${task ? task.title : ''}"? Esta ação não pode ser desfeita.`,
        confirmText: 'Excluir',
        danger: true,
        onConfirm: async () => {
          await db.tasks.delete(id);
          showToast('Tarefa excluída com sucesso.', 'info');
        }
      });
    });
  });
}

function calculateNextRecurrenceDate(currentDueDate, recurrence) {
  const base = currentDueDate ? new Date(`${currentDueDate}T00:00:00`) : new Date();
  if (recurrence === 'daily') {
    base.setDate(base.getDate() + 1);
  } else if (recurrence === 'weekly') {
    base.setDate(base.getDate() + 7);
  } else if (recurrence === 'monthly') {
    base.setMonth(base.getMonth() + 1);
  }
  return base.toISOString().split('T')[0];
}

function updateCategoryFilterOptions(tasks) {
  const select = document.getElementById('task-category-filter');
  if (!select) return;

  const categories = Array.from(new Set(tasks.map(t => t.category).filter(Boolean))).sort();
  const currentValue = select.value;

  select.innerHTML = '<option value="all">Todas as Categorias</option>' +
    categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');

  if (categories.includes(currentValue)) {
    select.value = currentValue;
  } else {
    select.value = 'all';
  }
}

export function openTaskModal(task = null) {
  const modal = document.getElementById('task-modal');
  const form = document.getElementById('task-form');
  const modalTitle = document.getElementById('task-modal-title');
  if (!modal || !form) return;

  form.reset();

  if (task) {
    modalTitle.textContent = 'Editar Tarefa';
    document.getElementById('task-id').value = task.id;
    document.getElementById('task-input-title').value = task.title || '';
    document.getElementById('task-input-description').value = task.description || '';
    document.getElementById('task-input-priority').value = task.priority || 'medium';
    document.getElementById('task-input-category').value = task.category || '';
    document.getElementById('task-input-duedate').value = task.dueDate || '';
    document.getElementById('task-input-recurrence').value = task.recurrence || 'none';
  } else {
    modalTitle.textContent = 'Nova Tarefa';
    document.getElementById('task-id').value = '';
    document.getElementById('task-input-priority').value = 'medium';
    document.getElementById('task-input-recurrence').value = 'none';
  }

  modal.classList.add('active');
  document.getElementById('task-input-title').focus();
}

async function handleTaskFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('task-id').value;
  const title = document.getElementById('task-input-title').value.trim();
  const description = document.getElementById('task-input-description').value.trim();
  const priority = document.getElementById('task-input-priority').value;
  const category = document.getElementById('task-input-category').value.trim();
  const dueDate = document.getElementById('task-input-duedate').value;
  const recurrence = document.getElementById('task-input-recurrence').value;

  if (!title) {
    showToast('Informe o título da tarefa.', 'error');
    return;
  }

  try {
    if (id) {
      await db.tasks.update(id, { title, description, priority, category: category || 'Geral', dueDate, recurrence });
      showToast('Tarefa atualizada com sucesso!', 'success');
    } else {
      await db.tasks.create({ title, description, priority, category: category || 'Geral', dueDate, recurrence, completed: false });
      showToast('Tarefa criada com sucesso!', 'success');
    }

    document.getElementById('task-modal').classList.remove('active');
  } catch (err) {
    showToast('Erro ao salvar tarefa.', 'error');
    console.error(err);
  }
}
