import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';

export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

export const isIOS = () => {
  return Capacitor.getPlatform() === 'ios';
};

export const checkPermission = async () => {
  if (!isNativePlatform()) {
    return { granted: false, nativeAvailable: false };
  }

  const { camera } = await BarcodeScanner.checkPermissions();
  return {
    granted: camera === 'granted',
    nativeAvailable: true
  };
};

export const requestPermission = async () => {
  if (!isNativePlatform()) {
    return false;
  }

  const { camera } = await BarcodeScanner.requestPermissions();
  return camera === 'granted';
};

export const startNativeScan = async (onScanSuccess, onScanError) => {
  if (!isNativePlatform()) {
    onScanError(new Error('Native scanning not available'));
    return null;
  }

  try {
    // Request permission if needed
    const permissionStatus = await BarcodeScanner.checkPermissions();
    if (permissionStatus.camera !== 'granted') {
      const requestResult = await BarcodeScanner.requestPermissions();
      if (requestResult.camera !== 'granted') {
        onScanError(new Error('Camera permission denied'));
        return null;
      }
    }

    // Add body class for transparent background
    document.body.classList.add('barcode-scanner-active');

    // Start continuous scanning
    const listener = await BarcodeScanner.addListener('barcodeScanned', (result) => {
      if (result.barcode && result.barcode.rawValue) {
        onScanSuccess(result.barcode.rawValue);
      }
    });

    await BarcodeScanner.startScan({
      formats: [
        BarcodeFormat.QrCode,
        BarcodeFormat.Code128,
        BarcodeFormat.Code39,
        BarcodeFormat.Ean13,
        BarcodeFormat.Ean8,
        BarcodeFormat.DataMatrix
      ]
    });

    return {
      stop: async () => {
        await BarcodeScanner.stopScan();
        await listener.remove();
        document.body.classList.remove('barcode-scanner-active');
      }
    };
  } catch (error) {
    onScanError(error);
    return null;
  }
};

export const stopNativeScan = async () => {
  try {
    await BarcodeScanner.stopScan();
    document.body.classList.remove('barcode-scanner-active');
  } catch (e) {
    // Ignore errors when stopping
  }
};

// Single scan mode (opens camera, scans once, closes)
export const scanOnce = async () => {
  if (!isNativePlatform()) {
    throw new Error('Native scanning not available');
  }

  // Check/request permission
  const permissionStatus = await BarcodeScanner.checkPermissions();
  if (permissionStatus.camera !== 'granted') {
    const requestResult = await BarcodeScanner.requestPermissions();
    if (requestResult.camera !== 'granted') {
      throw new Error('Camera permission denied');
    }
  }

  // Perform single scan
  const result = await BarcodeScanner.scan({
    formats: [
      BarcodeFormat.QrCode,
      BarcodeFormat.Code128,
      BarcodeFormat.Code39,
      BarcodeFormat.Ean13,
      BarcodeFormat.Ean8,
      BarcodeFormat.DataMatrix
    ]
  });

  if (result.barcodes && result.barcodes.length > 0) {
    return result.barcodes[0].rawValue;
  }

  return null;
};
