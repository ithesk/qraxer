import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { odooClient } from '../services/odoo.js';
import { qrService } from '../services/qr.js';
import { idempotencyService } from '../services/idempotency.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

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

    logger.debug('QR recibido - Usuario:', userId);

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
 * GET /api/repair/config
 * Obtener configuración para el formulario de reparación
 * Incluye: branches, leadSources, defaults
 */
router.get('/config', async (req, res, next) => {
  try {
    // Pasar userInfo completo para permitir re-autenticación si la sesión expiró
    const userInfo = {
      userId: req.user.userId,
      username: req.user.username,
      password: req.user.odooPassword,
    };
    const config = await odooClient.getRepairConfig(userInfo);
    res.json(config);
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
 * POST /api/repair/create
 * Crear nueva orden de reparación (Quick Creator)
 * Campos requeridos: clientId, equipment, problems, branchId
 * Campos opcionales: note, leadSource, deliveryDate, estimatedBudget, idempotencyKey
 *
 * idempotencyKey: Si se proporciona, verifica si ya existe una orden con esa key
 * para prevenir duplicados cuando el cliente reintenta.
 */
router.post('/create', async (req, res, next) => {
  try {
    const {
      clientId,
      equipment,
      problems,
      note,
      branchId,
      leadSource,
      deliveryDate,
      estimatedBudget,
      idempotencyKey,
    } = req.body;
    const userId = req.user.userId;
    const userName = req.user.name || req.user.username;

    // IDEMPOTENCY CHECK: Si hay key, verificar si ya existe la orden
    if (idempotencyKey) {
      const existing = idempotencyService.check(idempotencyKey, userId);
      if (existing) {
        logger.debug('Orden duplicada detectada, retornando existente:', existing.repairName);

        // Obtener datos completos de la orden existente
        const existingRepair = await odooClient.getRepairById(existing.repairId, userId);

        return res.json({
          success: true,
          duplicate: true,
          repair: {
            id: existing.repairId,
            name: existing.repairName,
            state: existingRepair?.state || 'draft',
            partner: existingRepair?.partner_id ? existingRepair.partner_id[1] : null,
            branch: existingRepair?.branch_id ? existingRepair.branch_id[1] : null,
            description: existingRepair?.description || '',
          },
        });
      }
    }

    // Validaciones
    if (!clientId) {
      throw new AppError('Cliente requerido', 400);
    }
    if (!equipment?.model) {
      throw new AppError('Modelo de equipo requerido', 400);
    }
    if (!branchId) {
      throw new AppError('Sucursal requerida', 400);
    }

    logger.debug('Creando orden:', { clientId, branchId, model: equipment?.model, idempotencyKey });

    const repair = await odooClient.createRepairOrder(
      {
        clientId,
        equipment,
        problems,
        note,
        branchId,
        leadSource,
        deliveryDate,
        estimatedBudget,
      },
      userId,
      userName
    );

    // IDEMPOTENCY SAVE: Guardar key para futuras verificaciones
    if (idempotencyKey) {
      idempotencyService.save(idempotencyKey, repair.id, repair.name, userId);
    }

    res.json({
      success: true,
      duplicate: false,
      repair: {
        id: repair.id,
        name: repair.name,
        state: repair.state,
        partner: repair.partner,
        branch: repair.branch,
        description: repair.description,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/repair/recent
 * Obtener órdenes recientes para historial
 */
router.get('/recent', async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const days = parseInt(req.query.days) || 7;

    logger.debug('Obteniendo órdenes recientes, días:', days);

    const repairs = await odooClient.getRecentRepairs(userId, days);

    res.json({
      repairs: repairs.map(r => ({
        id: r.id,
        name: r.name,
        state: r.state,
        partner: r.partner_id ? r.partner_id[1] : null,
        partnerPhone: r.partner_phone || null,
        product: r.product_id ? r.product_id[1] : null,
        assignedUser: r.user_id ? r.user_id[1] : null,
        description: r.description || '',
        createdAt: r.create_date,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/repair/debug/lead-sources
 * Debug endpoint para obtener valores válidos de lead_source directamente de Odoo
 */
router.get('/debug/lead-sources', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    logger.debug('[DEBUG] Consultando campos de repair.order...');

    // Consultar directamente los campos del modelo repair.order
    const fields = await odooClient.execute('repair.order', 'fields_get', [], {
      attributes: ['selection', 'string', 'type', 'required'],
      allfields: ['lead_source'],
    }, userId);

    logger.debug('[DEBUG] Respuesta fields_get:', JSON.stringify(fields, null, 2));

    res.json({
      success: true,
      raw_response: fields,
      lead_source: fields.lead_source || 'NOT_FOUND',
      selection: fields.lead_source?.selection || [],
    });
  } catch (error) {
    logger.error('[DEBUG] Error:', error);
    next(error);
  }
});

/**
 * POST /api/repair/checkin
 * Cliente llega a recoger - envía notificación al técnico
 * NOTE: This route must be BEFORE /:code to avoid being matched as a code
 */
router.post('/checkin', async (req, res, next) => {
  try {
    const { qrContent } = req.body;
    const userId = req.user.userId;
    const userName = req.user.name || req.user.username;

    if (!qrContent) {
      throw new AppError('Contenido de QR requerido', 400);
    }

    // Validar QR
    const qrResult = qrService.validateQRContent(qrContent);

    if (!qrResult.valid) {
      throw new AppError(qrResult.error, 400);
    }

    // Buscar reparación
    const repair = await odooClient.getRepairByCode(qrResult.repairCode, userId);

    if (!repair) {
      throw new AppError(`Reparacion ${qrResult.repairCode} no encontrada`, 404);
    }

    // Obtener técnico asignado
    const technician = repair.user_id ? {
      id: repair.user_id[0],
      name: repair.user_id[1],
    } : null;

    // Registrar check-in en chatter de Odoo
    const checkinMessage = `
<p><strong>🔔 Check-in del cliente</strong></p>
<ul>
  <li><strong>Cliente:</strong> ${repair.partner_id ? repair.partner_id[1] : 'N/A'}</li>
  <li><strong>Registrado por:</strong> ${userName}</li>
  <li><strong>Fecha:</strong> ${new Date().toLocaleString('es-DO')}</li>
  <li><strong>Estado actual:</strong> ${repair.state}</li>
</ul>
<p><em>El cliente ha llegado a recoger su equipo.</em></p>
    `.trim();

    try {
      await odooClient.execute('repair.order', 'message_post', [repair.id], {
        body: checkinMessage,
        message_type: 'notification',
      }, userId);
    } catch (e) {
      logger.warn('No se pudo registrar check-in en chatter:', e.message);
    }

    // Agregar el check-in al sistema de notificaciones en memoria
    // (para que otros usuarios de la app lo vean)
    const checkinNotification = {
      id: `checkin-${repair.id}-${Date.now()}`,
      type: 'checkin',
      repairId: repair.id,
      repairCode: repair.name,
      clientName: repair.partner_id ? repair.partner_id[1] : 'Cliente',
      technicianId: technician?.id || null,
      technicianName: technician?.name || null,
      registeredBy: userName,
      registeredById: userId,
      timestamp: new Date().toISOString(),
      state: repair.state,
    };

    // Guardar en memoria para polling (temporal hasta implementar push)
    if (!global.checkinNotifications) {
      global.checkinNotifications = [];
    }
    global.checkinNotifications.unshift(checkinNotification);
    // Mantener solo las últimas 50 notificaciones
    if (global.checkinNotifications.length > 50) {
      global.checkinNotifications = global.checkinNotifications.slice(0, 50);
    }

    res.json({
      success: true,
      message: 'Check-in registrado',
      checkin: checkinNotification,
      repair: {
        id: repair.id,
        name: repair.name,
        state: repair.state,
        partner: repair.partner_id ? repair.partner_id[1] : null,
        technician: technician,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/repair/checkin/pending
 * Obtener check-ins pendientes para el técnico actual
 */
router.get('/checkin/pending', async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const notifications = (global.checkinNotifications || [])
      .filter(n => {
        // Mostrar si es para este técnico o si no tiene técnico asignado
        const isForMe = n.technicianId === userId || n.technicianId === null;
        // Solo mostrar de los últimos 30 minutos
        const isRecent = new Date() - new Date(n.timestamp) < 30 * 60 * 1000;
        return isForMe && isRecent;
      });

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/repair/checkin/respond
 * Técnico responde al check-in
 */
router.post('/checkin/respond', async (req, res, next) => {
  try {
    const { checkinId, response } = req.body;
    const userId = req.user.userId;
    const userName = req.user.name || req.user.username;

    if (!checkinId || !response) {
      throw new AppError('checkinId y response requeridos', 400);
    }

    const validResponses = ['coming', 'ready', 'need_time'];
    if (!validResponses.includes(response)) {
      throw new AppError('Respuesta inválida', 400);
    }

    // Buscar la notificación
    const notification = (global.checkinNotifications || []).find(n => n.id === checkinId);

    if (!notification) {
      throw new AppError('Notificación no encontrada', 404);
    }

    // Mapear respuestas a mensajes
    const responseMessages = {
      coming: '🚶 Voy de camino',
      ready: '✅ Listo para entregar',
      need_time: '⏰ Necesito 10 minutos',
    };

    // Registrar respuesta en chatter de Odoo
    const responseMessage = `
<p><strong>📱 Respuesta del técnico al check-in</strong></p>
<ul>
  <li><strong>Técnico:</strong> ${userName}</li>
  <li><strong>Respuesta:</strong> ${responseMessages[response]}</li>
  <li><strong>Fecha:</strong> ${new Date().toLocaleString('es-DO')}</li>
</ul>
    `.trim();

    try {
      await odooClient.execute('repair.order', 'message_post', [notification.repairId], {
        body: responseMessage,
        message_type: 'notification',
      }, userId);
    } catch (e) {
      logger.warn('No se pudo registrar respuesta en chatter:', e.message);
    }

    // Actualizar la notificación con la respuesta
    notification.response = {
      type: response,
      message: responseMessages[response],
      respondedBy: userName,
      respondedById: userId,
      respondedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      message: 'Respuesta enviada',
      notification,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/repair/:id/note
 * Agregar nota al chatter de una orden de reparación
 */
router.post('/:id/note', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note } = req.body;
    const userId = req.user.userId;
    const userName = req.user.name || req.user.username;

    if (!note || !note.trim()) {
      throw new AppError('Nota requerida', 400);
    }

    const repairId = parseInt(id, 10);
    if (isNaN(repairId)) {
      throw new AppError('ID de reparación inválido', 400);
    }

    // Verificar que la reparación existe
    const repair = await odooClient.getRepairById(repairId, userId);
    if (!repair) {
      throw new AppError('Reparación no encontrada', 404);
    }

    // Crear mensaje para el chatter
    const message = `
<p><strong>📝 Nota agregada via QRaxer</strong></p>
<p>${note.trim().replace(/\n/g, '<br/>')}</p>
<p style="color: #666; font-size: 12px;">Por: ${userName} - ${new Date().toLocaleString('es-DO')}</p>
    `.trim();

    await odooClient.execute('repair.order', 'message_post', [repairId], {
      body: message,
      message_type: 'comment',
    }, userId);

    logger.debug('Nota agregada a reparación:', repairId);

    res.json({
      success: true,
      message: 'Nota agregada correctamente',
      repairId,
      repairName: repair.name,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/repair/:id/photo
 * Subir foto al chatter de una orden de reparación
 * Espera: { image: "base64string", filename: "foto.jpg", description?: "descripción" }
 */
router.post('/:id/photo', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { image, filename, description } = req.body;
    const userId = req.user.userId;
    const userName = req.user.name || req.user.username;

    if (!image) {
      throw new AppError('Imagen requerida', 400);
    }

    const repairId = parseInt(id, 10);
    if (isNaN(repairId)) {
      throw new AppError('ID de reparación inválido', 400);
    }

    // Verificar que la reparación existe
    const repair = await odooClient.getRepairById(repairId, userId);
    if (!repair) {
      throw new AppError('Reparación no encontrada', 404);
    }

    // Limpiar el base64 (quitar el prefijo data:image/xxx;base64, si existe)
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

    // Determinar el nombre del archivo
    const finalFilename = filename || `foto_${Date.now()}.jpg`;

    // Crear attachment en Odoo
    const attachmentResult = await odooClient.execute('ir.attachment', 'create', [{
      name: finalFilename,
      type: 'binary',
      datas: base64Data,
      res_model: 'repair.order',
      res_id: repairId,
    }], {}, userId);

    // Odoo create puede retornar diferentes formatos - normalizar a entero
    logger.debug('Attachment result raw:', JSON.stringify(attachmentResult));
    let attachmentId = attachmentResult;
    // Si es array, tomar primer elemento recursivamente
    while (Array.isArray(attachmentId)) {
      attachmentId = attachmentId[0];
    }
    // Asegurar que es entero
    attachmentId = parseInt(attachmentId, 10);
    logger.debug('Attachment ID normalizado:', attachmentId);

    if (!attachmentId || isNaN(attachmentId)) {
      throw new AppError('Error al crear attachment en Odoo', 500);
    }

    // Crear mensaje en el chatter con la foto
    // El attachment ya está asociado a repair.order via res_model/res_id
    // Solo necesitamos crear el mensaje, el attachment se mostrará automáticamente
    const message = `
<p><strong>📷 Foto agregada via QRaxer</strong></p>
${description ? `<p>${description}</p>` : ''}
<p style="color: #666; font-size: 12px;">Por: ${userName} - ${new Date().toLocaleString('es-DO')}</p>
    `.trim();

    // NO pasar attachment_ids - el attachment ya está vinculado al record
    // message_post con attachment_ids causa el error "unhashable type: list"
    await odooClient.execute('repair.order', 'message_post', [repairId], {
      body: message,
      message_type: 'comment',
    }, userId);

    res.json({
      success: true,
      message: 'Foto subida correctamente',
      repairId,
      repairName: repair.name,
      attachmentId,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/repair/:id/state
 * Actualizar estado de reparación por ID (para uso desde History, sin validación QR)
 */
router.post('/:id/state', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newState, note } = req.body;
    const userId = req.user.userId;
    const userName = req.user.name || req.user.username;

    if (!newState) {
      throw new AppError('Nuevo estado requerido', 400);
    }

    const repairId = parseInt(id, 10);
    if (isNaN(repairId)) {
      throw new AppError('ID de reparación inválido', 400);
    }

    // Verificar que la reparación existe
    const repair = await odooClient.getRepairById(repairId, userId);
    if (!repair) {
      throw new AppError('Reparación no encontrada', 404);
    }

    // Validar que el estado sea válido
    const validStates = await odooClient.getRepairStates(userId);
    const isValidState = validStates.some(s => s.value === newState);

    if (!isValidState) {
      throw new AppError('Estado invalido', 400);
    }

    // Actualizar estado con auditoría
    const result = await odooClient.updateRepairState(
      repairId,
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
 * GET /api/repair/by-id/:id
 * Obtener información de una reparación por ID numérico
 * Para uso desde History cuando se selecciona una reparación reciente
 */
router.get('/by-id/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const repairId = parseInt(id, 10);
    if (isNaN(repairId)) {
      throw new AppError('ID de reparación inválido', 400);
    }

    const repair = await odooClient.getRepairById(repairId, userId);

    if (!repair) {
      throw new AppError('Reparación no encontrada', 404);
    }

    res.json({
      repair: {
        id: repair.id,
        name: repair.name,
        state: repair.state,
        partner: repair.partner_id ? repair.partner_id[1] : null,
        partnerPhone: repair.partner_phone || null,
        product: repair.product_id ? repair.product_id[1] : null,
        assignedUser: repair.user_id ? repair.user_id[1] : null,
        description: repair.description || '',
        createdAt: repair.create_date,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/repair/:code
 * Obtener información de una reparación por código
 * NOTE: This route MUST be LAST because :code matches any string
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
