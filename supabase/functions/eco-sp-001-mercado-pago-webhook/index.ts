const BODY_LIMIT = 16 * 1024;
const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;
const EXTERNAL_REFERENCE_PATTERN = /^eco_[a-f0-9]{32}$/;
const HEX_SHA256_PATTERN = /^[a-fA-F0-9]{64}$/;

type JsonObject = Record<string, unknown>;

export type WebhookConfig = {
  webhookSecret?: string;
  mercadoPagoAccessToken?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
};

export type AuthoritativePayment = {
  id: string;
  liveMode: boolean;
  externalReference: string;
  currency: string;
  amount: number;
  status: string;
  updatedAt: string;
};

export type StoredOrder = {
  caseId: string;
  amountCents: number;
  currency: string;
  externalReference: string;
  providerPaymentId: string | null;
};

export type PaymentEvent = {
  providerPaymentId: string;
  observationKey: string;
  externalReference: string;
  providerStatus: string;
  mappedOrderStatus: string;
  providerUpdatedAt: string;
  correlationMetadata: { requestIdHash: string };
};

export type PaymentProvider = {
  getPayment: (paymentId: string) => Promise<AuthoritativePayment | null>;
};

export type PaymentRepository = {
  getOrderByExternalReference: (
    externalReference: string,
  ) => Promise<StoredOrder | null>;
  processPaymentEvent: (
    event: PaymentEvent,
  ) => Promise<
    | "updated"
    | "duplicate"
    | "ignored_older"
    | "ignored_protected"
    | "eco_referral_converted"
    | "unknown_order"
    | "order_invariant_mismatch"
    | "payment_id_conflict"
    | "invalid_event"
  >;
};

export type WebhookDependencies = {
  config: WebhookConfig;
  provider: PaymentProvider;
  repository: PaymentRepository;
  now?: () => number;
  logger?: {
    info: (entry: {
      eventType: "payment";
      outcome: string;
      durationMs: number;
      correlationId?: string;
    }) => void;
  };
};

function isPlainObject(value: unknown): value is JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function json(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function isJsonContentType(value: string | null): boolean {
  return value !== null && /^application\/json(?:\s*;|$)/iu.test(value);
}

async function parseBody(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; status: 400 | 413 }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > BODY_LIMIT) {
    return { ok: false, status: 413 };
  }
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > BODY_LIMIT) {
      return { ok: false, status: 413 };
    }
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400 };
  }
}

function parseSignature(
  value: string | null,
): { timestamp: string; digest: string } | null {
  if (!value) return null;
  const parts = new Map<string, string>();
  for (const part of value.split(",")) {
    const separator = part.indexOf("=");
    if (separator <= 0) return null;
    const key = part.slice(0, separator).trim();
    const item = part.slice(separator + 1).trim();
    if (!key || !item || parts.has(key)) return null;
    parts.set(key, item);
  }
  const timestamp = parts.get("ts");
  const digest = parts.get("v1");
  if (
    parts.size !== 2 ||
    !timestamp ||
    !/^[0-9]{8,20}$/u.test(timestamp) ||
    !digest ||
    !HEX_SHA256_PATTERN.test(digest)
  ) {
    return null;
  }
  return { timestamp, digest: digest.toLowerCase() };
}

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function hexToBytes(value: string): Uint8Array {
  return new Uint8Array(
    value.match(/.{2}/gu)?.map((pair) => Number.parseInt(pair, 16)) ?? [],
  );
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function hmacSha256(secret: string, value: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
  );
}

async function sha256(value: string): Promise<string> {
  return bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  );
}

export function signatureManifest(
  paymentId: string,
  requestId: string,
  timestamp: string,
): string {
  const normalizedId = /^[A-Za-z0-9]+$/u.test(paymentId)
    ? paymentId.toLowerCase()
    : paymentId;
  return `id:${normalizedId};request-id:${requestId};ts:${timestamp};`;
}

export async function createWebhookSignature(
  secret: string,
  paymentId: string,
  requestId: string,
  timestamp: string,
): Promise<string> {
  const digest = bytesToHex(
    await hmacSha256(
      secret,
      signatureManifest(paymentId, requestId, timestamp),
    ),
  );
  return `ts=${timestamp},v1=${digest}`;
}

export async function validateWebhookSignature(
  secret: string,
  paymentId: string,
  requestId: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const signature = parseSignature(signatureHeader);
  if (
    !secret ||
    !PAYMENT_ID_PATTERN.test(paymentId) ||
    requestId.length < 1 ||
    requestId.length > 200 ||
    /[\u0000-\u001f\u007f]/u.test(requestId) ||
    !signature
  ) {
    return false;
  }
  const expected = await hmacSha256(
    secret,
    signatureManifest(paymentId, requestId, signature.timestamp),
  );
  return constantTimeEqual(expected, hexToBytes(signature.digest));
}

