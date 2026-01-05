/**
 * Order Queue Service
 * Persiste órdenes en IndexedDB para sincronización offline
 *
 * Features:
 * - Persistencia local con IndexedDB
 * - Sistema de suscripción para UI reactivo
 * - CRUD completo de órdenes en cola
 */

const DB_NAME = 'qraxer_order_queue';
const DB_VERSION = 1;
const STORE_ORDERS = 'orders';

// Generar ID único para órdenes locales
const generateLocalId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `queue-${timestamp}-${random}`;
};

// Generar ID temporal para mostrar al usuario
const generateTempDisplayId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'TMP-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Generar idempotency key basada en datos de la orden
export const generateIdempotencyKey = (orderData) => {
  const unique = [
    orderData.client?.phone || 'no-phone',
    orderData.equipment?.model || 'no-model',
    orderData.equipment?.serial || 'no-serial',
    orderData.branchId || 'no-branch',
    new Date().toISOString().split('T')[0], // Solo fecha
  ].join('|');

  // Crear hash simple con btoa
  try {
    return 'idem-' + btoa(unique).replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  } catch {
    // Fallback si btoa falla
    return 'idem-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  }
};

class OrderQueueService {
  constructor() {
    this.db = null;
    this.listeners = new Set();
    this.initialized = false;
    this.initPromise = null;
  }

  /**
   * Inicializar IndexedDB
   */
  async init() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      console.log('[OrderQueue] Initializing IndexedDB...');

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OrderQueue] Error opening IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        console.log('[OrderQueue] IndexedDB initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log('[OrderQueue] Creating/upgrading database schema');
        const db = event.target.result;

        // Crear store de órdenes
        if (!db.objectStoreNames.contains(STORE_ORDERS)) {
          const store = db.createObjectStore(STORE_ORDERS, { keyPath: 'localId' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('idempotencyKey', 'idempotencyKey', { unique: true });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Agregar orden a la cola
   * @param {Object} orderData - Datos de la orden
   * @returns {Object} - Orden con localId y tempDisplayId
   */
  async addOrder(orderData) {
    await this.init();

    const now = new Date().toISOString();
    const localId = generateLocalId();
    const tempDisplayId = generateTempDisplayId();
    const idempotencyKey = generateIdempotencyKey(orderData);

    const queuedOrder = {
      localId,
      tempDisplayId,
      idempotencyKey,

      status: 'pending', // pending | syncing | synced | failed
      attemptCount: 0,
      maxAttempts: 5,

      createdAt: now,
      lastAttemptAt: null,
      syncedAt: null,

      lastError: null,
      errorType: null, // network | server | validation | conflict

      // IDs de Odoo (después de sync)
      serverId: null,
      serverName: null,
      serverClientId: null,

      // Datos de la orden (inmutables)
      orderData: { ...orderData },
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ORDERS], 'readwrite');
      const store = transaction.objectStore(STORE_ORDERS);
      const request = store.add(queuedOrder);

      request.onsuccess = () => {
        console.log('[OrderQueue] Order added:', localId);
        this.notifyListeners();
        resolve(queuedOrder);
      };

      request.onerror = () => {
        console.error('[OrderQueue] Error adding order:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Actualizar estado de una orden
   */
  async updateOrderStatus(localId, status, extras = {}) {
    await this.init();

    const order = await this.getOrder(localId);
    if (!order) {
      console.warn('[OrderQueue] Order not found for update:', localId);
      return null;
    }

    const updated = {
      ...order,
      status,
      ...extras,
    };

    // Actualizar timestamps según status
    if (status === 'syncing') {
      updated.lastAttemptAt = new Date().toISOString();
      updated.attemptCount = (order.attemptCount || 0) + 1;
    } else if (status === 'synced') {
      updated.syncedAt = new Date().toISOString();
      updated.lastError = null;
      updated.errorType = null;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ORDERS], 'readwrite');
      const store = transaction.objectStore(STORE_ORDERS);
      const request = store.put(updated);

      request.onsuccess = () => {
        console.log('[OrderQueue] Order updated:', localId, status);
        this.notifyListeners();
        resolve(updated);
      };

      request.onerror = () => {
        console.error('[OrderQueue] Error updating order:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Obtener una orden por localId
   */
  async getOrder(localId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ORDERS], 'readonly');
      const store = transaction.objectStore(STORE_ORDERS);
      const request = store.get(localId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtener órdenes pendientes (pending o failed con intentos restantes)
   */
  async getPendingOrders() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ORDERS], 'readonly');
      const store = transaction.objectStore(STORE_ORDERS);
      const request = store.getAll();

      request.onsuccess = () => {
        const orders = request.result || [];
        const pending = orders.filter(o =>
          o.status === 'pending' ||
          (o.status === 'failed' && o.attemptCount < o.maxAttempts)
        );
        // Ordenar por fecha de creación (más antiguas primero)
        pending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        resolve(pending);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtener todas las órdenes
   */
  async getAllOrders() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ORDERS], 'readonly');
      const store = transaction.objectStore(STORE_ORDERS);
      const request = store.getAll();

      request.onsuccess = () => {
        const orders = request.result || [];
        // Ordenar por fecha (más recientes primero)
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        resolve(orders);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Eliminar una orden de la cola
   */
  async removeOrder(localId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_ORDERS], 'readwrite');
      const store = transaction.objectStore(STORE_ORDERS);
      const request = store.delete(localId);

      request.onsuccess = () => {
        console.log('[OrderQueue] Order removed:', localId);
        this.notifyListeners();
        resolve(true);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Limpiar órdenes sincronizadas (más de 24 horas)
   */
  async cleanSyncedOrders(maxAgeMs = 24 * 60 * 60 * 1000) {
    const orders = await this.getAllOrders();
    const now = Date.now();

    for (const order of orders) {
      if (order.status === 'synced' && order.syncedAt) {
        const syncedTime = new Date(order.syncedAt).getTime();
        if (now - syncedTime > maxAgeMs) {
          await this.removeOrder(order.localId);
        }
      }
    }
  }

  /**
   * Resetear órdenes que quedaron en 'syncing' (app cerrada durante sync)
   */
  async resetStuckOrders() {
    await this.init();

    const orders = await this.getAllOrders();
    let resetCount = 0;

    for (const order of orders) {
      if (order.status === 'syncing') {
        await this.updateOrderStatus(order.localId, 'pending', {
          lastError: 'Sync interrumpido - reintentando',
        });
        resetCount++;
      }
    }

    if (resetCount > 0) {
      console.log('[OrderQueue] Reset', resetCount, 'stuck orders');
    }

    return resetCount;
  }

  /**
   * Obtener estadísticas de la cola
   */
  async getStats() {
    const orders = await this.getAllOrders();

    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      syncing: orders.filter(o => o.status === 'syncing').length,
      synced: orders.filter(o => o.status === 'synced').length,
      failed: orders.filter(o => o.status === 'failed').length,
    };
  }

  /**
   * Suscribirse a cambios en la cola
   * @param {Function} callback - Función a llamar cuando cambie la cola
   * @returns {Function} - Función para desuscribirse
   */
  subscribe(callback) {
    this.listeners.add(callback);

    // Notificar inmediatamente con estado actual
    this.getAllOrders().then(orders => callback(orders));

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notificar a todos los suscriptores
   */
  async notifyListeners() {
    const orders = await this.getAllOrders();
    this.listeners.forEach(callback => {
      try {
        callback(orders);
      } catch (e) {
        console.error('[OrderQueue] Error in listener:', e);
      }
    });
  }
}

export const orderQueue = new OrderQueueService();
