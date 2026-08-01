import { NextRequest, NextResponse } from "next/server";
import { renderEcoDeliveryEmail } from "../../../../../lib/eco/delivery-email.mjs";
import {
  genericResponse,
  isLocalDevelopmentRequest,
  isPlainObject,
  readLocalConfiguration,
  unavailableResponse,
  UUID_PATTERN,
} from "../_shared";

const PREVIEW_DELIVERY_URL =
  "https://liberula.com/eco/eco-sp-001/iniciar/";
const EXAMPLE_NAME = "PARTICIPANTE DE EXEMPLO";

async function readParticipantName(
  participantId: string | null,
): Promise<{ name: string | null; example: boolean } | null> {
  if (!participantId) return { name: EXAMPLE_NAME, example: true };
  const configuration = readLocalConfiguration();
  if (!configuration) return null;
  const url = new URL("/rest/v1/eco_participants", configuration.supabaseUrl);
  url.searchParams.set("select", "name");
  url.searchParams.set("id", `eq.${participantId}`);
  url.searchParams.set("limit", "1");
  const response = await fetch(url, {
    method: "GET",
    headers: { apikey: configuration.secretKey, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const value: unknown = await response.json().catch(() => null);
  if (
    !Array.isArray(value) || value.length !== 1 || !isPlainObject(value[0]) ||
    (value[0].name !== null && typeof value[0].name !== "string")
  ) return null;
  return { name: value[0].name, example: false };
}

function parseParticipantId(request: NextRequest): string | null | false {
  const values = request.nextUrl.searchParams.getAll("participant_id");
  if (values.length === 0) return null;
  if (values.length !== 1 || !UUID_PATTERN.test(values[0])) return false;
  return values[0].toLowerCase();
}

export async function GET(request: NextRequest) {
  if (!isLocalDevelopmentRequest(request)) return unavailableResponse();
  const participantId = parseParticipantId(request);
  if (participantId === false) return genericResponse("request_failed", 400);
  try {
    const participant = await readParticipantName(participantId);
    if (!participant) return genericResponse("preview_failed", 502);
    const content = renderEcoDeliveryEmail({
      caseId: "eco-sp-001",
      participantName: participant.name,
      deliveryUrl: PREVIEW_DELIVERY_URL,
    });
    if (request.nextUrl.searchParams.get("format") === "html") {
      return new NextResponse(content.htmlBody, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
          "X-Robots-Tag": "noindex, nofollow",
        },
      });
    }
    return NextResponse.json(
      { success: true, example: participant.example, ...content },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return genericResponse("preview_failed", 502);
  }
}
