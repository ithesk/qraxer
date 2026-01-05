import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

const DEBUG = config.nodeEnv === 'development';

function log(...args) {
  if (DEBUG) {
    console.log('[ODOO-INVENTORY]', ...args);
  }
}

function logError(...args) {
  console.error('[ODOO-INVENTORY ERROR]', ...args);
}

/**
 * Cliente para operaciones de inventario en Odoo Products (NCF)
 * Usa las mismas credenciales que odooProducts
 */
class OdooInventoryClient {
  constructor() {
    this.url = config.odooProducts.url;
    this.db = config.odooProducts.db;
    this.adminUser = config.odooProducts.adminUser;
    this.adminPassword = config.odooProducts.adminPassword;
    this.adminSession = null;

    log('Inicializando cliente Odoo Inventory:');
    log('  URL:', this.url);
    log('  DB:', this.db);
  }

  /**
   * Hacer request JSON-RPC
   */
  async jsonRpc(endpoint, params, sessionId = null) {
    const fullUrl = `${this.url}${endpoint}`;
    log(`Request: ${endpoint}`);

    try {
      const headers = { 'Content-Type': 'application/json' };

      if (sessionId) {
        headers['Cookie'] = `session_id=${sessionId}`;
      }

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params,
          id: Date.now(),
        }),
      });

      log('  Status:', response.status, response.statusText);

      let newSessionId = null;
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        const match = setCookie.match(/session_id=([^;]+)/);
        if (match) {
          newSessionId = match[1];
        }
      }

      if (!response.ok) {
        const text = await response.text();
        logError('HTTP Error:', response.status, text);
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();

      if (data.error) {
        logError('Odoo Error:', JSON.stringify(data.error, null, 2));
        const errorMsg = data.error.data?.message
          || data.error.data?.name
          || data.error.message
          || 'Error de Odoo Inventory';
        throw new Error(errorMsg);
      }

      log('  Response OK');
      return { result: data.result, sessionId: newSessionId };
    } catch (error) {
      logError('Fetch Error:', error.message);
      throw error;
    }
  }

  /**
   * Autenticar con credenciales de admin
   */
  async ensureAdminSession() {
    if (this.adminSession) {
      log('Usando sesión de admin existente');
      return this.adminSession;
    }

    if (!this.adminUser || !this.adminPassword) {
      throw new AppError('Credenciales de Odoo Inventory no configuradas', 500);
    }

    log('Autenticando admin en Odoo Inventory');

    try {
      const { result, sessionId } = await this.jsonRpc('/web/session/authenticate', {
        db: this.db,
        login: this.adminUser,
        password: this.adminPassword,
      });

      if (!result || !result.uid || result.uid === false) {
        logError('Admin auth failed: No UID en respuesta');
        throw new AppError('No se pudo autenticar en Odoo Inventory', 500);
      }

      log('Admin auth success: UID =', result.uid);

      this.adminSession = {
        uid: result.uid,
        sessionId: sessionId,
      };

      return this.adminSession;
    } catch (error) {
      logError('Admin auth exception:', error.message);
      throw error;
    }
  }

  /**
   * Limpiar sesión de admin
   */
  clearAdminSession() {
    this.adminSession = null;
    log('Sesión de admin limpiada');
  }

  /**
   * Ejecutar método en modelo de Odoo
   * @param {string} model - Modelo de Odoo
   * @param {string} method - Método a ejecutar
   * @param {Array} args - Argumentos posicionales
   * @param {Object} kwargs - Argumentos con nombre
   * @param {Object} context - Contexto adicional para la llamada
   */
  async execute(model, method, args = [], kwargs = {}, context = {}) {
    log(`Execute: ${model}.${method}`);

    const session = await this.ensureAdminSession();

    // Merge context into kwargs
    const finalKwargs = {
      ...kwargs,
      context: {
        ...kwargs.context,
        ...context,
      },
    };

    try {
      const { result } = await this.jsonRpc('/web/dataset/call_kw', {
        model,
        method,
        args,
        kwargs: finalKwargs,
      }, session.sessionId);

      return result;
    } catch (error) {
      if (error.message.includes('Session') || error.message.includes('Access')) {
        log('Sesión posiblemente expirada, reintentando...');
        this.clearAdminSession();
        const newSession = await this.ensureAdminSession();
        const { result } = await this.jsonRpc('/web/dataset/call_kw', {
          model,
          method,
          args,
          kwargs: finalKwargs,
        }, newSession.sessionId);
        return result;
      }
      throw error;
    }
  }

  /**
   * Obtener ubicaciones de stock disponibles
   */
  async getStockLocations() {
    log('Obteniendo ubicaciones de stock');

    const locations = await this.execute('stock.location', 'search_read', [
      [
        ['usage', '=', 'internal'],
        ['active', '=', true],
      ],
    ], {
      fields: ['id', 'name', 'complete_name', 'warehouse_id'],
      order: 'complete_name asc',
    });

    log('Ubicaciones encontradas:', locations.length);
    return locations;
  }

  /**
   * Obtener la ubicación por defecto del almacén principal
   */
  async getDefaultLocation() {
    log('Buscando ubicación por defecto');

    // Buscar el almacén principal
    const warehouses = await this.execute('stock.warehouse', 'search_read', [
      [['active', '=', true]],
    ], {
      fields: ['id', 'name', 'lot_stock_id'],
      limit: 1,
    });

    if (warehouses && warehouses.length > 0 && warehouses[0].lot_stock_id) {
      const locationId = warehouses[0].lot_stock_id[0];
      const locationName = warehouses[0].lot_stock_id[1];
      log('Ubicación por defecto:', locationId, locationName);
      return { id: locationId, name: locationName };
    }

    // Fallback: buscar cualquier ubicación interna
    const locations = await this.getStockLocations();
    if (locations && locations.length > 0) {
      return { id: locations[0].id, name: locations[0].complete_name || locations[0].name };
    }

    throw new AppError('No se encontró ninguna ubicación de stock', 500);
  }

  /**
   * Crear ajuste de inventario para un producto
   * Usa stock.change.product.qty wizard para Odoo 12
   * Referencia: https://www.odoo.com/forum/help-1/inventory-stock-adjustment-in-odoo-12-155262
   */
  async createInventoryAdjustment(productId, locationId, countedQty, userName) {
    log('Creando ajuste de inventario (Odoo 12):', { productId, locationId, countedQty });

    // Obtener product_tmpl_id necesario para el wizard
    const products = await this.execute('product.product', 'search_read', [
      [['id', '=', productId]],
    ], {
      fields: ['product_tmpl_id'],
      limit: 1,
    });

    if (!products || products.length === 0) {
      throw new AppError(`Producto ${productId} no encontrado`, 404);
    }

    const productTmplId = products[0].product_tmpl_id[0];
    log('Product template ID:', productTmplId);

    // Usar el wizard stock.change.product.qty (método estándar en Odoo 12)
    // Este wizard tiene los permisos correctos para modificar inventario
    const wizardId = await this.execute('stock.change.product.qty', 'create', [{
      product_id: productId,
      product_tmpl_id: productTmplId,
      new_quantity: countedQty,
      location_id: locationId,
    }]);

    log('Wizard creado:', wizardId);

    // Ejecutar el wizard para aplicar el cambio
    await this.execute('stock.change.product.qty', 'change_product_qty', [[wizardId]]);

    log('Cantidad actualizada via wizard stock.change.product.qty');
    return wizardId;
  }

  /**
   * Aplicar los ajustes de inventario
   * En Odoo 12 con stock.change.product.qty, los ajustes se aplican automáticamente
   * Este método solo confirma que se procesaron correctamente
   */
  async applyInventoryAdjustments(wizardIds) {
    log('Ajustes de inventario ya aplicados via wizard:', wizardIds);
    // Los ajustes ya fueron aplicados por change_product_qty en createInventoryAdjustment
    return { applied: wizardIds.length };
  }

  /**
   * Procesar conteo de inventario completo
   * Recibe lista de items con productId y cantidad contada
   */
  async processInventoryCount(items, locationId, userName) {
    log('Procesando conteo de inventario:', items.length, 'items');

    if (!items || items.length === 0) {
      throw new AppError('No hay productos para procesar', 400);
    }

    // Si no se especifica ubicación, usar la por defecto
    let targetLocationId = locationId;
    if (!targetLocationId) {
      const defaultLocation = await this.getDefaultLocation();
      targetLocationId = defaultLocation.id;
    }

    const results = {
      processed: 0,
      failed: 0,
      errors: [],
      quantIds: [],
    };

    // Crear ajustes para cada producto
    for (const item of items) {
      try {
        const quantId = await this.createInventoryAdjustment(
          item.productId,
          targetLocationId,
          item.countedQty,
          userName
        );
        results.quantIds.push(quantId);
        results.processed++;
      } catch (error) {
        logError('Error procesando item:', item, error.message);
        results.failed++;
        results.errors.push({
          productId: item.productId,
          barcode: item.barcode,
          error: error.message,
        });
      }
    }

    // Aplicar todos los ajustes
    if (results.quantIds.length > 0) {
      try {
        await this.applyInventoryAdjustments(results.quantIds);
        results.applied = true;
      } catch (error) {
        results.applied = false;
        results.applyError = error.message;
      }
    }

    log('Conteo procesado:', results);
    return results;
  }

  /**
   * Obtener cantidad actual en stock de un producto
   */
  async getProductStock(productId, locationId = null) {
    log('Obteniendo stock de producto:', productId);

    const domain = [['product_id', '=', productId]];
    if (locationId) {
      domain.push(['location_id', '=', locationId]);
    }

    const quants = await this.execute('stock.quant', 'search_read', [domain], {
      fields: ['id', 'quantity', 'location_id', 'product_id'],
    });

    const totalQty = quants.reduce((sum, q) => sum + (q.quantity || 0), 0);
    log('Stock total:', totalQty);

    return {
      totalQty,
      quants,
    };
  }
}

export const odooInventoryClient = new OdooInventoryClient();
