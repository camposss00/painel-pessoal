import { LocalStorageAdapter } from './local-storage-adapter.js';

// Central Database Service with Event Pub/Sub
class Database {
  constructor(adapter) {
    this.adapter = adapter;
    this.listeners = new Map();
  }

  // Pub/Sub for cross-module reactivity
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const filtered = this.listeners.get(event).filter(cb => cb !== callback);
    this.listeners.set(event, filtered);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Erro ao disparar evento ${event}:`, e);
        }
      });
    }
  }

  // 1. Tasks Repository
  get tasks() {
    return {
      getAll: async () => this.adapter.getAll('tasks'),
      getById: async (id) => this.adapter.getById('tasks', id),
      create: async (task) => {
        const itemToCreate = {
          completed: false,
          priority: 'medium',
          recurrence: 'none', // none, daily, weekly, monthly
          category: 'Geral',
          ...task
        };
        const created = await this.adapter.create('tasks', itemToCreate);
        this.emit('tasks:changed', { action: 'create', item: created });
        return created;
      },
      update: async (id, updates) => {
        const updated = await this.adapter.update('tasks', id, updates);
        this.emit('tasks:changed', { action: 'update', item: updated });
        return updated;
      },
      delete: async (id) => {
        const deleted = await this.adapter.delete('tasks', id);
        this.emit('tasks:changed', { action: 'delete', id });
        return deleted;
      },
      toggleComplete: async (id) => {
        const task = await this.adapter.getById('tasks', id);
        if (!task) return null;
        const updated = await this.adapter.update('tasks', id, { completed: !task.completed });
        this.emit('tasks:changed', { action: 'toggle', item: updated });
        return updated;
      }
    };
  }

  // 2. Studies (Subjects, Exams, StudySessions)
  get subjects() {
    return {
      getAll: async () => this.adapter.getAll('subjects'),
      getById: async (id) => this.adapter.getById('subjects', id),
      create: async (subject) => {
        const created = await this.adapter.create('subjects', {
          grades: [],
          ...subject
        });
        this.emit('subjects:changed', { action: 'create', item: created });
        return created;
      },
      update: async (id, updates) => {
        const updated = await this.adapter.update('subjects', id, updates);
        this.emit('subjects:changed', { action: 'update', item: updated });
        return updated;
      },
      delete: async (id) => {
        const deleted = await this.adapter.delete('subjects', id);
        this.emit('subjects:changed', { action: 'delete', id });
        return deleted;
      },
      addGrade: async (id, grade) => {
        const subject = await this.adapter.getById('subjects', id);
        if (!subject) throw new Error('Matéria não encontrada');
        const grades = Array.isArray(subject.grades) ? [...subject.grades, grade] : [grade];
        const updated = await this.adapter.update('subjects', id, { grades });
        this.emit('subjects:changed', { action: 'grade_added', item: updated });
        return updated;
      },
      removeGrade: async (id, gradeIndex) => {
        const subject = await this.adapter.getById('subjects', id);
        if (!subject) throw new Error('Matéria não encontrada');
        const grades = (subject.grades || []).filter((_, idx) => idx !== gradeIndex);
        const updated = await this.adapter.update('subjects', id, { grades });
        this.emit('subjects:changed', { action: 'grade_removed', item: updated });
        return updated;
      }
    };
  }

  get exams() {
    return {
      getAll: async () => this.adapter.getAll('exams'),
      getById: async (id) => this.adapter.getById('exams', id),
      create: async (exam) => {
        const itemToCreate = {
          type: 'prova',
          ...exam
        };
        const created = await this.adapter.create('exams', itemToCreate);
        this.emit('exams:changed', { action: 'create', item: created });
        return created;
      },
      update: async (id, updates) => {
        const updated = await this.adapter.update('exams', id, updates);
        this.emit('exams:changed', { action: 'update', item: updated });
        return updated;
      },
      delete: async (id) => {
        const deleted = await this.adapter.delete('exams', id);
        this.emit('exams:changed', { action: 'delete', id });
        return deleted;
      }
    };
  }

  get studySessions() {
    return {
      getAll: async () => this.adapter.getAll('studySessions'),
      create: async (session) => {
        const itemToCreate = {
          minutes: 0,
          ...session
        };
        const created = await this.adapter.create('studySessions', itemToCreate);
        this.emit('studySessions:changed', { action: 'create', item: created });
        return created;
      },
      delete: async (id) => {
        const deleted = await this.adapter.delete('studySessions', id);
        this.emit('studySessions:changed', { action: 'delete', id });
        return deleted;
      }
    };
  }

  // 3. Projects Repository
  get projects() {
    return {
      getAll: async () => this.adapter.getAll('projects'),
      getById: async (id) => this.adapter.getById('projects', id),
      create: async (project) => {
        const created = await this.adapter.create('projects', {
          status: 'ideia',
          priority: 'medium',
          deadline: '',
          tasks: [],
          ...project
        });
        this.emit('projects:changed', { action: 'create', item: created });
        return created;
      },
      update: async (id, updates) => {
        const updated = await this.adapter.update('projects', id, updates);
        this.emit('projects:changed', { action: 'update', item: updated });
        return updated;
      },
      delete: async (id) => {
        const deleted = await this.adapter.delete('projects', id);
        this.emit('projects:changed', { action: 'delete', id });
        return deleted;
      }
    };
  }

  // 4. Finance Repository
  get transactions() {
    return {
      getAll: async () => this.adapter.getAll('transactions'),
      getById: async (id) => this.adapter.getById('transactions', id),
      create: async (transaction) => {
        const itemToCreate = {
          type: 'expense',
          amount: 0,
          category: 'Outros',
          ...transaction
        };
        const created = await this.adapter.create('transactions', itemToCreate);
        this.emit('transactions:changed', { action: 'create', item: created });
        return created;
      },
      update: async (id, updates) => {
        const updated = await this.adapter.update('transactions', id, updates);
        this.emit('transactions:changed', { action: 'update', item: updated });
        return updated;
      },
      delete: async (id) => {
        const deleted = await this.adapter.delete('transactions', id);
        this.emit('transactions:changed', { action: 'delete', id });
        return deleted;
      }
    };
  }

  // 5. Events & Calendar Repository
  get events() {
    return {
      getAll: async () => this.adapter.getAll('events'),
      getById: async (id) => this.adapter.getById('events', id),
      create: async (event) => {
        const created = await this.adapter.create('events', event);
        this.emit('events:changed', { action: 'create', item: created });
        return created;
      },
      update: async (id, updates) => {
        const updated = await this.adapter.update('events', id, updates);
        this.emit('events:changed', { action: 'update', item: updated });
        return updated;
      },
      delete: async (id) => {
        const deleted = await this.adapter.delete('events', id);
        this.emit('events:changed', { action: 'delete', id });
        return deleted;
      }
    };
  }

  // 6. Habits Repository (New)
  get habits() {
    return {
      getAll: async () => this.adapter.getAll('habits'),
      getById: async (id) => this.adapter.getById('habits', id),
      create: async (habit) => {
        const itemToCreate = {
          name: '',
          frequency: 'daily',
          category: 'Saúde',
          history: [], // list of 'YYYY-MM-DD'
          streak: 0,
          bestStreak: 0,
          ...habit
        };
        const created = await this.adapter.create('habits', itemToCreate);
        this.emit('habits:changed', { action: 'create', item: created });
        return created;
      },
      update: async (id, updates) => {
        const updated = await this.adapter.update('habits', id, updates);
        this.emit('habits:changed', { action: 'update', item: updated });
        return updated;
      },
      delete: async (id) => {
        const deleted = await this.adapter.delete('habits', id);
        this.emit('habits:changed', { action: 'delete', id });
        return deleted;
      },
      toggleDay: async (id, dateStr) => {
        const habit = await this.adapter.getById('habits', id);
        if (!habit) return null;
        let history = Array.isArray(habit.history) ? [...habit.history] : [];
        if (history.includes(dateStr)) {
          history = history.filter(d => d !== dateStr);
        } else {
          history.push(dateStr);
        }
        history.sort();

        // Calculate current streak
        const streak = calculateHabitStreak(history);
        const bestStreak = Math.max(habit.bestStreak || 0, streak);

        const updated = await this.adapter.update('habits', id, { history, streak, bestStreak });
        this.emit('habits:changed', { action: 'toggleDay', item: updated });
        return updated;
      }
    };
  }

  // 7. Goals Repository (New)
  get goals() {
    return {
      getAll: async () => this.adapter.getAll('goals'),
      getById: async (id) => this.adapter.getById('goals', id),
      create: async (goal) => {
        const itemToCreate = {
          title: '',
          description: '',
          category: 'Geral',
          deadline: '',
          status: 'active', // active, completed, paused
          milestones: [],
          progress: 0,
          ...goal
        };
        const created = await this.adapter.create('goals', itemToCreate);
        this.emit('goals:changed', { action: 'create', item: created });
        return created;
      },
      update: async (id, updates) => {
        const updated = await this.adapter.update('goals', id, updates);
        this.emit('goals:changed', { action: 'update', item: updated });
        return updated;
      },
      delete: async (id) => {
        const deleted = await this.adapter.delete('goals', id);
        this.emit('goals:changed', { action: 'delete', id });
        return deleted;
      },
      toggleMilestone: async (goalId, milestoneId) => {
        const goal = await this.adapter.getById('goals', goalId);
        if (!goal) return null;
        const milestones = (goal.milestones || []).map(m => {
          if (m.id === milestoneId) return { ...m, completed: !m.completed };
          return m;
        });
        const completedCount = milestones.filter(m => m.completed).length;
        const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;
        const status = progress === 100 ? 'completed' : (goal.status === 'completed' ? 'active' : goal.status);

        const updated = await this.adapter.update('goals', goalId, { milestones, progress, status });
        this.emit('goals:changed', { action: 'toggleMilestone', item: updated });
        return updated;
      }
    };
  }

  // 8. Notes Repository (New)
  get notes() {
    return {
      getAll: async () => this.adapter.getAll('notes'),
      getById: async (id) => this.adapter.getById('notes', id),
      create: async (note) => {
        const itemToCreate = {
          title: '',
          content: '',
          category: 'Ideias',
          pinned: false,
          ...note
        };
        const created = await this.adapter.create('notes', itemToCreate);
        this.emit('notes:changed', { action: 'create', item: created });
        return created;
      },
      update: async (id, updates) => {
        const updated = await this.adapter.update('notes', id, updates);
        this.emit('notes:changed', { action: 'update', item: updated });
        return updated;
      },
      delete: async (id) => {
        const deleted = await this.adapter.delete('notes', id);
        this.emit('notes:changed', { action: 'delete', id });
        return deleted;
      },
      togglePin: async (id) => {
        const note = await this.adapter.getById('notes', id);
        if (!note) return null;
        const updated = await this.adapter.update('notes', id, { pinned: !note.pinned });
        this.emit('notes:changed', { action: 'togglePin', item: updated });
        return updated;
      }
    };
  }

  // 9. Settings Repository (New)
  get settings() {
    return {
      get: async () => this.adapter.getSettings(),
      save: async (settings) => {
        const updated = await this.adapter.saveSettings(settings);
        this.emit('settings:changed', updated);
        return updated;
      },
      clearAllData: async () => {
        await this.adapter.clearAll();
        this.emit('data:cleared', null);
        return true;
      }
    };
  }

  // 10. Backup Service
  get backup() {
    return {
      exportAll: async () => this.adapter.exportAll(),
      importAll: async (data) => {
        const result = await this.adapter.importAll(data);
        this.emit('data:imported', null);
        return result;
      }
    };
  }
}

// Helper: Calculate streak of consecutive days
function calculateHabitStreak(historyDates = []) {
  if (!historyDates || historyDates.length === 0) return 0;
  const dateSet = new Set(historyDates);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Streak must connect to today or yesterday to be active
  let checkDate = new Date(dateSet.has(todayStr) ? today : (dateSet.has(yesterdayStr) ? yesterday : null));
  if (!checkDate || isNaN(checkDate.getTime())) return 0;

  let streak = 0;
  while (true) {
    const dStr = checkDate.toISOString().split('T')[0];
    if (dateSet.has(dStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

// Instantiate with LocalStorageAdapter
export const db = new Database(new LocalStorageAdapter());
