export {
  DELIVERY_REFERENCE_MAX_LENGTH,
  DELIVERY_REFERENCE_MIN_LENGTH,
  DELIVERY_REFERENCE_PATTERN,
  normalizeDeliveryReference,
} from "../../../lib/eco/delivery-reference.mjs";

import { normalizeDeliveryReference } from "../../../lib/eco/delivery-reference.mjs";

export function buildCaseAnswerPath(deliveryReference) {
  const normalized = normalizeDeliveryReference(deliveryReference);
  if (!normalized) return "/eco/eco-sp-001/";
  return `/eco/eco-sp-001/?delivery=${encodeURIComponent(normalized)}`;
}
