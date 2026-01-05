/**
 * Apple Push Notification Service (APNs) Client
 *
 * Este servicio es OPCIONAL - si no hay configuración de APNs,
 * el sistema sigue funcionando con polling.
 *
 * Los tokens se persisten en SQLite y se cargan en memoria al iniciar.
 */

import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { database } from './database.js';

// Almacén de tokens de dispositivos en memoria (cache de la DB)
// Estructura: Map<userId, Set<{token, platform, createdAt}>>
const deviceTokens = new Map();

// Cliente APNs (se inicializa solo si hay configuración)
let apnProvider = null;

/**
 * Carga los tokens desde la base de datos a memoria
 */
function loadTokensFromDatabase() {
  const tokens = database.getAllDeviceTokens();

  for (const row of tokens) {
    if (!deviceTokens.has(row.user_id)) {
      deviceTokens.set(row.user_id, new Set());
    }

    deviceTokens.get(row.user_id).add({
      token: row.token,
      platform: row.platform,
      createdAt: row.created_at,
    });
  }

  logger.info(`[APNS] Cargados ${tokens.length} tokens de la base de datos`);
}

/**
 * Inicializa el cliente APNs si hay configuración disponible
 */
async function initializeApns() {
  // Cargar tokens persistidos
  loadTokensFromDatabase();

  if (!config.apns?.enabled) {
    logger.info('[APNS] Push notifications deshabilitadas (sin configuración)');
    return false;
  }

  try {
    // Importación dinámica para no requerir la dependencia si no se usa
    const apn = await import('@parse/node-apn');

    const isProduction = config.apns.production;

    apnProvider = new apn.default.Provider({
      token: {
        key: config.apns.keyPath,
        keyId: config.apns.keyId,
        teamId: config.apns.teamId,
      },
      production: isProduction,
    });

    logger.info(`[APNS] Cliente inicializado - Entorno: ${isProduction ? 'PRODUCTION' : 'SANDBOX'}`);
    return true;
  } catch (error) {
    logger.warn('[APNS] No se pudo inicializar:', error.message);
    logger.warn('[APNS] Continuando sin push notifications (solo polling)');
    return false;
  }
}

/**
 * Registra un token de dispositivo para un usuario
 * Guarda en DB y en cache de memoria
 */
function registerDeviceToken(userId, token, platform = 'ios') {
  // Guardar en base de datos
  database.upsertDeviceToken(userId, token, platform);

  // Actualizar cache en memoria
  if (!deviceTokens.has(userId)) {
    deviceTokens.set(userId, new Set());
  }

  const userDevices = deviceTokens.get(userId);

  // Remover token existente si ya existe (para actualizar)
  for (const device of userDevices) {
    if (device.token === token) {
      userDevices.delete(device);
      break;
    }
  }

  userDevices.add({
    token,
    platform,
    createdAt: new Date().toISOString(),
  });

  logger.debug(`[APNS] Token registrado para usuario ${userId}`);
  return true;
}

/**
 * Elimina un token de dispositivo
 * Elimina de DB y de cache de memoria
 */
function unregisterDeviceToken(userId, token) {
  // Eliminar de base de datos
  database.deleteDeviceToken(token);

  // Eliminar de cache en memoria
  if (!deviceTokens.has(userId)) {
    return false;
  }

  const userDevices = deviceTokens.get(userId);
  for (const device of userDevices) {
    if (device.token === token) {
      userDevices.delete(device);
      logger.debug(`[APNS] Token eliminado para usuario ${userId}`);
      return true;
    }
  }

  return false;
}

/**
 * Obtiene todos los tokens de un usuario (desde cache en memoria)
 */
function getDeviceTokens(userId) {
  if (!deviceTokens.has(userId)) {
    return [];
  }
  return Array.from(deviceTokens.get(userId));
}

/**
 * Envía una notificación push a un usuario
 */
async function sendPushNotification(userId, notification) {
  const devices = getDeviceTokens(userId);

  if (devices.length === 0) {
    logger.debug(`[APNS] No hay dispositivos registrados para usuario ${userId}`);
    return { sent: 0, failed: 0 };
  }

  if (!apnProvider) {
    logger.debug('[APNS] Provider no disponible, notificación no enviada');
    return { sent: 0, failed: 0, reason: 'provider_not_available' };
  }

  try {
    const apn = await import('@parse/node-apn');

    const note = new apn.default.Notification({
      alert: {
        title: notification.title,
        body: notification.body,
      },
      topic: config.apns.bundleId,
      sound: notification.sound || 'default',
      badge: notification.badge,
      payload: notification.data || {},
      expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hora
    });

    let sent = 0;
    let failed = 0;

    for (const device of devices) {
      if (device.platform === 'ios') {
        try {
          const result = await apnProvider.send(note, device.token);

          if (result.sent.length > 0) {
            sent++;
            logger.debug(`[APNS] Notificación enviada a ${device.token.substring(0, 10)}...`);
          }

          if (result.failed.length > 0) {
            failed++;
            const failure = result.failed[0];
            logger.warn(`[APNS] Falló envío: ${failure.response?.reason || 'unknown'}`);

            // Si el token es inválido, eliminarlo
            if (failure.response?.reason === 'BadDeviceToken' ||
                failure.response?.reason === 'Unregistered') {
              unregisterDeviceToken(userId, device.token);
            }
          }
        } catch (error) {
          failed++;
          logger.error(`[APNS] Error enviando a dispositivo:`, error.message);
        }
      }
    }

    return { sent, failed };
  } catch (error) {
    logger.error('[APNS] Error en sendPushNotification:', error.message);
    return { sent: 0, failed: 0, error: error.message };
  }
}

/**
 * Envía notificación de check-in a un técnico
 */
async function sendCheckinNotification(technicianId, checkinData) {
  if (!technicianId) {
    logger.debug('[APNS] No hay técnico asignado, no se envía push');
    return { sent: 0, failed: 0 };
  }

  return sendPushNotification(technicianId, {
    title: 'Cliente esperando',
    body: `${checkinData.clientName} - ${checkinData.repairCode}`,
    sound: 'default',
    data: {
      type: 'checkin',
      checkinId: checkinData.id,
      repairId: checkinData.repairId,
      repairCode: checkinData.repairCode,
    },
  });
}

/**
 * Verifica si APNs está habilitado
 */
function isEnabled() {
  return apnProvider !== null;
}

/**
 * Estadísticas de dispositivos registrados
 */
function getStats() {
  // Obtener stats desde la base de datos para mayor precisión
  const dbStats = database.getStats();

  // También incluir stats de memoria para comparación
  let memoryDevices = 0;
  let memoryUsers = deviceTokens.size;

  for (const devices of deviceTokens.values()) {
    memoryDevices += devices.size;
  }

  return {
    enabled: isEnabled(),
    database: dbStats,
    memory: {
      totalUsers: memoryUsers,
      totalDevices: memoryDevices,
    },
  };
}

// Exportar servicio
export const apnsService = {
  initialize: initializeApns,
  registerToken: registerDeviceToken,
  unregisterToken: unregisterDeviceToken,
  getTokens: getDeviceTokens,
  sendNotification: sendPushNotification,
  sendCheckinNotification,
  isEnabled,
  getStats,
};

export default apnsService;
