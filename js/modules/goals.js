import { db } from '../storage/db.js';
import { escapeHTML, formatDate, getRelativeDateStatus, showToast, showConfirmModal } from '../utils/helpers.js';

let currentGoalStatusFilter = 'all';

export function initGoalsModule() {
  const container = document.getElementById('view-goals');
  if (!container) return;

  setupEvents();
  renderGoals();

  db.on('goals:changed', () => renderGoals());
}

function setupEvents() {
  const btnNewGoal = document.getElementById('btn-new-goal');
  if (btnNewGoal) {
    btnNewGoal.addEventListener('click', () => openGoalModal());
  }

  const form = document.getElementById('goal-form');
  if (form) {
    form.addEventListener('submit', handleGoalFormSubmit);
  }

  // Filter chips
  const filterChips = document.querySelectorAll('.goal-filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentGoalStatusFilter = chip.dataset.status || 'all';
      renderGoals();
    });
  });
}

export async function renderGoals() {
  const container = document.getElementById('goals-grid-container');
  if (!container) return;

  const goals = await db.goals.getAll();

  const filtered = goals.filter(g => {
    if (currentGoalStatusFilter === 'all') return true;
    return g.status === currentGoalStatusFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon"><i data-lucide="target"></i></div>
        <h4 class="empty-state-title">Nenhuma meta encontrada</h4>
        <p class="empty-state-desc">
          ${goals.length === 0 ? 'Defina suas metas pessoais e divida-as em etapas para acompanhar seu progresso diário.' : 'Nenhuma meta com o status selecionado.'}
        </p>
        ${goals.length === 0 ? '<button class="btn btn-primary btn-sm" id="btn-empty-add-goal"><i data-lucide="plus"></i> Criar Meta</button>' : ''}
      </div>
    `;

    const emptyBtn = document.getElementById('btn-empty-add-goal');
    if (emptyBtn) emptyBtn.addEventListener('click', () => openGoalModal());

    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
    return;
  }

  const statusMap = {
    'active': { label: 'Em Andamento', class: 'badge-purple' },
    'completed': { label: 'Concluída', class: 'badge-success' },
    'paused': { label: 'Pausada', class: 'badge-gray' }
  };

  container.innerHTML = filtered.map(goal => {
    const statusInfo = statusMap[goal.status] || { label: goal.status, class: 'badge-gray' };
    const milestones = goal.milestones || [];
    const completedCount = milestones.filter(m => m.completed).length;
    const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : (goal.status === 'completed' ? 100 : 0);
    const relDeadline = goal.deadline ? getRelativeDateStatus(goal.deadline) : null;

    return `
      <div class="card goal-card" data-id="${goal.id}">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:var(--space-2); margin-bottom:var(--space-2);">
            <div>
              <span class="badge badge-gray" style="margin-bottom:4px;">${escapeHTML(goal.category || 'Geral')}</span>
              <h3 style="font-size:1.15rem; font-weight:700;">${escapeHTML(goal.title)}</h3>
            </div>
            <span class="badge ${statusInfo.class}">${statusInfo.label}</span>
          </div>

          ${goal.description ? `<p style="font-size:0.875rem; color:var(--text-muted); margin-bottom:var(--space-3); line-height:1.4;">${escapeHTML(goal.description)}</p>` : ''}

          <!-- Progress bar -->
          <div style="margin: var(--space-3) 0;">
            <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; margin-bottom:4px;">
              <span>Progresso (${completedCount}/${milestones.length} etapas)</span>
              <span style="color:var(--primary); font-weight:700;">${progress}%</span>
            </div>
            <div style="background:var(--bg-card-hover); height:8px; border-radius:var(--radius-full); overflow:hidden; border:1px solid var(--border-subtle);">
              <div style="background:${progress === 100 ? 'var(--color-success)' : 'var(--primary)'}; height:100%; width:${progress}%; transition:width 0.3s ease;"></div>
            </div>
          </div>

          <!-- Milestones preview / quick toggle -->
          ${milestones.length > 0 ? `
            <div class="goal-milestones-list" style="margin-top:var(--space-3); background:var(--bg-card-hover); padding:var(--space-3); border-radius:var(--radius-md);">
              <span style="font-size:0.75rem; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em;">Etapas</span>
              <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px;">
                ${milestones.map(m => `
                  <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.85rem;">
                    <input type="checkbox" class="milestone-toggle" data-goal-id="${goal.id}" data-milestone-id="${m.id}" ${m.completed ? 'checked' : ''}>
                    <span style="${m.completed ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${escapeHTML(m.text)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:var(--space-4); border-top:1px solid var(--border-subtle); padding-top:var(--space-3);">
          <div>
            ${goal.deadline ? `
              <span style="font-size:0.775rem; color:var(--text-muted); display:inline-flex; align-items:center; gap:4px;">
                <i data-lucide="clock" style="width:13px; height:13px;"></i> Prazo: ${formatDate(goal.deadline)} (${relDeadline ? relDeadline.label : ''})
              </span>
            ` : '<span style="font-size:0.775rem; color:var(--text-light);">Sem prazo definido</span>'}
          </div>

          <div style="display:flex; gap:2px;">
            <button class="btn-icon btn-edit-goal" data-id="${goal.id}" title="Editar Meta e Etapas">
              <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
            </button>
            <button class="btn-icon btn-delete-goal" data-id="${goal.id}" title="Excluir">
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

  // Toggle milestone checkboxes
  container.querySelectorAll('.milestone-toggle').forEach(chk => {
    chk.addEventListener('change', async () => {
      const goalId = chk.dataset.goalId;
      const milestoneId = chk.dataset.milestoneId;
      await db.goals.toggleMilestone(goalId, milestoneId);
    });
  });

  // Edit goal
  container.querySelectorAll('.btn-edit-goal').forEach(btn => {
    btn.addEventListener('click', async () => {
      const goal = await db.goals.getById(btn.dataset.id);
      if (goal) openGoalModal(goal);
    });
  });

  // Delete goal
  container.querySelectorAll('.btn-delete-goal').forEach(btn => {
    btn.addEventListener('click', async () => {
      const goal = await db.goals.getById(btn.dataset.id);
      showConfirmModal({
        title: 'Excluir Meta',
        message: `Deseja realmente excluir a meta "${goal ? goal.title : ''}"?`,
        confirmText: 'Excluir',
        danger: true,
        onConfirm: async () => {
          await db.goals.delete(btn.dataset.id);
          showToast('Meta excluída.', 'info');
        }
      });
    });
  });
}

export function openGoalModal(goal = null) {
  const modal = document.getElementById('goal-modal');
  const form = document.getElementById('goal-form');
  const titleEl = document.getElementById('goal-modal-title');
  const milestonesContainer = document.getElementById('goal-milestones-input-container');
  if (!modal || !form) return;

  form.reset();
  milestonesContainer.innerHTML = '';

  if (goal) {
    if (titleEl) titleEl.textContent = 'Editar Meta';
    document.getElementById('goal-id').value = goal.id;
    document.getElementById('goal-title').value = goal.title || '';
    document.getElementById('goal-description').value = goal.description || '';
    document.getElementById('goal-category').value = goal.category || 'Geral';
    document.getElementById('goal-status').value = goal.status || 'active';
    document.getElementById('goal-deadline').value = goal.deadline || '';

    // Render existing milestones inputs
    (goal.milestones || []).forEach(m => {
      addMilestoneInputRow(milestonesContainer, m.text, m.id, m.completed);
    });
  } else {
    if (titleEl) titleEl.textContent = 'Nova Meta';
    document.getElementById('goal-id').value = '';
    document.getElementById('goal-status').value = 'active';
    // Add 2 default empty milestone inputs
    addMilestoneInputRow(milestonesContainer, '');
    addMilestoneInputRow(milestonesContainer, '');
  }

  // Setup Add Milestone Row Button
  const btnAddMilestone = document.getElementById('btn-add-milestone-input');
  if (btnAddMilestone) {
    btnAddMilestone.onclick = () => addMilestoneInputRow(milestonesContainer, '');
  }

  modal.classList.add('active');
  document.getElementById('goal-title').focus();
}

function addMilestoneInputRow(container, text = '', id = null, completed = false) {
  const row = document.createElement('div');
  row.className = 'milestone-input-row';
  row.style.cssText = 'display: flex; gap: 8px; margin-bottom: 6px; align-items: center;';
  row.dataset.id = id || ('m_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6));
  row.dataset.completed = completed ? 'true' : 'false';

  row.innerHTML = `
    <input type="text" class="form-control milestone-text-input" placeholder="Etapa / Passo..." value="${escapeHTML(text)}">
    <button type="button" class="btn-icon btn-remove-milestone-row" style="color:var(--text-muted);">&times;</button>
  `;

  row.querySelector('.btn-remove-milestone-row').addEventListener('click', () => {
    row.remove();
  });

  container.appendChild(row);
}

async function handleGoalFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('goal-id').value;
  const title = document.getElementById('goal-title').value.trim();
  const description = document.getElementById('goal-description').value.trim();
  const category = document.getElementById('goal-category').value.trim();
  const status = document.getElementById('goal-status').value;
  const deadline = document.getElementById('goal-deadline').value;

  if (!title) {
    showToast('Informe o título da meta.', 'error');
    return;
  }

  // Collect milestones
  const milestoneRows = document.querySelectorAll('#goal-milestones-input-container .milestone-input-row');
  const milestones = [];
  milestoneRows.forEach(row => {
    const text = row.querySelector('.milestone-text-input').value.trim();
    if (text) {
      milestones.push({
        id: row.dataset.id,
        text,
        completed: row.dataset.completed === 'true'
      });
    }
  });

  const completedCount = milestones.filter(m => m.completed).length;
  const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : (status === 'completed' ? 100 : 0);

  if (id) {
    await db.goals.update(id, { title, description, category: category || 'Geral', status, deadline, milestones, progress });
    showToast('Meta atualizada com sucesso!', 'success');
  } else {
    await db.goals.create({ title, description, category: category || 'Geral', status, deadline, milestones, progress });
    showToast('Meta criada com sucesso!', 'success');
  }

  document.getElementById('goal-modal').classList.remove('active');
}
