import { db } from '../storage/db.js';
import { escapeHTML, formatDate, getRelativeDateStatus, calculateAverage, showToast, showConfirmModal } from '../utils/helpers.js';

export function initStudiesModule() {
  const container = document.getElementById('view-studies');
  if (!container) return;

  setupEvents();
  renderAll();

  // Listen to DB changes
  db.on('subjects:changed', () => renderAll());
  db.on('exams:changed', () => renderAll());
  db.on('studySessions:changed', () => renderAll());
}

function setupEvents() {
  // Add Subject button
  const btnNewSubject = document.getElementById('btn-new-subject');
  if (btnNewSubject) {
    btnNewSubject.addEventListener('click', () => openSubjectModal());
  }

  // Subject Form
  const subjectForm = document.getElementById('subject-form');
  if (subjectForm) {
    subjectForm.addEventListener('submit', handleSubjectFormSubmit);
  }

  // Add Exam/Paper button
  const btnNewExam = document.getElementById('btn-new-exam');
  if (btnNewExam) {
    btnNewExam.addEventListener('click', () => openExamModal());
  }

  // Exam Form
  const examForm = document.getElementById('exam-form');
  if (examForm) {
    examForm.addEventListener('submit', handleExamFormSubmit);
  }

  // Log Study Session button
  const btnNewSession = document.getElementById('btn-new-study-session');
  if (btnNewSession) {
    btnNewSession.addEventListener('click', () => openSessionModal());
  }

  // Session Form
  const sessionForm = document.getElementById('study-session-form');
  if (sessionForm) {
    sessionForm.addEventListener('submit', handleSessionFormSubmit);
  }

  // Add Grade Form
  const gradeForm = document.getElementById('grade-form');
  if (gradeForm) {
    gradeForm.addEventListener('submit', handleGradeFormSubmit);
  }
}

export async function renderAll() {
  await Promise.all([
    renderCountdownBanner(),
    renderStudiesStats(),
    renderSubjects(),
    renderExamsList(),
    renderStudySessions()
  ]);
}

