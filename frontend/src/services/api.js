// En producción (Vercel), la API está en el mismo dominio bajo /api
// En desarrollo, usa el backend local en puerto 3001
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api');

class ApiService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
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

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Si el token expiró, intentar refresh
    if (response.status === 401 && this.refreshToken) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
        return fetch(`${API_URL}${endpoint}`, { ...options, headers });
      }
    }

    return response;
  }

  async tryRefresh() {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.saveTokens(data.accessToken, this.refreshToken);
        return true;
      }
    } catch (e) {
      // Refresh failed
    }

    this.clearTokens();
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

    return data.user;
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignorar errores de logout
    }
    this.clearTokens();
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
   */
  async createRepairOrder(orderData) {
    const response = await this.request('/repair/create', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al crear orden');
    }

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

      const response = await fetch(healthUrl, {
        method: 'GET',
        cache: 'no-store',
      });
      const latency = Date.now() - start;
      return {
        online: response.ok,
        latency,
      };
    } catch (e) {
      return {
        online: false,
        latency: 0,
      };
    }
  }
}

export const api = new ApiService();
