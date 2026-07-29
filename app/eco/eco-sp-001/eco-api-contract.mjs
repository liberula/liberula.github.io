const ECO_API_PATHS = {
  validation: "validate",
  orders: "orders",
};

function normalizeApiBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    const isLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    if (
      (url.protocol !== "https:" && !isLocalHttp) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function buildEndpoint(baseUrl, path) {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  if (!normalizedBaseUrl) return null;
  return `${normalizedBaseUrl}/${path}`;
}

export function buildValidationEndpoint(baseUrl) {
  return buildEndpoint(baseUrl, ECO_API_PATHS.validation);
}

export function buildOrderEndpoint(baseUrl) {
  return buildEndpoint(baseUrl, ECO_API_PATHS.orders);
}

export function buildOrderStatusEndpoint(baseUrl, orderReference) {
  return buildEndpoint(
    baseUrl,
    `${ECO_API_PATHS.orders}/${encodeURIComponent(orderReference)}/status`,
  );
}