async function renderStudiesStats() {
  const statsContainer = document.getElementById('studies-overview-stats');
  if (!statsContainer) return;

  const [subjects, sessions] = await Promise.all([
    db.subjects.getAll(),
    db.studySessions.getAll()
  ]);

  let totalAverages = [];
  let attentionCount = 0;
  let approvedCount = 0;

  subjects.forEach(s => {
    const avg = calculateAverage(s.grades || []);
    if (avg !== null) {
      totalAverages.push(avg);
      if (avg >= 7.0) approvedCount++;
      else attentionCount++;
    }
  });

  const overallAvg = totalAverages.length > 0 
    ? (totalAverages.reduce((a, b) => a + b, 0) / totalAverages.length).toFixed(1)
    : '--';

  const totalMinutes = sessions.reduce((acc, s) => acc + (Number(s.minutes) || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon purple"><i data-lucide="award"></i></div>
      <div class="stat-details">
        <span class="stat-label">Média Geral</span>
        <span class="stat-value">${overallAvg}</span>
        <span class="stat-subtitle">${totalAverages.length} matérias com notas</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon warning"><i data-lucide="alert-triangle"></i></div>
      <div class="stat-details">
        <span class="stat-label">Precisam de Atenção</span>
        <span class="stat-value" style="${attentionCount > 0 ? 'color:var(--color-warning);' : ''}">${attentionCount}</span>
        <span class="stat-subtitle">Média &lt; 7.0</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon success"><i data-lucide="check-circle-2"></i></div>
      <div class="stat-details">
        <span class="stat-label">Aprovadas / Acima da Média</span>
        <span class="stat-value">${approvedCount}</span>
        <span class="stat-subtitle">Média &ge; 7.0</span>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon primary"><i data-lucide="clock"></i></div>
      <div class="stat-details">
        <span class="stat-label">Horas Estudadas</span>
        <span class="stat-value">${totalHours}h</span>
        <span class="stat-subtitle">${sessions.length} sessões registradas</span>
      </div>
    </div>
  `;

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}

async function renderCountdownBanner() {
  const bannerContainer = document.getElementById('studies-countdown-container');
  if (!bannerContainer) return;

  const exams = await db.exams.getAll();
  const today = new Date().toISOString().split('T')[0];

  const upcomingExams = exams
    .filter(e => e.date >= today)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (upcomingExams.length === 0) {
    bannerContainer.innerHTML = `
      <div class="countdown-banner" style="background: var(--bg-card); border-color: var(--border-subtle);">
        <div class="countdown-info">
          <h3>Nenhuma prova agendada</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem;">Adicione suas próximas provas ou trabalhos para acompanhar a contagem regressiva.</p>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-banner-add-exam"><i data-lucide="plus"></i> Agendar Prova</button>
      </div>
    `;
    const addBtn = document.getElementById('btn-banner-add-exam');
    if (addBtn) addBtn.addEventListener('click', () => openExamModal());
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
    return;
  }

  const nextExam = upcomingExams[0];
  const relDate = getRelativeDateStatus(nextExam.date);

  bannerContainer.innerHTML = `
    <div class="countdown-banner">
      <div class="countdown-info">
        <span class="badge badge-purple" style="margin-bottom: 4px;">Próxima Avaliação</span>
        <h3>${escapeHTML(nextExam.title)} - ${escapeHTML(nextExam.subjectName || 'Geral')}</h3>
        <p style="color: var(--text-muted); font-size: 0.85rem;">
          <i data-lucide="calendar" style="width:13px; height:13px; display:inline-block; vertical-align:middle;"></i>
          ${formatDate(nextExam.date, 'full')}
        </p>
      </div>
      <div class="countdown-timer-badge">
        ${relDate.status === 'today' ? 'Hoje!' : relDate.status === 'tomorrow' ? 'Amanhã!' : relDate.label}
      </div>
    </div>
  `;

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}

async function renderSubjects() {
  const container = document.getElementById('subjects-grid-container');
  if (!container) return;

  const subjects = await db.subjects.getAll();

  if (subjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon"><i data-lucide="book-open"></i></div>
        <h4 class="empty-state-title">Nenhuma matéria cadastrada</h4>
        <p class="empty-state-desc">Cadastre suas matérias para calcular médias e organizar suas notas.</p>
        <button class="btn btn-primary btn-sm" id="btn-empty-add-subject"><i data-lucide="plus"></i> Cadastrar Matéria</button>
      </div>
    `;
    const addBtn = document.getElementById('btn-empty-add-subject');
    if (addBtn) addBtn.addEventListener('click', () => openSubjectModal());
    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
    return;
  }

  container.innerHTML = subjects.map(subj => {
    const grades = subj.grades || [];
    const avg = calculateAverage(grades);

    let statusText = 'Cursando';
    let statusClass = 'status-ongoing';

    if (avg !== null) {
      if (avg >= 7.0) {
        statusText = 'Aprovado';
        statusClass = 'status-approved';
      } else if (avg >= 5.0) {
        statusText = 'Atenção / Exame';
        statusClass = 'status-exam';
      } else {
        statusText = 'Reprovado / Crítico';
        statusClass = 'status-failing';
      }
    }

    return `
      <div class="subject-card ${avg !== null && avg < 7.0 ? 'subject-needs-attention' : ''}" data-id="${subj.id}">
        <div>
          <div class="subject-card-header">
            <div>
              <h4 class="subject-card-title">${escapeHTML(subj.name)}</h4>
              ${subj.professor ? `<span style="font-size: 0.8rem; color: var(--text-muted);">${escapeHTML(subj.professor)}</span>` : ''}
            </div>
            <span class="subject-status ${statusClass}">${statusText}</span>
          </div>

          <div style="margin-top: var(--space-3);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
              <span style="font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Notas</span>
              <button class="btn btn-sm btn-outline btn-add-grade" data-id="${subj.id}" style="padding: 2px 6px; font-size: 0.7rem;">
                + Nota
              </button>
            </div>
            
            <div class="grades-list">
              ${grades.length === 0 ? '<span style="font-size: 0.8rem; color: var(--text-light);">Sem notas lançadas</span>' : grades.map((g, idx) => `
                <span class="grade-pill" title="${escapeHTML(g.label || 'Avaliação')}">
                  ${escapeHTML(g.label ? `${g.label}: ` : '')}<strong>${Number(g.value).toFixed(1)}</strong>
                  <button class="btn-remove-grade" data-subj-id="${subj.id}" data-index="${idx}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; margin-left:3px;" title="Remover">&times;</button>
                </span>
              `).join('')}
            </div>
          </div>
        </div>

        <div>
          <div class="average-row">
            <span style="font-size: 0.85rem; color: var(--text-muted);">Média Atual:</span>
            <span class="average-val" style="color: ${avg === null ? 'var(--text-muted)' : avg >= 7 ? 'var(--color-success)' : avg >= 5 ? 'var(--color-warning)' : 'var(--color-danger)'};">
              ${avg !== null ? avg.toFixed(1) : '--'}
            </span>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-3); border-top: 1px solid var(--border-subtle); padding-top: var(--space-2);">
            <button class="btn-icon btn-edit-subj" data-id="${subj.id}" title="Editar">
              <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
            </button>
            <button class="btn-icon btn-delete-subj" data-id="${subj.id}" title="Excluir">
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

  // Event handlers
  container.querySelectorAll('.btn-add-grade').forEach(btn => {
    btn.addEventListener('click', () => openGradeModal(btn.dataset.id));
  });

  container.querySelectorAll('.btn-remove-grade').forEach(btn => {
    btn.addEventListener('click', async () => {
      const subjId = btn.dataset.subjId;
      const index = parseInt(btn.dataset.index, 10);
      await db.subjects.removeGrade(subjId, index);
      showToast('Nota removida.', 'info');
    });
  });

  container.querySelectorAll('.btn-edit-subj').forEach(btn => {
    btn.addEventListener('click', async () => {
      const subj = await db.subjects.getById(btn.dataset.id);
      if (subj) openSubjectModal(subj);
    });
  });

  container.querySelectorAll('.btn-delete-subj').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const subj = await db.subjects.getById(id);
      showConfirmModal({
        title: 'Excluir Matéria',
        message: `Deseja realmente excluir "${subj ? subj.name : ''}" e todas as suas notas associadas?`,
        confirmText: 'Excluir',
        danger: true,
        onConfirm: async () => {
          await db.subjects.delete(id);
          showToast('Matéria excluída com sucesso.', 'info');
        }
      });
    });
  });
}

async function renderExamsList() {
  const container = document.getElementById('exams-list-container');
  if (!container) return;

  const exams = await db.exams.getAll();
  exams.sort((a, b) => new Date(a.date) - new Date(b.date));

  if (exams.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-4);">
        <p class="empty-state-desc" style="margin-bottom:0;">Nenhum trabalho ou prova cadastrado.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = exams.map(e => {
    const relDate = getRelativeDateStatus(e.date);
    const typeLabel = e.type === 'trabalho' ? 'Trabalho' : 'Prova';
    const typeBadge = e.type === 'trabalho' ? 'badge-low' : 'badge-purple';

    return `
      <div class="widget-item">
        <div style="flex:1; min-width:0;">
          <div style="display:flex; align-items:center; gap:var(--space-2);">
            <span class="badge ${typeBadge}">${typeLabel}</span>
            <strong style="font-size:0.9rem;">${escapeHTML(e.title)}</strong>
          </div>
          <div style="font-size:0.775rem; color:var(--text-muted); margin-top:2px;">
            ${escapeHTML(e.subjectName || 'Geral')} &bull; ${formatDate(e.date)} (${relDate ? relDate.label : ''})
          </div>
        </div>
        <div style="display:flex; gap:2px;">
          <button class="btn-icon btn-edit-exam" data-id="${e.id}" title="Editar">
            <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
          </button>
          <button class="btn-icon btn-delete-exam" data-id="${e.id}" title="Excluir">
            <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }

  container.querySelectorAll('.btn-edit-exam').forEach(btn => {
    btn.addEventListener('click', async () => {
      const exam = await db.exams.getById(btn.dataset.id);
      if (exam) openExamModal(exam);
    });
  });

  container.querySelectorAll('.btn-delete-exam').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      showConfirmModal({
        title: 'Excluir Avaliação',
        message: 'Deseja excluir esta avaliação?',
        confirmText: 'Excluir',
        danger: true,
        onConfirm: async () => {
          await db.exams.delete(id);
          showToast('Avaliação excluída.', 'info');
        }
      });
    });
  });
}

