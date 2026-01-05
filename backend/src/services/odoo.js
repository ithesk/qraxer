import { config } from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';

const DEBUG = config.nodeEnv === 'development';

function log(...args) {
  if (DEBUG) {
    console.log('[ODOO]', ...args);
  }
}

function logError(...args) {
  console.error('[ODOO ERROR]', ...args);
}

/**
 * Almacén de sesiones de usuarios
 * Guarda la sesión de Odoo por cada usuario autenticado
 */
const userSessions = new Map();

/**
 * Cliente JSON-RPC para Odoo
 * Usa la sesión del usuario logueado para todas las operaciones
 */
class OdooClient {
  constructor() {
    this.url = config.odoo.url;
    this.db = config.odoo.db;

    log('Inicializando cliente Odoo:');
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

      // Incluir cookie de sesión si existe
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

      // Extraer session_id de la respuesta
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
          || 'Error de Odoo';
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
   * Autenticar usuario contra Odoo y guardar su sesión
   */
  async authenticate(username, password) {
    log('Autenticando usuario');

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

      // Guardar sesión del usuario
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
        partnerId: result.partner_id,
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
  getUserSession(userId) {
    return userSessions.get(userId);
  }

  /**
   * Eliminar sesión de usuario (logout)
   */
  removeUserSession(userId) {
    userSessions.delete(userId);
    log('Sesión eliminada para UID:', userId);
  }

  /**
   * Verificar si el usuario pertenece al grupo autorizado
   */
  async checkUserGroup(uid) {
    log('Verificando grupos para UID:', uid);

    // En desarrollo, skip la verificación
    if (DEBUG) {
      log('DEBUG: Saltando verificación de grupos');
      return true;
    }

    return true; // Por ahora permitir todos
  }

  /**
   * Ejecutar método en modelo de Odoo usando sesión del usuario
   */
  async execute(model, method, args = [], kwargs = {}, userId) {
    log(`Execute: ${model}.${method} (user: ${userId})`);

    const session = userSessions.get(userId);
    if (!session || !session.sessionId) {
      throw new AppError('Sesión de usuario no encontrada. Inicie sesión nuevamente.', 401);
    }

    const { result } = await this.jsonRpc('/web/dataset/call_kw', {
      model,
      method,
      args,
      kwargs,
    }, session.sessionId);

    return result;
  }

  /**
   * Buscar reparación por código (name) - ej: E707640
   */
  async getRepairByCode(code, userId) {
    log('Buscando reparación por código:', code);

    const repairs = await this.execute('repair.order', 'search_read', [
      [['name', '=', code]],
    ], {
      fields: ['id', 'name', 'state', 'product_id', 'partner_id', 'user_id', 'description'],
      limit: 1,
    }, userId);

    if (!repairs || repairs.length === 0) {
      log('Reparación no encontrada con código:', code);
      return null;
    }

    log('Reparación encontrada:', repairs[0].name, '- Estado:', repairs[0].state);
    return repairs[0];
  }

  /**
   * Obtener información de reparación por ID
   */
  async getRepairById(repairId, userId) {
    log('Obteniendo reparación por ID:', repairId);

    const repairs = await this.execute('repair.order', 'search_read', [
      [['id', '=', repairId]],
    ], {
      fields: ['id', 'name', 'state', 'product_id', 'partner_id', 'description'],
      limit: 1,
    }, userId);

    log('Reparación encontrada:', repairs[0] ? 'Sí' : 'No');
    return repairs[0] || null;
  }

  /**
   * Actualizar estado de reparación con auditoría y asignar usuario
   */
  async updateRepairState(repairId, newState, note, userId, userName) {
    log('Actualizando estado:', { repairId, newState, userId });

    const repair = await this.getRepairById(repairId, userId);
    if (!repair) {
      throw new AppError('Reparación no encontrada', 404);
    }

    const oldState = repair.state;

    // Actualizar estado Y asignar el usuario al campo user_id
    await this.execute('repair.order', 'write', [
      [repairId],
      {
        state: newState,
        user_id: userId,  // Asignar el usuario que hace el cambio
      },
    ], {}, userId);

    // Registrar en chatter para auditoría
    const auditMessage = `
<p><strong>Cambio de estado via QRaxer</strong></p>
<ul>
  <li><strong>Usuario:</strong> ${userName} (ID: ${userId})</li>
  <li><strong>Estado anterior:</strong> ${oldState}</li>
  <li><strong>Estado nuevo:</strong> ${newState}</li>
  <li><strong>Fecha:</strong> ${new Date().toISOString()}</li>
  ${note ? `<li><strong>Nota:</strong> ${note}</li>` : ''}
</ul>
    `.trim();

    try {
      await this.execute('repair.order', 'message_post', [repairId], {
        body: auditMessage,
        message_type: 'notification',
      }, userId);
    } catch (e) {
      log('Warning: No se pudo registrar en chatter:', e.message);
    }

    log('Estado actualizado correctamente');
    return { oldState, newState, repairId, repairName: repair.name };
  }

  /**
   * Buscar cliente/partner por teléfono
   */
  async searchPartnerByPhone(phone, userId) {
    log('Buscando cliente por teléfono');

    // Limpiar teléfono (solo dígitos)
    const cleanPhone = phone.replace(/\D/g, '');

    // Buscar en múltiples campos de teléfono
    const partners = await this.execute('res.partner', 'search_read', [
      ['|', '|',
        ['phone', 'ilike', cleanPhone],
        ['mobile', 'ilike', cleanPhone],
        ['phone', 'ilike', phone]
      ],
    ], {
      fields: ['id', 'name', 'phone', 'mobile', 'email'],
      limit: 5,
    }, userId);

    log('Clientes encontrados:', partners.length);
    return partners;
  }

  /**
   * Crear nuevo cliente/partner
   */
  async createPartner(data, userId) {
    log('Creando nuevo cliente');

    const partnerData = {
      name: data.name,
      phone: data.phone || false,
      mobile: data.phone || false,
      email: data.email || false,
      customer_rank: 1,
    };

    const partnerId = await this.execute('res.partner', 'create', [partnerData], {}, userId);

    log('Cliente creado con ID:', partnerId);

    // Obtener el cliente recién creado
    const partners = await this.execute('res.partner', 'search_read', [
      [['id', '=', partnerId]],
    ], {
      fields: ['id', 'name', 'phone', 'mobile', 'email'],
      limit: 1,
    }, userId);

    return partners[0] || { id: partnerId, name: data.name, phone: data.phone };
  }

  /**
   * Buscar producto por nombre (modelo de equipo)
   */
  async searchProduct(name, userId) {
    log('Buscando producto:', name);

    const products = await this.execute('product.product', 'search_read', [
      [['name', '=ilike', name]],
    ], {
      fields: ['id', 'name', 'default_code'],
      limit: 1,
    }, userId);

    if (products && products.length > 0) {
      log('Producto encontrado:', products[0].id, products[0].name);
      return products[0];
    }

    log('Producto no encontrado');
    return null;
  }

  /**
   * Crear producto (modelo de equipo) en Odoo
   */
  async createProduct(name, brand, userId) {
    log('Creando producto:', name, '- Marca:', brand);

    const productData = {
      name: name,
      default_code: brand ? `${brand.toUpperCase().slice(0, 3)}-${name.replace(/\s+/g, '-').toUpperCase()}` : null,
      type: 'consu', // Consumible (no requiere inventario)
      categ_id: 1, // Categoría por defecto
    };

    const productId = await this.execute('product.product', 'create', [productData], {}, userId);

    log('Producto creado con ID:', productId);

    return { id: productId, name: name };
  }

  /**
   * Buscar o crear producto (modelo de equipo)
   * Evita duplicados buscando primero
   */
  async findOrCreateProduct(modelName, brand, userId) {
    log('findOrCreateProduct:', modelName);

    if (!modelName) {
      log('No se proporcionó nombre de modelo');
      return null;
    }

    // Buscar primero
    let product = await this.searchProduct(modelName, userId);

    if (product) {
      return product;
    }

    // No existe, crear
    product = await this.createProduct(modelName, brand, userId);
    return product;
  }

  /**
   * Crear nueva orden de reparación
   * Campos obligatorios según XML de Odoo:
   * - partner_id, imei, lead_source, description, branch_id, schedule_date_str, estimated_budget
   */
  async createRepairOrder(data, userId, userName) {
    log('Creando orden de reparación');
    log('Data recibida:', JSON.stringify(data, null, 2));

    // Construir descripción del problema
    const problemLabels = {
      screen: 'Pantalla',
      battery: 'Batería',
      charging: 'Carga',
      power: 'No enciende',
      software: 'Software',
      diagnostic: 'Diagnóstico',
    };

    const problemText = (data.problems || [])
      .map(p => problemLabels[p] || p)
      .join(', ');

    // La descripción ahora es solo el problema (el equipo va en product_id)
    const description = problemText || 'Diagnóstico general';

    // Buscar o crear producto (modelo del equipo) para product_id
    let productId = null;
    if (data.equipment?.model) {
      try {
        const product = await this.findOrCreateProduct(
          data.equipment.model,
          data.equipment.brand,
          userId
        );
        if (product) {
          productId = product.id;
        }
      } catch (e) {
        log('Warning: No se pudo obtener/crear producto:', e.message);
      }
    }

    // Si no hay product_id, es un error (campo obligatorio)
    if (!productId) {
      throw new Error('Se requiere un modelo de equipo válido');
    }

    // Construir datos de la orden con campos de Odoo
    const repairData = {
      // Campos obligatorios
      partner_id: data.clientId,
      product_id: productId,
      imei: data.equipment?.serial || 'N/A',
      description: description,
      branch_id: data.branchId,
      lead_source: data.leadSource || 'walk_in',
      schedule_date_str: data.deliveryDate || this.getDefaultDeliveryDate(),
      estimated_budget: data.estimatedBudget || 0,

      // Campos del sistema
      state: 'draft',
      user_id: userId,

      // Campo de estado del equipo (encendido/apagado)
      powerstate: data.equipment?.status === 'on',

      // Contraseña del equipo
      passcode: data.equipment?.password || false,
    };

    // Agregar campos de funcionalidad solo si powerstate es true
    if (data.equipment?.status === 'on' && data.equipment?.functionalityChecks) {
      const checks = data.equipment.functionalityChecks;
      // Mapear checks del frontend a campos de Odoo
      if (checks.battery !== undefined) repairData.battery = checks.battery;
      if (checks.wifi !== undefined) repairData.wifi = checks.wifi;
      if (checks.signal !== undefined) repairData.signal = checks.signal;
      if (checks.screen !== undefined) repairData.screen = checks.screen;
      if (checks.touch !== undefined) repairData.touch = checks.touch;
      if (checks.camera !== undefined) repairData.camera = checks.camera;
      if (checks.microphone !== undefined) repairData.microphone = checks.microphone;
      if (checks.speaker !== undefined) repairData.speaker = checks.speaker;
      if (checks.charging !== undefined) repairData.charging = checks.charging;
      if (checks.buttons !== undefined) repairData.buttons = checks.buttons;
      if (checks.faceid !== undefined) repairData.faceid = checks.faceid;
      if (checks.truetone !== undefined) repairData.truetone = checks.truetone;
      if (checks.flash !== undefined) repairData.flash = checks.flash;
      if (checks.camerafront !== undefined) repairData.camerafront = checks.camerafront;
      if (checks.earphone !== undefined) repairData.earphone = checks.earphone;
    }

    // Campos adicionales opcionales
    if (data.equipment?.cover !== undefined) repairData.cover = data.equipment.cover;
    if (data.equipment?.accessories !== undefined) repairData.accessories = data.equipment.accessories;
    if (data.equipment?.screw !== undefined) repairData.screw = data.equipment.screw;
    if (data.equipment?.sim !== undefined) repairData.sim = data.equipment.sim;

    // Tipo de reparación (smartphone por defecto)
    repairData.typerepair = data.equipment?.type || 'smartphone';

    // Nota adicional en descripción si existe
    if (data.note) {
      repairData.description = `${description}\n\nNota: ${data.note}`;
    }

    log('repairData a enviar:', JSON.stringify(repairData, null, 2));

    // Crear la orden
    const repairId = await this.execute('repair.order', 'create', [repairData], {}, userId);

    log('Orden creada con ID:', repairId);

    // Obtener la orden recién creada para obtener el nombre (código)
    const repairs = await this.execute('repair.order', 'search_read', [
      [['id', '=', repairId]],
    ], {
      fields: ['id', 'name', 'state', 'partner_id', 'description', 'branch_id'],
      limit: 1,
    }, userId);

    const repair = repairs[0];

    // Registrar en chatter
    try {
      const message = `
<p><strong>Orden creada via QRaxer Quick Creator</strong></p>
<ul>
  <li><strong>Usuario:</strong> ${userName} (ID: ${userId})</li>
  <li><strong>Equipo:</strong> ${data.equipment?.brand} ${data.equipment?.model}</li>
  <li><strong>IMEI:</strong> ${data.equipment?.serial || 'N/A'}</li>
  <li><strong>Fecha:</strong> ${new Date().toISOString()}</li>
</ul>
      `.trim();

      await this.execute('repair.order', 'message_post', [repairId], {
        body: message,
        message_type: 'notification',
      }, userId);
    } catch (e) {
      log('Warning: No se pudo registrar en chatter:', e.message);
    }

    return {
      id: repair.id,
      name: repair.name,
      state: repair.state,
      partner: repair.partner_id ? repair.partner_id[1] : null,
      branch: repair.branch_id ? repair.branch_id[1] : null,
      description: repair.description,
    };
  }

  /**
   * Helper: Obtener fecha de entrega por defecto (hoy + 3 días)
   */
  getDefaultDeliveryDate() {
    const date = new Date();
    date.setDate(date.getDate() + 3);
    return date.toISOString().split('T')[0];
  }

  /**
   * Obtener órdenes recientes con info del cliente
   */
  async getRecentRepairs(userId, days = 7) {
    log('Obteniendo órdenes recientes, días:', days);

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const dateStr = dateFrom.toISOString().split('T')[0];

    const repairs = await this.execute('repair.order', 'search_read', [
      [['create_date', '>=', dateStr]],
    ], {
      fields: ['id', 'name', 'state', 'partner_id', 'product_id', 'description', 'create_date', 'user_id'],
      order: 'create_date desc',
      limit: 50,
    }, userId);

    log('Órdenes recientes encontradas:', repairs.length);

    // Obtener info adicional de los partners (teléfono)
    const partnerIds = repairs
      .filter(r => r.partner_id)
      .map(r => r.partner_id[0]);

    if (partnerIds.length > 0) {
      const uniquePartnerIds = [...new Set(partnerIds)];
      const partners = await this.execute('res.partner', 'search_read', [
        [['id', 'in', uniquePartnerIds]],
      ], {
        fields: ['id', 'phone', 'mobile'],
      }, userId);

      // Crear mapa de partner -> teléfono
      const partnerPhones = {};
      partners.forEach(p => {
        partnerPhones[p.id] = p.mobile || p.phone || null;
      });

      // Agregar teléfono a cada reparación
      repairs.forEach(r => {
        if (r.partner_id) {
          r.partner_phone = partnerPhones[r.partner_id[0]] || null;
        }
      });
    }

    return repairs;
  }

  /**
   * Obtener sucursales (branches) disponibles
   * Nota: branch_id en repair.order es Many2one a repair.location
   */
  async getBranches(userId) {
    log('Obteniendo sucursales (repair.location)...');

    try {
      const branches = await this.execute('repair.location', 'search_read', [
        [],
      ], {
        fields: ['id', 'name'],
        order: 'name asc',
      }, userId);

      log('Sucursales encontradas:', branches.length);
      return branches;
    } catch (e) {
      log('Error obteniendo sucursales:', e.message);
      return [];
    }
  }

  /**
   * Obtener fuentes de lead (lead_source) - campo selection de repair.order
   */
  async getLeadSources(userId) {
    log('Obteniendo fuentes de lead...');

    try {
      const fields = await this.execute('repair.order', 'fields_get', [], {
        attributes: ['selection'],
        allfields: ['lead_source'],
      }, userId);

      if (fields.lead_source && fields.lead_source.selection) {
        const sources = fields.lead_source.selection.map(([value, label]) => ({
          value,
          label,
        }));
        log('Fuentes de lead obtenidas:', sources);
        return sources;
      }
    } catch (e) {
      log('Error obteniendo fuentes de lead:', e.message);
    }

    // Valores por defecto
    return [
      { value: 'walk_in', label: 'Cliente directo' },
      { value: 'referral', label: 'Referido' },
      { value: 'social', label: 'Redes sociales' },
      { value: 'website', label: 'Sitio web' },
    ];
  }

  /**
   * Obtener configuración para el formulario de reparación
   * Incluye branches, lead_sources y valores por defecto
   */
  async getRepairConfig(userId) {
    log('Obteniendo configuración de reparación...');

    const [branches, leadSources] = await Promise.all([
      this.getBranches(userId),
      this.getLeadSources(userId),
    ]);

    // Calcular fecha de entrega por defecto (hoy + 3 días)
    const defaultDeliveryDate = new Date();
    defaultDeliveryDate.setDate(defaultDeliveryDate.getDate() + 3);
    const defaultDeliveryStr = defaultDeliveryDate.toISOString().split('T')[0];

    return {
      branches,
      leadSources,
      defaults: {
        leadSource: leadSources.length > 0 ? leadSources[0].value : 'walk_in',
        deliveryDate: defaultDeliveryStr,
        estimatedBudget: 0,
      },
    };
  }

  /**
   * Obtener estados disponibles para reparación desde Odoo
   */
  async getRepairStates(userId) {
    log('Obteniendo estados de repair.order...');

    try {
      // Obtener la definición del campo state del modelo repair.order
      const fields = await this.execute('repair.order', 'fields_get', [], {
        attributes: ['selection'],
        allfields: ['state'],
      }, userId);

      if (fields.state && fields.state.selection) {
        const states = fields.state.selection.map(([value, label]) => ({
          value,
          label,
        }));
        log('Estados obtenidos de Odoo:', states);
        return states;
      }
    } catch (e) {
      log('Error obteniendo estados de Odoo, usando valores por defecto:', e.message);
    }

    // Valores por defecto si no se pueden obtener de Odoo
    return [
      { value: 'draft', label: 'Presupuesto' },
      { value: 'confirmed', label: 'Confirmado' },
      { value: 'under_repair', label: 'En reparación' },
      { value: 'ready', label: 'Reparado' },
      { value: 'done', label: 'Hecho' },
      { value: 'cancel', label: 'Cancelado' },
    ];
  }

}

export const odooClient = new OdooClient();
