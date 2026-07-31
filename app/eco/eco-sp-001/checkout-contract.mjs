export { buildOrderEndpoint } from "./eco-api-contract.mjs";

const SANDBOX_CHECKOUT_HOSTS = new Set([
  "sandbox.mercadopago.com",
  "sandbox.mercadopago.com.br",
]);
const PRODUCTION_CHECKOUT_HOSTS = new Set([
  "www.mercadopago.com",
  "www.mercadopago.com.br",
]);
const TRUSTED_CHECKOUT_HOSTS = new Set([
  ...SANDBOX_CHECKOUT_HOSTS,
  ...PRODUCTION_CHECKOUT_HOSTS,
]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

import { normalizeReferralCode } from "./campaign-contract.mjs";

/**
 * @param {unknown} buyer
 * @param {string | null} referralCode
 */
export function createOrderRequest(buyer, referralCode = null) {
  const normalizedReferral = normalizeReferralCode(referralCode);
  return normalizedReferral
    ? { buyer, referralCode: normalizedReferral }
    : { buyer };
}

export function parseOrderResponse(value) {
  if (!isPlainObject(value)) return null;
  if (
    typeof value.checkoutUrl !== "string" ||
    typeof value.orderReference !== "string" ||
    typeof value.referralCode !== "string" ||
    typeof value.referralAttributed !== "boolean"
  ) {
    return null;
  }

  const orderReference = value.orderReference.trim();
  const referralCode = normalizeReferralCode(value.referralCode);
  if (!orderReference || orderReference.length > 200 || !referralCode) {
    return null;
  }

  try {
    const checkoutUrl = new URL(value.checkoutUrl);
    if (
      checkoutUrl.protocol !== "https:" ||
      !TRUSTED_CHECKOUT_HOSTS.has(checkoutUrl.hostname)
    ) {
      return null;
    }
    return {
      checkoutUrl: checkoutUrl.toString(),
      orderReference,
      referralCode,
      referralAttributed: value.referralAttributed,
    };
  } catch {
    return null;
  }
}