async function renderStudySessions() {
  const container = document.getElementById('study-sessions-container');
  const totalHoursEl = document.getElementById('total-study-hours');
  if (!container) return;

  const sessions = await db.studySessions.getAll();
  sessions.sort((a, b) => new Date(b.date) - new Date(a.date));

  const totalMinutes = sessions.reduce((acc, s) => acc + (Number(s.minutes) || 0), 0);
  const hours = (totalMinutes / 60).toFixed(1);
  if (totalHoursEl) {
    totalHoursEl.textContent = `${hours}h`;
  }

  if (sessions.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: var(--space-4);">
        <p class="empty-state-desc" style="margin-bottom:0;">Nenhuma sessão de estudo registrada ainda.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = sessions.slice(0, 10).map(s => `
    <div class="widget-item">
      <div>
        <strong style="font-size:0.875rem;">${escapeHTML(s.subjectName || 'Estudo')}</strong>
        <div style="font-size:0.75rem; color:var(--text-muted);">
          ${formatDate(s.date)} &bull; ${escapeHTML(s.topic || 'Revisão')}
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:var(--space-2);">
        <span class="badge badge-success">${s.minutes} min</span>
        <button class="btn-icon btn-delete-session" data-id="${s.id}" title="Excluir">
          <i data-lucide="trash-2" style="width:13px; height:13px;"></i>
        </button>
      </div>
    </div>
  `).join('');

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }

  container.querySelectorAll('.btn-delete-session').forEach(btn => {
    btn.addEventListener('click', async () => {
      await db.studySessions.delete(btn.dataset.id);
      showToast('Registro de estudo removido.', 'info');
    });
  });
}

