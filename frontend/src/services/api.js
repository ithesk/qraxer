import secureStorage from './secureStorage';

// En producción (Vercel), la API está en el mismo dominio bajo /api
// En desarrollo, usa el backend local en puerto 3001
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

// DEBUG: Log API configuration
console.log('[API] ========== CONFIG ==========');
console.log('[API] VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('[API] PROD mode:', import.meta.env.PROD);
console.log('[API] Final API_URL:', API_URL);
console.log('[API] ==============================');

class ApiService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.isRefreshing = false;
    this.refreshPromise = null;
    this.onSessionExpired = null; // Callback para cuando la sesión expira completamente
    this.loadTokens();
  }

  loadTokens() {
    this.accessToken = localStorage.getItem('accessToken');
    this.refreshToken = localStorage.getItem('refreshToken');
  }

  saveTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  isAuthenticated() {
    return !!this.accessToken;
  }

  async request(endpoint, options = {}, retryCount = 0) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    let response;
    try {
      response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (networkError) {
      // Error de red - no reintentar auth
      throw networkError;
    }

    // Si el token expiró (401) o no autorizado (403)
    if ((response.status === 401 || response.status === 403) && retryCount < 2) {
      console.log(`[API] Auth error ${response.status} on ${endpoint}, attempting recovery...`);

      // Paso 1: Intentar refresh token
      if (this.refreshToken) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          console.log('[API] Token refreshed successfully, retrying request...');
          return this.request(endpoint, options, retryCount + 1);
        }
      }

      // Paso 2: Si refresh falló, intentar re-login silencioso
      console.log('[API] Refresh failed, attempting silent re-login...');
      const relogged = await this.trySilentRelogin();
      if (relogged) {
        console.log('[API] Silent re-login successful, retrying request...');
        return this.request(endpoint, options, retryCount + 1);
      }

      // Paso 3: Todo falló, notificar sesión expirada
      console.log('[API] All recovery attempts failed, session expired');
      if (this.onSessionExpired) {
        this.onSessionExpired();
      }
    }

    return response;
  }

  async tryRefresh() {
    // Evitar múltiples refreshes simultáneos
    if (this.isRefreshing) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this._doRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  async _doRefresh() {
    try {
      console.log('[API] Attempting token refresh...');
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.saveTokens(data.accessToken, this.refreshToken);
        console.log('[API] Token refresh successful');
        return true;
      }
      console.log('[API] Token refresh failed with status:', response.status);
    } catch (e) {
      console.error('[API] Token refresh error:', e);
    }

    return false;
  }

  /**
   * Intenta re-autenticar silenciosamente usando credenciales guardadas
   */
  async trySilentRelogin() {
    try {
      const credentials = await secureStorage.getCredentials();
      if (!credentials) {
        console.log('[API] No saved credentials for silent re-login');
        return false;
      }

      console.log('[API] Attempting silent re-login...');
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        this.saveTokens(data.accessToken, data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        console.log('[API] Silent re-login successful');
        return true;
      }

      console.log('[API] Silent re-login failed with status:', response.status);
    } catch (e) {
      console.error('[API] Silent re-login error:', e);
    }

    return false;
  }

  async login(username, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error de autenticación');
    }

    this.saveTokens(data.accessToken, data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));

    // Guardar credenciales para re-login automático
    await secureStorage.saveCredentials(username, password);
    console.log('[API] Credentials saved for auto re-login');

    return data.user;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignorar errores de logout
    }
    this.clearTokens();
    // Limpiar credenciales guardadas
    await secureStorage.clearCredentials();
    console.log('[API] Credentials cleared on logout');
  }

  /**
   * Configura el callback para cuando la sesión expira completamente
   * (después de que refresh y re-login fallan)
   */
  setSessionExpiredCallback(callback) {
    this.onSessionExpired = callback;
  }

  async scanQR(qrContent) {
    const response = await this.request('/repair/scan', {
      method: 'POST',
      body: JSON.stringify({ qrContent }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al escanear QR');
    }

    return data;
  }

  async updateState(qrContent, newState, note) {
    const response = await this.request('/repair/update-state', {
      method: 'POST',
      body: JSON.stringify({ qrContent, newState, note }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al actualizar estado');
    }

    return data;
  }

  /**
   * Update repair state by repair ID (for History screen, bypasses QR validation)
   */
  async updateRepairState(repairId, newState, note = null) {
    const response = await this.request(`/repair/${repairId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newState, note }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Error al actualizar estado');
    }

    return response.json();
  }

  /**
   * Get repair details by ID
   */
  async getRepairById(repairId) {
    const response = await this.request(`/repair/by-id/${repairId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Error al obtener reparación');
    }

    const data = await response.json();
    return data.repair;
  }

  /**
   * Get available repair states
   */
  async getRepairStates() {
    const response = await this.request('/repair/states', {
      method: 'GET',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al obtener estados');
    }

    return data.states || [];
  }

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  // === Quick Creator Methods ===

  /**
   * Search client by phone
   */
  async searchClient(phone) {
    const response = await this.request('/clients/search', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al buscar cliente');
    }

    return data;
  }

  /**
   * Create new client
   */
  async createClient(name, phone, email = null) {
    const response = await this.request('/clients/create', {
      method: 'POST',
      body: JSON.stringify({ name, phone, email }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al crear cliente');
    }

    return data;
  }

  /**
   * Create repair order
   * @param {Object} orderData - Order data
   * @param {string} idempotencyKey - Optional key to prevent duplicates
   * @returns {Promise<{success: boolean, duplicate: boolean, repair: Object}>}
   */
  async createRepairOrder(orderData, idempotencyKey = null) {
    const payload = { ...orderData };
    if (idempotencyKey) {
      payload.idempotencyKey = idempotencyKey;
    }

    const response = await this.request('/repair/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al crear orden');
    }

    return data;
  }

  /**
   * Get repair form configuration (branches, leadSources, defaults)
   * Call this once at login and cache the result
   */
  async getRepairConfig() {
    console.log('[API] getRepairConfig() - starting...');
    console.log('[API] getRepairConfig() - accessToken exists:', !!this.accessToken);

    const response = await this.request('/repair/config', {
      method: 'GET',
    });

    console.log('[API] getRepairConfig() - response status:', response.status);

    const data = await response.json();
    console.log('[API] getRepairConfig() - data:', JSON.stringify(data));

    if (!response.ok) {
      console.error('[API] getRepairConfig() - ERROR:', data.error);
      throw new Error(data.error || 'Error al obtener configuracion');
    }

    console.log('[API] getRepairConfig() - branches count:', data.branches?.length || 0);
    return data;
  }

  /**
   * Get recent repairs for history
   */
  async getRecentRepairs(days = 7) {
    const response = await this.request(`/repair/recent?days=${days}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al obtener historial');
    }

    return data;
  }

  // === Product Methods ===

  /**
   * Get product by barcode
   */
  async getProductByBarcode(barcode) {
    const response = await this.request(`/products/barcode/${encodeURIComponent(barcode)}`, {
      method: 'GET',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al buscar producto');
    }

    return data;
  }

  /**
   * Search products by name/reference
   */
  async searchProducts(query) {
    const response = await this.request('/products/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al buscar productos');
    }

    return data;
  }

  // === Check-in Methods ===

  /**
   * Register customer check-in (customer arrived to pick up)
   */
  async checkin(qrContent) {
    const response = await this.request('/repair/checkin', {
      method: 'POST',
      body: JSON.stringify({ qrContent }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al registrar check-in');
    }

    return data;
  }

  /**
   * Get pending check-in notifications for current technician
   */
  async getPendingCheckins() {
    const response = await this.request('/repair/checkin/pending', {
      method: 'GET',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al obtener notificaciones');
    }

    return data;
  }

  /**
   * Respond to a check-in notification
   * @param {string} checkinId - ID of the check-in notification
   * @param {string} response - 'coming' | 'ready' | 'need_time'
   */
  async respondToCheckin(checkinId, responseType) {
    const response = await this.request('/repair/checkin/respond', {
      method: 'POST',
      body: JSON.stringify({ checkinId, response: responseType }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al responder');
    }

    return data;
  }

  /**
   * Quick check if currently online
   * @returns {Promise<boolean>}
   */
  async isOnline() {
    try {
      const result = await this.checkConnection();
      return result.online;
    } catch {
      return false;
    }
  }

  /**
   * Check API connection status
   * @returns {Promise<{online: boolean, latency: number}>}
   */
  async checkConnection() {
    const start = Date.now();
    try {
      // Build health URL - handle both relative and absolute URLs
      let healthUrl;
      if (API_URL.startsWith('/')) {
        // Relative URL in production
        healthUrl = '/health';
      } else {
        // Absolute URL in development
        healthUrl = API_URL.replace('/api', '/health');
      }

      console.log('[API] checkConnection - healthUrl:', healthUrl);

      const response = await fetch(healthUrl, {
        method: 'GET',
        cache: 'no-store',
      });
      const latency = Date.now() - start;
      console.log('[API] checkConnection - response:', response.status, response.ok, 'latency:', latency);
      return {
        online: response.ok,
        latency,
      };
    } catch (e) {
      console.error('[API] checkConnection - ERROR:', e.message, e);
      return {
        online: false,
        latency: 0,
      };
    }
  }

  // === Inventory Methods ===

  /**
   * Get inventory locations from Odoo
   * @returns {Promise<{locations: Array<{id: number, name: string, complete_name: string}>}>}
   */
  async getInventoryLocations() {
    const response = await this.request('/inventory/locations', {
      method: 'GET',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al obtener ubicaciones');
    }

    return data;
  }

  /**
   * Submit inventory count
   * @param {Array<{barcode: string, product_id: number, quantity: number, product_name: string}>} items
   * @param {number} locationId - Stock location ID
   * @param {string} notes - Optional notes
   * @returns {Promise<{success: boolean, adjustment_id: number}>}
   */
  async submitInventoryCount(items, locationId, notes = '') {
    const response = await this.request('/inventory/count', {
      method: 'POST',
      body: JSON.stringify({ items, locationId, notes }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al enviar conteo');
    }

    return data;
  }

  // === Repair Notes & Photos Methods ===

  /**
   * Add note to repair order chatter
   * @param {number} repairId - Repair order ID
   * @param {string} note - Note text
   * @returns {Promise<{success: boolean, repairId: number, repairName: string}>}
   */
  async addRepairNote(repairId, note) {
    const response = await this.request(`/repair/${repairId}/note`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al agregar nota');
    }

    return data;
  }

  /**
   * Upload photo to repair order chatter
   * @param {number} repairId - Repair order ID
   * @param {string} imageBase64 - Base64 encoded image
   * @param {string} filename - Optional filename
   * @param {string} description - Optional description
   * @returns {Promise<{success: boolean, repairId: number, attachmentId: number}>}
   */
  async uploadRepairPhoto(repairId, imageBase64, filename = null, description = null) {
    const response = await this.request(`/repair/${repairId}/photo`, {
      method: 'POST',
      body: JSON.stringify({
        image: imageBase64,
        filename,
        description,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al subir foto');
    }

    return data;
  }

  // === IMEI Lookup Methods ===

  /**
   * Lookup IMEI information via backend proxy to Supabase Edge Function
   * @param {string} imei - 15-digit IMEI number
   * @param {boolean} forceRefresh - Force fresh lookup (bypass cache)
   * @returns {Promise<{imei: string, fromCache: boolean, summary: Object, payload: Object}>}
   */
  async lookupImei(imei, forceRefresh = false) {
    const response = await this.request('/imei/lookup', {
      method: 'POST',
      body: JSON.stringify({ imei, forceRefresh }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al consultar IMEI');
    }

    return data;
  }

  /**
   * Check if IMEI lookup service is available
   * @returns {Promise<{enabled: boolean, message: string}>}
   */
  async getImeiStatus() {
    const response = await this.request('/imei/status', {
      method: 'GET',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al verificar servicio IMEI');
    }

    return data;
  }
}

export const api = new ApiService();
