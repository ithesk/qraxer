/**
 * Database Service - SQLite para persistencia local
 *
 * Almacena tokens de dispositivos para push notifications
 */

import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/qraxer.db');

let db = null;

/**
 * Inicializa la base de datos y crea tablas si no existen
 */
function initialize() {
  try {
    // Crear directorio data si no existe
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    db = new Database(DB_PATH);

    // Habilitar WAL mode para mejor rendimiento
    db.pragma('journal_mode = WAL');

    // Crear tabla de device tokens
    db.exec(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        platform TEXT NOT NULL DEFAULT 'ios',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);
    `);

    logger.info('[DB] Base de datos inicializada:', DB_PATH);
    return true;
  } catch (error) {
    logger.error('[DB] Error inicializando base de datos:', error.message);
    return false;
  }
}

/**
 * Registra o actualiza un token de dispositivo
 */
function upsertDeviceToken(userId, token, platform = 'ios') {
  if (!db) return false;

  try {
    const stmt = db.prepare(`
      INSERT INTO device_tokens (user_id, token, platform, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(token) DO UPDATE SET
        user_id = excluded.user_id,
        platform = excluded.platform,
        updated_at = datetime('now')
    `);

    stmt.run(userId, token, platform);
    logger.debug(`[DB] Token guardado para usuario ${userId}`);
    return true;
  } catch (error) {
    logger.error('[DB] Error guardando token:', error.message);
    return false;
  }
}

/**
 * Elimina un token de dispositivo
 */
function deleteDeviceToken(token) {
  if (!db) return false;

  try {
    const stmt = db.prepare('DELETE FROM device_tokens WHERE token = ?');
    const result = stmt.run(token);
    return result.changes > 0;
  } catch (error) {
    logger.error('[DB] Error eliminando token:', error.message);
    return false;
  }
}

/**
 * Obtiene todos los tokens de un usuario
 */
function getDeviceTokensByUserId(userId) {
  if (!db) return [];

  try {
    const stmt = db.prepare('SELECT * FROM device_tokens WHERE user_id = ?');
    return stmt.all(userId);
  } catch (error) {
    logger.error('[DB] Error obteniendo tokens:', error.message);
    return [];
  }
}

/**
 * Obtiene todos los tokens (para cargar en memoria al iniciar)
 */
function getAllDeviceTokens() {
  if (!db) return [];

  try {
    const stmt = db.prepare('SELECT * FROM device_tokens');
    return stmt.all();
  } catch (error) {
    logger.error('[DB] Error obteniendo todos los tokens:', error.message);
    return [];
  }
}

/**
 * Obtiene estadísticas de la base de datos
 */
function getStats() {
  if (!db) return { totalTokens: 0, totalUsers: 0 };

  try {
    const tokenCount = db.prepare('SELECT COUNT(*) as count FROM device_tokens').get();
    const userCount = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM device_tokens').get();

    return {
      totalTokens: tokenCount.count,
      totalUsers: userCount.count,
    };
  } catch (error) {
    logger.error('[DB] Error obteniendo stats:', error.message);
    return { totalTokens: 0, totalUsers: 0 };
  }
}

/**
 * Cierra la conexión a la base de datos
 */
function close() {
  if (db) {
    db.close();
    db = null;
    logger.info('[DB] Conexión cerrada');
  }
}

export const database = {
  initialize,
  upsertDeviceToken,
  deleteDeviceToken,
  getDeviceTokensByUserId,
  getAllDeviceTokens,
  getStats,
  close,
};

export default database;
