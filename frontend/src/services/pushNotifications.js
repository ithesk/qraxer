/**
 * Push Notifications Service for iOS (Capacitor)
 *
 * Maneja el registro de dispositivo y recepción de notificaciones push
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api } from './api';

class PushNotificationsService {
  constructor() {
    this.initialized = false;
    this.token = null;
    this.listeners = [];
  }

  /**
   * Verifica si push notifications está soportado
   */
  isSupported() {
    const isNative = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    console.log('[PUSH] Platform:', platform, '| isNative:', isNative);
    return isNative;
  }

  /**
   * Inicializa push notifications
   * Debe llamarse después del login
   */
  async initialize() {
    if (!this.isSupported()) {
      console.log('[PUSH] No soportado en esta plataforma');
      return false;
    }

    if (this.initialized) {
      console.log('[PUSH] Ya inicializado');
      return true;
    }

    try {
      // Verificar/solicitar permisos
      const permStatus = await PushNotifications.checkPermissions();
      console.log('[PUSH] Permisos actuales:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        const newStatus = await PushNotifications.requestPermissions();
        if (newStatus.receive !== 'granted') {
          console.log('[PUSH] Permisos denegados');
          return false;
        }
      } else if (permStatus.receive !== 'granted') {
        console.log('[PUSH] Permisos no otorgados:', permStatus.receive);
        return false;
      }

      // Configurar listeners
      this.setupListeners();

      // Registrar para recibir push
      await PushNotifications.register();

      this.initialized = true;
      console.log('[PUSH] Inicializado correctamente');
      return true;
    } catch (error) {
      console.error('[PUSH] Error al inicializar:', error);
      return false;
    }
  }

  /**
   * Configura los listeners de eventos
   */
  setupListeners() {
    // Token recibido - registrar en backend
    PushNotifications.addListener('registration', async (token) => {
      console.log('[PUSH] 🔑 Token recibido:', token.value?.substring(0, 20) + '...');
      console.log('[PUSH] 🔑 Timestamp:', new Date().toISOString());
      this.token = token.value;

      // Registrar token en el backend
      await this.registerTokenWithBackend(token.value);
    });

    // Error de registro
    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PUSH] ❌ Error de registro:', error);
    });

    // Notificación recibida (app en foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PUSH] 📬 Notificación PUSH recibida (foreground):');
      console.log('[PUSH] 📬 Title:', notification.title);
      console.log('[PUSH] 📬 Body:', notification.body);
      console.log('[PUSH] 📬 Data:', JSON.stringify(notification.data));
      console.log('[PUSH] 📬 Timestamp:', new Date().toISOString());
      this.notifyListeners('received', notification);
    });

    // Notificación abierta (usuario tocó la notificación)
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[PUSH] 👆 Acción realizada (tocó notificación):');
      console.log('[PUSH] 👆 ActionId:', action.actionId);
      console.log('[PUSH] 👆 Notification:', JSON.stringify(action.notification));
      console.log('[PUSH] 👆 Timestamp:', new Date().toISOString());
      this.notifyListeners('action', action);
    });
  }

  /**
   * Registra el token en el backend
   */
  async registerTokenWithBackend(token) {
    if (!api.isAuthenticated()) {
      console.log('[PUSH] No autenticado, saltando registro de token');
      return;
    }

    try {
      const response = await api.request('/devices/register', {
        method: 'POST',
        body: JSON.stringify({
          token,
          platform: 'ios',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('[PUSH] Token registrado en backend:', data);
      } else {
        console.error('[PUSH] Error registrando token:', data.error);
      }
    } catch (error) {
      console.error('[PUSH] Error de red al registrar token:', error);
    }
  }

  /**
   * Desregistra el token del backend (llamar en logout)
   */
  async unregisterToken() {
    if (!this.token || !api.isAuthenticated()) {
      return;
    }

    try {
      await api.request('/devices/unregister', {
        method: 'DELETE',
        body: JSON.stringify({ token: this.token }),
      });
      console.log('[PUSH] Token desregistrado');
    } catch (error) {
      console.error('[PUSH] Error al desregistrar token:', error);
    }

    this.token = null;
  }

  /**
   * Agrega un listener para eventos de notificación
   * @param {Function} callback - (type, data) => void
   * @returns {Function} - Función para remover el listener
   */
  addListener(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Notifica a todos los listeners
   */
  notifyListeners(type, data) {
    this.listeners.forEach(callback => {
      try {
        callback(type, data);
      } catch (e) {
        console.error('[PUSH] Error en listener:', e);
      }
    });
  }

  /**
   * Obtiene el estado actual de push
   */
  async getStatus() {
    if (!this.isSupported()) {
      return { supported: false };
    }

    try {
      const permStatus = await PushNotifications.checkPermissions();
      return {
        supported: true,
        permission: permStatus.receive,
        registered: this.initialized,
        token: this.token ? this.token.substring(0, 20) + '...' : null,
      };
    } catch (error) {
      return {
        supported: true,
        permission: 'unknown',
        error: error.message,
      };
    }
  }

  /**
   * Limpia los listeners (llamar al desmontar la app)
   */
  async cleanup() {
    await PushNotifications.removeAllListeners();
    this.listeners = [];
    this.initialized = false;
  }
}

export const pushService = new PushNotificationsService();
export default pushService;
