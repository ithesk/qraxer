import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { supabaseAuth } from '../services/supabaseAuth.js';

const router = Router();

// Todas las rutas requieren autenticación de QRaxer
router.use(authMiddleware);

/**
 * Validación Luhn para IMEI
 */
function luhnCheck(num) {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (Number.isNaN(n)) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/**
 * Normaliza IMEI removiendo caracteres no numéricos
 */
function normalizeImei(raw) {
  return (raw ?? '').replace(/\D/g, '');
}

/**
 * POST /api/imei/lookup
 * Proxy para la Edge Function de Supabase que consulta IMEI
 *
 * Body: { imei: string, forceRefresh?: boolean }
 * Returns: Resultado de la consulta IMEI (modelo, SIM lock, iCloud, etc.)
 */
router.post('/lookup', async (req, res, next) => {
  try {
    // Verificar que Supabase está configurado
    if (!config.supabase.enabled) {
      throw new AppError('Servicio IMEI no configurado', 503);
    }

    // Verificar que el servicio de autenticación está disponible
    if (!supabaseAuth.isEnabled()) {
      throw new AppError('Credenciales de servicio IMEI no configuradas', 503);
    }

    const { imei: rawImei, forceRefresh = false } = req.body;

    if (!rawImei) {
      throw new AppError('IMEI requerido', 400);
    }

    // Normalizar y validar IMEI
    const imei = normalizeImei(rawImei);

    if (imei.length !== 15) {
      throw new AppError('El IMEI debe tener 15 dígitos', 400);
    }

    if (!luhnCheck(imei)) {
      throw new AppError('IMEI inválido (verificación Luhn falló)', 400);
    }

    logger.debug('IMEI lookup request:', imei);

    // Obtener token de usuario de Supabase
    const userToken = await supabaseAuth.getValidToken();
    if (!userToken) {
      logger.error('No se pudo obtener token de Supabase');
      throw new AppError('Error de autenticación con servicio IMEI', 503);
    }

    // Llamar a la Edge Function de Supabase con token de usuario
    const functionUrl = `${config.supabase.url}/functions/v1/lookup_imei`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
        'apikey': config.supabase.anonKey,
      },
      body: JSON.stringify({
        imei,
        force_refresh: forceRefresh,
        streaming: false, // No streaming para el proxy
      }),
    });

    // Manejar respuesta
    const contentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Supabase Edge Function error:', response.status, errorText);

      // Mapear errores comunes
      if (response.status === 401) {
        throw new AppError('Error de autenticación con servicio IMEI', 503);
      }
      if (response.status === 429) {
        throw new AppError('Límite de consultas alcanzado', 429);
      }

      throw new AppError(`Error del servicio IMEI: ${errorText}`, response.status);
    }

    // Parsear respuesta JSON
    const data = await response.json();

    logger.debug('IMEI lookup success:', imei, data.from_cache ? '(cache)' : '(fresh)');

    // Transformar respuesta para el frontend
    const result = {
      imei: data.imei,
      fromCache: data.from_cache || false,
      fetchedAt: data.fetched_at,
      expiresAt: data.expires_at,
      payload: data.payload,
    };

    // Extraer datos principales para respuesta simplificada
    if (data.payload?.extracted) {
      const ext = data.payload.extracted;
      result.summary = {
        isApple: data.payload.is_apple || false,
        modelName: ext.model_description || ext.model_name || ext.model || null,
        manufacturer: ext.manufacturer || (data.payload.is_apple ? 'Apple' : null),
        simLock: ext.sim_lock || null,
        lockedCarrier: ext.locked_carrier || null,
        icloudLock: ext.icloud_lock || null,
        warrantyStatus: ext.warranty_status || null,
        serialNumber: ext.serial_number || null,
      };
    }

    res.json(result);

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/imei/status
 * Verificar si el servicio IMEI está disponible
 */
router.get('/status', (req, res) => {
  const supabaseConfigured = config.supabase.enabled;
  const authConfigured = supabaseAuth.isEnabled();
  const fullyEnabled = supabaseConfigured && authConfigured;

  res.json({
    enabled: fullyEnabled,
    supabaseConfigured,
    authConfigured,
    message: fullyEnabled
      ? 'Servicio IMEI disponible'
      : !supabaseConfigured
        ? 'Servicio IMEI no configurado (falta SUPABASE_URL/KEY)'
        : 'Credenciales de servicio no configuradas (falta SUPABASE_SERVICE_EMAIL/PASSWORD)',
  });
});

export default router;
