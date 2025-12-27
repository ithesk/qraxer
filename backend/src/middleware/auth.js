import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { AppError } from './errorHandler.js';

// Desencriptación de password (misma lógica que en auth.js)
const ENCRYPTION_KEY = crypto.scryptSync(config.jwt.secret, 'salt', 32);

function decryptPassword(encryptedPassword) {
  try {
    const parts = encryptedPassword.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Token no proporcionado', 401);
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);

    // Desencriptar password para uso en Odoo Products
    if (decoded.odooPassword) {
      decoded.odooPassword = decryptPassword(decoded.odooPassword);
    }

    req.user = decoded;
    next();
  } catch (error) {
    throw error; // Let errorHandler handle JWT errors
  }
}
