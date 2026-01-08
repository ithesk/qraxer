/**
 * Debug Logs Service
 *
 * Guarda logs de eventos importantes en localStorage para poder
 * revisarlos después sin necesidad de tener el dispositivo conectado a Xcode.
 */

const STORAGE_KEY = 'qraxer_debug_logs';
const MAX_LOGS = 100; // Máximo de logs a guardar

const debugLogsService = {
  /**
   * Agrega un log al historial
   * @param {string} category - Categoría del log (PUSH, LOCAL, DEVICE, etc.)
   * @param {string} event - Nombre del evento
   * @param {object} data - Datos adicionales
   */
  log(category, event, data = {}) {
    try {
      const logs = this.getLogs();

      const entry = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        category,
        event,
        data,
      };

      // Agregar al inicio
      logs.unshift(entry);

      // Limitar cantidad
      if (logs.length > MAX_LOGS) {
        logs.length = MAX_LOGS;
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));

      // También loguear a consola
      console.log(`[DEBUG] ${category} | ${event}:`, data);

      return entry;
    } catch (e) {
      console.error('[DebugLogs] Error guardando log:', e);
    }
  },

  /**
   * Obtiene todos los logs
   * @returns {Array} Lista de logs
   */
  getLogs() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('[DebugLogs] Error leyendo logs:', e);
      return [];
    }
  },

  /**
   * Obtiene logs filtrados por categoría
   * @param {string} category - Categoría a filtrar
   * @returns {Array} Logs filtrados
   */
  getLogsByCategory(category) {
    return this.getLogs().filter(log => log.category === category);
  },

  /**
   * Limpia todos los logs
   */
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      console.log('[DebugLogs] Logs limpiados');
    } catch (e) {
      console.error('[DebugLogs] Error limpiando logs:', e);
    }
  },

  /**
   * Exporta logs como texto
   * @returns {string} Logs formateados
   */
  exportAsText() {
    const logs = this.getLogs();
    return logs.map(log => {
      const dataStr = Object.keys(log.data).length > 0
        ? '\n    ' + JSON.stringify(log.data, null, 2).replace(/\n/g, '\n    ')
        : '';
      return `[${log.timestamp}] ${log.category} | ${log.event}${dataStr}`;
    }).join('\n\n');
  },

  // Métodos de conveniencia para diferentes categorías

  push(event, data) {
    return this.log('PUSH', event, data);
  },

  local(event, data) {
    return this.log('LOCAL', event, data);
  },

  device(event, data) {
    return this.log('DEVICE', event, data);
  },

  app(event, data) {
    return this.log('APP', event, data);
  },
};

export default debugLogsService;
