/**
 * Queue Processor Service
 * Sincroniza órdenes pendientes con el backend
 *
 * Features:
 * - Bloqueo anti-duplicados (marca 'syncing' antes de API call)
 * - Retry con backoff exponencial
 * - Manejo de errores por tipo
 * - Procesamiento automático al reconectar
 */

import { orderQueue } from './orderQueue';
import { api } from './api';

// Configuración de backoff
const BASE_DELAY_MS = 5000; // 5 segundos
const MAX_DELAY_MS = 300000; // 5 minutos
const JITTER_FACTOR = 0.2; // 20% de variación

class QueueProcessor {
  constructor() {
    this.isProcessing = false;
    this.processInterval = null;
    this.listeners = new Set();
  }

  /**
   * Calcular delay con backoff exponencial + jitter
   */
  calculateBackoff(attemptCount) {
    const delay = Math.min(
      BASE_DELAY_MS * Math.pow(2, attemptCount - 1),
      MAX_DELAY_MS
    );
    const jitter = delay * JITTER_FACTOR * Math.random();
    return delay + jitter;
  }

  /**
   * Verificar si una orden puede ser procesada (pasó el backoff)
   */
  canProcessOrder(order) {
    if (!order.lastAttemptAt) return true;

    const lastAttempt = new Date(order.lastAttemptAt).getTime();
    const backoffDelay = this.calculateBackoff(order.attemptCount);
    const nextAttemptTime = lastAttempt + backoffDelay;

    return Date.now() >= nextAttemptTime;
  }

