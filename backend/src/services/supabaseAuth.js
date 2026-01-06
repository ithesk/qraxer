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
    logger.info('[SupabaseAuth] initialize() llamado');
    logger.info('[SupabaseAuth]   config.supabase.enabled:', config.supabase.enabled);
    logger.info('[SupabaseAuth]   config.supabase.url:', config.supabase.url ? config.supabase.url.substring(0, 40) + '...' : 'NOT SET');
    logger.info('[SupabaseAuth]   config.supabase.anonKey exists:', !!config.supabase.anonKey);
    logger.info('[SupabaseAuth]   config.supabase.serviceEmail:', config.supabase.serviceEmail || 'NOT SET');
    logger.info('[SupabaseAuth]   config.supabase.servicePassword length:', config.supabase.servicePassword?.length || 0);

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

    logger.info('[SupabaseAuth] Cliente Supabase creado exitosamente');
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
      logger.error('[SupabaseAuth] login() llamado sin cliente Supabase inicializado');
      return null;
    }

    try {
      // Debug: mostrar credenciales (parcialmente)
      const email = config.supabase.serviceEmail;
      const passLength = config.supabase.servicePassword?.length || 0;
      logger.info(`[SupabaseAuth] Intentando login con email: ${email}, password length: ${passLength}`);

      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: config.supabase.serviceEmail,
        password: config.supabase.servicePassword,
      });

      if (error) {
        logger.error('[SupabaseAuth] Error en login:', error.message);
        logger.error('[SupabaseAuth] Error code:', error.code || 'N/A');
        logger.error('[SupabaseAuth] Error status:', error.status || 'N/A');
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
