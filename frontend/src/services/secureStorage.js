/**
 * Secure Storage Service
 * Guarda credenciales de forma segura para re-autenticación automática
 *
 * En iOS: Usa Capacitor Preferences (almacenamiento seguro)
 * En Web: Usa localStorage con ofuscación básica (no es seguro, solo para desarrollo)
 */

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const KEYS = {
  CREDENTIALS: 'qraxer_auth_creds',
};

// Ofuscación simple para web (NO es seguro, solo para desarrollo)
const encode = (str) => {
  try {
    return btoa(encodeURIComponent(str));
  } catch {
    return str;
  }
};

const decode = (str) => {
  try {
    return decodeURIComponent(atob(str));
  } catch {
    return str;
  }
};

const secureStorage = {
  /**
   * Guarda las credenciales del usuario
   * @param {string} username
   * @param {string} password
   */
  async saveCredentials(username, password) {
    const data = JSON.stringify({ u: username, p: password });

    if (Capacitor.isNativePlatform()) {
      // En iOS/Android, usa Preferences (más seguro)
      await Preferences.set({
        key: KEYS.CREDENTIALS,
        value: encode(data),
      });
    } else {
      // En web, usa localStorage con ofuscación básica
      localStorage.setItem(KEYS.CREDENTIALS, encode(data));
    }
  },

  /**
   * Obtiene las credenciales guardadas
   * @returns {Promise<{username: string, password: string} | null>}
   */
  async getCredentials() {
    try {
      let encoded;

      if (Capacitor.isNativePlatform()) {
        const result = await Preferences.get({ key: KEYS.CREDENTIALS });
        encoded = result.value;
      } else {
        encoded = localStorage.getItem(KEYS.CREDENTIALS);
      }

      if (!encoded) return null;

      const data = JSON.parse(decode(encoded));
      return {
        username: data.u,
        password: data.p,
      };
    } catch (e) {
      console.error('[SecureStorage] Error getting credentials:', e);
      return null;
    }
  },

  /**
   * Elimina las credenciales guardadas
   */
  async clearCredentials() {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key: KEYS.CREDENTIALS });
    } else {
      localStorage.removeItem(KEYS.CREDENTIALS);
    }
  },

  /**
   * Verifica si hay credenciales guardadas
   * @returns {Promise<boolean>}
   */
  async hasCredentials() {
    const creds = await this.getCredentials();
    return creds !== null;
  },
};

export default secureStorage;
