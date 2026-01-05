/**
 * Biometric Authentication Service
 * Uses Face ID / Touch ID to securely store and retrieve credentials
 */

import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

const SERVER_ID = 'com.qraxer.credentials';
const isNative = Capacitor.isNativePlatform();

/**
 * Check if biometrics are available on the device
 */
export async function isBiometricsAvailable() {
  if (!isNative) {
    console.log('[Biometrics] Not available on web');
    return { available: false, type: null };
  }

  try {
    const result = await NativeBiometric.isAvailable();
    console.log('[Biometrics] Available:', result);
    return {
      available: result.isAvailable,
      type: result.biometryType,
      typeName: getBiometryTypeName(result.biometryType),
    };
  } catch (error) {
    console.error('[Biometrics] Error checking availability:', error);
    return { available: false, type: null };
  }
}

/**
 * Get human-readable biometry type name
 */
function getBiometryTypeName(type) {
  switch (type) {
    case BiometryType.FACE_ID:
      return 'Face ID';
    case BiometryType.TOUCH_ID:
      return 'Touch ID';
    case BiometryType.FINGERPRINT:
      return 'Huella digital';
    case BiometryType.FACE_AUTHENTICATION:
      return 'Reconocimiento facial';
    case BiometryType.IRIS_AUTHENTICATION:
      return 'Iris';
    default:
      return 'Biometrics';
  }
}

/**
 * Save credentials securely using biometrics
 */
export async function saveCredentials(username, password) {
  console.log('[Biometrics] saveCredentials called, isNative:', isNative);
  console.log('[Biometrics] username:', username, 'password length:', password?.length);

  if (!isNative) {
    console.log('[Biometrics] Web fallback - using localStorage');
    localStorage.setItem('savedUsername', username);
    return true;
  }

  try {
    console.log('[Biometrics] Calling NativeBiometric.setCredentials...');
    await NativeBiometric.setCredentials({
      username,
      password,
      server: SERVER_ID,
    });
    console.log('[Biometrics] Credentials saved successfully!');

    // Set flag in localStorage to track that credentials exist
    localStorage.setItem('biometrics_credentials_saved', 'true');
    localStorage.setItem('biometrics_username', username); // For display purposes
    console.log('[Biometrics] Flag set in localStorage');

    return true;
  } catch (error) {
    console.error('[Biometrics] Error saving credentials:', error);
    console.error('[Biometrics] Error details:', JSON.stringify(error));
    return false;
  }
}

/**
 * Get saved credentials using biometric verification
 */
export async function getCredentials() {
  if (!isNative) {
    console.log('[Biometrics] Web fallback');
    const username = localStorage.getItem('savedUsername');
    return username ? { username, password: null } : null;
  }

  try {
    // First verify with biometrics
    const verified = await NativeBiometric.verifyIdentity({
      reason: 'Iniciar sesión con Face ID',
      title: 'Autenticación',
      subtitle: 'Usa Face ID para acceder',
      description: 'Coloca tu rostro frente a la cámara',
      negativeButtonText: 'Cancelar',
    });

    console.log('[Biometrics] Verification result:', verified);

    // If verified, get credentials
    const credentials = await NativeBiometric.getCredentials({
      server: SERVER_ID,
    });

    console.log('[Biometrics] Got credentials for:', credentials.username);
    return {
      username: credentials.username,
      password: credentials.password,
    };
  } catch (error) {
    console.error('[Biometrics] Error getting credentials:', error);
    return null;
  }
}

/**
 * Check if there are saved credentials
 * Uses localStorage flag to avoid Keychain errors when no credentials exist
 */
export async function hasStoredCredentials() {
  console.log('[Biometrics] hasStoredCredentials called, isNative:', isNative);

  if (!isNative) {
    const has = !!localStorage.getItem('savedUsername');
    console.log('[Biometrics] Web - hasStored:', has);
    return has;
  }

  // Use a localStorage flag to track if we've saved credentials
  // This avoids the KeychainError when checking for non-existent credentials
  const hasFlag = localStorage.getItem('biometrics_credentials_saved') === 'true';
  console.log('[Biometrics] hasStored flag:', hasFlag);
  return hasFlag;
}

/**
 * Delete stored credentials
 */
export async function deleteCredentials() {
  // Always clear localStorage flags
  localStorage.removeItem('biometrics_credentials_saved');
  localStorage.removeItem('biometrics_username');
  localStorage.removeItem('savedUsername');

  if (!isNative) {
    console.log('[Biometrics] Web credentials deleted');
    return true;
  }

  try {
    await NativeBiometric.deleteCredentials({
      server: SERVER_ID,
    });
    console.log('[Biometrics] Credentials deleted from Keychain');
    return true;
  } catch (error) {
    console.error('[Biometrics] Error deleting credentials:', error);
    // Still return true since we cleared localStorage
    return true;
  }
}

export const biometrics = {
  isAvailable: isBiometricsAvailable,
  save: saveCredentials,
  get: getCredentials,
  hasStored: hasStoredCredentials,
  delete: deleteCredentials,
};

export default biometrics;
