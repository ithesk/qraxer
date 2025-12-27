import { Router } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { odooClient } from '../services/odoo.js';
import { AppError } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Encriptación para guardar password en JWT (para re-auth en Odoo Products)
const ENCRYPTION_KEY = crypto.scryptSync(config.jwt.secret, 'salt', 32);
const IV_LENGTH = 16;

function encryptPassword(password) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}


/**
 * POST /api/auth/login
 * Autenticar usuario con credenciales de Odoo
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new AppError('Usuario y contraseña requeridos', 400);
    }

    // Autenticar contra Odoo
    const user = await odooClient.authenticate(username, password);

    if (!user) {
      throw new AppError('Credenciales inválidas', 401);
    }

    // Verificar pertenencia a grupo autorizado
    const hasPermission = await odooClient.checkUserGroup(user.uid);

    if (!hasPermission) {
      throw new AppError('Usuario no autorizado para usar esta aplicación', 403);
    }

    // Generar JWT con password encriptado para re-auth en Odoo Products
    const tokenPayload = {
      userId: user.uid,
      username: user.username,
      name: user.name,
      roles: ['scanner'],
      odooPassword: encryptPassword(password), // Encriptado para Odoo Products
    };

    const accessToken = jwt.sign(tokenPayload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    const refreshToken = jwt.sign(
      { userId: user.uid, type: 'refresh' },
      config.jwt.secret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.uid,
        username: user.username,
        name: user.name,
      },
      expiresIn: config.jwt.expiresIn,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/refresh
 * Refrescar access token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token requerido', 400);
    }

    const decoded = jwt.verify(refreshToken, config.jwt.secret);

    if (decoded.type !== 'refresh') {
      throw new AppError('Token inválido', 401);
    }

    // Generar nuevo access token
    const newAccessToken = jwt.sign(
      {
        userId: decoded.userId,
        username: decoded.username,
        name: decoded.name,
        roles: ['scanner'],
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      accessToken: newAccessToken,
      expiresIn: config.jwt.expiresIn,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión (invalidar token del lado del cliente)
 */
router.post('/logout', authMiddleware, (req, res) => {
  // El token se invalida del lado del cliente
  // Aquí podríamos agregar lógica de blacklist si fuera necesario
  res.json({ message: 'Sesión cerrada' });
});

/**
 * GET /api/auth/me
 * Obtener información del usuario actual
 */
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    userId: req.user.userId,
    username: req.user.username,
    name: req.user.name,
    roles: req.user.roles,
  });
});

export default router;
