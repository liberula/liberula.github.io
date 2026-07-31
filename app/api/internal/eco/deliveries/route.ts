import { NextRequest } from "next/server";
import {
  DELIVERY_REFERENCE_PATTERN,
  genericResponse,
  isLocalDevelopmentRequest,
  isPlainObject,
  readBoundedJson,
  readLocalConfiguration,
  successResponse,
  unavailableResponse,
  UUID_PATTERN,
} from "../_shared";

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function parseOperation(value: unknown): Record<string, unknown> | null {
  if (!isPlainObject(value)) return null;
  if (
    value.action === "prepare" &&
    hasExactKeys(value, ["action", "case_id", "participant_ids"]) &&
    value.case_id === "eco-sp-001" && Array.isArray(value.participant_ids) &&
    value.participant_ids.length >= 1 && value.participant_ids.length <= 10 &&
    value.participant_ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id)) &&
    new Set(value.participant_ids).size === value.participant_ids.length
  ) return value;
  if (
    value.action === "send" && hasExactKeys(value, ["action", "delivery_ids"]) &&
    Array.isArray(value.delivery_ids) && value.delivery_ids.length >= 1 &&
    value.delivery_ids.length <= 10 &&
    value.delivery_ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id)) &&
    new Set(value.delivery_ids).size === value.delivery_ids.length
  ) return value;
  return null;
}

const PREPARE_RESULTS = new Set(["created", "existing"]);
const DELIVERY_STATES = new Set(["pending", "sending", "sent", "failed", "cancelled"]);
const SEND_RESULTS = new Set([
  "sent",
  "failed",
  "already_sent",
  "ineligible_state",
  "retry_limit_reached",
  "not_found",
]);
const SAFE_SEND_ERRORS = new Set([
  "postmark_configuration_missing",
  "postmark_timeout",
  "postmark_network_error",
  "postmark_unauthorized",
  "postmark_rejected",
  "postmark_server_error",
  "postmark_invalid_response",
  "postmark_result_unknown",
  "participant_ineligible",
  "case_inactive",
  "retry_limit_reached",
  "internal_error",
]);

function sanitizeOperationResponse(action: "prepare" | "send", value: unknown) {
  if (!isPlainObject(value) || value.success !== true || !Array.isArray(value.results)) return null;
  if (value.results.length < 1 || value.results.length > 10) return null;
  const results: Record<string, unknown>[] = [];
  for (const raw of value.results) {
    if (!isPlainObject(raw) || typeof raw.delivery_id !== "string" || !UUID_PATTERN.test(raw.delivery_id)) {
      return null;
    }
    if (action === "prepare") {
      if (
        typeof raw.participant_id !== "string" || !UUID_PATTERN.test(raw.participant_id) ||
        typeof raw.result !== "string" || !PREPARE_RESULTS.has(raw.result) ||
        typeof raw.status !== "string" || !DELIVERY_STATES.has(raw.status) ||
        typeof raw.delivery_url !== "string"
      ) return null;
      let deliveryUrl: URL;
      try {
        deliveryUrl = new URL(raw.delivery_url);
      } catch {
        return null;
      }
      if (
        deliveryUrl.protocol !== "https:" || deliveryUrl.hostname !== "liberula.com" ||
        deliveryUrl.pathname !== "/eco/eco-sp-001/iniciar/" ||
        Array.from(deliveryUrl.searchParams.keys()).some((key) => key !== "delivery") ||
        !DELIVERY_REFERENCE_PATTERN.test(deliveryUrl.searchParams.get("delivery") ?? "")
      ) return null;
      results.push({
        participant_id: raw.participant_id,
        delivery_id: raw.delivery_id,
        result: raw.result,
        status: raw.status,
        delivery_url: deliveryUrl.toString(),
      });
    } else {
      if (typeof raw.result !== "string" || !SEND_RESULTS.has(raw.result)) return null;
      const status = typeof raw.status === "string" && DELIVERY_STATES.has(raw.status)
        ? raw.status
        : undefined;
      const error = typeof raw.error === "string" && SAFE_SEND_ERRORS.has(raw.error)
        ? raw.error
        : undefined;
      results.push({
        delivery_id: raw.delivery_id,
        result: raw.result,
        ...(status ? { status } : {}),
        ...(error ? { error } : {}),
      });
    }
  }
  return { success: true, results };
}

export async function POST(request: NextRequest) {
  if (!isLocalDevelopmentRequest(request)) return unavailableResponse();
  const operation = parseOperation(await readBoundedJson(request));
  if (!operation) return genericResponse("request_failed", 400);
  const configuration = readLocalConfiguration();
  if (!configuration) return genericResponse("configuration_missing", 503);
  const action = operation.action as "prepare" | "send";
  try {
    const response = await fetch(configuration.deliveryFunctionUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${configuration.deliveryAdminSecret}`,
      },
      body: JSON.stringify(operation),
      cache: "no-store",
    });
    if (!response.ok) {
      return genericResponse(action === "prepare" ? "prepare_failed" : "send_failed", 502);
    }
    const sanitized = sanitizeOperationResponse(
      action,
      await response.json().catch(() => null),
    );
    if (!sanitized) return genericResponse("invalid_response", 502);
    return successResponse(sanitized);
  } catch {
    return genericResponse(action === "prepare" ? "prepare_failed" : "send_failed", 502);
  }
}
