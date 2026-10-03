/**
 * StorageInterface - Abstract contract for data providers.
 * 
 * To migrate to Firebase/Firestore in the future:
 * 1. Implement this interface in `firebase-adapter.js` using `getDocs`, `addDoc`, `updateDoc`, `deleteDoc`.
 * 2. In `db.js`, swap `new LocalStorageAdapter()` with `new FirebaseAdapter()`.
 * All UI modules and application code remain 100% unchanged!
 */

export class StorageInterface {
  async getAll(collection) {
    throw new Error('Method getAll() not implemented.');
  }

  async getById(collection, id) {
    throw new Error('Method getById() not implemented.');
  }

  async create(collection, item) {
    throw new Error('Method create() not implemented.');
  }

  async update(collection, id, updates) {
    throw new Error('Method update() not implemented.');
  }

  async delete(collection, id) {
    throw new Error('Method delete() not implemented.');
  }

  async clear(collection) {
    throw new Error('Method clear() not implemented.');
  }

  async exportAll() {
    throw new Error('Method exportAll() not implemented.');
  }

  async importAll(data) {
    throw new Error('Method importAll() not implemented.');
  }
}
