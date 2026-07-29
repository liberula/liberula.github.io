export const ORDER_ENDPOINT = "/api/eco/eco-sp-001/orders";

const SANDBOX_CHECKOUT_HOSTS = new Set([
  "sandbox.mercadopago.com",
  "sandbox.mercadopago.com.br",
]);

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function createOrderRequest(buyer) {
  return { buyer };
}

export function parseOrderResponse(value) {
  if (!isPlainObject(value)) return null;
  if (
    typeof value.checkoutUrl !== "string" ||
    typeof value.orderReference !== "string"
  ) {
    return null;
  }

  const orderReference = value.orderReference.trim();
  if (!orderReference || orderReference.length > 200) return null;

  try {
    const checkoutUrl = new URL(value.checkoutUrl);
    if (
      checkoutUrl.protocol !== "https:" ||
      !SANDBOX_CHECKOUT_HOSTS.has(checkoutUrl.hostname)
    ) {
      return null;
    }
    return { checkoutUrl: checkoutUrl.toString(), orderReference };
  } catch {
    return null;
  }
}
