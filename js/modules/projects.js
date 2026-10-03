import { db } from '../storage/db.js';
import { escapeHTML, formatDate, getRelativeDateStatus, showToast, showConfirmModal } from '../utils/helpers.js';

let currentStatusFilter = 'all';

export function initProjectsModule() {
  const container = document.getElementById('view-projects');
  if (!container) return;

  setupEvents();
  renderProjects();

  db.on('projects:changed', () => renderProjects());
}

function setupEvents() {
  const btnNewProject = document.getElementById('btn-new-project');
  if (btnNewProject) {
    btnNewProject.addEventListener('click', () => openProjectModal());
  }

  const projectForm = document.getElementById('project-form');
  if (projectForm) {
    projectForm.addEventListener('submit', handleProjectFormSubmit);
  }

  // Filter chips
  const filterChips = document.querySelectorAll('.project-filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentStatusFilter = chip.dataset.status || 'all';
      renderProjects();
    });
  });
}

export async function renderProjects() {
  const container = document.getElementById('projects-grid-container');
  if (!container) return;

  const projects = await db.projects.getAll();

  const filtered = projects.filter(p => {
    if (currentStatusFilter === 'all') return true;
    return p.status === currentStatusFilter;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon"><i data-lucide="folder-git-2"></i></div>
        <h4 class="empty-state-title">Nenhum projeto encontrado</h4>
        <p class="empty-state-desc">
          ${projects.length === 0 ? 'Cadastre seus projetos pessoais para acompanhar o status, prazos, tecnologias e checklists.' : 'Nenhum projeto com o status selecionado.'}
        </p>
        ${projects.length === 0 ? '<button class="btn btn-primary btn-sm" id="btn-empty-add-project"><i data-lucide="plus"></i> Cadastrar Projeto</button>' : ''}
      </div>
    `;

    const emptyAddBtn = document.getElementById('btn-empty-add-project');
    if (emptyAddBtn) {
      emptyAddBtn.addEventListener('click', () => openProjectModal());
    }

    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
    return;
  }

  const statusMap = {
    'ideia': { label: 'Ideia', class: 'badge-gray' },
    'planejamento': { label: 'Planejamento', class: 'badge-low' },
    'desenvolvimento': { label: 'Em Desenvolvimento', class: 'badge-purple' },
    'concluido': { label: 'Concluído', class: 'badge-success' },
    'pausado': { label: 'Pausado', class: 'badge-medium' }
  };

  const priorityLabels = { high: 'Alta', medium: 'Média', low: 'Baixa' };
  const priorityBadgeClass = { high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };

  container.innerHTML = filtered.map(proj => {
    const statusInfo = statusMap[proj.status] || { label: proj.status, class: 'badge-gray' };
    const techList = (proj.technologies || '').split(',').map(t => t.trim()).filter(Boolean);
    const tasks = proj.tasks || [];
    const completedTasks = tasks.filter(t => t.completed).length;
    const progressPct = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : (proj.status === 'concluido' ? 100 : 0);
    const relDeadline = proj.deadline ? getRelativeDateStatus(proj.deadline) : null;

    return `
      <div class="card project-card" data-id="${proj.id}">
        <div>
          <div class="project-header">
            <div>
              <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                <span class="badge ${statusInfo.class}">${statusInfo.label}</span>
                <span class="badge ${priorityBadgeClass[proj.priority] || 'badge-low'}">${priorityLabels[proj.priority] || 'Média'}</span>
              </div>
              <h3 class="project-title">${escapeHTML(proj.name)}</h3>
            </div>
          </div>

          ${proj.description ? `<p class="project-desc" style="margin-top: 6px;">${escapeHTML(proj.description)}</p>` : ''}

          ${techList.length > 0 ? `
            <div class="project-tech-tags" style="margin-top: var(--space-3);">
              ${techList.map(t => `<span class="tech-tag">${escapeHTML(t)}</span>`).join('')}
            </div>
          ` : ''}

          <!-- Checklist & Progress -->
          <div class="project-checklist-preview" style="margin-top: var(--space-3);">
            <div style="display:flex; justify-content:space-between; margin-bottom: 4px; font-weight: 600;">
              <span>Progresso</span>
              <span>${progressPct}% (${completedTasks}/${tasks.length})</span>
            </div>
            <div style="background:var(--border-subtle); border-radius:var(--radius-full); height:6px; overflow:hidden;">
              <div style="background:${progressPct === 100 ? 'var(--color-success)' : 'var(--primary)'}; height:100%; width:${progressPct}%;"></div>
            </div>
          </div>

          ${proj.deadline ? `
            <div style="margin-top: var(--space-2); font-size: 0.775rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
              <i data-lucide="clock" style="width: 12px; height: 12px;"></i>
              Prazo: ${formatDate(proj.deadline)} (${relDeadline ? relDeadline.label : ''})
            </div>
          ` : ''}

          ${proj.notes ? `
            <div style="margin-top: var(--space-3); font-size: 0.8rem; color: var(--text-muted); background: var(--bg-card-hover); padding: 8px; border-radius: var(--radius-sm);">
              <strong>Notas:</strong> ${escapeHTML(proj.notes)}
            </div>
          ` : ''}
        </div>

        <div>
          <div class="project-links">
            ${proj.githubUrl ? `
              <a href="${escapeHTML(proj.githubUrl)}" target="_blank" rel="noopener noreferrer" class="project-link-btn">
                <i data-lucide="github" style="width:14px; height:14px;"></i> GitHub
              </a>
            ` : ''}
            ${proj.liveUrl ? `
              <a href="${escapeHTML(proj.liveUrl)}" target="_blank" rel="noopener noreferrer" class="project-link-btn">
                <i data-lucide="external-link" style="width:14px; height:14px;"></i> Ver Site
              </a>
            ` : ''}
            
            <div style="margin-left: auto; display: flex; gap: 4px;">
              <button class="btn-icon btn-manage-tasks" data-id="${proj.id}" title="Gerenciar Tarefas/Checklist">
                <i data-lucide="check-square" style="width:14px; height:14px;"></i>
              </button>
              <button class="btn-icon btn-edit-project" data-id="${proj.id}" title="Editar">
                <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
              </button>
              <button class="btn-icon btn-delete-project" data-id="${proj.id}" title="Excluir">
                <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }

  // Event handlers
  container.querySelectorAll('.btn-edit-project').forEach(btn => {
    btn.addEventListener('click', async () => {
      const proj = await db.projects.getById(btn.dataset.id);
      if (proj) openProjectModal(proj);
    });
  });

  container.querySelectorAll('.btn-manage-tasks').forEach(btn => {
    btn.addEventListener('click', async () => {
      const proj = await db.projects.getById(btn.dataset.id);
      if (proj) openProjectChecklistModal(proj);
    });
  });

  container.querySelectorAll('.btn-delete-project').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const proj = await db.projects.getById(id);
      showConfirmModal({
        title: 'Excluir Projeto',
        message: `Deseja realmente excluir o projeto "${proj ? proj.name : ''}"?`,
        confirmText: 'Excluir',
        danger: true,
        onConfirm: async () => {
          await db.projects.delete(id);
          showToast('Projeto excluído com sucesso.', 'info');
        }
      });
    });
  });
}

