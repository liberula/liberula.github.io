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
  if (
    value.action === "send_participants" &&
    hasExactKeys(value, ["action", "case_id", "participant_ids"]) &&
    value.case_id === "eco-sp-001" && Array.isArray(value.participant_ids) &&
    value.participant_ids.length >= 1 && value.participant_ids.length <= 10 &&
    value.participant_ids.every((id) => typeof id === "string" && UUID_PATTERN.test(id)) &&
    new Set(value.participant_ids).size === value.participant_ids.length
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

async function callDeliveryFunction(
  configuration: NonNullable<ReturnType<typeof readLocalConfiguration>>,
  action: "prepare" | "send",
  operation: Record<string, unknown>,
) {
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
  if (!response.ok) return null;
  return sanitizeOperationResponse(
    action,
    await response.json().catch(() => null),
  );
}

function mapParticipantSendResult(result: Record<string, unknown>) {
  if (result.result === "sent") return "sent";
  if (result.result === "already_sent") return "already_sent";
  if (result.result === "retry_limit_reached") return "retry_limit_reached";
  if (result.result === "not_found") return "not_found";
  if (result.result === "failed") return "failed";
  return "blocked";
}

async function sendParticipants(
  configuration: NonNullable<ReturnType<typeof readLocalConfiguration>>,
  operation: Record<string, unknown>,
) {
  const participantIds = operation.participant_ids as string[];
  const participantUrl = new URL("/rest/v1/eco_participants", configuration.supabaseUrl);
  participantUrl.searchParams.set("select", "id,status");
  participantUrl.searchParams.set("id", `in.(${participantIds.join(",")})`);
  participantUrl.searchParams.set("limit", "10");
  const participantResponse = await fetch(participantUrl, {
    method: "GET",
    headers: { apikey: configuration.secretKey, Accept: "application/json" },
    cache: "no-store",
  });
  if (!participantResponse.ok) return null;
  const rawParticipants: unknown = await participantResponse.json().catch(() => null);
  if (!Array.isArray(rawParticipants) || rawParticipants.length > 10) return null;

  const statuses = new Map<string, string>();
  for (const value of rawParticipants) {
    if (
      !isPlainObject(value) || typeof value.id !== "string" ||
      !UUID_PATTERN.test(value.id) || typeof value.status !== "string"
    ) return null;
    statuses.set(value.id, value.status);
  }

  const results = new Map<string, Record<string, unknown>>();
  const eligibleIds: string[] = [];
  for (const participantId of participantIds) {
    const status = statuses.get(participantId);
    if (!status) {
      results.set(participantId, { participant_id: participantId, result: "not_found" });
    } else if (status === "blocked" || status === "completed") {
      results.set(participantId, { participant_id: participantId, result: "blocked" });
    } else {
      eligibleIds.push(participantId);
    }
  }

  if (eligibleIds.length > 0) {
    const prepared = await callDeliveryFunction(configuration, "prepare", {
      action: "prepare",
      case_id: operation.case_id,
      participant_ids: eligibleIds,
    });
    if (!prepared) return null;
    const preparedByParticipant = new Map(
      prepared.results.map((item) => [item.participant_id as string, item]),
    );
    const deliveryIds = eligibleIds.map((id) => preparedByParticipant.get(id)?.delivery_id);
    if (deliveryIds.some((id) => typeof id !== "string")) return null;
    const sent = await callDeliveryFunction(configuration, "send", {
      action: "send",
      delivery_ids: deliveryIds,
    });
    if (!sent) return null;
    const sentByDelivery = new Map(
      sent.results.map((item) => [item.delivery_id as string, item]),
    );
    for (const participantId of eligibleIds) {
      const preparedResult = preparedByParticipant.get(participantId)!;
      const sentResult = sentByDelivery.get(preparedResult.delivery_id as string);
      if (!sentResult) return null;
      results.set(participantId, {
        participant_id: participantId,
        result: mapParticipantSendResult(sentResult),
        ...(typeof sentResult.error === "string" ? { error: sentResult.error } : {}),
      });
    }
  }

  return {
    success: true,
    results: participantIds.map((participantId) => results.get(participantId)),
  };
}

export async function POST(request: NextRequest) {
  if (!isLocalDevelopmentRequest(request)) return unavailableResponse();
  const operation = parseOperation(await readBoundedJson(request));
  if (!operation) return genericResponse("request_failed", 400);
  const configuration = readLocalConfiguration();
  if (!configuration) return genericResponse("configuration_missing", 503);
  const action = operation.action as "prepare" | "send" | "send_participants";
  try {
    const sanitized = action === "send_participants"
      ? await sendParticipants(configuration, operation)
      : await callDeliveryFunction(configuration, action, operation);
    if (!sanitized) return genericResponse("invalid_response", 502);
    return successResponse(sanitized);
  } catch {
    return genericResponse(action === "prepare" ? "prepare_failed" : "send_failed", 502);
  }
}