const STATUS_MAP: Readonly<Record<string, string>> = Object.freeze({
  approved: "paid",
  pending: "pending",
  in_process: "pending",
  rejected: "rejected",
  cancelled: "cancelled",
  refunded: "refunded",
});

function completeConfig(config: WebhookConfig): boolean {
  return Boolean(
    config.webhookSecret &&
      config.mercadoPagoAccessToken &&
      /^TEST-/u.test(config.mercadoPagoAccessToken) &&
      config.supabaseUrl &&
      config.supabaseServiceRoleKey,
  );
}

function validBody(value: unknown, signedPaymentId: string): boolean {
  if (!isPlainObject(value) || value.type !== "payment") return false;
  if (!isPlainObject(value.data)) return false;
  const bodyId = typeof value.data.id === "number"
    ? String(value.data.id)
    : value.data.id;
  return typeof bodyId === "string" && bodyId === signedPaymentId;
}

function log(
  dependencies: WebhookDependencies,
  startedAt: number,
  outcome: string,
  correlationId?: string,
): void {
  dependencies.logger?.info({
    eventType: "payment",
    outcome,
    durationMs: Math.max(0, (dependencies.now?.() ?? Date.now()) - startedAt),
    ...(correlationId ? { correlationId } : {}),
  });
}

export function createWebhookHandler(dependencies: WebhookDependencies) {
  return async (request: Request): Promise<Response> => {
    const startedAt = dependencies.now?.() ?? Date.now();
    if (request.method !== "POST") {
      return json(405, { error: "method_not_allowed" });
    }
    if (!completeConfig(dependencies.config)) {
      log(dependencies, startedAt, "service_unavailable");
      return json(503, { error: "service_unavailable" });
    }

    const url = new URL(request.url);
    const paymentId = url.searchParams.get("data.id") ?? "";
    const queryType = url.searchParams.get("type");
    const requestId = request.headers.get("x-request-id") ?? "";
    const signature = request.headers.get("x-signature");
    const validSignature = await validateWebhookSignature(
      dependencies.config.webhookSecret!,
      paymentId,
      requestId,
      signature,
    );
    if (!validSignature) {
      log(dependencies, startedAt, "invalid_signature");
      return json(401, { error: "unauthorized" });
    }

    const correlationId = (await sha256(requestId)).slice(0, 16);
    if (queryType !== null && queryType !== "payment") {
      log(dependencies, startedAt, "unsupported_topic", correlationId);
      return json(400, { error: "notification_rejected" });
    }
    if (!isJsonContentType(request.headers.get("content-type"))) {
      log(dependencies, startedAt, "invalid_content_type", correlationId);
      return json(415, { error: "invalid_request" });
    }

    const parsed = await parseBody(request);
    if (!parsed.ok) {
      log(dependencies, startedAt, "invalid_body", correlationId);
      return json(parsed.status, { error: "invalid_request" });
    }
    if (!validBody(parsed.body, paymentId)) {
      log(dependencies, startedAt, "invalid_notification", correlationId);
      return json(400, { error: "notification_rejected" });
    }

    let payment: AuthoritativePayment | null;
    try {
      payment = await dependencies.provider.getPayment(paymentId);
    } catch {
      log(dependencies, startedAt, "provider_unavailable", correlationId);
      return json(503, { error: "service_unavailable" });
    }
    if (!payment) {
      log(dependencies, startedAt, "unknown_payment", correlationId);
      return json(404, { error: "notification_rejected" });
    }

    const mappedStatus = STATUS_MAP[payment.status];
    const providerUpdatedAt = Date.parse(payment.updatedAt);
    if (
      payment.id !== paymentId ||
      payment.liveMode !== false ||
      !EXTERNAL_REFERENCE_PATTERN.test(payment.externalReference) ||
      payment.currency !== "BRL" ||
      !Number.isFinite(payment.amount) ||
      payment.amount !== 79.90 ||
      !mappedStatus ||
      Number.isNaN(providerUpdatedAt)
    ) {
      log(dependencies, startedAt, "payment_mismatch", correlationId);
      return json(400, { error: "notification_rejected" });
    }

    let order: StoredOrder | null;
    try {
      order = await dependencies.repository.getOrderByExternalReference(
        payment.externalReference,
      );
    } catch {
      log(dependencies, startedAt, "database_unavailable", correlationId);
      return json(503, { error: "service_unavailable" });
    }
    if (!order) {
      log(dependencies, startedAt, "unknown_order", correlationId);
      return json(404, { error: "notification_rejected" });
    }
    if (
      order.externalReference !== payment.externalReference ||
      order.caseId !== "eco-sp-001" ||
      order.amountCents !== 7990 ||
      order.currency !== "BRL" ||
      (order.providerPaymentId !== null &&
        order.providerPaymentId !== payment.id)
    ) {
      log(dependencies, startedAt, "order_mismatch", correlationId);
      return json(409, { error: "notification_rejected" });
    }

    const observationKey = await sha256(
      `mercado_pago:${payment.id}:${payment.updatedAt}:${payment.status}`,
    );
    let result: Awaited<
      ReturnType<PaymentRepository["processPaymentEvent"]>
    >;
    try {
      result = await dependencies.repository.processPaymentEvent({
        providerPaymentId: payment.id,
        observationKey,
        externalReference: payment.externalReference,
        providerStatus: payment.status,
        mappedOrderStatus: mappedStatus,
        providerUpdatedAt: new Date(providerUpdatedAt).toISOString(),
        correlationMetadata: {
          requestIdHash: await sha256(requestId),
        },
      });
    } catch {
      log(dependencies, startedAt, "database_unavailable", correlationId);
      return json(503, { error: "service_unavailable" });
    }

    if (
      ![
        "updated",
        "duplicate",
        "ignored_older",
        "ignored_protected",
        "eco_referral_converted",
      ].includes(result)
    ) {
      log(dependencies, startedAt, result, correlationId);
      const status = result === "unknown_order" ? 404 : 409;
      return json(status, { error: "notification_rejected" });
    }

    log(dependencies, startedAt, result, correlationId);
    return json(200, { processed: true, result });
  };
}