  /**
   * Clasificar tipo de error
   */
  classifyError(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
      return 'network';
    }
    if (message.includes('401') || message.includes('unauthorized') || message.includes('sesion')) {
      return 'auth';
    }
    if (message.includes('400') || message.includes('validation') || message.includes('requerido')) {
      return 'validation';
    }
    if (message.includes('409') || message.includes('conflict') || message.includes('duplicado')) {
      return 'conflict';
    }
    return 'server';
  }

  /**
   * Sincronizar una orden individual
   * CRÍTICO: Verifica status antes de procesar para evitar duplicados
   */
  async syncOrder(order) {
    // BLOQUEO 1: Verificar que no esté ya sincronizando
    if (order.status === 'syncing') {
      console.log('[QueueProcessor] Order already syncing, skipping:', order.localId);
      return { skipped: true, reason: 'already_syncing' };
    }

    // BLOQUEO 2: Verificar que no haya excedido intentos
    if (order.attemptCount >= order.maxAttempts) {
      console.log('[QueueProcessor] Order max attempts reached:', order.localId);
      await orderQueue.updateOrderStatus(order.localId, 'failed', {
        lastError: 'Maximo de intentos alcanzado',
        errorType: 'max_attempts',
      });
      return { skipped: true, reason: 'max_attempts' };
    }

    // BLOQUEO 3: Verificar backoff
    if (!this.canProcessOrder(order)) {
      console.log('[QueueProcessor] Order in backoff period:', order.localId);
      return { skipped: true, reason: 'backoff' };
    }

    console.log('[QueueProcessor] Processing order:', order.localId, order.tempDisplayId);

    // MARCAR COMO SYNCING ANTES DE CUALQUIER API CALL
    // Esto previene que otro proceso intente sincronizar la misma orden
    await orderQueue.updateOrderStatus(order.localId, 'syncing');
    this.notifyListeners();

    try {
      const { orderData, idempotencyKey } = order;
      let clientId = orderData.client.id;

      // PASO 1: Crear cliente si es nuevo
      if (orderData.client.isNew && !order.serverClientId) {
        console.log('[QueueProcessor] Creating new client...');

        try {
          const clientResult = await api.createClient(
            orderData.client.name,
            orderData.client.phone
          );
          clientId = clientResult.client.id;

          // Guardar clientId para no volver a crearlo si falla el siguiente paso
          await orderQueue.updateOrderStatus(order.localId, 'syncing', {
            serverClientId: clientId,
          });

          console.log('[QueueProcessor] Client created:', clientId);
        } catch (clientError) {
          throw new Error(`Error creando cliente: ${clientError.message}`);
        }
      } else if (order.serverClientId) {
        // Usar cliente ya creado en intento anterior
        clientId = order.serverClientId;
      }

      // PASO 2: Crear orden de reparación
      console.log('[QueueProcessor] Creating repair order...');

      const repairData = {
        clientId,
        equipment: orderData.equipment,
        problems: orderData.problems,
        note: orderData.note,
        branchId: orderData.branchId,
        leadSource: orderData.leadSource,
        deliveryDate: orderData.deliveryDate,
      };

      const result = await api.createRepairOrder(repairData, idempotencyKey);

      console.log('[QueueProcessor] Order synced:', result.repair.name, result.duplicate ? '(duplicate)' : '');

      // ÉXITO: Marcar como sincronizado
      await orderQueue.updateOrderStatus(order.localId, 'synced', {
        serverId: result.repair.id,
        serverName: result.repair.name,
        lastError: null,
        errorType: null,
      });

      this.notifyListeners();

      return {
        success: true,
        duplicate: result.duplicate,
        serverId: result.repair.id,
        serverName: result.repair.name,
      };

    } catch (error) {
      console.error('[QueueProcessor] Sync error:', error.message);

      const errorType = this.classifyError(error);

      // Errores de validación no se reintentan
      const isFatalError = errorType === 'validation' || errorType === 'conflict';

      await orderQueue.updateOrderStatus(order.localId,
        isFatalError ? 'failed' : 'pending',
        {
          lastError: error.message,
          errorType,
        }
      );

      this.notifyListeners();

      return {
        success: false,
        error: error.message,
        errorType,
        willRetry: !isFatalError,
      };
    }
  }

  /**
   * Procesar todas las órdenes pendientes
   */
  async processQueue() {
    if (this.isProcessing) {
      console.log('[QueueProcessor] Already processing, skipping');
      return;
    }

    // Verificar conexión primero
    const isOnline = await api.isOnline();
    if (!isOnline) {
      console.log('[QueueProcessor] Offline, skipping queue processing');
      return;
    }

    this.isProcessing = true;
    console.log('[QueueProcessor] Starting queue processing...');

    try {
      const pendingOrders = await orderQueue.getPendingOrders();
      console.log('[QueueProcessor] Pending orders:', pendingOrders.length);

      for (const order of pendingOrders) {
        // Re-verificar conexión entre órdenes
        const stillOnline = await api.isOnline();
        if (!stillOnline) {
          console.log('[QueueProcessor] Lost connection, pausing');
          break;
        }

        await this.syncOrder(order);

        // Pequeña pausa entre órdenes para no saturar
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } finally {
      this.isProcessing = false;
      console.log('[QueueProcessor] Queue processing completed');
    }
  }

  /**
   * Iniciar procesamiento periódico
   */
  start(intervalMs = 60000) {
    if (this.processInterval) return;

    console.log('[QueueProcessor] Starting periodic processing');

    // Procesar inmediatamente
    this.processQueue();

    // Luego cada intervalo
    this.processInterval = setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }

  /**
   * Detener procesamiento
   */
  stop() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      console.log('[QueueProcessor] Stopped');
    }
  }

  /**
   * Suscribirse a eventos de sync
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notificar a listeners
   */
  notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb({ isProcessing: this.isProcessing });
      } catch (e) {
        console.error('[QueueProcessor] Error in listener:', e);
      }
    });
  }

  /**
   * Forzar reintento de una orden específica
   */
  async retryOrder(localId) {
    const order = await orderQueue.getOrder(localId);
    if (!order) {
      console.warn('[QueueProcessor] Order not found:', localId);
      return null;
    }

    // Resetear contadores para permitir reintento
    await orderQueue.updateOrderStatus(localId, 'pending', {
      attemptCount: 0,
      lastAttemptAt: null,
      lastError: null,
      errorType: null,
    });

    // Procesar inmediatamente
    const freshOrder = await orderQueue.getOrder(localId);
    return this.syncOrder(freshOrder);
  }
}

export const queueProcessor = new QueueProcessor();
