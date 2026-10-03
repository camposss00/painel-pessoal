/**
 * Main Application Bootstrap - Painel Pessoal 2.0
 */

import { initDashboardModule, renderDashboard } from './modules/dashboard.js';
import { initTasksModule, renderTasks } from './modules/tasks.js';
import { initCalendarModule, renderCalendar } from './modules/calendar.js';
import { initStudiesModule, renderAll as renderStudies } from './modules/studies.js';
import { initProjectsModule, renderProjects } from './modules/projects.js';
import { initFinanceModule, renderFinance } from './modules/finance.js';
import { initHabitsModule, renderHabits } from './modules/habits.js';
import { initGoalsModule, renderGoals } from './modules/goals.js';
import { initNotesModule, renderNotes } from './modules/notes.js';
import { initSettingsModule, renderSettings } from './modules/settings.js';
import { initBackupModule } from './modules/backup.js';

let activeViewId = 'view-dashboard';

document.addEventListener('DOMContentLoaded', () => {
  initDateDisplay();
  initTheme();
  initNavigation();
  initModalDismissHandlers();

  // Initialize all 10 functional modules
  initDashboardModule();
  initTasksModule();
  initCalendarModule();
  initStudiesModule();
  initProjectsModule();
  initFinanceModule();
  initHabitsModule();
  initGoalsModule();
  initNotesModule();
  initSettingsModule();
  initBackupModule();

  // Initialize PWA Service Worker & Install flow
  initServiceWorker();
  initPwaInstallPrompt();

  // Initialize Lucide icons
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
});

function initDateDisplay() {
  const dateDisplay = document.getElementById('topbar-date-display');
  if (dateDisplay) {
    dateDisplay.textContent = new Date().toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  }
}

/* ==========================================================================
   THEME SWITCHER
   ========================================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem('painel_pessoal_theme') || 
    (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  applyTheme(savedTheme);

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('painel_pessoal_theme', theme);

  const themeIcon = document.getElementById('theme-icon');
  const themeText = document.getElementById('theme-text');
  if (themeIcon && themeText) {
    if (theme === 'dark') {
      themeIcon.setAttribute('data-lucide', 'sun');
      themeText.textContent = 'Modo Claro';
    } else {
      themeIcon.setAttribute('data-lucide', 'moon');
      themeText.textContent = 'Modo Escuro';
    }
  }

  // Update theme radio if on settings view
  const themeRadio = document.querySelector(`input[name="settings-theme"][value="${theme}"]`);
  if (themeRadio) {
    themeRadio.checked = true;
  }

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }

  // Update meta theme-color for PWA status bar / theme
  const metaThemeColor = document.getElementById('meta-theme-color');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#0b0f19' : '#2563eb');
  }

  // Refresh finance chart if currently on finance view
  if (activeViewId === 'view-finance') {
    renderFinance();
  }
}

/* ==========================================================================
   VIEW NAVIGATION & ROUTING
   ========================================================================== */
const viewTitles = {
  'view-dashboard': 'Dashboard',
  'view-tasks': 'Minhas Tarefas',
  'view-calendar': 'Agenda & Calendário',
  'view-studies': 'Estudos & Desempenho',
  'view-projects': 'Meus Projetos',
  'view-finance': 'Controle Financeiro',
  'view-habits': 'Hábitos & Rotina',
  'view-goals': 'Metas & Objetivos',
  'view-notes': 'Bloco de Notas',
  'view-settings': 'Configurações'
};

