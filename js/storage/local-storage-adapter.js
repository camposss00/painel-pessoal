import { StorageInterface } from './storage-interface.js';
import { generateId } from '../utils/helpers.js';

const STORAGE_PREFIX = 'painel_pessoal_';
const ALL_COLLECTIONS = [
  'tasks',
  'subjects',
  'exams',
  'studySessions',
  'projects',
  'transactions',
  'events',
  'habits',
  'goals',
  'notes',
  'settings'
];

export class LocalStorageAdapter extends StorageInterface {
  constructor() {
    super();
  }

  _getKey(collection) {
    return `${STORAGE_PREFIX}${collection}`;
  }

  _readCollection(collection) {
    try {
      const raw = localStorage.getItem(this._getKey(collection));
      if (!raw) {
        // Settings default to an object, others to an array
        return collection === 'settings' ? {} : [];
      }
      const parsed = JSON.parse(raw);
      if (collection === 'settings') {
        return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
      }
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error(`Erro ao ler coleção ${collection} do localStorage:`, e);
      return collection === 'settings' ? {} : [];
    }
  }

  _saveCollection(collection, data) {
    try {
      localStorage.setItem(this._getKey(collection), JSON.stringify(data));
      return true;
    } catch (e) {
      console.error(`Erro ao salvar coleção ${collection} no localStorage:`, e);
      throw new Error('Falha ao salvar dados no armazenamento local.');
    }
  }

  async getAll(collection) {
    return this._readCollection(collection);
  }

  async getById(collection, id) {
    const items = this._readCollection(collection);
    if (!Array.isArray(items)) return null;
    return items.find(item => item.id === id) || null;
  }

  async create(collection, item) {
    const items = this._readCollection(collection);
    const now = new Date().toISOString();
    
    const newItem = {
      ...item,
      id: item.id || generateId(),
      createdAt: item.createdAt || now,
      updatedAt: now
    };

    if (Array.isArray(items)) {
      items.unshift(newItem);
      this._saveCollection(collection, items);
    }
    return newItem;
  }

  async update(collection, id, updates) {
    const items = this._readCollection(collection);
    if (!Array.isArray(items)) {
      throw new Error(`Coleção ${collection} não suporta update por id`);
    }

    const index = items.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Item ${id} não encontrado na coleção ${collection}`);
    }

    const updatedItem = {
      ...items[index],
      ...updates,
      id: items[index].id,
      createdAt: items[index].createdAt,
      updatedAt: new Date().toISOString()
    };

    items[index] = updatedItem;
    this._saveCollection(collection, items);
    return updatedItem;
  }

  async delete(collection, id) {
    const items = this._readCollection(collection);
    if (!Array.isArray(items)) return false;
    const filtered = items.filter(item => item.id !== id);
    this._saveCollection(collection, filtered);
    return true;
  }

  async getSettings() {
    return this._readCollection('settings');
  }

  async saveSettings(settingsData) {
    const current = this._readCollection('settings');
    const updated = { ...current, ...settingsData, updatedAt: new Date().toISOString() };
    this._saveCollection('settings', updated);
    return updated;
  }

  async clear(collection) {
    localStorage.removeItem(this._getKey(collection));
    return true;
  }

  async clearAll() {
    for (const col of ALL_COLLECTIONS) {
      localStorage.removeItem(this._getKey(col));
    }
    return true;
  }

  async exportAll() {
    const exportData = {
      appName: 'Painel Pessoal',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      data: {}
    };

    for (const col of ALL_COLLECTIONS) {
      exportData.data[col] = this._readCollection(col);
    }

    return exportData;
  }

  async importAll(importedPayload) {
    if (!importedPayload || typeof importedPayload !== 'object') {
      throw new Error('Formato de backup inválido.');
    }

    const dataSource = (importedPayload.data && typeof importedPayload.data === 'object')
      ? importedPayload.data
      : importedPayload;

    let importedAny = false;
    for (const col of ALL_COLLECTIONS) {
      if (dataSource[col] !== undefined) {
        if (col === 'settings' && typeof dataSource[col] === 'object') {
          this._saveCollection(col, dataSource[col]);
          importedAny = true;
        } else if (Array.isArray(dataSource[col])) {
          this._saveCollection(col, dataSource[col]);
          importedAny = true;
        }
      }
    }

    if (!importedAny) {
      throw new Error('O arquivo não contém coleções de dados reconhecidas.');
    }

    return true;
  }
}