export function openProjectModal(proj = null) {
  const modal = document.getElementById('project-modal');
  const form = document.getElementById('project-form');
  const title = document.getElementById('project-modal-title');
  if (!modal || !form) return;

  form.reset();

  if (proj) {
    title.textContent = 'Editar Projeto';
    document.getElementById('project-id').value = proj.id;
    document.getElementById('project-name').value = proj.name || '';
    document.getElementById('project-description').value = proj.description || '';
    document.getElementById('project-status').value = proj.status || 'ideia';
    document.getElementById('project-priority').value = proj.priority || 'medium';
    document.getElementById('project-deadline').value = proj.deadline || '';
    document.getElementById('project-tech').value = proj.technologies || '';
    document.getElementById('project-github').value = proj.githubUrl || '';
    document.getElementById('project-live').value = proj.liveUrl || '';
    document.getElementById('project-notes').value = proj.notes || '';
  } else {
    title.textContent = 'Novo Projeto';
    document.getElementById('project-id').value = '';
    document.getElementById('project-status').value = 'ideia';
    document.getElementById('project-priority').value = 'medium';
  }

  modal.classList.add('active');
  document.getElementById('project-name').focus();
}

async function handleProjectFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('project-id').value;
  const name = document.getElementById('project-name').value.trim();
  const description = document.getElementById('project-description').value.trim();
  const status = document.getElementById('project-status').value;
  const priority = document.getElementById('project-priority').value;
  const deadline = document.getElementById('project-deadline').value;
  const technologies = document.getElementById('project-tech').value.trim();
  const githubUrl = document.getElementById('project-github').value.trim();
  const liveUrl = document.getElementById('project-live').value.trim();
  const notes = document.getElementById('project-notes').value.trim();

  if (!name) {
    showToast('Informe o nome do projeto.', 'error');
    return;
  }

  if (id) {
    await db.projects.update(id, { name, description, status, priority, deadline, technologies, githubUrl, liveUrl, notes });
    showToast('Projeto atualizado com sucesso!', 'success');
  } else {
    await db.projects.create({ name, description, status, priority, deadline, technologies, githubUrl, liveUrl, notes });
    showToast('Projeto criado com sucesso!', 'success');
  }

  document.getElementById('project-modal').classList.remove('active');
}

