import { NextRequest, NextResponse } from "next/server";
import {
  DELIVERY_REFERENCE_PATTERN,
  genericResponse,
  isLocalDevelopmentRequest,
  isPlainObject,
  readLocalConfiguration,
  unavailableResponse,
  UUID_PATTERN,
} from "../_shared";

const PUBLIC_LANDING_URL =
  "https://liberula.com/eco/eco-sp-001/iniciar/";

export async function GET(request: NextRequest) {
  if (!isLocalDevelopmentRequest(request)) return unavailableResponse();
  const keys = Array.from(request.nextUrl.searchParams.keys());
  const participantIds = request.nextUrl.searchParams.getAll("participant_id");
  if (
    keys.length !== 1 || keys[0] !== "participant_id" ||
    participantIds.length !== 1 || !UUID_PATTERN.test(participantIds[0])
  ) return genericResponse("request_failed", 400);

  const configuration = readLocalConfiguration();
  if (!configuration) return genericResponse("configuration_missing", 503);

  try {
    const url = new URL(
      "/rest/v1/eco_case_deliveries",
      configuration.supabaseUrl,
    );
    url.searchParams.set("select", "status,delivery_reference");
    url.searchParams.set("case_id", "eq.eco-sp-001");
    url.searchParams.set("participant_id", `eq.${participantIds[0].toLowerCase()}`);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, {
      method: "GET",
      headers: { apikey: configuration.secretKey, Accept: "application/json" },
      cache: "no-store",
    });
    const value: unknown = response.ok
      ? await response.json().catch(() => null)
      : null;
    if (
      !Array.isArray(value) || value.length !== 1 ||
      !isPlainObject(value[0]) || value[0].status !== "sent" ||
      typeof value[0].delivery_reference !== "string" ||
      !DELIVERY_REFERENCE_PATTERN.test(value[0].delivery_reference)
    ) return genericResponse("access_unavailable", 404);

    const target = new URL(PUBLIC_LANDING_URL);
    target.searchParams.set("delivery", value[0].delivery_reference);
    return NextResponse.redirect(target, 307);
  } catch {
    return genericResponse("access_unavailable", 502);
  }
}
