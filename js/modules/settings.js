import { db } from '../storage/db.js';
import { escapeHTML, showToast, showConfirmModal } from '../utils/helpers.js';

export function initSettingsModule() {
  const container = document.getElementById('view-settings');
  if (!container) return;

  setupEvents();
  renderSettings();

  db.on('settings:changed', () => renderSettings());
  db.on('data:imported', () => renderSettings());
}

function setupEvents() {
  const form = document.getElementById('settings-profile-form');
  if (form) {
    form.addEventListener('submit', handleProfileFormSubmit);
  }

  // Theme radios
  const themeRadios = document.querySelectorAll('input[name="settings-theme"]');
  themeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const theme = e.target.value;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('painel_pessoal_theme', theme);
      db.settings.save({ theme });
    });
  });

  // Clear data button
  const btnClearAll = document.getElementById('btn-clear-all-data');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', handleClearAllData);
  }
}

export async function renderSettings() {
  const settings = await db.settings.get();

  // Populate profile fields
  const userNameInput = document.getElementById('settings-user-name');
  if (userNameInput) {
    userNameInput.value = settings.userName || '';
  }

  // Set theme radio
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const themeRadio = document.querySelector(`input[name="settings-theme"][value="${currentTheme}"]`);
  if (themeRadio) {
    themeRadio.checked = true;
  }

  // Render storage breakdown stats
  await renderStorageStats();
}

async function renderStorageStats() {
  const container = document.getElementById('settings-storage-stats');
  if (!container) return;

  const [
    tasks,
    subjects,
    exams,
    projects,
    transactions,
    events,
    habits,
    goals,
    notes
  ] = await Promise.all([
    db.tasks.getAll(),
    db.subjects.getAll(),
    db.exams.getAll(),
    db.projects.getAll(),
    db.transactions.getAll(),
    db.events.getAll(),
    db.habits.getAll(),
    db.goals.getAll(),
    db.notes.getAll()
  ]);

  // Estimate localStorage bytes used
  let totalBytes = 0;
  for (let key in localStorage) {
    if (localStorage.hasOwnProperty(key) && key.startsWith('painel_pessoal_')) {
      totalBytes += (localStorage[key].length + key.length) * 2;
    }
  }
  const kbUsed = (totalBytes / 1024).toFixed(1);

  const stats = [
    { label: 'Tarefas', count: tasks.length },
    { label: 'Matérias', count: subjects.length },
    { label: 'Avaliações', count: exams.length },
    { label: 'Projetos', count: projects.length },
    { label: 'Transações', count: transactions.length },
    { label: 'Eventos/Agenda', count: events.length },
    { label: 'Hábitos', count: habits.length },
    { label: 'Metas', count: goals.length },
    { label: 'Anotações', count: notes.length }
  ];

  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-3); padding-bottom:var(--space-2); border-bottom:1px solid var(--border-subtle);">
      <span style="font-size:0.875rem; color:var(--text-muted);">Espaço utilizado:</span>
      <strong style="color:var(--primary); font-size:1rem;">~${kbUsed} KB no navegador</strong>
    </div>

    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:var(--space-2);">
      ${stats.map(s => `
        <div style="background:var(--bg-card-hover); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:0.8rem; color:var(--text-muted);">${escapeHTML(s.label)}</span>
          <strong style="font-size:0.95rem;">${s.count}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

async function handleProfileFormSubmit(e) {
  e.preventDefault();
  const userName = document.getElementById('settings-user-name').value.trim();

  await db.settings.save({ userName });
  showToast('Preferências salvas com sucesso!', 'success');
}

function handleClearAllData() {
  showConfirmModal({
    title: 'ATENÇÃO: Limpar Todos os Dados',
    message: 'Esta ação apagará permanentemente todas as suas tarefas, matérias, projetos, finanças, hábitos, metas e notas deste navegador. Recomendamos exportar um backup antes. Deseja realmente zerar tudo?',
    confirmText: 'Zerar Todos os Dados',
    danger: true,
    onConfirm: async () => {
      await db.settings.clearAllData();
      showToast('Todos os dados foram excluídos. Reiniciando...', 'info');
      setTimeout(() => {
        window.location.reload();
      }, 900);
    }
  });
}
