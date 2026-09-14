// Native IndexedDB Offline Caching Layer for AIChatBot
// Zero external dependencies - uses standard browser window.indexedDB

const DB_NAME = 'aichatbot_offline_cache';
const DB_VERSION = 1;

class DBService {
  constructor() {
    this.db = null;
    this.isSupported = typeof window !== 'undefined' && 'indexedDB' in window;
    this.memStore = {
      conversations: new Map(),
      messages: new Map(),
      outbox: new Map(),
      outboxIdCounter: 1,
    };
  }

  async openDB() {
    if (!this.isSupported) return null;
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Conversations Store
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: '_id' });
          convStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // Messages Store
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: '_id' });
          msgStore.createIndex('conversation', 'conversation', { unique: false });
          msgStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Outbox Store (pending messages queued while offline)
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
          outboxStore.createIndex('conversationId', 'conversationId', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.warn('[IndexedDB] Database open error:', event.target.error);
        resolve(null);
      };
    });
  }

  // Helper for running transactions
  async getTransaction(storeName, mode = 'readonly') {
    const db = await this.openDB();
    if (!db) return null;
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  // --- CONVERSATIONS ---
  async saveConversations(conversations) {
    if (!Array.isArray(conversations)) return;

    if (!this.isSupported) {
      conversations.forEach((c) => {
        if (c && c._id) this.memStore.conversations.set(c._id, c);
      });
      return;
    }

    try {
      const store = await this.getTransaction('conversations', 'readwrite');
      if (!store) return;

      for (const conv of conversations) {
        if (conv && conv._id) {
          store.put(conv);
        }
      }
    } catch (err) {
      console.warn('[IndexedDB] saveConversations error:', err);
    }
  }

  async getConversations() {
    if (!this.isSupported) {
      return Array.from(this.memStore.conversations.values());
    }

    try {
      const store = await this.getTransaction('conversations', 'readonly');
      if (!store) return [];

      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const list = request.result || [];
          // Sort by updatedAt descending
          list.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
          resolve(list);
        };
        request.onerror = () => resolve([]);
      });
    } catch (err) {
      console.warn('[IndexedDB] getConversations error:', err);
      return [];
    }
  }

  async saveConversation(conv) {
    if (!conv || !conv._id) return;

    if (!this.isSupported) {
      this.memStore.conversations.set(conv._id, conv);
      return;
    }

    try {
      const store = await this.getTransaction('conversations', 'readwrite');
      if (store) store.put(conv);
    } catch (err) {
      console.warn('[IndexedDB] saveConversation error:', err);
    }
  }

  // --- MESSAGES ---
  async saveMessages(conversationId, messages) {
    if (!Array.isArray(messages)) return;

    if (!this.isSupported) {
      messages.forEach((m) => {
        if (m && m._id) this.memStore.messages.set(m._id, { ...m, conversation: conversationId });
      });
      return;
    }

    try {
      const store = await this.getTransaction('messages', 'readwrite');
      if (!store) return;

      for (const msg of messages) {
        if (msg && msg._id) {
          store.put({
            ...msg,
            conversation: msg.conversation || conversationId,
          });
        }
      }
    } catch (err) {
      console.warn('[IndexedDB] saveMessages error:', err);
    }
  }

  async getMessages(conversationId) {
    if (!conversationId) return [];

    if (!this.isSupported) {
      const list = Array.from(this.memStore.messages.values()).filter(
        (m) => m.conversation === conversationId
      );
      list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      return list;
    }

    try {
      const store = await this.getTransaction('messages', 'readonly');
      if (!store) return [];

      return new Promise((resolve) => {
        const index = store.index('conversation');
        const request = index.getAll(conversationId);
        request.onsuccess = () => {
          const list = request.result || [];
          list.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
          resolve(list);
        };
        request.onerror = () => resolve([]);
      });
    } catch (err) {
      console.warn('[IndexedDB] getMessages error:', err);
      return [];
    }
  }

  async saveSingleMessage(message) {
    if (!message || !message._id) return;

    if (!this.isSupported) {
      this.memStore.messages.set(message._id, message);
      return;
    }

    try {
      const store = await this.getTransaction('messages', 'readwrite');
      if (store) store.put(message);
    } catch (err) {
      console.warn('[IndexedDB] saveSingleMessage error:', err);
    }
  }

  // --- OUTBOX (Offline Message Queue) ---
  async queueOutboxMessage(messageData) {
    const record = {
      ...messageData,
      queuedAt: new Date().toISOString(),
      status: 'queued',
    };

    if (!this.isSupported) {
      const id = this.memStore.outboxIdCounter++;
      record.id = id;
      this.memStore.outbox.set(id, record);
      return id;
    }

    try {
      const store = await this.getTransaction('outbox', 'readwrite');
      if (!store) return null;

      return new Promise((resolve) => {
        const request = store.add(record);
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => resolve(null);
      });
    } catch (err) {
      console.warn('[IndexedDB] queueOutboxMessage error:', err);
      return null;
    }
  }

  async getOutboxMessages() {
    if (!this.isSupported) {
      return Array.from(this.memStore.outbox.values());
    }

    try {
      const store = await this.getTransaction('outbox', 'readonly');
      if (!store) return [];

      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch (err) {
      console.warn('[IndexedDB] getOutboxMessages error:', err);
      return [];
    }
  }

  async removeOutboxMessage(id) {
    if (!id) return;

    if (!this.isSupported) {
      this.memStore.outbox.delete(id);
      return;
    }

    try {
      const store = await this.getTransaction('outbox', 'readwrite');
      if (!store) return;

      return new Promise((resolve) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve(true);
        request.onerror = () => resolve(false);
      });
    } catch (err) {
      console.warn('[IndexedDB] removeOutboxMessage error:', err);
    }
  }

  async clearOutbox() {
    if (!this.isSupported) {
      this.memStore.outbox.clear();
      return;
    }

    try {
      const store = await this.getTransaction('outbox', 'readwrite');
      if (store) store.clear();
    } catch (err) {
      console.warn('[IndexedDB] clearOutbox error:', err);
    }
  }

  async clearAllCache() {
    this.memStore.conversations.clear();
    this.memStore.messages.clear();
    this.memStore.outbox.clear();

    if (!this.isSupported) return;

    try {
      const db = await this.openDB();
      if (!db) return;
      const tx = db.transaction(['conversations', 'messages', 'outbox'], 'readwrite');
      tx.objectStore('conversations').clear();
      tx.objectStore('messages').clear();
      tx.objectStore('outbox').clear();
    } catch (err) {
      console.warn('[IndexedDB] clearAllCache error:', err);
    }
  }
}

const dbService = new DBService();
export default dbService;