function initNavigation() {
  const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
  const viewSections = document.querySelectorAll('.view-section');
  const topbarTitle = document.getElementById('topbar-title-text');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const menuToggle = document.getElementById('menu-toggle-btn');
  const closeSidebarBtn = document.getElementById('sidebar-close-btn');

  function switchView(targetViewId) {
    activeViewId = targetViewId;

    // Hide all views, deactivate nav links
    viewSections.forEach(section => section.classList.remove('active'));
    navLinks.forEach(link => link.classList.remove('active'));

    const targetSection = document.getElementById(targetViewId);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    const activeLink = document.querySelector(`.sidebar-nav .nav-link[data-target="${targetViewId}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
    }

    if (topbarTitle && viewTitles[targetViewId]) {
      topbarTitle.textContent = viewTitles[targetViewId];
    }

    // Refresh view specific renders
    if (targetViewId === 'view-dashboard') renderDashboard();
    else if (targetViewId === 'view-tasks') renderTasks();
    else if (targetViewId === 'view-calendar') renderCalendar();
    else if (targetViewId === 'view-studies') renderStudies();
    else if (targetViewId === 'view-projects') renderProjects();
    else if (targetViewId === 'view-finance') renderFinance();
    else if (targetViewId === 'view-habits') renderHabits();
    else if (targetViewId === 'view-goals') renderGoals();
    else if (targetViewId === 'view-notes') renderNotes();
    else if (targetViewId === 'view-settings') renderSettings();

    // Close mobile sidebar if open
    if (sidebar && sidebar.classList.contains('open')) {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    }

    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }

    // Scroll window to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Attach nav link events
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.target;
      if (target) switchView(target);
    });
  });

  // Mobile menu toggle
  if (menuToggle && sidebar && backdrop) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.add('open');
      backdrop.classList.add('active');
    });

    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    });
  }

  if (closeSidebarBtn && sidebar && backdrop) {
    closeSidebarBtn.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    });
  }

  // Allow global quick navigation (e.g. from widgets)
  window.navigateToView = (targetViewId) => switchView(targetViewId);
}

/* ==========================================================================
   MODAL DISMISS & ACCESSIBILITY HANDLERS
   ========================================================================== */
function initModalDismissHandlers() {
  // Close modal when clicking close button or cancel
  document.querySelectorAll('.modal-close, .modal-cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-overlay');
      if (modal) modal.classList.remove('active');
    });
  });

  // Close when clicking overlay backdrop
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  });

  // Close when pressing Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal-overlay.active');
      if (openModal) {
        openModal.classList.remove('active');
      }
    }
  });
}

/* ==========================================================================
   PROGRESSIVE WEB APP (PWA) SERVICE WORKER & INSTALL PROMPT
   ========================================================================== */
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registrado com sucesso. Escopo:', registration.scope);

          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] Nova versão disponível. O cache foi atualizado com segurança.');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('[PWA] Falha ao registrar Service Worker:', error);
        });
    });
  }
}

let deferredPwaInstallPrompt = null;

function initPwaInstallPrompt() {
  const installBtnSidebar = document.getElementById('btn-install-pwa');
  const installBtnSettings = document.getElementById('btn-install-pwa-settings');

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent default browser install banner
    e.preventDefault();
    deferredPwaInstallPrompt = e;

    // Show custom install buttons
    if (installBtnSidebar) {
      installBtnSidebar.style.display = 'inline-flex';
    }
    if (installBtnSettings) {
      installBtnSettings.style.display = 'inline-flex';
    }
  });

  const triggerInstall = async () => {
    if (!deferredPwaInstallPrompt) return;

    deferredPwaInstallPrompt.prompt();
    const { outcome } = await deferredPwaInstallPrompt.userChoice;

    if (outcome === 'accepted') {
      if (installBtnSidebar) installBtnSidebar.style.display = 'none';
      if (installBtnSettings) installBtnSettings.style.display = 'none';
    }
    deferredPwaInstallPrompt = null;
  };

  if (installBtnSidebar) {
    installBtnSidebar.addEventListener('click', triggerInstall);
  }
  if (installBtnSettings) {
    installBtnSettings.addEventListener('click', triggerInstall);
  }

  window.addEventListener('appinstalled', () => {
    if (installBtnSidebar) installBtnSidebar.style.display = 'none';
    if (installBtnSettings) installBtnSettings.style.display = 'none';
    deferredPwaInstallPrompt = null;
    console.log('[PWA] Aplicativo Painel Pessoal instalado com êxito!');
  });
}

