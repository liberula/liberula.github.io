import { NextRequest } from "next/server";
import {
  genericResponse,
  isLocalDevelopmentRequest,
  isPlainObject,
  readBoundedJson,
  readLocalConfiguration,
  successResponse,
  unavailableResponse,
} from "../_shared";

function parseOperation(value: unknown): Record<string, unknown> | null {
  if (!isPlainObject(value)) return null;
  const keys = Object.keys(value).sort();
  if (value.action === "get" && keys.length === 1 && keys[0] === "action") {
    return { action: "get" };
  }
  if (
    value.action === "set" && keys.length === 2 && keys[0] === "action" &&
    keys[1] === "automatic_case_delivery_enabled" &&
    typeof value.automatic_case_delivery_enabled === "boolean"
  ) return value;
  return null;
}

function sanitize(value: unknown) {
  if (
    !isPlainObject(value) || value.success !== true ||
    typeof value.automatic_case_delivery_enabled !== "boolean" ||
    !isPlainObject(value.counts) ||
    !Number.isInteger(value.counts.pending) || Number(value.counts.pending) < 0 ||
    !Number.isInteger(value.counts.failed) || Number(value.counts.failed) < 0 ||
    !Number.isInteger(value.counts.completed_last_24h) || Number(value.counts.completed_last_24h) < 0
  ) return null;
  return {
    success: true,
    automatic_case_delivery_enabled: value.automatic_case_delivery_enabled,
    counts: {
      pending: Number(value.counts.pending),
      failed: Number(value.counts.failed),
      completed_last_24h: Number(value.counts.completed_last_24h),
    },
  };
}

export async function POST(request: NextRequest) {
  if (!isLocalDevelopmentRequest(request)) return unavailableResponse();
  const operation = parseOperation(await readBoundedJson(request));
  if (!operation) return genericResponse("request_failed", 400);
  const configuration = readLocalConfiguration();
  if (!configuration) return genericResponse("configuration_missing", 503);
  try {
    const response = await fetch(configuration.automationSettingsFunctionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configuration.deliveryAdminSecret}`,
      },
      body: JSON.stringify(operation),
      cache: "no-store",
    });
    if (!response.ok) return genericResponse("automation_settings_failed", 502);
    const approved = sanitize(await response.json().catch(() => null));
    if (!approved) return genericResponse("invalid_response", 502);
    return successResponse(approved);
  } catch {
    return genericResponse("automation_settings_failed", 502);
  }
}
