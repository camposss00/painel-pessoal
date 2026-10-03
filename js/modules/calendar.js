import { db } from '../storage/db.js';
import { escapeHTML, formatDate, showToast, showConfirmModal } from '../utils/helpers.js';

let currentCalDate = new Date();
let currentViewMode = 'month'; // 'month' or 'day'

export function initCalendarModule() {
  const container = document.getElementById('view-calendar');
  if (!container) return;

  setupEvents();
  renderCalendar();

  db.on('tasks:changed', () => renderCalendar());
  db.on('exams:changed', () => renderCalendar());
  db.on('events:changed', () => renderCalendar());
}

function setupEvents() {
  const prevBtn = document.getElementById('cal-prev-btn');
  const nextBtn = document.getElementById('cal-next-btn');
  const todayBtn = document.getElementById('cal-today-btn');
  const btnNewEvent = document.getElementById('btn-new-cal-event');
  const btnAddFromDay = document.getElementById('btn-cal-day-add-event');

  // View mode switcher buttons
  const viewMonthBtn = document.getElementById('cal-view-month-btn');
  const viewDayBtn = document.getElementById('cal-view-day-btn');

  if (viewMonthBtn && viewDayBtn) {
    viewMonthBtn.addEventListener('click', () => {
      currentViewMode = 'month';
      viewMonthBtn.classList.add('active');
      viewDayBtn.classList.remove('active');
      renderCalendar();
    });

    viewDayBtn.addEventListener('click', () => {
      currentViewMode = 'day';
      viewDayBtn.classList.add('active');
      viewMonthBtn.classList.remove('active');
      renderCalendar();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentViewMode === 'month') {
        currentCalDate.setMonth(currentCalDate.getMonth() - 1);
      } else {
        currentCalDate.setDate(currentCalDate.getDate() - 1);
      }
      renderCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentViewMode === 'month') {
        currentCalDate.setMonth(currentCalDate.getMonth() + 1);
      } else {
        currentCalDate.setDate(currentCalDate.getDate() + 1);
      }
      renderCalendar();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      currentCalDate = new Date();
      renderCalendar();
    });
  }

  if (btnNewEvent) {
    btnNewEvent.addEventListener('click', () => openEventModal());
  }

  if (btnAddFromDay) {
    btnAddFromDay.addEventListener('click', () => {
      const selectedDate = document.getElementById('cal-day-modal-date').value;
      const dayModal = document.getElementById('calendar-day-modal');
      if (dayModal) dayModal.classList.remove('active');
      openEventModal(null, selectedDate);
    });
  }

  const eventForm = document.getElementById('calendar-event-form');
  if (eventForm) {
    eventForm.addEventListener('submit', handleEventFormSubmit);
  }
}

export async function renderCalendar() {
  const titleEl = document.getElementById('cal-title-display');
  const monthContainer = document.getElementById('calendar-month-view-container');
  const dayContainer = document.getElementById('calendar-day-view-container');
  if (!titleEl) return;

  const year = currentCalDate.getFullYear();
  const month = currentCalDate.getMonth();

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Fetch all date-linked items
  const [tasks, exams, events] = await Promise.all([
    db.tasks.getAll(),
    db.exams.getAll(),
    db.events.getAll()
  ]);

  // Map items by date string "YYYY-MM-DD"
  const itemsByDate = {};

  tasks.forEach(t => {
    if (t.dueDate) {
      const d = t.dueDate.split('T')[0];
      if (!itemsByDate[d]) itemsByDate[d] = [];
      itemsByDate[d].push({ type: 'task', title: t.title, completed: t.completed, item: t });
    }
  });

  exams.forEach(e => {
    if (e.date) {
      const d = e.date.split('T')[0];
      if (!itemsByDate[d]) itemsByDate[d] = [];
      itemsByDate[d].push({ type: 'exam', title: `${e.type === 'trabalho' ? 'Trabalho' : 'Prova'}: ${e.title}`, item: e });
    }
  });

  events.forEach(ev => {
    if (ev.date) {
      const d = ev.date.split('T')[0];
      if (!itemsByDate[d]) itemsByDate[d] = [];
      itemsByDate[d].push({ type: 'event', title: ev.title, item: ev });
    }
  });

  if (currentViewMode === 'month') {
    titleEl.textContent = `${monthNames[month]} ${year}`;
    if (monthContainer) monthContainer.style.display = 'block';
    if (dayContainer) dayContainer.style.display = 'none';
    renderMonthGrid(year, month, itemsByDate);
  } else {
    const selectedDateStr = formatDateString(year, month, currentCalDate.getDate());
    titleEl.textContent = formatDate(selectedDateStr, 'full');
    if (monthContainer) monthContainer.style.display = 'none';
    if (dayContainer) dayContainer.style.display = 'block';
    renderDailyAgenda(selectedDateStr, itemsByDate[selectedDateStr] || []);
  }

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}

