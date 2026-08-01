export function buildDeliveryOpenEndpoint(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const localHttp = url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (
      (url.protocol !== "https:" && !localHttp) || url.username ||
      url.password || url.search || url.hash ||
      (url.pathname !== "" && !/^\/+$/u.test(url.pathname))
    ) return null;
    return `${url.origin}/functions/v1/eco-case-delivery-open`;
  } catch {
    return null;
  }
}

export function isTrackableDeliveryLandingHostname(hostname) {
  return hostname === "liberula.com";
}

export async function sendDeliveryOpen(endpoint, deliveryReference, fetcher = fetch) {
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delivery_reference: deliveryReference }),
    keepalive: true,
  });
  if (!response.ok) throw new Error("delivery_open_tracking_failed");
}
