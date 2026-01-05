/**
 * Idempotency Service
 * Previene la creación de órdenes duplicadas cuando el cliente reintenta
 *
 * Almacena keys en memoria con TTL de 24 horas.
 * Las keys se generan en el frontend basadas en: cliente + equipo + fecha
 */

import { logger } from '../utils/logger.js';

// Almacén en memoria: Map<key, { repairId, repairName, userId, createdAt, expiresAt }>
const idempotencyStore = new Map();

// TTL: 24 horas
const TTL_MS = 24 * 60 * 60 * 1000;

// Limpieza periódica cada hora
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

class IdempotencyService {
  constructor() {
    this.cleanupInterval = null;
  }

  /**
   * Iniciar limpieza periódica de keys expiradas
   */
  startCleanup() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanExpired();
    }, CLEANUP_INTERVAL_MS);

    logger.debug('[Idempotency] Cleanup scheduler started');
  }

  /**
   * Detener limpieza
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Verificar si una key ya existe
   * @param {string} key - Idempotency key
   * @param {number} userId - ID del usuario
   * @returns {Object|null} - Datos de la orden existente o null
   */
  check(key, userId) {
    if (!key) return null;

    const record = idempotencyStore.get(key);

    if (!record) {
      return null;
    }

    // Verificar que no haya expirado
    if (Date.now() > record.expiresAt) {
      idempotencyStore.delete(key);
      logger.debug('[Idempotency] Key expired and removed:', key);
      return null;
    }

    // Verificar que sea del mismo usuario
    if (record.userId !== userId) {
      logger.warn('[Idempotency] Key exists but different user:', key, 'stored:', record.userId, 'requested:', userId);
      return null;
    }

    logger.debug('[Idempotency] Duplicate detected for key:', key);
    return {
      repairId: record.repairId,
      repairName: record.repairName,
      createdAt: record.createdAt,
    };
  }

  /**
   * Guardar una key después de crear orden exitosamente
   * @param {string} key - Idempotency key
   * @param {number} repairId - ID de la orden en Odoo
   * @param {string} repairName - Nombre/código de la orden (ej: E707640)
   * @param {number} userId - ID del usuario
   */
  save(key, repairId, repairName, userId) {
    if (!key) return;

    const now = Date.now();

    idempotencyStore.set(key, {
      repairId,
      repairName,
      userId,
      createdAt: new Date(now).toISOString(),
      expiresAt: now + TTL_MS,
    });

    logger.debug('[Idempotency] Key saved:', key, '-> repair:', repairName);
  }

  /**
   * Limpiar keys expiradas
   */
  cleanExpired() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, record] of idempotencyStore.entries()) {
      if (now > record.expiresAt) {
        idempotencyStore.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('[Idempotency] Cleaned', cleaned, 'expired keys. Remaining:', idempotencyStore.size);
    }
  }

  /**
   * Obtener estadísticas (para debugging)
   */
  getStats() {
    return {
      totalKeys: idempotencyStore.size,
      ttlHours: TTL_MS / (60 * 60 * 1000),
    };
  }

  /**
   * Limpiar todo (para tests)
   */
  clear() {
    idempotencyStore.clear();
  }
}

export const idempotencyService = new IdempotencyService();

// Iniciar limpieza automática
idempotencyService.startCleanup();
