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
 * Cliente JSON-RPC para Odoo Products (NCF)
 * Servidor separado para consulta de productos
 * Usa credenciales de admin configuradas en env
 */
class OdooProductsClient {
  constructor() {
    this.url = config.odooProducts.url;
    this.db = config.odooProducts.db;
    this.adminUser = config.odooProducts.adminUser;
    this.adminPassword = config.odooProducts.adminPassword;
    this.adminSession = null;

    log('Inicializando cliente Odoo Products:');
    log('  URL:', this.url);
    log('  DB:', this.db);
    log('  Admin User:', this.adminUser ? '***' : 'No configurado');
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
   * Autenticar con credenciales de admin y cachear la sesión
   */
  async ensureAdminSession() {
    // Si ya tenemos sesión válida, usarla
    if (this.adminSession) {
      log('Usando sesión de admin existente');
      return this.adminSession;
    }

    if (!this.adminUser || !this.adminPassword) {
      throw new AppError('Credenciales de Odoo Products no configuradas', 500);
    }

    log('Autenticando admin en Odoo Products');

    try {
      const { result, sessionId } = await this.jsonRpc('/web/session/authenticate', {
        db: this.db,
        login: this.adminUser,
        password: this.adminPassword,
      });

      if (!result || !result.uid || result.uid === false) {
        logError('Admin auth failed: No UID en respuesta');
        throw new AppError('No se pudo autenticar en Odoo Products', 500);
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
   * Invalidar sesión de admin (para reconectar)
   */
  clearAdminSession() {
    this.adminSession = null;
    log('Sesión de admin limpiada');
  }

  /**
   * Ejecutar método en modelo de Odoo usando sesión de admin
   */
  async execute(model, method, args = [], kwargs = {}) {
    log(`Execute: ${model}.${method}`);

    // Asegurar que tenemos sesión de admin
    const session = await this.ensureAdminSession();

    try {
      const { result } = await this.jsonRpc('/web/dataset/call_kw', {
        model,
        method,
        args,
        kwargs,
      }, session.sessionId);

      return result;
    } catch (error) {
      // Si la sesión expiró, limpiarla y reintentar
      if (error.message.includes('Session') || error.message.includes('Access')) {
        log('Sesión posiblemente expirada, reintentando...');
        this.clearAdminSession();
        const newSession = await this.ensureAdminSession();
        const { result } = await this.jsonRpc('/web/dataset/call_kw', {
          model,
          method,
          args,
          kwargs,
        }, newSession.sessionId);
        return result;
      }
      throw error;
    }
  }

  /**
   * Buscar producto por código de barras
   */
  async getProductByBarcode(barcode) {
    log('Buscando producto por barcode');

    const products = await this.execute('product.product', 'search_read', [
      [['barcode', '=', barcode]],
    ], {
      fields: ['id', 'name', 'barcode', 'default_code', 'list_price', 'standard_price', 'qty_available', 'categ_id', 'uom_id'],
      limit: 1,
    });

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
  async searchProducts(query) {
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
    });

    log('Productos encontrados:', products.length);
    return products;
  }
}

export const odooProductsClient = new OdooProductsClient();