function supabaseHeaders(serviceRoleKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${serviceRoleKey}`,
    "apikey": serviceRoleKey,
  };
}

function createSupabaseRepository(
  supabaseUrl?: string,
  serviceRoleKey?: string,
): PaymentRepository {
  function configuration() {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("missing_server_configuration");
    }
    return {
      url: supabaseUrl.replace(/\/+$/u, ""),
      headers: supabaseHeaders(serviceRoleKey),
    };
  }

  return {
    async getOrderByExternalReference(externalReference) {
      const { url, headers } = configuration();
      const query = new URLSearchParams({
        external_reference: `eq.${externalReference}`,
        select:
          "case_id,amount_cents,currency,external_reference,provider_payment_id",
        limit: "1",
      });
      const response = await fetch(`${url}/rest/v1/eco_orders?${query}`, {
        headers,
      });
      if (!response.ok) throw new Error("database_read_failed");
      const rows = await response.json() as JsonObject[];
      if (!rows[0]) return null;
      return {
        caseId: String(rows[0].case_id),
        amountCents: Number(rows[0].amount_cents),
        currency: String(rows[0].currency),
        externalReference: String(rows[0].external_reference),
        providerPaymentId: typeof rows[0].provider_payment_id === "string"
          ? rows[0].provider_payment_id
          : null,
      };
    },

    async processPaymentEvent(event) {
      const { url, headers } = configuration();
      const response = await fetch(
        `${url}/rest/v1/rpc/process_eco_payment_event`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            p_provider_payment_id: event.providerPaymentId,
            p_observation_key: event.observationKey,
            p_external_reference: event.externalReference,
            p_provider_status: event.providerStatus,
            p_mapped_order_status: event.mappedOrderStatus,
            p_provider_updated_at: event.providerUpdatedAt,
            p_correlation_metadata: event.correlationMetadata,
          }),
        },
      );
      if (!response.ok) throw new Error("database_rpc_failed");
      const value = await response.json() as JsonObject;
      return String(value.result) as Awaited<
        ReturnType<PaymentRepository["processPaymentEvent"]>
      >;
    },
  };
}

function createMercadoPagoProvider(accessToken?: string): PaymentProvider {
  return {
    async getPayment(paymentId) {
      if (!accessToken || !/^TEST-/u.test(accessToken)) {
        throw new Error("invalid_provider_configuration");
      }
      const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${
          encodeURIComponent(paymentId)
        }`,
        { headers: { "Authorization": `Bearer ${accessToken}` } },
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("provider_request_failed");
      const value = await response.json() as JsonObject;
      return {
        id: String(value.id ?? ""),
        liveMode: value.live_mode !== false,
        externalReference: String(value.external_reference ?? ""),
        currency: String(value.currency_id ?? ""),
        amount: Number(value.transaction_amount),
        status: String(value.status ?? ""),
        updatedAt: String(value.date_last_updated ?? ""),
      };
    },
  };
}

if (import.meta.main) {
  const config: WebhookConfig = {
    webhookSecret: Deno.env.get("MERCADO_PAGO_WEBHOOK_SECRET"),
    mercadoPagoAccessToken: Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN"),
    supabaseUrl: Deno.env.get("SUPABASE_URL"),
    supabaseServiceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  };
  Deno.serve(createWebhookHandler({
    config,
    provider: createMercadoPagoProvider(config.mercadoPagoAccessToken),
    repository: createSupabaseRepository(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
    ),
    logger: {
      info: (entry) => console.info(JSON.stringify(entry)),
    },
  }));
}
