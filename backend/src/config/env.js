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

  // Odoo (Reparaciones)
  odoo: {
    url: required('ODOO_URL'),
    db: required('ODOO_DB'),
    adminUser: required('ODOO_ADMIN_USER'),
    adminPassword: required('ODOO_ADMIN_PASSWORD'),
    authorizedGroup: optional('ODOO_AUTHORIZED_GROUP', 'repair_scanner_user'),
  },

  // Odoo Products (NCF - otro servidor)
  odooProducts: {
    url: optional('ODOO_PRODUCTS_URL', 'https://ncf.ithesk.com'),
    db: optional('ODOO_PRODUCTS_DB', 'nfcithesk'),
    adminUser: optional('ODOO_PRODUCTS_ADMIN_USER', ''),
    adminPassword: optional('ODOO_PRODUCTS_ADMIN_PASSWORD', ''),
  },

  // QR Security
  qr: {
    hmacSecret: required('QR_HMAC_SECRET'),
    expirationMinutes: parseInt(optional('QR_EXPIRATION_MINUTES', '60'), 10),
    allowSimpleCodes: optional('ALLOW_SIMPLE_QR', 'false') === 'true',
  },

  // CORS - Si es '*' permitir todo, sino parsear como lista
  corsOrigins: (() => {
    const origins = optional('CORS_ORIGINS', 'http://localhost:5173');
    if (origins === '*') return true; // cors() acepta true para permitir todo
    return origins.split(',').map(o => o.trim());
  })(),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  },

  // APNs (Apple Push Notifications) - OPCIONAL
  // Si no se configura, el sistema usa polling
  apns: {
    enabled: !!process.env.APNS_KEY_PATH,
    keyPath: optional('APNS_KEY_PATH', ''),
    keyId: optional('APNS_KEY_ID', ''),
    teamId: optional('APNS_TEAM_ID', ''),
    bundleId: optional('APNS_BUNDLE_ID', 'com.qraxer.app'),
    // APNS_PRODUCTION: 'true' para producción, 'false' para sandbox
    // Por defecto usa sandbox (development) para desarrollo con Xcode
    production: optional('APNS_PRODUCTION', 'false') === 'true',
  },

  // Supabase (IMEI Lookup via Edge Function) - OPCIONAL
  // Si no se configura, la funcionalidad IMEI no estará disponible
  supabase: {
    enabled: !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    url: optional('SUPABASE_URL', ''),
    serviceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY', ''),
    anonKey: optional('SUPABASE_ANON_KEY', ''),
  },
};

// Debug: Log Supabase configuration at startup
console.log('[CONFIG] Supabase configuration:');
console.log('[CONFIG]   SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
console.log('[CONFIG]   SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('[CONFIG]   SUPABASE_ANON_KEY exists:', !!process.env.SUPABASE_ANON_KEY);
console.log('[CONFIG]   config.supabase.enabled:', config.supabase.enabled);
if (process.env.SUPABASE_URL) {
  console.log('[CONFIG]   SUPABASE_URL value:', process.env.SUPABASE_URL.substring(0, 30) + '...');
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('[CONFIG]   SERVICE_ROLE_KEY length:', process.env.SUPABASE_SERVICE_ROLE_KEY.length);
}

export default config;
