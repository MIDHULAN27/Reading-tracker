// Promise-wrapped IndexedDB manager to store PDF blobs locally and bypass localStorage limits.
class PDFStore {
  constructor() {
    this.dbName = 'cozy_reads_pdfs';
    this.storeName = 'pdfs';
    this.version = 1;
    this.db = null;
  }

  // Opens the IndexedDB database, initializing stores if needed
  _openDB() {
    if (this.db) return Promise.resolve(this.db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        reject(new Error(`Failed to open IndexedDB: ${event.target.error?.message || 'Unknown error'}`));
      };
    });
  }

  /**
   * Save a raw binary Blob associated with a book ID
   * @param {string} bookId 
   * @param {Blob} blob 
   * @returns {Promise<boolean>}
   */
  async savePDF(bookId, blob) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(blob, bookId);

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(new Error(`Failed to save PDF: ${event.target.error?.message}`));
    });
  }

  /**
   * Retrieve a stored PDF Blob by book ID
   * @param {string} bookId 
   * @returns {Promise<Blob|null>}
   */
  async getPDF(bookId) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(bookId);

      request.onsuccess = (event) => resolve(event.target.result || null);
      request.onerror = (event) => reject(new Error(`Failed to retrieve PDF: ${event.target.error?.message}`));
    });
  }

  /**
   * Delete a stored PDF Blob by book ID
   * @param {string} bookId 
   * @returns {Promise<boolean>}
   */
  async deletePDF(bookId) {
    const db = await this._openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(bookId);

      request.onsuccess = () => resolve(true);
      request.onerror = (event) => reject(new Error(`Failed to delete PDF: ${event.target.error?.message}`));
    });
  }
}

export const pdfStore = new PDFStore();
