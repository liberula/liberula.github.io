export const ORDER_STATUSES = [
  "pending",
  "paid",
  "rejected",
  "cancelled",
  "refunded",
];

const ORDER_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;

export function parseOrderReference(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return ORDER_REFERENCE_PATTERN.test(normalized) ? normalized : null;
}

export function buildStatusEndpoint(baseUrl, orderReference) {
  const parsedReference = parseOrderReference(orderReference);
  if (!parsedReference) return null;
  return buildOrderStatusEndpoint(baseUrl, parsedReference);
}

export function parseOrderStatusResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (!ORDER_STATUSES.includes(value.status)) return null;

  let updatedAt = null;
  if (value.updatedAt !== undefined && value.updatedAt !== null) {
    if (
      typeof value.updatedAt !== "string" ||
      !Number.isFinite(Date.parse(value.updatedAt))
    ) {
      return null;
    }
    updatedAt = value.updatedAt;
  }

  return { status: value.status, updatedAt };
}
import { buildOrderStatusEndpoint } from "./eco-api-contract.mjs";
