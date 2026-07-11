/**
 * SyncManager
 * Exposes API to queue database transactions while offline
 * and automatically drains the queue once back online.
 */

class SyncManager {
  constructor() {
    this.queueKey = 'booklyn_reads_sync_queue';
    this.simulatedOfflineKey = 'booklyn_reads_simulated_offline';
    this.subscribers = new Set();
    
    // Bind network events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());
    }
  }

  isOnline() {
    if (typeof window === 'undefined') return false;
    const isSimulatedOffline = localStorage.getItem(this.simulatedOfflineKey) === 'true';
    return navigator.onLine && !isSimulatedOffline;
  }

  setSimulatedOffline(status) {
    localStorage.setItem(this.simulatedOfflineKey, String(status));
    this.handleNetworkChange();
  }

  getSimulatedOffline() {
    return localStorage.getItem(this.simulatedOfflineKey) === 'true';
  }

  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(this.queueKey) || '[]');
    } catch {
      return [];
    }
  }

  saveQueue(queue) {
    localStorage.setItem(this.queueKey, JSON.stringify(queue));
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    // Initial call
    callback(this.getStatus());
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const status = this.getStatus();
    this.subscribers.forEach(cb => cb(status));
  }

  getStatus() {
    const online = this.isOnline();
    const queue = this.getQueue();
    return {
      online,
      isSimulated: localStorage.getItem(this.simulatedOfflineKey) === 'true',
      queueLength: queue.length,
      statusText: !online 
        ? 'Offline Mode (Saved Locally)' 
        : queue.length > 0 
          ? 'Reconnecting & Syncing...' 
          : 'Connected & Synced'
    };
  }

  /**
   * Queue a database action
   * @param {string} store 'books' | 'logs'
   * @param {string} action 'add' | 'update' | 'delete'
   * @param {object} payload data required for action
   */
  queueMutation(store, action, payload) {
    const queue = this.getQueue();
    const newMutation = {
      id: 'mutation-' + Math.random().toString(36).substr(2, 9),
      store,
      action,
      payload,
      timestamp: new Date().toISOString()
    };
    queue.push(newMutation);
    this.saveQueue(queue);
    this.notify();
    
    // If online, immediately process
    if (this.isOnline()) {
      this.flushQueue();
    }
  }

  async handleNetworkChange() {
    this.notify();
    if (this.isOnline()) {
      await this.flushQueue();
    }
  }

  async flushQueue() {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    // Prevent concurrent flush loops
    if (this.isFlushing) return;
    this.isFlushing = true;
    this.notify();

    // Import stores dynamically or map actions to database service
    // We import dbService here to prevent circular dependencies
    const { dbService } = await import('./db');
    const { useLibraryStore } = await import('../store/useLibraryStore');
    const { useProgressStore } = await import('../store/useProgressStore');

    let remainingQueue = [...queue];

    for (const mutation of queue) {
      if (!this.isOnline()) {
        // Network was lost again, stop processing
        break;
      }

      try {
        const { store, action, payload } = mutation;
        
        if (store === 'books') {
          if (action === 'add') {
            await dbService.books.addBook(payload);
          } else if (action === 'update') {
            await dbService.books.updateBook(payload.id, payload.updates);
          } else if (action === 'delete') {
            await dbService.books.deleteBook(payload.id);
          }
        } else if (store === 'logs') {
          if (action === 'add') {
            await dbService.logs.addLog(payload);
          } else if (action === 'delete') {
            await dbService.logs.deleteLog(payload.id);
          }
        } else if (store === 'goals') {
          if (action === 'update') {
            await dbService.goals.updateGoals(payload);
          }
        }

        // Successfully processed, remove from queue
        remainingQueue = remainingQueue.filter(m => m.id !== mutation.id);
        this.saveQueue(remainingQueue);
        this.notify();
      } catch (err) {
        console.error('Error syncing mutation:', mutation, err);
        // If it's a structural error (e.g. invalid arguments), we discard it.
        // If it's a network error, break and retry later.
        if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('network'))) {
          break;
        }
        remainingQueue = remainingQueue.filter(m => m.id !== mutation.id);
        this.saveQueue(remainingQueue);
        this.notify();
      }
    }

    this.isFlushing = false;
    
    // Refresh visual state inside the Zustand stores to ensure complete sync
    try {
      await useLibraryStore.getState().fetchBooks();
      await useProgressStore.getState().fetchLogs();
    } catch (e) {
      console.warn('Post-sync refresh failed', e);
    }
    
    this.notify();
  }
}

export const syncManager = new SyncManager();