function renderMonthGrid(year, month, itemsByDate) {
  const gridEl = document.getElementById('calendar-grid');
  if (!gridEl) return;

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const todayStr = new Date().toISOString().split('T')[0];
  let daysHTML = '';

  // Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthDays - i;
    const dateStr = formatDateString(year, month - 1, dayNum);
    daysHTML += renderDayCell(dayNum, dateStr, itemsByDate[dateStr] || [], true, false);
  }

  // Current month days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dateStr = formatDateString(year, month, d);
    const isToday = dateStr === todayStr;
    daysHTML += renderDayCell(d, dateStr, itemsByDate[dateStr] || [], false, isToday);
  }

  // Next month leading days to complete full 7-column rows (35 or 42 cells)
  const totalCellsSoFar = firstDayIndex + totalDaysInMonth;
  const targetCells = totalCellsSoFar <= 35 ? 35 : 42;
  const remainingCells = targetCells - totalCellsSoFar;
  for (let d = 1; d <= remainingCells; d++) {
    const dateStr = formatDateString(year, month + 1, d);
    daysHTML += renderDayCell(d, dateStr, itemsByDate[dateStr] || [], true, false);
  }

  gridEl.innerHTML = daysHTML;

  // Add click handlers on day cells
  gridEl.querySelectorAll('.calendar-day-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      const dateStr = cell.dataset.date;
      openDayDetailsModal(dateStr, itemsByDate[dateStr] || []);
    });
  });
}

