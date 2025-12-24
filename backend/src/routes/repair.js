import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { odooClient } from '../services/odoo.js';
import { qrService } from '../services/qr.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * POST /api/repair/scan
 * Escanear y validar QR de reparación
 * Acepta códigos simples (E707640) o firmados
 */
router.post('/scan', async (req, res, next) => {
  try {
    const { qrContent } = req.body;
    const userId = req.user.userId;

    if (!qrContent) {
      throw new AppError('Contenido de QR requerido', 400);
    }

    console.log('[SCAN] QR recibido:', qrContent, '- Usuario:', userId);

    // Validar QR
    const qrResult = qrService.validateQRContent(qrContent);

    if (!qrResult.valid) {
      throw new AppError(qrResult.error, 400);
    }

    // Buscar reparación por código (name) usando sesión del usuario
    const repair = await odooClient.getRepairByCode(qrResult.repairCode, userId);

    if (!repair) {
      throw new AppError(`Reparacion ${qrResult.repairCode} no encontrada`, 404);
    }

    // Obtener estados disponibles
    const states = await odooClient.getRepairStates(userId);

    res.json({
      repair: {
        id: repair.id,
        name: repair.name,
        currentState: repair.state,
        product: repair.product_id ? repair.product_id[1] : null,
        partner: repair.partner_id ? repair.partner_id[1] : null,
        description: repair.description || '',
      },
      availableStates: states,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/repair/update-state
 * Actualizar estado de reparación
 */
router.post('/update-state', async (req, res, next) => {
  try {
    const { qrContent, newState, note } = req.body;
    const userId = req.user.userId;
    const userName = req.user.name || req.user.username;

    if (!qrContent || !newState) {
      throw new AppError('QR y nuevo estado requeridos', 400);
    }

    // Validar QR nuevamente
    const qrResult = qrService.validateQRContent(qrContent);

    if (!qrResult.valid) {
      throw new AppError(qrResult.error, 400);
    }

    // Buscar reparación por código
    const repair = await odooClient.getRepairByCode(qrResult.repairCode, userId);

    if (!repair) {
      throw new AppError(`Reparacion ${qrResult.repairCode} no encontrada`, 404);
    }

    // Validar que el estado sea válido
    const validStates = await odooClient.getRepairStates(userId);
    const isValidState = validStates.some(s => s.value === newState);

    if (!isValidState) {
      throw new AppError('Estado invalido', 400);
    }

    // Actualizar estado con auditoría
    const result = await odooClient.updateRepairState(
      repair.id,
      newState,
      note || null,
      userId,
      userName
    );

    res.json({
      success: true,
      message: 'Estado actualizado correctamente',
      repairId: result.repairId,
      repairName: result.repairName,
      oldState: result.oldState,
      newState: result.newState,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/repair/states
 * Obtener estados disponibles
 */
router.get('/states', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const states = await odooClient.getRepairStates(userId);
    res.json({ states });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/repair/generate-qr
 * Generar QR firmado para una reparación
 */
router.post('/generate-qr', async (req, res, next) => {
  try {
    const { repairCode } = req.body;
    const userId = req.user.userId;

    if (!repairCode) {
      throw new AppError('Codigo de reparacion requerido', 400);
    }

    // Verificar que la reparación existe
    const repair = await odooClient.getRepairByCode(repairCode, userId);

    if (!repair) {
      throw new AppError('Reparacion no encontrada', 404);
    }

    const qrContent = qrService.generateQRContent(repairCode);

    res.json({
      qrContent,
      repairCode: repair.name,
      repairId: repair.id,
      expiresInMinutes: qrService.expirationMinutes,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/repair/:code
 * Obtener información de una reparación por código
 */
router.get('/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const userId = req.user.userId;

    const repair = await odooClient.getRepairByCode(code, userId);

    if (!repair) {
      throw new AppError(`Reparacion ${code} no encontrada`, 404);
    }

    const states = await odooClient.getRepairStates(userId);

    res.json({
      repair: {
        id: repair.id,
        name: repair.name,
        currentState: repair.state,
        product: repair.product_id ? repair.product_id[1] : null,
        partner: repair.partner_id ? repair.partner_id[1] : null,
        description: repair.description || '',
      },
      availableStates: states,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
