const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class ApiService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.loadTokens();
  }

  loadTokens() {
    this.accessToken = sessionStorage.getItem('accessToken');
    this.refreshToken = sessionStorage.getItem('refreshToken');
  }

  saveTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    sessionStorage.setItem('accessToken', accessToken);
    if (refreshToken) {
      sessionStorage.setItem('refreshToken', refreshToken);
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
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
    sessionStorage.setItem('user', JSON.stringify(data.user));

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
    const user = sessionStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
}

export const api = new ApiService();
