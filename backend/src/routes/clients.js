import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { odooClient } from '../services/odoo.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * POST /api/clients/search
 * Buscar cliente por teléfono
 */
router.post('/search', async (req, res, next) => {
  try {
    const { phone } = req.body;
    const userId = req.user.userId;

    if (!phone) {
      throw new AppError('Teléfono requerido', 400);
    }

    console.log('[CLIENTS] Buscando cliente por teléfono:', phone);

    const partners = await odooClient.searchPartnerByPhone(phone, userId);

    if (partners && partners.length > 0) {
      res.json({
        found: true,
        clients: partners.map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone || p.mobile || null,
          email: p.email || null,
        })),
      });
    } else {
      res.json({
        found: false,
        clients: [],
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/clients/create
 * Crear nuevo cliente
 */
router.post('/create', async (req, res, next) => {
  try {
    const { name, phone, email } = req.body;
    const userId = req.user.userId;

    if (!name) {
      throw new AppError('Nombre requerido', 400);
    }

    console.log('[CLIENTS] Creando cliente:', name, phone);

    const partner = await odooClient.createPartner({ name, phone, email }, userId);

    res.json({
      success: true,
      client: {
        id: partner.id,
        name: partner.name,
        phone: partner.phone || partner.mobile || phone,
        email: partner.email || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