function renderDailyAgenda(dateStr, items) {
  const container = document.getElementById('calendar-day-agenda-list');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:var(--space-8);">
        <div class="empty-state-icon"><i data-lucide="calendar"></i></div>
        <h4 class="empty-state-title">Nenhum compromisso ou tarefa para este dia</h4>
        <p class="empty-state-desc">Você pode adicionar eventos, agendar provas ou vincular tarefas a esta data.</p>
        <button class="btn btn-primary btn-sm" id="btn-agenda-add-event-empty"><i data-lucide="plus"></i> Novo Evento</button>
      </div>
    `;

    const emptyBtn = document.getElementById('btn-agenda-add-event-empty');
    if (emptyBtn) emptyBtn.addEventListener('click', () => openEventModal(null, dateStr));
    return;
  }

  container.innerHTML = items.map(it => {
    const isTask = it.type === 'task';
    const isExam = it.type === 'exam';

    return `
      <div class="widget-item" style="padding:var(--space-4); margin-bottom:var(--space-2); background:var(--bg-card); border:1px solid var(--border-subtle); border-radius:var(--radius-md);">
        <div style="display:flex; align-items:center; gap:var(--space-3); flex:1;">
          ${isTask ? `
            <label class="task-checkbox-wrapper" style="cursor:pointer;" title="Concluir tarefa">
              <input type="checkbox" class="agenda-task-toggle" data-id="${it.item.id}" ${it.item.completed ? 'checked' : ''} style="display:none;">
              <span class="custom-checkbox">
                <i data-lucide="check" style="width:14px; height:14px;"></i>
              </span>
            </label>
          ` : `
            <span class="badge ${isExam ? 'badge-purple' : 'badge-warning'}">
              ${isExam ? 'Avaliação' : 'Evento'}
            </span>
          `}

          <div style="flex:1;">
            <strong style="font-size:0.95rem; ${isTask && it.item.completed ? 'text-decoration:line-through; color:var(--text-muted);' : ''}">${escapeHTML(it.title)}</strong>
            ${it.item.description ? `<p style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${escapeHTML(it.item.description)}</p>` : ''}
          </div>
        </div>

        <div>
          ${!isTask ? `
            <div style="display:flex; gap:2px;">
              <button class="btn-icon btn-agenda-edit-item" data-type="${it.type}" data-id="${it.item.id}" title="Editar">
                <i data-lucide="edit-2" style="width:14px; height:14px;"></i>
              </button>
              <button class="btn-icon btn-agenda-delete-item" data-type="${it.type}" data-id="${it.item.id}" title="Excluir">
                <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Agenda task toggle
  container.querySelectorAll('.agenda-task-toggle').forEach(chk => {
    chk.addEventListener('change', async () => {
      await db.tasks.toggleComplete(chk.dataset.id);
    });
  });

  // Agenda edit item
  container.querySelectorAll('.btn-agenda-edit-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.type;
      const id = btn.dataset.id;
      if (type === 'event') {
        const ev = await db.events.getById(id);
        if (ev) openEventModal(ev);
      }
    });
  });

  // Agenda delete item
  container.querySelectorAll('.btn-agenda-delete-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.type;
      const id = btn.dataset.id;
      showConfirmModal({
        title: 'Excluir Item',
        message: 'Deseja excluir este item da agenda?',
        confirmText: 'Excluir',
        danger: true,
        onConfirm: async () => {
          if (type === 'event') await db.events.delete(id);
          else if (type === 'exam') await db.exams.delete(id);
          showToast('Item excluído da agenda.', 'info');
        }
      });
    });
  });
}

function formatDateString(year, month, day) {
  const d = new Date(year, month, day);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function renderDayCell(dayNum, dateStr, items, isOtherMonth, isToday) {
  const maxPills = 3;
  const pillsToShow = items.slice(0, maxPills);
  const remainingCount = items.length - maxPills;

  return `
    <div class="calendar-day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}" data-date="${dateStr}">
      <div class="day-number">${dayNum}</div>
      <div class="calendar-events-preview">
        ${pillsToShow.map(it => {
          const pillClass = it.type === 'task' ? 'event-pill-task' : it.type === 'exam' ? 'event-pill-exam' : 'event-pill-event';
          return `<div class="event-pill ${pillClass}" title="${escapeHTML(it.title)}">${escapeHTML(it.title)}</div>`;
        }).join('')}
        ${remainingCount > 0 ? `<div style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">+${remainingCount} mais</div>` : ''}
      </div>
    </div>
  `;
}

function openDayDetailsModal(dateStr, items) {
  const modal = document.getElementById('calendar-day-modal');
  if (!modal) return;

  document.getElementById('cal-day-modal-title').textContent = formatDate(dateStr, 'full');
  document.getElementById('cal-day-modal-date').value = dateStr;

  const container = document.getElementById('cal-day-items-list');

  if (items.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:16px;">Nenhum compromisso, prova ou tarefa para este dia.</p>';
  } else {
    container.innerHTML = items.map(it => {
      const badge = it.type === 'task' ? '<span class="badge badge-low">Tarefa</span>' : it.type === 'exam' ? '<span class="badge badge-purple">Avaliação</span>' : '<span class="badge badge-warning">Evento</span>';
      return `
        <div class="widget-item" style="margin-bottom:8px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              ${badge}
              <strong style="font-size:0.9rem;">${escapeHTML(it.title)}</strong>
            </div>
          </div>
          ${it.type === 'event' ? `
            <button class="btn-icon btn-del-cal-event" data-id="${it.item.id}" title="Excluir evento">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          ` : ''}
        </div>
      `;
    }).join('');

    if (window.lucide && window.lucide.createIcons) {
      window.lucide.createIcons();
    }

    container.querySelectorAll('.btn-del-cal-event').forEach(btn => {
      btn.addEventListener('click', async () => {
        await db.events.delete(btn.dataset.id);
        modal.classList.remove('active');
        renderCalendar();
        showToast('Evento excluído.', 'info');
      });
    });
  }

  modal.classList.add('active');
}

export function openEventModal(event = null, defaultDate = null) {
  const modal = document.getElementById('calendar-event-modal');
  const form = document.getElementById('calendar-event-form');
  const titleEl = document.getElementById('calendar-event-modal-title');
  if (!modal || !form) return;

  form.reset();
  const idInput = document.getElementById('cal-event-id');
  const titleInput = document.getElementById('cal-event-title');
  const dateInput = document.getElementById('cal-event-date');
  const descInput = document.getElementById('cal-event-description');

  if (event) {
    if (titleEl) titleEl.textContent = 'Editar Evento';
    if (idInput) idInput.value = event.id;
    titleInput.value = event.title || '';
    dateInput.value = event.date || '';
    descInput.value = event.description || '';
  } else {
    if (titleEl) titleEl.textContent = 'Novo Evento';
    if (idInput) idInput.value = '';
    dateInput.value = defaultDate || new Date().toISOString().split('T')[0];
  }

  modal.classList.add('active');
  titleInput.focus();
}

async function handleEventFormSubmit(e) {
  e.preventDefault();
  const idInput = document.getElementById('cal-event-id');
  const id = idInput ? idInput.value : '';
  const title = document.getElementById('cal-event-title').value.trim();
  const date = document.getElementById('cal-event-date').value;
  const description = document.getElementById('cal-event-description').value.trim();

  if (!title || !date) {
    showToast('Informe o título e a data do evento.', 'error');
    return;
  }

  if (id) {
    await db.events.update(id, { title, date, description });
    showToast('Evento atualizado com sucesso!', 'success');
  } else {
    await db.events.create({ title, date, description });
    showToast('Evento adicionado ao calendário!', 'success');
  }

  document.getElementById('calendar-event-modal').classList.remove('active');
}