// Modal Openers & Form Handlers
export function openSubjectModal(subject = null) {
  const modal = document.getElementById('subject-modal');
  const form = document.getElementById('subject-form');
  const title = document.getElementById('subject-modal-title');
  if (!modal || !form) return;

  form.reset();

  if (subject) {
    title.textContent = 'Editar Matéria';
    document.getElementById('subject-id').value = subject.id;
    document.getElementById('subject-name').value = subject.name || '';
    document.getElementById('subject-professor').value = subject.professor || '';
  } else {
    title.textContent = 'Nova Matéria';
    document.getElementById('subject-id').value = '';
  }

  modal.classList.add('active');
  document.getElementById('subject-name').focus();
}

async function handleSubjectFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('subject-id').value;
  const name = document.getElementById('subject-name').value.trim();
  const professor = document.getElementById('subject-professor').value.trim();

  if (!name) {
    showToast('Informe o nome da matéria.', 'error');
    return;
  }

  if (id) {
    await db.subjects.update(id, { name, professor });
    showToast('Matéria atualizada com sucesso!', 'success');
  } else {
    await db.subjects.create({ name, professor, grades: [] });
    showToast('Matéria criada com sucesso!', 'success');
  }

  document.getElementById('subject-modal').classList.remove('active');
}

export async function openExamModal(exam = null) {
  const modal = document.getElementById('exam-modal');
  const form = document.getElementById('exam-form');
  const modalTitle = document.getElementById('exam-modal-title');
  const selectSubject = document.getElementById('exam-subject-select');
  if (!modal || !form) return;

  form.reset();

  const subjects = await db.subjects.getAll();
  selectSubject.innerHTML = '<option value="">Sem matéria específica (Geral)</option>' +
    subjects.map(s => `<option value="${s.id}" data-name="${escapeHTML(s.name)}">${escapeHTML(s.name)}</option>`).join('');

  if (exam) {
    if (modalTitle) modalTitle.textContent = 'Editar Avaliação';
    const idInput = document.getElementById('exam-id');
    if (idInput) idInput.value = exam.id;
    document.getElementById('exam-title').value = exam.title || '';
    document.getElementById('exam-type').value = exam.type || 'prova';
    document.getElementById('exam-date').value = exam.date || '';
    if (exam.subjectId) selectSubject.value = exam.subjectId;
  } else {
    if (modalTitle) modalTitle.textContent = 'Agendar Avaliação';
    const idInput = document.getElementById('exam-id');
    if (idInput) idInput.value = '';
    document.getElementById('exam-date').value = new Date().toISOString().split('T')[0];
  }

  modal.classList.add('active');
  document.getElementById('exam-title').focus();
}

