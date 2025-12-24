import crypto from 'crypto';
import { config } from '../config/env.js';

/**
 * Servicio de validación y generación de QR
 * Soporta dos modos:
 * 1. Código simple (ej: "E707640") - modo desarrollo/legacy
 * 2. Código firmado (ej: "E707640|timestamp|signature") - modo seguro
 */
class QRService {
  constructor() {
    this.secret = config.qr.hmacSecret;
    this.expirationMinutes = config.qr.expirationMinutes;
    // En desarrollo, permitir códigos simples sin firma
    this.allowSimpleCodes = config.nodeEnv === 'development';
  }

  /**
   * Generar firma HMAC para datos del QR
   */
  generateSignature(data) {
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Generar contenido de QR firmado
   * Formato: repairCode|timestamp|signature
   */
  generateQRContent(repairCode) {
    const timestamp = Date.now();
    const dataToSign = `${repairCode}|${timestamp}`;
    const signature = this.generateSignature(dataToSign);

    return `${repairCode}|${timestamp}|${signature}`;
  }

  /**
   * Validar y parsear contenido de QR
   * Acepta códigos simples (E707640) o firmados (E707640|timestamp|signature)
   */
  validateQRContent(qrContent) {
    if (!qrContent || typeof qrContent !== 'string') {
      return { valid: false, error: 'QR vacio o invalido' };
    }

    const trimmed = qrContent.trim();
    const parts = trimmed.split('|');

    // Modo 1: Código simple (solo el código de reparación)
    if (parts.length === 1) {
      if (!this.allowSimpleCodes) {
        return { valid: false, error: 'QR sin firma no permitido en produccion' };
      }

      // Validar formato básico (alfanumérico)
      if (!/^[A-Za-z0-9\-_]+$/.test(trimmed)) {
        return { valid: false, error: 'Formato de codigo invalido' };
      }

      console.log('[QR] Modo simple - codigo:', trimmed);
      return {
        valid: true,
        repairCode: trimmed,
        mode: 'simple',
      };
    }

    // Modo 2: Código firmado (código|timestamp|signature)
    if (parts.length === 3) {
      const [repairCode, timestamp, signature] = parts;

      // Validar timestamp
      const parsedTimestamp = parseInt(timestamp, 10);
      if (isNaN(parsedTimestamp)) {
        return { valid: false, error: 'Timestamp invalido' };
      }

      // Verificar expiración
      const now = Date.now();
      const expirationMs = this.expirationMinutes * 60 * 1000;
      if (now - parsedTimestamp > expirationMs) {
        return { valid: false, error: 'QR expirado' };
      }

      // Verificar firma
      const dataToSign = `${repairCode}|${timestamp}`;
      const expectedSignature = this.generateSignature(dataToSign);

      try {
        if (!crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature)
        )) {
          return { valid: false, error: 'Firma de QR invalida' };
        }
      } catch (e) {
        return { valid: false, error: 'Firma de QR invalida' };
      }

      console.log('[QR] Modo firmado - codigo:', repairCode);
      return {
        valid: true,
        repairCode: repairCode,
        timestamp: parsedTimestamp,
        mode: 'signed',
      };
    }

    return { valid: false, error: 'Formato de QR no reconocido' };
  }
}

export const qrService = new QRService();
