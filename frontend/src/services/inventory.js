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

export const submitCounts = async (lines) => {
  const items = lines.map((line) => ({
    barcode: line.barcode,
    product_id: line.productId ?? null,
    quantity: line.qty,
    product_name: line.name,
  }));

  // TODO: Wire a location selector if backend requires locationId.
  return api.submitInventoryCount(items, null, '');
};