async function handleExamFormSubmit(e) {
  e.preventDefault();
  const idInput = document.getElementById('exam-id');
  const id = idInput ? idInput.value : '';
  const title = document.getElementById('exam-title').value.trim();
  const type = document.getElementById('exam-type').value;
  const selectSubject = document.getElementById('exam-subject-select');
  const subjectId = selectSubject.value;
  const subjectName = selectSubject.selectedOptions[0] ? selectSubject.selectedOptions[0].dataset.name : '';
  const date = document.getElementById('exam-date').value;

  if (!title || !date) {
    showToast('Preencha o título e a data.', 'error');
    return;
  }

  if (id) {
    await db.exams.update(id, { title, type, subjectId, subjectName, date });
    showToast('Avaliação atualizada com sucesso!', 'success');
  } else {
    await db.exams.create({ title, type, subjectId, subjectName, date });
    showToast('Avaliação agendada com sucesso!', 'success');
  }

  document.getElementById('exam-modal').classList.remove('active');
}

export async function openSessionModal() {
  const modal = document.getElementById('study-session-modal');
  const form = document.getElementById('study-session-form');
  const select = document.getElementById('session-subject-select');
  if (!modal || !form) return;

  form.reset();

  const subjects = await db.subjects.getAll();
  select.innerHTML = '<option value="">Estudo Geral</option>' +
    subjects.map(s => `<option value="${escapeHTML(s.name)}">${escapeHTML(s.name)}</option>`).join('');

  document.getElementById('session-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('session-minutes').value = '60';

  modal.classList.add('active');
}

async function handleSessionFormSubmit(e) {
  e.preventDefault();
  const subjectName = document.getElementById('session-subject-select').value;
  const topic = document.getElementById('session-topic').value.trim();
  const minutes = parseInt(document.getElementById('session-minutes').value, 10);
  const date = document.getElementById('session-date').value;

  if (isNaN(minutes) || minutes <= 0) {
    showToast('Informe minutos válidos de estudo.', 'error');
    return;
  }

  await db.studySessions.create({ subjectName, topic, minutes, date });
  showToast('Horas de estudo registradas!', 'success');
  document.getElementById('study-session-modal').classList.remove('active');
}

function openGradeModal(subjectId) {
  const modal = document.getElementById('grade-modal');
  const form = document.getElementById('grade-form');
  if (!modal || !form) return;

  form.reset();
  document.getElementById('grade-subject-id').value = subjectId;
  modal.classList.add('active');
  document.getElementById('grade-value').focus();
}

async function handleGradeFormSubmit(e) {
  e.preventDefault();
  const subjectId = document.getElementById('grade-subject-id').value;
  const value = parseFloat(document.getElementById('grade-value').value);
  const label = document.getElementById('grade-label').value.trim();

  if (isNaN(value) || value < 0 || value > 10) {
    showToast('A nota deve estar entre 0 e 10.', 'error');
    return;
  }

  await db.subjects.addGrade(subjectId, { value, label: label || 'Avaliação' });
  showToast('Nota adicionada com sucesso!', 'success');
  document.getElementById('grade-modal').classList.remove('active');
}
