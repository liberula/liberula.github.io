export const DELIVERY_REFERENCE_MIN_LENGTH = 16;
export const DELIVERY_REFERENCE_MAX_LENGTH = 200;
export const DELIVERY_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;

export function normalizeDeliveryReference(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return DELIVERY_REFERENCE_PATTERN.test(normalized) ? normalized : null;
}
