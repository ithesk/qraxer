import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// IDs fijos para las notificaciones programadas
const NOTIFICATION_IDS = {
  MORNING_REMINDER: 1001,
  EVENING_REMINDER: 1002,
};

const localNotificationsService = {
  /**
   * Verifica si las notificaciones locales están soportadas
   */
  isSupported() {
    return Capacitor.isNativePlatform();
  },

  /**
   * Solicita permisos para notificaciones
   */
  async requestPermissions() {
    if (!this.isSupported()) return false;

    try {
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    } catch (e) {
      console.error('[LocalNotifications] Error requesting permissions:', e);
      return false;
    }
  },

  /**
   * Verifica si tiene permisos
   */
  async checkPermissions() {
    if (!this.isSupported()) return false;

    try {
      const result = await LocalNotifications.checkPermissions();
      return result.display === 'granted';
    } catch (e) {
      console.error('[LocalNotifications] Error checking permissions:', e);
      return false;
    }
  },

  /**
   * Calcula la próxima fecha para una hora específica
   * @param {number} hour - Hora del día (0-23)
   * @param {number} minute - Minutos (0-59)
   */
  getNextScheduleDate(hour, minute = 0) {
    const now = new Date();
    const scheduled = new Date();
    scheduled.setHours(hour, minute, 0, 0);

    // Si ya pasó la hora hoy, programar para mañana
    if (scheduled <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }

    return scheduled;
  },

  /**
   * Programa las notificaciones de recordatorio diarias
   * - 9:00 AM: Recordatorio de inicio de día
   * - 5:00 PM: Recordatorio de cierre de reparaciones
   */
  async scheduleRepairReminders() {
    if (!this.isSupported()) {
      console.log('[LocalNotifications] Not supported on this platform');
      return false;
    }

    // Solicitar permisos si no los tiene
    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.warn('[LocalNotifications] Permission denied');
      return false;
    }

    try {
      // Cancelar notificaciones existentes primero
      await this.cancelRepairReminders();

      const morningDate = this.getNextScheduleDate(9, 0);  // 9:00 AM
      const eveningDate = this.getNextScheduleDate(17, 0); // 5:00 PM

      await LocalNotifications.schedule({
        notifications: [
          {
            id: NOTIFICATION_IDS.MORNING_REMINDER,
            title: 'Buenos dias',
            body: 'Revisa tus reparaciones pendientes para hoy',
            schedule: {
              at: morningDate,
              repeats: true,
              every: 'day',
            },
            sound: 'default',
            actionTypeId: 'OPEN_APP',
            extra: {
              type: 'morning_reminder',
            },
          },
          {
            id: NOTIFICATION_IDS.EVENING_REMINDER,
            title: 'Cierre del dia',
            body: 'Recuerda actualizar el estado de tus reparaciones antes de salir',
            schedule: {
              at: eveningDate,
              repeats: true,
              every: 'day',
            },
            sound: 'default',
            actionTypeId: 'OPEN_APP',
            extra: {
              type: 'evening_reminder',
            },
          },
        ],
      });

      console.log('[LocalNotifications] Reminders scheduled successfully');
      console.log('  Morning:', morningDate.toLocaleString());
      console.log('  Evening:', eveningDate.toLocaleString());

      return true;
    } catch (e) {
      console.error('[LocalNotifications] Error scheduling reminders:', e);
      return false;
    }
  },

  /**
   * Cancela las notificaciones de recordatorio
   */
  async cancelRepairReminders() {
    if (!this.isSupported()) return;

    try {
      await LocalNotifications.cancel({
        notifications: [
          { id: NOTIFICATION_IDS.MORNING_REMINDER },
          { id: NOTIFICATION_IDS.EVENING_REMINDER },
        ],
      });
      console.log('[LocalNotifications] Reminders cancelled');
    } catch (e) {
      console.error('[LocalNotifications] Error cancelling reminders:', e);
    }
  },

  /**
   * Lista las notificaciones pendientes (para debug)
   */
  async getPendingNotifications() {
    if (!this.isSupported()) return [];

    try {
      const result = await LocalNotifications.getPending();
      return result.notifications;
    } catch (e) {
      console.error('[LocalNotifications] Error getting pending:', e);
      return [];
    }
  },

  /**
   * Agrega un listener para cuando se toca una notificación
   */
  addActionListener(callback) {
    if (!this.isSupported()) return () => {};

    const listener = LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (notification) => {
        console.log('[LocalNotifications] Action performed:', notification);
        callback(notification);
      }
    );

    return () => listener.remove();
  },

  /**
   * Envía una notificación inmediata (para testing)
   */
  async sendTestNotification() {
    if (!this.isSupported()) {
      console.log('[LocalNotifications] Not supported');
      return false;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return false;

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 9999,
            title: 'Test de notificacion',
            body: 'Esta es una notificacion de prueba',
            schedule: { at: new Date(Date.now() + 3000) }, // En 3 segundos
            sound: 'default',
          },
        ],
      });
      console.log('[LocalNotifications] Test notification scheduled');
      return true;
    } catch (e) {
      console.error('[LocalNotifications] Error sending test:', e);
      return false;
    }
  },
};

export default localNotificationsService;
