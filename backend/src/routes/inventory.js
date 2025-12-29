import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { odooInventoryClient } from '../services/odooInventory.js';
import { AppError } from '../middleware/errorHandler.js';

const router = Router();

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * GET /api/inventory/locations
 * Obtener ubicaciones de stock disponibles
 */
router.get('/locations', async (req, res, next) => {
  try {
    const locations = await odooInventoryClient.getStockLocations();

    res.json({
      locations: locations.map(loc => ({
        id: loc.id,
        name: loc.name,
        fullName: loc.complete_name || loc.name,
        warehouseId: loc.warehouse_id ? loc.warehouse_id[0] : null,
        warehouseName: loc.warehouse_id ? loc.warehouse_id[1] : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/inventory/default-location
 * Obtener la ubicación por defecto
 */
router.get('/default-location', async (req, res, next) => {
  try {
    const location = await odooInventoryClient.getDefaultLocation();

    res.json({
      location: {
        id: location.id,
        name: location.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/inventory/count
 * Enviar conteo de inventario
 *
 * Body:
 * {
 *   locationId: number (opcional, usa default si no se envía),
 *   items: [
 *     { productId: number, barcode: string, productName: string, countedQty: number }
 *   ],
 *   notes: string (opcional)
 * }
 */
router.post('/count', async (req, res, next) => {
  try {
    const { locationId, items, notes } = req.body;
    const userName = req.user?.name || req.user?.username || 'Usuario';

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError('Debe enviar al menos un producto para contar', 400);
    }

    // Validar items
    for (const item of items) {
      if (!item.productId || typeof item.productId !== 'number') {
        throw new AppError('Cada item debe tener un productId válido', 400);
      }
      if (typeof item.countedQty !== 'number' || item.countedQty < 0) {
        throw new AppError('Cada item debe tener una cantidad válida (>= 0)', 400);
      }
    }

    // Procesar el conteo
    const result = await odooInventoryClient.processInventoryCount(
      items,
      locationId,
      userName
    );

    res.json({
      success: result.applied !== false,
      message: result.applied !== false
        ? `Conteo aplicado: ${result.processed} productos actualizados`
        : 'Conteo creado pero hubo errores al aplicar',
      processed: result.processed,
      failed: result.failed,
      errors: result.errors,
      applyError: result.applyError,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/inventory/product/:productId/stock
 * Obtener stock actual de un producto
 */
router.get('/product/:productId/stock', async (req, res, next) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    const locationId = req.query.locationId ? parseInt(req.query.locationId, 10) : null;

    if (isNaN(productId)) {
      throw new AppError('ID de producto inválido', 400);
    }

    const stock = await odooInventoryClient.getProductStock(productId, locationId);

    res.json({
      productId,
      totalQty: stock.totalQty,
      locations: stock.quants.map(q => ({
        locationId: q.location_id[0],
        locationName: q.location_id[1],
        quantity: q.quantity,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
