import { api } from './api';

export const fetchProductByBarcode = async (barcode) => {
  const data = await api.getProductByBarcode(barcode);
  if (data?.found && data.product) {
    const productId = data.product.id ?? data.product.product_id ?? null;
    const name = data.product.name ?? data.product.display_name ?? `Codigo ${barcode}`;
    return { id: productId, name };
  }
  return null;
};

export const submitCounts = async (lines, locationId = null, notes = '') => {
  // Filter out items without productId - backend requires valid productId
  const validLines = lines.filter((line) => line.productId && typeof line.productId === 'number');

  if (validLines.length === 0) {
    throw new Error('No hay productos validos para enviar. Asegurate de escanear productos registrados en el sistema.');
  }

  if (validLines.length < lines.length) {
    console.warn(`[Inventory] ${lines.length - validLines.length} productos sin ID fueron omitidos`);
  }

  // Map to backend expected format: productId and countedQty
  const items = validLines.map((line) => ({
    productId: line.productId,
    countedQty: line.qty,
    barcode: line.barcode,
    productName: line.name,
  }));

  return api.submitInventoryCount(items, locationId, notes);
};
