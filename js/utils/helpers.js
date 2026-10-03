/**
 * Utility helper functions for Painel Pessoal
 */

export function generateId() {
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

export function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(num);
}

export function formatDate(dateString, format = 'short') {
  if (!dateString) return '';
  const safeDateStr = dateString.length === 10 ? `${dateString}T00:00:00` : dateString;
  const date = new Date(safeDateStr);
  if (isNaN(date.getTime())) return dateString;

  if (format === 'short') {
    return date.toLocaleDateString('pt-BR');
  }

  if (format === 'full') {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  if (format === 'month-year') {
    return date.toLocaleDateString('pt-BR', {
      month: 'long',
      year: 'numeric'
    });
  }

  return date.toLocaleDateString('pt-BR');
}

export function getRelativeDateStatus(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const safeDateStr = dateString.length === 10 ? `${dateString}T00:00:00` : dateString;
  const targetDate = new Date(safeDateStr);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === -1) return { status: 'overdue', label: 'Ontem', days: -1 };
  if (diffDays < -1) return { status: 'overdue', label: `${Math.abs(diffDays)}d atrasada`, days: diffDays };
  if (diffDays === 0) return { status: 'today', label: 'Hoje', days: 0 };
  if (diffDays === 1) return { status: 'tomorrow', label: 'Amanhã', days: 1 };
  return { status: 'future', label: `Em ${diffDays} dias`, days: diffDays };
}

export function calculateAverage(grades = []) {
  const validGrades = grades
    .map(g => Number(g.value !== undefined ? g.value : g))
    .filter(val => !isNaN(val) && val >= 0);

  if (validGrades.length === 0) return null;
  const sum = validGrades.reduce((acc, val) => acc + val, 0);
  return Number((sum / validGrades.length).toFixed(1));
}

export function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-triangle' : 'info';
  
  toast.innerHTML = `
    <div class="toast-icon"><i data-lucide="${iconName}"></i></div>
    <div class="toast-message">${escapeHTML(message)}</div>
    <button class="toast-close" aria-label="Fechar">&times;</button>
  `;

  container.appendChild(toast);
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }

  const removeToast = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  };

  toast.querySelector('.toast-close').addEventListener('click', removeToast);

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }
}

export function showConfirmModal({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false, onConfirm }) {
  const modalEl = document.getElementById('confirm-modal');
  if (!modalEl) {
    if (confirm(message)) {
      if (onConfirm) onConfirm();
    }
    return;
  }

  const titleEl = modalEl.querySelector('.modal-title');
  const messageEl = modalEl.querySelector('#confirm-modal-message');
  const confirmBtn = modalEl.querySelector('#confirm-modal-ok');
  const cancelBtn = modalEl.querySelector('#confirm-modal-cancel');
  const closeBtn = modalEl.querySelector('.modal-close');

  titleEl.textContent = title || 'Confirmação';
  messageEl.textContent = message || 'Tem certeza que deseja prosseguir?';
  confirmBtn.textContent = confirmText;
  cancelBtn.textContent = cancelText;

  if (danger) {
    confirmBtn.className = 'btn btn-danger';
  } else {
    confirmBtn.className = 'btn btn-primary';
  }

  const closeModal = () => {
    modalEl.classList.remove('active');
    cleanup();
  };

  const handleConfirm = () => {
    closeModal();
    if (onConfirm) onConfirm();
  };

  const cleanup = () => {
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', closeModal);
    closeBtn.removeEventListener('click', closeModal);
  };

  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);

  modalEl.classList.add('active');
}
