import { db } from '../storage/db.js';
import { escapeHTML, formatDate, showToast, showConfirmModal } from '../utils/helpers.js';

let currentNotesCategory = 'all';
let searchQuery = '';

export function initNotesModule() {
  const container = document.getElementById('view-notes');
  if (!container) return;

  setupEvents();
  renderNotes();

  db.on('notes:changed', () => renderNotes());
}

function setupEvents() {
  const btnNewNote = document.getElementById('btn-new-note');
  if (btnNewNote) {
    btnNewNote.addEventListener('click', () => openNoteModal());
  }

  const form = document.getElementById('note-form');
  if (form) {
    form.addEventListener('submit', handleNoteFormSubmit);
  }

  const searchInput = document.getElementById('notes-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderNotes();
    });
  }

  const categorySelect = document.getElementById('notes-category-filter');
  if (categorySelect) {
    categorySelect.addEventListener('change', (e) => {
      currentNotesCategory = e.target.value;
      renderNotes();
    });
  }
}

export async function renderNotes() {
  const container = document.getElementById('notes-grid-container');
  if (!container) return;

  const notes = await db.notes.getAll();
  updateCategoryFilter(notes);

  const filtered = notes.filter(n => {
    if (currentNotesCategory !== 'all' && n.category !== currentNotesCategory) return false;
    if (searchQuery) {
      const matchTitle = (n.title || '').toLowerCase().includes(searchQuery);
      const matchContent = (n.content || '').toLowerCase().includes(searchQuery);
      const matchCat = (n.category || '').toLowerCase().includes(searchQuery);
      if (!matchTitle && !matchContent && !matchCat) return false;
    }
    return true;
  });

  // Sort: pinned first, then by updatedAt/createdAt descending
  filtered.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon"><i data-lucide="sticky-note"></i></div>
        <h4 class="empty-state-title">Nenhuma anotação encontrada</h4>
        <p class="empty-state-desc">
          ${notes.length === 0 ? 'Crie anotações rápidas, ideias de projetos ou resumos de estudos.' : 'Nenhuma nota corresponde à busca ou categoria.'}
        </p>
        ${notes.length === 0 ? '<button class="btn btn-primary btn-sm" id="btn-empty-add-note"><i data-lucide="plus"></i> Criar Anotação</button>' : ''}
      </div>
    `;

    const emptyBtn = document.getElementById('btn-empty-add-note');
    if (emptyBtn) emptyBtn.addEventListener('click', () => openNoteModal());

    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }
    return;
  }

  container.innerHTML = filtered.map(note => {
    return `
      <div class="card note-card ${note.pinned ? 'pinned' : ''}" data-id="${note.id}">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:var(--space-2); margin-bottom:var(--space-2);">
            <div>
              <span class="badge badge-gray" style="margin-bottom:4px;">${escapeHTML(note.category || 'Geral')}</span>
              <h3 style="font-size:1.1rem; font-weight:700;">${escapeHTML(note.title)}</h3>
            </div>
            <button class="btn-icon btn-toggle-pin ${note.pinned ? 'active-pin' : ''}" data-id="${note.id}" title="${note.pinned ? 'Desafixar nota' : 'Fixar no topo'}">
              <i data-lucide="pin" style="width:16px; height:16px; ${note.pinned ? 'fill:var(--primary); color:var(--primary);' : ''}"></i>
            </button>
          </div>

          <p class="note-content-preview" style="font-size:0.875rem; color:var(--text-muted); line-height:1.5; white-space:pre-wrap; word-break:break-word;">${escapeHTML(note.content)}</p>
        </div>

        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:var(--space-4); border-top:1px solid var(--border-subtle); padding-top:var(--space-3);">
          <span style="font-size:0.75rem; color:var(--text-light);">
            ${formatDate(note.updatedAt || note.createdAt)}
          </span>

          <div style="display:flex; gap:2px;">
            <button class="btn-icon btn-edit-note" data-id="${note.id}" title="Editar">
              <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
            </button>
            <button class="btn-icon btn-delete-note" data-id="${note.id}" title="Excluir">
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

  // Bind pin toggle
  container.querySelectorAll('.btn-toggle-pin').forEach(btn => {
    btn.addEventListener('click', async () => {
      await db.notes.togglePin(btn.dataset.id);
    });
  });

  // Bind edit
  container.querySelectorAll('.btn-edit-note').forEach(btn => {
    btn.addEventListener('click', async () => {
      const note = await db.notes.getById(btn.dataset.id);
      if (note) openNoteModal(note);
    });
  });

  // Bind delete
  container.querySelectorAll('.btn-delete-note').forEach(btn => {
    btn.addEventListener('click', async () => {
      const note = await db.notes.getById(btn.dataset.id);
      showConfirmModal({
        title: 'Excluir Anotação',
        message: `Deseja realmente excluir a anotação "${note ? note.title : ''}"?`,
        confirmText: 'Excluir',
        danger: true,
        onConfirm: async () => {
          await db.notes.delete(btn.dataset.id);
          showToast('Anotação excluída.', 'info');
        }
      });
    });
  });
}

function updateCategoryFilter(notes) {
  const select = document.getElementById('notes-category-filter');
  if (!select) return;

  const categories = Array.from(new Set(notes.map(n => n.category).filter(Boolean))).sort();
  const current = select.value;

  select.innerHTML = '<option value="all">Todas as Categorias</option>' +
    categories.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');

  if (categories.includes(current)) {
    select.value = current;
  } else {
    select.value = 'all';
  }
}

export function openNoteModal(note = null) {
  const modal = document.getElementById('note-modal');
  const form = document.getElementById('note-form');
  const titleEl = document.getElementById('note-modal-title');
  if (!modal || !form) return;

  form.reset();

  if (note) {
    if (titleEl) titleEl.textContent = 'Editar Anotação';
    document.getElementById('note-id').value = note.id;
    document.getElementById('note-title').value = note.title || '';
    document.getElementById('note-content').value = note.content || '';
    document.getElementById('note-category').value = note.category || 'Ideias';
    document.getElementById('note-pinned').checked = !!note.pinned;
  } else {
    if (titleEl) titleEl.textContent = 'Nova Anotação';
    document.getElementById('note-id').value = '';
    document.getElementById('note-category').value = 'Ideias';
    document.getElementById('note-pinned').checked = false;
  }

  modal.classList.add('active');
  document.getElementById('note-title').focus();
}

async function handleNoteFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('note-id').value;
  const title = document.getElementById('note-title').value.trim();
  const content = document.getElementById('note-content').value.trim();
  const category = document.getElementById('note-category').value.trim();
  const pinned = document.getElementById('note-pinned').checked;

  if (!title && !content) {
    showToast('Informe um título ou conteúdo para a nota.', 'error');
    return;
  }

  if (id) {
    await db.notes.update(id, { title: title || 'Sem título', content, category: category || 'Geral', pinned });
    showToast('Anotação atualizada!', 'success');
  } else {
    await db.notes.create({ title: title || 'Sem título', content, category: category || 'Geral', pinned });
    showToast('Anotação criada!', 'success');
  }

  document.getElementById('note-modal').classList.remove('active');
}
