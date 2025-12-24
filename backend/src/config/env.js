import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

function required(key) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key, defaultValue) {
  return process.env[key] || defaultValue;
}

export const config = {
  // Server
  port: optional('PORT', '3001'),
  nodeEnv: optional('NODE_ENV', 'development'),

  // JWT
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: optional('JWT_EXPIRES_IN', '30m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  // Odoo
  odoo: {
    url: required('ODOO_URL'),
    db: required('ODOO_DB'),
    adminUser: required('ODOO_ADMIN_USER'),
    adminPassword: required('ODOO_ADMIN_PASSWORD'),
    authorizedGroup: optional('ODOO_AUTHORIZED_GROUP', 'repair_scanner_user'),
  },

  // QR Security
  qr: {
    hmacSecret: required('QR_HMAC_SECRET'),
    expirationMinutes: parseInt(optional('QR_EXPIRATION_MINUTES', '60'), 10),
    allowSimpleCodes: optional('ALLOW_SIMPLE_QR', 'false') === 'true',
  },

  // CORS
  corsOrigins: optional('CORS_ORIGINS', 'http://localhost:5173').split(','),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  },
};

export default config;
