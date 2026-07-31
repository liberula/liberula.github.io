import { NextRequest } from "next/server";
import {
  DELIVERY_REFERENCE_PATTERN,
  genericResponse,
  isLocalDevelopmentRequest,
  isPlainObject,
  readLocalConfiguration,
  successResponse,
  unavailableResponse,
  UUID_PATTERN,
} from "../_shared";

type ApprovedParticipant = {
  id: string;
  name: string | null;
  email: string;
  status: string;
  registered_at: string;
  delivery_id: string | null;
  delivery_status: string | null;
  delivery_reference: string | null;
  sent_at: string | null;
  attempt_count: number | null;
  last_error_code: string | null;
};

type ApprovedDelivery = {
  id: string;
  status: string;
  delivery_reference: string;
  sent_at: string | null;
  attempt_count: number;
  last_error_code: string | null;
};

const PARTICIPANT_STATUSES = new Set([
  "registered",
  "active",
  "paused",
  "completed",
  "blocked",
]);
const DELIVERY_STATUSES = new Set([
  "pending",
  "sending",
  "sent",
  "failed",
  "cancelled",
]);
const SAFE_ERROR_CODES = new Set([
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
]);

function parseParticipant(
  value: unknown,
): Omit<
  ApprovedParticipant,
  | "delivery_id"
  | "delivery_status"
  | "delivery_reference"
  | "sent_at"
  | "attempt_count"
  | "last_error_code"
> | null {
  if (
    !isPlainObject(value) || typeof value.id !== "string" ||
    !UUID_PATTERN.test(value.id) ||
    (value.name !== null && typeof value.name !== "string") ||
    typeof value.email !== "string" || typeof value.status !== "string" ||
    !PARTICIPANT_STATUSES.has(value.status) ||
    typeof value.registered_at !== "string" ||
    !Number.isFinite(Date.parse(value.registered_at))
  ) return null;
  return {
    id: value.id,
    name: value.name,
    email: value.email,
    status: value.status,
    registered_at: value.registered_at,
  };
}

function parseDelivery(value: unknown): (ApprovedDelivery & { participant_id: string }) | null {
  if (
    !isPlainObject(value) || typeof value.id !== "string" ||
    typeof value.participant_id !== "string" ||
    !UUID_PATTERN.test(value.id) || !UUID_PATTERN.test(value.participant_id) ||
    typeof value.status !== "string" || !DELIVERY_STATUSES.has(value.status) ||
    typeof value.delivery_reference !== "string" ||
    !DELIVERY_REFERENCE_PATTERN.test(value.delivery_reference) ||
    (value.sent_at !== null &&
      (typeof value.sent_at !== "string" || !Number.isFinite(Date.parse(value.sent_at)))) ||
    typeof value.attempt_count !== "number" ||
    !Number.isInteger(value.attempt_count) || value.attempt_count < 0 ||
    (value.last_error_code !== null &&
      (typeof value.last_error_code !== "string" || !SAFE_ERROR_CODES.has(value.last_error_code)))
  ) return null;
  return {
    id: value.id,
    participant_id: value.participant_id,
    status: value.status,
    delivery_reference: value.delivery_reference,
    sent_at: value.sent_at,
    attempt_count: value.attempt_count,
    last_error_code: value.last_error_code,
  };
}

export async function POST(request: NextRequest) {
  if (!isLocalDevelopmentRequest(request)) return unavailableResponse();
  const configuration = readLocalConfiguration();
  if (!configuration) return genericResponse("configuration_missing", 503);

  const headers = {
    apikey: configuration.secretKey,
    Accept: "application/json",
  };
  try {
    const participantUrl = new URL("/rest/v1/eco_participants", configuration.supabaseUrl);
    participantUrl.searchParams.set("select", "id,name,email,status,registered_at");
    participantUrl.searchParams.set("order", "registered_at.desc");
    participantUrl.searchParams.set("limit", "100");
    const participantResponse = await fetch(participantUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    if (!participantResponse.ok) return genericResponse("participant_query_failed", 502);
    const rawParticipants: unknown = await participantResponse.json().catch(() => null);
    if (!Array.isArray(rawParticipants) || rawParticipants.length > 100) {
      return genericResponse("invalid_response", 502);
    }
    const participants = rawParticipants.map(parseParticipant);
    if (participants.some((item) => !item)) return genericResponse("invalid_response", 502);

    const participantIds = participants.map((item) => item!.id);
    const deliveries = new Map<string, ApprovedDelivery>();
    if (participantIds.length > 0) {
      const deliveryUrl = new URL("/rest/v1/eco_case_deliveries", configuration.supabaseUrl);
      deliveryUrl.searchParams.set(
        "select",
        "id,participant_id,status,delivery_reference,sent_at,attempt_count,last_error_code",
      );
      deliveryUrl.searchParams.set("case_id", "eq.eco-sp-001");
      deliveryUrl.searchParams.set("participant_id", `in.(${participantIds.join(",")})`);
      deliveryUrl.searchParams.set("limit", "100");
      const deliveryResponse = await fetch(deliveryUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });
      if (!deliveryResponse.ok) return genericResponse("participant_query_failed", 502);
      const rawDeliveries: unknown = await deliveryResponse.json().catch(() => null);
      if (!Array.isArray(rawDeliveries) || rawDeliveries.length > 100) {
        return genericResponse("invalid_response", 502);
      }
      for (const rawDelivery of rawDeliveries) {
        const delivery = parseDelivery(rawDelivery);
        if (!delivery || deliveries.has(delivery.participant_id)) {
          return genericResponse("invalid_response", 502);
        }
        const { participant_id, ...approved } = delivery;
        deliveries.set(participant_id, approved);
      }
    }

    const approved: ApprovedParticipant[] = participants.map((participant) => {
      const delivery = deliveries.get(participant!.id);
      return {
        ...participant!,
        delivery_id: delivery?.id ?? null,
        delivery_status: delivery?.status ?? null,
        delivery_reference: delivery?.delivery_reference ?? null,
        sent_at: delivery?.sent_at ?? null,
        attempt_count: delivery?.attempt_count ?? null,
        last_error_code: delivery?.last_error_code ?? null,
      };
    });
    return successResponse({ success: true, participants: approved });
  } catch {
    return genericResponse("participant_query_failed", 502);
  }
}
