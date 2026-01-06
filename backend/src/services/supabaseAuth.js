import { createClient } from '@supabase/supabase-js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio de autenticación con Supabase para llamar Edge Functions
 * Mantiene un token de usuario de servicio válido para hacer requests
 */
class SupabaseAuthService {
  constructor() {
    this.supabase = null;
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Inicializa el cliente de Supabase
   */
  initialize() {
    if (!config.supabase.enabled) {
      logger.info('[SupabaseAuth] Supabase no configurado, servicio deshabilitado');
      return false;
    }

    if (!config.supabase.serviceEmail || !config.supabase.servicePassword) {
      logger.warn('[SupabaseAuth] Credenciales de servicio no configuradas');
      return false;
    }

    this.supabase = createClient(config.supabase.url, config.supabase.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    logger.info('[SupabaseAuth] Cliente inicializado');
    return true;
  }

  /**
   * Obtiene un token válido, haciendo login o refresh si es necesario
   * @returns {Promise<string|null>} Access token o null si falla
   */
  async getValidToken() {
    if (!this.supabase) {
      if (!this.initialize()) {
        return null;
      }
    }

    // Si tenemos token y no ha expirado (con 5 min de margen)
    if (this.accessToken && this.tokenExpiresAt) {
      const now = Date.now();
      const margin = 5 * 60 * 1000; // 5 minutos
      if (now < this.tokenExpiresAt - margin) {
        return this.accessToken;
      }
    }

    // Intentar refresh si tenemos refresh token
    if (this.refreshToken) {
      try {
        const { data, error } = await this.supabase.auth.refreshSession({
          refresh_token: this.refreshToken,
        });

        if (!error && data?.session) {
          this.accessToken = data.session.access_token;
          this.refreshToken = data.session.refresh_token;
          this.tokenExpiresAt = Date.now() + (data.session.expires_in * 1000);
          logger.debug('[SupabaseAuth] Token refrescado exitosamente');
          return this.accessToken;
        }
      } catch (e) {
        logger.warn('[SupabaseAuth] Error en refresh:', e.message);
      }
    }

    // Hacer login fresco
    return this.login();
  }

  /**
   * Hace login con las credenciales de servicio
   * @returns {Promise<string|null>} Access token o null si falla
   */
  async login() {
    if (!this.supabase) {
      return null;
    }

    try {
      logger.debug('[SupabaseAuth] Haciendo login con usuario de servicio...');

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: config.supabase.serviceEmail,
        password: config.supabase.servicePassword,
      });

      if (error) {
        logger.error('[SupabaseAuth] Error en login:', error.message);
        return null;
      }

      if (!data?.session) {
        logger.error('[SupabaseAuth] Login exitoso pero sin sesión');
        return null;
      }

      this.accessToken = data.session.access_token;
      this.refreshToken = data.session.refresh_token;
      this.tokenExpiresAt = Date.now() + (data.session.expires_in * 1000);

      logger.info('[SupabaseAuth] Login exitoso, token válido por', data.session.expires_in, 'segundos');
      return this.accessToken;

    } catch (e) {
      logger.error('[SupabaseAuth] Excepción en login:', e.message);
      return null;
    }
  }

  /**
   * Verifica si el servicio está disponible
   */
  isEnabled() {
    return config.supabase.enabled &&
           !!config.supabase.serviceEmail &&
           !!config.supabase.servicePassword;
  }
}

export const supabaseAuth = new SupabaseAuthService();
