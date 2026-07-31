export const DELIVERY_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;

export function normalizeDeliveryReference(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return DELIVERY_REFERENCE_PATTERN.test(normalized) ? normalized : null;
}

export function buildCaseAnswerPath(deliveryReference) {
  const normalized = normalizeDeliveryReference(deliveryReference);
  if (!normalized) return "/eco/eco-sp-001/";
  return `/eco/eco-sp-001/?delivery=${encodeURIComponent(normalized)}`;
}
