import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

const DEBUG = config.nodeEnv === 'development';

function log(...args) {
  if (DEBUG) {
    console.log('[ODOO-PRODUCTS]', ...args);
  }
}

function logError(...args) {
  console.error('[ODOO-PRODUCTS ERROR]', ...args);
}

/**
 * Almacén de sesiones de usuarios para Odoo Products
 */
const userSessions = new Map();

/**
 * Cliente JSON-RPC para Odoo Products (NCF)
 * Servidor separado para consulta de productos
 */
class OdooProductsClient {
  constructor() {
    this.url = config.odooProducts.url;
    this.db = config.odooProducts.db;

    log('Inicializando cliente Odoo Products:');
    log('  URL:', this.url);
    log('  DB:', this.db);
  }

  /**
   * Hacer request JSON-RPC con sesión de usuario específico
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
          || 'Error de Odoo Products';
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
   * Autenticar usuario contra Odoo Products
   * Usa las mismas credenciales que el usuario usó en el Odoo principal
   */
  async authenticate(username, password) {
    log('Autenticando usuario en Odoo Products');

    try {
      const { result, sessionId } = await this.jsonRpc('/web/session/authenticate', {
        db: this.db,
        login: username,
        password: password,
      });

      log('Auth result keys:', Object.keys(result || {}));

      if (!result || !result.uid || result.uid === false) {
        log('Auth failed: No UID en respuesta');
        return null;
      }

      log('Auth success: UID =', result.uid);

      const userSession = {
        uid: result.uid,
        sessionId: sessionId,
        username: username,
        name: result.name,
      };
      userSessions.set(result.uid, userSession);
      log('Sesión guardada para UID:', result.uid);

      return {
        uid: result.uid,
        username: result.username || username,
        name: result.name,
        sessionId: sessionId,
      };
    } catch (error) {
      logError('Auth exception:', error.message);
      throw error;
    }
  }

  /**
   * Obtener sesión de un usuario
   */
  getUserSession(odooProductsUid) {
    return userSessions.get(odooProductsUid);
  }

  /**
   * Guardar sesión externa (cuando se autentica desde otro lado)
   */
  setUserSession(uid, session) {
    userSessions.set(uid, session);
  }

  /**
   * Eliminar sesión de usuario
   */
  removeUserSession(uid) {
    userSessions.delete(uid);
    log('Sesión eliminada para UID:', uid);
  }

  /**
   * Ejecutar método en modelo de Odoo usando sesión del usuario
   */
  async execute(model, method, args = [], kwargs = {}, sessionId) {
    log(`Execute: ${model}.${method}`);

    if (!sessionId) {
      throw new AppError('Sesión de Odoo Products no encontrada. Inicie sesión nuevamente.', 401);
    }

    const { result } = await this.jsonRpc('/web/dataset/call_kw', {
      model,
      method,
      args,
      kwargs,
    }, sessionId);

    return result;
  }

  /**
   * Buscar producto por código de barras
   */
  async getProductByBarcode(barcode, sessionId) {
    log('Buscando producto por barcode');

    const products = await this.execute('product.product', 'search_read', [
      [['barcode', '=', barcode]],
    ], {
      fields: ['id', 'name', 'barcode', 'default_code', 'list_price', 'standard_price', 'qty_available', 'categ_id', 'uom_id'],
      limit: 1,
    }, sessionId);

    if (!products || products.length === 0) {
      log('Producto no encontrado con barcode:', barcode);
      return null;
    }

    log('Producto encontrado:', products[0].name);
    return products[0];
  }

  /**
   * Buscar productos por nombre o referencia
   */
  async searchProducts(query, sessionId) {
    log('Buscando productos');

    const products = await this.execute('product.product', 'search_read', [
      ['|', '|',
        ['name', 'ilike', query],
        ['default_code', 'ilike', query],
        ['barcode', 'ilike', query]
      ],
    ], {
      fields: ['id', 'name', 'barcode', 'default_code', 'list_price', 'qty_available'],
      limit: 20,
    }, sessionId);

    log('Productos encontrados:', products.length);
    return products;
  }
}

export const odooProductsClient = new OdooProductsClient();
