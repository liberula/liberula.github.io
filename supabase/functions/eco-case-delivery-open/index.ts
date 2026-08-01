import { normalizeDeliveryReference } from "../../../lib/eco/delivery-reference.mjs";

const MAX_BODY_BYTES = 1024;
const PRODUCTION_ORIGIN = "https://liberula.com";
const LOCAL_ORIGIN_PATTERN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d{1,5})?$/;

type JsonObject = Record<string, unknown>;

export type DeliveryOpenDependencies = {
  persist: (deliveryReference: string) => Promise<void>;
  logger?: {
    info?: (message: string) => void;
    error?: (message: string) => void;
  };
};

function isPlainObject(value: unknown): value is JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function parseDeliveryOpenRequest(value: unknown): string | null {
  if (!isPlainObject(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== "delivery_reference") return null;
  return normalizeDeliveryReference(value.delivery_reference);
}

export function isAllowedDeliveryOpenOrigin(origin: string | null): boolean {
  return origin === null || origin === PRODUCTION_ORIGIN ||
    LOCAL_ORIGIN_PATTERN.test(origin);
}

function corsHeaders(origin: string | null): HeadersInit {
  if (!origin || !isAllowedDeliveryOpenOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function json(
  status: number,
  body: JsonObject,
  origin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders(origin),
    },
  });
}

function invalid(origin: string | null, status = 400): Response {
  return json(status, { success: false, error: "invalid_request" }, origin);
}

export function createDeliveryOpenHandler(
  dependencies: DeliveryOpenDependencies,
) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");

    if (request.method === "OPTIONS") {
      if (!isAllowedDeliveryOpenOrigin(origin)) return invalid(origin, 403);
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "POST") return invalid(origin, 405);
    if (!isAllowedDeliveryOpenOrigin(origin)) return invalid(origin, 403);
    if (
      (request.headers.get("content-type") ?? "").trim().toLowerCase() !==
        "application/json"
    ) {
      dependencies.logger?.info?.(
        "delivery open request rejected: validation",
      );
      return invalid(origin);
    }

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      dependencies.logger?.info?.(
        "delivery open request rejected: validation",
      );
      return invalid(origin);
    }

    let payload: unknown;
    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        dependencies.logger?.info?.(
          "delivery open request rejected: validation",
        );
        return invalid(origin);
      }
      payload = JSON.parse(rawBody);
    } catch {
      dependencies.logger?.info?.(
        "delivery open request rejected: validation",
      );
      return invalid(origin);
    }

    const deliveryReference = parseDeliveryOpenRequest(payload);
    if (!deliveryReference) {
      dependencies.logger?.info?.(
        "delivery open request rejected: validation",
      );
      return invalid(origin);
    }

    try {
      await dependencies.persist(deliveryReference);
      dependencies.logger?.info?.("delivery open request accepted");
    } catch {
      dependencies.logger?.error?.("delivery open persistence failed");
    }

    return json(202, { success: true }, origin);
  };
}

export function createSupabaseDeliveryOpenPersistence(
  supabaseUrl?: string,
  serviceRoleKey?: string,
  fetcher: typeof fetch = fetch,
) {
  return async (deliveryReference: string): Promise<void> => {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("missing_server_configuration");
    }
    const response = await fetcher(
      `${supabaseUrl}/rest/v1/rpc/record_eco_case_delivery_open`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
        },
        body: JSON.stringify({
          p_delivery_reference: deliveryReference,
        }),
      },
    );
    if (!response.ok) throw new Error("delivery_open_persistence_failed");
  };
}

if (import.meta.main) {
  Deno.serve(createDeliveryOpenHandler({
    persist: createSupabaseDeliveryOpenPersistence(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    ),
    logger: {
      info: (message) => console.info(message),
      error: (message) => console.error(message),
    },
  }));
}