// Sub-checklist Modal for Project
export function openProjectChecklistModal(proj) {
  const modal = document.getElementById('project-checklist-modal');
  if (!modal) return;

  document.getElementById('checklist-project-id').value = proj.id;
  document.getElementById('checklist-project-title').textContent = proj.name;

  renderChecklistItems(proj);
  modal.classList.add('active');

  const addBtn = document.getElementById('btn-add-checklist-item');
  const inputEl = document.getElementById('checklist-new-item-input');

  const handleAddItem = async () => {
    const text = inputEl.value.trim();
    if (!text) return;
    const currentProj = await db.projects.getById(proj.id);
    const tasks = currentProj.tasks || [];
    tasks.push({ id: 'item_' + Date.now(), text, completed: false });
    await db.projects.update(proj.id, { tasks });
    inputEl.value = '';
    renderChecklistItems(await db.projects.getById(proj.id));
  };

  addBtn.onclick = handleAddItem;
  inputEl.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddItem();
    }
  };
}

function renderChecklistItems(proj) {
  const container = document.getElementById('checklist-items-container');
  if (!container) return;

  const tasks = proj.tasks || [];

  if (tasks.length === 0) {
    container.innerHTML = '<p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:10px;">Nenhuma tarefa vinculada ao projeto.</p>';
    return;
  }

  container.innerHTML = tasks.map((t, idx) => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--border-light);">
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1;">
        <input type="checkbox" class="chk-item" data-index="${idx}" ${t.completed ? 'checked' : ''}>
        <span style="font-size:0.9rem; ${t.completed ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${escapeHTML(t.text)}</span>
      </label>
      <button class="btn-icon btn-del-chk" data-index="${idx}" style="padding:2px;" title="Remover">&times;</button>
    </div>
  `).join('');

  container.querySelectorAll('.chk-item').forEach(chk => {
    chk.addEventListener('change', async () => {
      const idx = parseInt(chk.dataset.index, 10);
      const currentProj = await db.projects.getById(proj.id);
      currentProj.tasks[idx].completed = chk.checked;
      await db.projects.update(proj.id, { tasks: currentProj.tasks });
      renderChecklistItems(currentProj);
    });
  });

  container.querySelectorAll('.btn-del-chk').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.dataset.index, 10);
      const currentProj = await db.projects.getById(proj.id);
      currentProj.tasks.splice(idx, 1);
      await db.projects.update(proj.id, { tasks: currentProj.tasks });
      renderChecklistItems(currentProj);
    });
  });
}
