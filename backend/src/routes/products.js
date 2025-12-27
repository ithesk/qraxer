import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { odooProductsClient } from '../services/odooProducts.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * Middleware para obtener/crear sesión en Odoo Products
 * Usa las mismas credenciales del usuario pero contra el otro Odoo
 */
async function ensureProductsSession(req, res, next) {
  try {
    const userId = req.user.userId;

    // Verificar si ya tenemos sesión para este usuario
    let session = odooProductsClient.getUserSession(userId);

    if (session && session.sessionId) {
      req.productsSessionId = session.sessionId;
      return next();
    }

    // No tenemos sesión, necesitamos autenticar
    // Las credenciales se guardaron en el JWT cuando el usuario hizo login
    const username = req.user.username;
    const password = req.user.odooPassword; // Guardado encriptado en el token

    if (!password) {
      throw new AppError('Sesión de productos expirada. Inicie sesión nuevamente.', 401);
    }

    logger.debug('Autenticando en Odoo Products');

    const authResult = await odooProductsClient.authenticate(username, password);

    if (!authResult) {
      throw new AppError('No se pudo autenticar en el servidor de productos', 401);
    }

    // Guardar sesión asociada al userId original (no al uid de products)
    odooProductsClient.setUserSession(userId, {
      uid: authResult.uid,
      sessionId: authResult.sessionId,
      username: username,
    });

    req.productsSessionId = authResult.sessionId;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/products/barcode/:code
 * Buscar producto por código de barras
 */
router.get('/barcode/:code', ensureProductsSession, async (req, res, next) => {
  try {
    const { code } = req.params;

    if (!code) {
      throw new AppError('Código de barras requerido', 400);
    }

    logger.debug('Buscando producto por barcode en NCF');

    const product = await odooProductsClient.getProductByBarcode(code, req.productsSessionId);

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
router.post('/search', ensureProductsSession, async (req, res, next) => {
  try {
    const { query } = req.body;

    if (!query || query.length < 2) {
      throw new AppError('Búsqueda debe tener al menos 2 caracteres', 400);
    }

    logger.debug('Buscando productos en NCF');

    const products = await odooProductsClient.searchProducts(query, req.productsSessionId);

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
