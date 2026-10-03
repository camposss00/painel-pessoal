import { db } from '../storage/db.js';
import { escapeHTML, showToast, showConfirmModal } from '../utils/helpers.js';

let currentCategoryFilter = 'all';

export function initHabitsModule() {
  const container = document.getElementById('view-habits');
  if (!container) return;

  setupEvents();
  renderHabits();

  db.on('habits:changed', () => renderHabits());
}

function setupEvents() {
  const btnNewHabit = document.getElementById('btn-new-habit');
  if (btnNewHabit) {
    btnNewHabit.addEventListener('click', () => openHabitModal());
  }

  const form = document.getElementById('habit-form');
  if (form) {
    form.addEventListener('submit', handleHabitFormSubmit);
  }

  const categorySelect = document.getElementById('habit-category-filter');
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      currentCategoryFilter = e.target.value;
      renderHabits();
    });
  }
}

export async function renderHabits() {
  const container = document.getElementById('habits-grid-container');
  if (!container) return;

  const habits = await db.habits.getAll();
  updateCategoryFilter(habits);

  const filtered = habits.filter(h => {
    if (currentCategoryFilter === 'all') return true;
    return h.category === currentCategoryFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon"><i data-lucide="flame"></i></div>
        <h4 class="empty-state-title">Nenhum hábito cadastrado</h4>
        <p class="empty-state-desc">
          ${habits.length === 0 ? 'Crie hábitos diários como leitura, exercícios ou estudos e acompanhe suas sequências.' : 'Nenhum hábito na categoria selecionada.'}
        </p>
        ${habits.length === 0 ? '<button class="btn btn-primary btn-sm" id="btn-empty-add-habit"><i data-lucide="plus"></i> Criar Hábito</button>' : ''}
      </div>
    `;

    const emptyBtn = document.getElementById('btn-empty-add-habit');
    if (emptyBtn) emptyBtn.addEventListener('click', () => openHabitModal());

    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const last7Days = getLast7Days();

  container.innerHTML = filtered.map(habit => {
    const history = habit.history || [];
    const isDoneToday = history.includes(todayStr);

    return `
      <div class="card habit-card" data-id="${habit.id}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:var(--space-3);">
          <div>
            <span class="badge badge-purple" style="margin-bottom:4px;">${escapeHTML(habit.category || 'Geral')}</span>
            <h3 style="font-size:1.1rem; font-weight:700;">${escapeHTML(habit.name)}</h3>
            <span style="font-size:0.775rem; color:var(--text-muted);">${escapeHTML(habit.frequency === 'daily' ? 'Diário' : habit.frequency || 'Todos os dias')}</span>
          </div>
          <div class="habit-streak-badge" title="Sequência atual: ${habit.streak || 0} dias (Melhor: ${habit.bestStreak || 0} dias)">
            <span>🔥</span>
            <strong>${habit.streak || 0}</strong>
            <span style="font-size:0.7rem; color:var(--text-muted);">dias</span>
          </div>
        </div>

        <!-- 7-day history dots -->
        <div class="habit-days-row">
          ${last7Days.map(day => {
            const isCompleted = history.includes(day.dateStr);
            const isToday = day.dateStr === todayStr;
            return `
              <div class="habit-day-item">
                <span class="habit-day-label ${isToday ? 'today' : ''}">${day.label}</span>
                <button class="habit-day-circle ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''}" 
                        data-habit-id="${habit.id}" 
                        data-date="${day.dateStr}"
                        title="${day.dateStr} - ${isCompleted ? 'Concluído (clique para desmarcar)' : 'Não concluído (clique para marcar)'}">
                  ${isCompleted ? '<i data-lucide="check" style="width:12px; height:12px;"></i>' : ''}
                </button>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Action footer -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:var(--space-4); border-top:1px solid var(--border-subtle); padding-top:var(--space-3);">
          <button class="btn ${isDoneToday ? 'btn-secondary' : 'btn-primary'} btn-sm btn-toggle-today" data-id="${habit.id}">
            <i data-lucide="${isDoneToday ? 'check-circle' : 'circle'}"></i>
            <span>${isDoneToday ? 'Feito hoje!' : 'Concluir hoje'}</span>
          </button>

          <div style="display:flex; gap:2px;">
            <button class="btn-icon btn-edit-habit" data-id="${habit.id}" title="Editar">
              <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
            </button>
            <button class="btn-icon btn-delete-habit" data-id="${habit.id}" title="Excluir">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }

  // Bind day circle clicks
  container.querySelectorAll('.habit-day-circle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const habitId = btn.dataset.habitId;
      const dateStr = btn.dataset.date;
      await db.habits.toggleDay(habitId, dateStr);
    });
  });

  // Bind today toggle
  container.querySelectorAll('.btn-toggle-today').forEach(btn => {
    btn.addEventListener('click', async () => {
      await db.habits.toggleDay(btn.dataset.id, todayStr);
    });
  });

  // Bind edit
  container.querySelectorAll('.btn-edit-habit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const habit = await db.habits.getById(btn.dataset.id);
      if (habit) openHabitModal(habit);
    });
  });

  // Bind delete
  container.querySelectorAll('.btn-delete-habit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const habit = await db.habits.getById(btn.dataset.id);
      showConfirmModal({
        title: 'Excluir Hábito',
        message: `Deseja realmente excluir o hábito "${habit ? habit.name : ''}" e seu histórico?`,
        confirmText: 'Excluir',
        danger: true,
        onConfirm: async () => {
          await db.habits.delete(btn.dataset.id);
          showToast('Hábito excluído.', 'info');
        }
      });
    });
  });
}

function updateCategoryFilter(habits) {
  const select = document.getElementById('habit-category-filter');
  if (!select) return;

  const categories = Array.from(new Set(habits.map(h => h.category).filter(Boolean))).sort();
  const current = select.value;

  select.innerHTML = '<option value="all">Todas as Categorias</option>' +
    categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');

  if (categories.includes(current)) {
    select.value = current;
  } else {
    select.value = 'all';
  }
}

function getLast7Days() {
  const days = [];
  const dayLabels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    days.push({
      dateStr,
      label: dayLabels[d.getDay()]
    });
  }

  return days;
}

export function openHabitModal(habit = null) {
  const modal = document.getElementById('habit-modal');
  const form = document.getElementById('habit-form');
  const titleEl = document.getElementById('habit-modal-title');
  if (!modal || !form) return;

  form.reset();

  if (habit) {
    if (titleEl) titleEl.textContent = 'Editar Hábito';
    document.getElementById('habit-id').value = habit.id;
    document.getElementById('habit-name').value = habit.name || '';
    document.getElementById('habit-category').value = habit.category || 'Saúde';
    document.getElementById('habit-frequency').value = habit.frequency || 'daily';
  } else {
    if (titleEl) titleEl.textContent = 'Novo Hábito';
    document.getElementById('habit-id').value = '';
    document.getElementById('habit-category').value = 'Saúde';
    document.getElementById('habit-frequency').value = 'daily';
  }

  modal.classList.add('active');
  document.getElementById('habit-name').focus();
}

async function handleHabitFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('habit-id').value;
  const name = document.getElementById('habit-name').value.trim();
  const category = document.getElementById('habit-category').value.trim();
  const frequency = document.getElementById('habit-frequency').value;

  if (!name) {
    showToast('Informe o nome do hábito.', 'error');
    return;
  }

  if (id) {
    await db.habits.update(id, { name, category: category || 'Geral', frequency });
    showToast('Hábito atualizado com sucesso!', 'success');
  } else {
    await db.habits.create({ name, category: category || 'Geral', frequency });
    showToast('Hábito criado com sucesso!', 'success');
  }

  document.getElementById('habit-modal').classList.remove('active');
}
