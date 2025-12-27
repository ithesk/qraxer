import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { odooClient } from '../services/odoo.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * GET /api/products/barcode/:code
 * Buscar producto por código de barras
 */
router.get('/barcode/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const userId = req.user.userId;

    if (!code) {
      throw new AppError('Código de barras requerido', 400);
    }

    logger.debug('Buscando producto por barcode');

    const product = await odooClient.getProductByBarcode(code, userId);

    if (product) {
      res.json({
        found: true,
        product: {
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          default_code: product.default_code || null,
          list_price: product.list_price || 0,
          standard_price: product.standard_price || 0,
          qty_available: product.qty_available || 0,
          categ_name: product.categ_id ? product.categ_id[1] : null,
          uom_name: product.uom_id ? product.uom_id[1] : null,
        },
      });
    } else {
      res.json({
        found: false,
        product: null,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/products/search
 * Buscar productos por nombre o referencia
 */
router.post('/search', async (req, res, next) => {
  try {
    const { query } = req.body;
    const userId = req.user.userId;

    if (!query || query.length < 2) {
      throw new AppError('Búsqueda debe tener al menos 2 caracteres', 400);
    }

    logger.debug('Buscando productos');

    const products = await odooClient.searchProducts(query, userId);

    res.json({
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        barcode: p.barcode || null,
        default_code: p.default_code || null,
        list_price: p.list_price || 0,
        qty_available: p.qty_available || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
