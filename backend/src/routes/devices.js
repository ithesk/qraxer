/**
 * Rutas para gestión de dispositivos y push notifications
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { apnsService } from '../services/apns.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * POST /api/devices/register
 * Registrar token de dispositivo para push notifications
 */
router.post('/register', async (req, res, next) => {
  try {
    const { token, platform } = req.body;
    const userId = req.user.userId;

    if (!token) {
      throw new AppError('Token de dispositivo requerido', 400);
    }

    const validPlatforms = ['ios', 'android'];
    const devicePlatform = platform || 'ios';

    if (!validPlatforms.includes(devicePlatform)) {
      throw new AppError('Plataforma inválida (ios o android)', 400);
    }

    apnsService.registerToken(userId, token, devicePlatform);

    logger.info(`[DEVICES] Token registrado - Usuario: ${userId}, Plataforma: ${devicePlatform}`);

    res.json({
      success: true,
      message: 'Dispositivo registrado para notificaciones',
      pushEnabled: apnsService.isEnabled(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/devices/unregister
 * Eliminar token de dispositivo
 */
router.delete('/unregister', async (req, res, next) => {
  try {
    const { token } = req.body;
    const userId = req.user.userId;

    if (!token) {
      throw new AppError('Token de dispositivo requerido', 400);
    }

    const removed = apnsService.unregisterToken(userId, token);

    res.json({
      success: true,
      removed,
      message: removed ? 'Dispositivo eliminado' : 'Token no encontrado',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/devices/status
 * Obtener estado de push notifications para el usuario
 */
router.get('/status', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const devices = apnsService.getTokens(userId);

    res.json({
      pushEnabled: apnsService.isEnabled(),
      devicesRegistered: devices.length,
      devices: devices.map(d => ({
        platform: d.platform,
        registeredAt: d.createdAt,
        tokenPreview: d.token.substring(0, 10) + '...',
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/devices/stats
 * Estadísticas globales de push (solo para debug)
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = apnsService.getStats();

    res.json({
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/devices/test-push
 * Enviar notificación de prueba (solo desarrollo)
 */
router.post('/test-push', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const userName = req.user.name || req.user.username;

    if (!apnsService.isEnabled()) {
      return res.json({
        success: false,
        message: 'Push notifications no configuradas',
        hint: 'Configura APNS_KEY_PATH, APNS_KEY_ID, APNS_TEAM_ID en .env',
      });
    }

    const result = await apnsService.sendNotification(userId, {
      title: 'Notificación de prueba',
      body: `Hola ${userName}, las notificaciones funcionan!`,
      data: { type: 'test' },
    });

    res.json({
      success: result.sent > 0,
      result,
      message: result.sent > 0
        ? 'Notificación enviada'
        : 'No se pudo enviar (verifica que tienes dispositivos registrados)',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
