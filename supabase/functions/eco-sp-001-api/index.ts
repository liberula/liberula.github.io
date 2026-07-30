const VALIDATE_BODY_LIMIT = 4 * 1024;
const ORDER_BODY_LIMIT = 16 * 1024;
const ANSWER_MAX_LENGTH = 200;
const ORDER_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;
const REFERRAL_CODE_PATTERN = /^[A-F0-9]{12}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATE_PATTERN = /^[A-Za-z]{2}$/;
const SANDBOX_CHECKOUT_HOSTS = new Set([
  "sandbox.mercadopago.com",
  "sandbox.mercadopago.com.br",
]);
const PRODUCTION_ORIGINS = new Set([
  "https://liberula.com",
  "https://www.liberula.com",
]);

export const ECO_PRODUCT = Object.freeze({
  caseId: "eco-sp-001",
  title: "Próximo Caso E.C.O. | Lote Fundador",
  amountCents: 7990,
  unitPrice: 79.90,
  currency: "BRL",
  quantity: 1,
  initialStatus: "pending",
});

export const ECO_CAMPAIGN = Object.freeze({
  id: "eco-sp-001-founder",
  target: 100,
  closesAt: "2026-08-31T23:59:59-03:00",
});

type JsonObject = Record<string, unknown>;

export type Buyer = {
  name: string;
  email: string;
  whatsapp: string;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
  };
};

export type OrderRecord = {
  orderReference: string;
  externalReference: string;
  providerIdempotencyKey: string;
  checkoutUrl: string | null;
  preferenceId: string | null;
  siteOrigin: string;
  referralCode: string;
  referralAttributed: boolean;
};

export type CampaignProgress = {
  campaignId: string;
  confirmed: number;
  target: number;
  goalReached: boolean;
  status: "collecting" | "goal_reached" | "closed";
  closesAt: string;
};

export type PreferenceClaim =
  | { state: "claimed"; claimToken: string }
  | { state: "busy" | "missing" | "claim_lost" }
  | {
    state: "existing" | "completed";
    checkoutUrl: string;
    preferenceId: string;
  };

export type OrderRepository = {
  createOrGet: (
    idempotencyKey: string,
    buyer: Buyer,
    siteOrigin: string,
    referralCode: string | null,
  ) => Promise<OrderRecord>;
  claimPreference: (orderReference: string) => Promise<PreferenceClaim>;
  completePreference: (
    orderReference: string,
    claimToken: string,
    preferenceId: string,
    checkoutUrl: string,
  ) => Promise<PreferenceClaim>;
  releasePreferenceClaim: (
    orderReference: string,
    claimToken: string,
  ) => Promise<void>;
  getOrder: (orderReference: string) => Promise<OrderRecord | null>;
  getStatus: (
    orderReference: string,
  ) => Promise<
    {
      status: string;
      updatedAt: string;
      referralCode: string;
    } | null
  >;
  consumeStatusRateLimit: (
    rateKey: string,
  ) => Promise<{ allowed: boolean; retryAfter: number }>;
  getCampaignProgress: () => Promise<CampaignProgress>;
};

export type PreferenceRequest = {
  item: {
    title: string;
    quantity: number;
    currencyId: string;
    unitPrice: number;
  };
  buyer: Buyer;
  externalReference: string;
  providerIdempotencyKey: string;
  backUrls: {
    success: string;
    pending: string;
    failure: string;
  };
  notificationUrl: string;
  autoReturn: "approved";
};

export type MercadoPagoAdapter = {
  createPreference: (
    request: PreferenceRequest,
  ) => Promise<{ preferenceId: string; checkoutUrl: string }>;
};

export type EcoApiConfig = {
  answer?: string;
  allowedOrigins?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  mercadoPagoAccessToken?: string;
  statusRateLimitSalt?: string;
};

export type EcoApiDependencies = {
  config: EcoApiConfig;
  orders: OrderRepository;
  mercadoPago: MercadoPagoAdapter;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: {
    error: (message: string) => void;
    info?: (entry: {
      event: "eco_referral_order_created";
      campaign_id: "eco-sp-001-founder";
      has_referral: true;
    }) => void;
  };
};

type ParsedBody =
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 };

function isPlainObject(value: unknown): value is JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: JsonObject, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function isJsonContentType(contentType: string | null): boolean {
  return contentType !== null &&
    /^application\/json(?:\s*;|$)/i.test(contentType);
}

async function parseJsonBody(
  request: Request,
  maxBytes: number,
): Promise<ParsedBody> {
  const rawLength = request.headers.get("content-length");
  if (rawLength) {
    const declaredLength = Number(rawLength);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return { ok: false, status: 413 };
    }
  }

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
      return { ok: false, status: 413 };
    }
    return { ok: true, value: JSON.parse(rawBody) };
  } catch {
    return { ok: false, status: 400 };
  }
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/gu, " ");
}

function digitsOnly(value: unknown): string {
  return normalizeText(value).replace(/\D/gu, "");
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/\s+/gu, " ");
}

export function normalizeReferralCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLocaleUpperCase("en-US");
  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : null;
}

function validateRequiredText(
  value: unknown,
  minLength: number,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeText(value);
  if (
    normalized.length < minLength ||
    normalized.length > maxLength
  ) {
    return null;
  }
  return normalized;
}

export function parseBuyer(value: unknown): Buyer | null {
  if (
    !isPlainObject(value) ||
    !hasExactKeys(value, ["name", "email", "whatsapp", "address"]) ||
    !isPlainObject(value.address) ||
    !hasExactKeys(value.address, [
      "street",
      "number",
      "complement",
      "neighborhood",
      "city",
      "state",
      "postalCode",
    ])
  ) {
    return null;
  }

  const name = validateRequiredText(value.name, 2, 120);
  const email = typeof value.email === "string"
    ? normalizeText(value.email).toLocaleLowerCase("pt-BR")
    : "";
  const whatsapp = typeof value.whatsapp === "string"
    ? digitsOnly(value.whatsapp)
    : "";
  const street = validateRequiredText(value.address.street, 1, 160);
  const number = validateRequiredText(value.address.number, 1, 20);
  const complement = typeof value.address.complement === "string"
    ? normalizeText(value.address.complement)
    : null;
  const neighborhood = validateRequiredText(
    value.address.neighborhood,
    1,
    100,
  );
  const city = validateRequiredText(value.address.city, 1, 100);
  const state = typeof value.address.state === "string"
    ? normalizeText(value.address.state).toLocaleUpperCase("pt-BR")
    : "";
  const postalCode = typeof value.address.postalCode === "string"
    ? digitsOnly(value.address.postalCode)
    : "";

  if (
    !name ||
    !email ||
    email.length > 320 ||
    !EMAIL_PATTERN.test(email) ||
    whatsapp.length < 10 ||
    whatsapp.length > 15 ||
    !street ||
    !number ||
    complement === null ||
    complement.length > 80 ||
    !neighborhood ||
    !city ||
    !STATE_PATTERN.test(state) ||
    postalCode.length !== 8
  ) {
    return null;
  }

  return {
    name,
    email,
    whatsapp,
    address: {
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      postalCode,
    },
  };
}

function parseAdditionalOrigins(value: string | undefined): Set<string> {
  const origins = new Set<string>();
  for (const candidate of value?.split(/[\s,]+/u) ?? []) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (
        url.origin === candidate &&
        (url.protocol === "https:" ||
          (url.protocol === "http:" && url.hostname === "localhost"))
      ) {
        origins.add(candidate);
      }
    } catch {
      // Invalid configured origins are ignored and never reflected.
    }
  }
  return origins;
}

export function isAllowedOrigin(
  origin: string,
  configuredOrigins?: string,
): boolean {
  if (PRODUCTION_ORIGINS.has(origin)) return true;
  if (parseAdditionalOrigins(configuredOrigins).has(origin)) return true;
  try {
    const url = new URL(origin);
    return (
      url.origin === origin &&
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname === "localhost"
    );
  } catch {
    return false;
  }
}

function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, idempotency-key",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(
  status: number,
  body: JsonObject,
  origin?: string,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(origin ? corsHeaders(origin) : {}),
      ...extraHeaders,
    },
  });
}

function requestRoute(request: Request): string {
  const pathname = new URL(request.url).pathname.replace(/\/+$/u, "") || "/";
  const marker = "/eco-sp-001-api";
  const markerIndex = pathname.indexOf(marker);
  if (markerIndex >= 0) {
    return pathname.slice(markerIndex + marker.length) || "/";
  }
  return pathname;
}

function sandboxCheckoutUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !SANDBOX_CHECKOUT_HOSTS.has(url.hostname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function paymentReturnUrl(siteOrigin: string, orderReference: string): string {
  const url = new URL("/eco/eco-sp-001/status", siteOrigin);
  url.searchParams.set("order", orderReference);
  return url.toString();
}

function webhookUrl(supabaseUrl: string): string | null {
  try {
    const projectUrl = new URL(supabaseUrl);
    if (projectUrl.protocol !== "https:") return null;
    return new URL(
      "/functions/v1/eco-sp-001-mercado-pago-webhook",
      projectUrl.origin,
    ).toString();
  } catch {
    return null;
  }
}

function validOrderConfiguration(config: EcoApiConfig): boolean {
  return Boolean(
    config.supabaseUrl &&
      config.supabaseServiceRoleKey &&
      config.mercadoPagoAccessToken &&
      /^TEST-/u.test(config.mercadoPagoAccessToken) &&
      webhookUrl(config.supabaseUrl),
  );
}

async function handleValidate(
  request: Request,
  origin: string,
  config: EcoApiConfig,
): Promise<Response> {
  const expected = typeof config.answer === "string"
    ? normalizeAnswer(config.answer)
    : "";
  if (!expected) {
    return json(503, { error: "service_unavailable" }, origin);
  }
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return json(415, { error: "invalid_request" }, origin);
  }

  const parsed = await parseJsonBody(request, VALIDATE_BODY_LIMIT);
  if (!parsed.ok) {
    return json(parsed.status, { error: "invalid_request" }, origin);
  }
  if (
    !isPlainObject(parsed.value) ||
    !hasExactKeys(parsed.value, ["answer"]) ||
    typeof parsed.value.answer !== "string" ||
    parsed.value.answer.length > ANSWER_MAX_LENGTH
  ) {
    return json(400, { error: "invalid_request" }, origin);
  }

  const submitted = normalizeAnswer(parsed.value.answer);
  if (!submitted) {
    return json(400, { error: "invalid_request" }, origin);
  }
  return json(200, { correct: submitted === expected }, origin);
}

function preferenceRequest(
  order: OrderRecord,
  buyer: Buyer,
  supabaseUrl: string,
): PreferenceRequest {
  const returnUrl = paymentReturnUrl(
    order.siteOrigin,
    order.orderReference,
  );
  const notificationUrl = webhookUrl(supabaseUrl);
  if (!notificationUrl) throw new Error("invalid_server_configuration");

  return {
    item: {
      title: ECO_PRODUCT.title,
      quantity: ECO_PRODUCT.quantity,
      currencyId: ECO_PRODUCT.currency,
      unitPrice: ECO_PRODUCT.unitPrice,
    },
    buyer,
    externalReference: order.externalReference,
    providerIdempotencyKey: order.providerIdempotencyKey,
    backUrls: {
      success: returnUrl,
      pending: returnUrl,
      failure: returnUrl,
    },
    notificationUrl,
    autoReturn: "approved",
  };
}

async function handleOrder(
  request: Request,
  origin: string,
  dependencies: EcoApiDependencies,
): Promise<Response> {
  const { config, orders, mercadoPago } = dependencies;
  if (!validOrderConfiguration(config)) {
    return json(503, { error: "service_unavailable" }, origin);
  }
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return json(415, { error: "invalid_request" }, origin);
  }

  const idempotencyKey = request.headers.get("idempotency-key") ?? "";
  if (!UUID_PATTERN.test(idempotencyKey)) {
    return json(400, { error: "invalid_request" }, origin);
  }

  const parsed = await parseJsonBody(request, ORDER_BODY_LIMIT);
  if (!parsed.ok) {
    return json(parsed.status, { error: "invalid_request" }, origin);
  }
  if (
    !isPlainObject(parsed.value) ||
    !(
      hasExactKeys(parsed.value, ["buyer"]) ||
      hasExactKeys(parsed.value, ["buyer", "referralCode"])
    )
  ) {
    return json(400, { error: "invalid_request" }, origin);
  }
  const buyer = parseBuyer(parsed.value.buyer);
  if (!buyer) {
    return json(400, { error: "invalid_request" }, origin);
  }
  const referralCode = normalizeReferralCode(parsed.value.referralCode);

  let order: OrderRecord;
  try {
    order = await orders.createOrGet(
      idempotencyKey,
      buyer,
      origin,
      referralCode,
    );
    if (order.referralAttributed) {
      dependencies.logger?.info?.({
        event: "eco_referral_order_created",
        campaign_id: ECO_CAMPAIGN.id,
        has_referral: true,
      });
    }
  } catch {
    dependencies.logger?.error("[eco-sp-001-api] order persistence failed");
    return json(503, { error: "service_unavailable" }, origin);
  }

  if (order.checkoutUrl) {
    const checkoutUrl = sandboxCheckoutUrl(order.checkoutUrl);
    if (!checkoutUrl) {
      return json(503, { error: "service_unavailable" }, origin);
    }
    return json(200, {
      checkoutUrl,
      orderReference: order.orderReference,
      referralCode: order.referralCode,
      referralAttributed: order.referralAttributed,
    }, origin);
  }

  let claim: PreferenceClaim;
  try {
    claim = await orders.claimPreference(order.orderReference);
  } catch {
    dependencies.logger?.error("[eco-sp-001-api] preference claim failed");
    return json(503, { error: "service_unavailable" }, origin);
  }

  if (claim.state === "existing" || claim.state === "completed") {
    const checkoutUrl = sandboxCheckoutUrl(claim.checkoutUrl);
    if (!checkoutUrl) {
      return json(503, { error: "service_unavailable" }, origin);
    }
    return json(200, {
      checkoutUrl,
      orderReference: order.orderReference,
      referralCode: order.referralCode,
      referralAttributed: order.referralAttributed,
    }, origin);
  }

  if (claim.state === "busy") {
    const sleep = dependencies.sleep ??
      ((milliseconds: number) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await sleep(100);
        const current = await orders.getOrder(order.orderReference);
        if (current?.checkoutUrl) {
          const checkoutUrl = sandboxCheckoutUrl(current.checkoutUrl);
          if (checkoutUrl) {
            return json(200, {
              checkoutUrl,
              orderReference: order.orderReference,
              referralCode: current.referralCode,
              referralAttributed: current.referralAttributed,
            }, origin);
          }
        }
      }
    } catch {
      dependencies.logger?.error(
        "[eco-sp-001-api] preference reload failed",
      );
      return json(503, { error: "service_unavailable" }, origin);
    }
    return json(
      409,
      { error: "preference_in_progress", retryable: true },
      origin,
      { "Retry-After": "1" },
    );
  }

  if (claim.state !== "claimed") {
    return json(503, { error: "service_unavailable" }, origin);
  }

  try {
    const created = await mercadoPago.createPreference(
      preferenceRequest(order, buyer, config.supabaseUrl!),
    );
    const checkoutUrl = sandboxCheckoutUrl(created.checkoutUrl);
    if (!created.preferenceId || !checkoutUrl) {
      throw new Error("invalid_provider_response");
    }

    const completed = await orders.completePreference(
      order.orderReference,
      claim.claimToken,
      created.preferenceId,
      checkoutUrl,
    );
    if (
      completed.state !== "completed" &&
      completed.state !== "existing"
    ) {
      throw new Error("preference_persistence_failed");
    }
    const persistedUrl = sandboxCheckoutUrl(completed.checkoutUrl);
    if (!persistedUrl) throw new Error("invalid_persisted_checkout_url");

    return json(201, {
      checkoutUrl: persistedUrl,
      orderReference: order.orderReference,
      referralCode: order.referralCode,
      referralAttributed: order.referralAttributed,
    }, origin);
  } catch {
    try {
      await orders.releasePreferenceClaim(
        order.orderReference,
        claim.claimToken,
      );
    } catch {
      dependencies.logger?.error(
        "[eco-sp-001-api] preference claim release failed",
      );
    }
    dependencies.logger?.error(
      "[eco-sp-001-api] preference creation failed",
    );
    return json(502, { error: "checkout_unavailable" }, origin);
  }
}

async function handleCampaignProgress(
  origin: string,
  dependencies: EcoApiDependencies,
): Promise<Response> {
  if (
    !dependencies.config.supabaseUrl ||
    !dependencies.config.supabaseServiceRoleKey
  ) {
    return json(503, { error: "service_unavailable" }, origin);
  }

  try {
    const progress = await dependencies.orders.getCampaignProgress();
    if (
      progress.campaignId !== ECO_CAMPAIGN.id ||
      !Number.isInteger(progress.confirmed) ||
      progress.confirmed < 0 ||
      progress.target !== ECO_CAMPAIGN.target ||
      progress.goalReached !==
        (progress.confirmed >= progress.target) ||
      !["collecting", "goal_reached", "closed"].includes(progress.status) ||
      Number.isNaN(Date.parse(progress.closesAt))
    ) {
      throw new Error("invalid_campaign_progress");
    }
    return json(
      200,
      {
        campaignId: progress.campaignId,
        confirmed: progress.confirmed,
        target: progress.target,
        goalReached: progress.goalReached,
        status: progress.status,
        closesAt: progress.closesAt,
      },
      origin,
      {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=30",
      },
    );
  } catch {
    dependencies.logger?.error(
      "[eco-sp-001-api] campaign progress read failed",
    );
    return json(503, { error: "service_unavailable" }, origin);
  }
}

async function handleStatus(
  request: Request,
  origin: string,
  orderReference: string,
  dependencies: EcoApiDependencies,
): Promise<Response> {
  if (
    !dependencies.config.supabaseUrl ||
    !dependencies.config.supabaseServiceRoleKey ||
    !dependencies.config.statusRateLimitSalt ||
    dependencies.config.statusRateLimitSalt.length < 32
  ) {
    return json(503, { error: "service_unavailable" }, origin);
  }
  if (!ORDER_REFERENCE_PATTERN.test(orderReference)) {
    return json(400, { error: "invalid_request" }, origin);
  }

  try {
    const forwardedFor = request.headers.get("x-forwarded-for")
      ?.split(",")[0].trim();
    const clientIdentifier = request.headers.get("cf-connecting-ip")?.trim() ||
      forwardedFor ||
      "unknown";
    const keyMaterial = `${clientIdentifier}\n${orderReference}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(dependencies.config.statusRateLimitSalt),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(keyMaterial),
      ),
    );
    const rateKey = [...digest]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const limit = await dependencies.orders.consumeStatusRateLimit(rateKey);
    if (!limit.allowed) {
      return json(
        429,
        { error: "rate_limited" },
        origin,
        { "Retry-After": String(Math.max(1, limit.retryAfter)) },
      );
    }
    const status = await dependencies.orders.getStatus(orderReference);
    if (!status) return json(404, { error: "not_found" }, origin);
    if (
      !["pending", "paid", "rejected", "cancelled", "refunded"].includes(
        status.status,
      ) ||
      Number.isNaN(Date.parse(status.updatedAt)) ||
      !REFERRAL_CODE_PATTERN.test(status.referralCode)
    ) {
      throw new Error("invalid_database_response");
    }
    return json(200, {
      status: status.status,
      updatedAt: status.updatedAt,
      referralCode: status.referralCode,
    }, origin);
  } catch {
    dependencies.logger?.error("[eco-sp-001-api] status read failed");
    return json(503, { error: "service_unavailable" }, origin);
  }
}

export function createEcoApiHandler(dependencies: EcoApiDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin") ?? "";
    if (
      !origin ||
      !isAllowedOrigin(origin, dependencies.config.allowedOrigins)
    ) {
      return json(403, { error: "request_rejected" });
    }

    const route = requestRoute(request);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    if (route === "/validate") {
      if (request.method !== "POST") {
        return json(405, { error: "method_not_allowed" }, origin);
      }
      return await handleValidate(request, origin, dependencies.config);
    }

    if (route === "/orders") {
      if (request.method !== "POST") {
        return json(405, { error: "method_not_allowed" }, origin);
      }
      return await handleOrder(request, origin, dependencies);
    }

    if (route === "/campaign-progress") {
      if (request.method !== "GET") {
        return json(405, { error: "method_not_allowed" }, origin);
      }
      return await handleCampaignProgress(origin, dependencies);
    }

    const statusMatch = route.match(/^\/orders\/([^/]+)\/status$/u);
    if (statusMatch) {
      if (request.method !== "GET") {
        return json(405, { error: "method_not_allowed" }, origin);
      }
      try {
        return await handleStatus(
          request,
          origin,
          decodeURIComponent(statusMatch[1]),
          dependencies,
        );
      } catch {
        return json(400, { error: "invalid_request" }, origin);
      }
    }

    return json(404, { error: "not_found" }, origin);
  };
}

function supabaseHeaders(serviceRoleKey: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${serviceRoleKey}`,
    "apikey": serviceRoleKey,
  };
}

function createSupabaseOrderRepository(
  supabaseUrl?: string,
  serviceRoleKey?: string,
): OrderRepository {
  function requireConfiguration(): {
    url: string;
    key: string;
  } {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("missing_server_configuration");
    }
    return { url: supabaseUrl.replace(/\/+$/u, ""), key: serviceRoleKey };
  }

  async function rpc(name: string, body: JsonObject): Promise<unknown> {
    const { url, key } = requireConfiguration();
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: supabaseHeaders(key),
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error("database_rpc_failed");
    return await response.json();
  }

  async function selectOrder(
    orderReference: string,
  ): Promise<OrderRecord | null> {
    const { url, key } = requireConfiguration();
    const query = new URLSearchParams({
      public_reference: `eq.${orderReference}`,
      select:
        "public_reference,external_reference,id,sandbox_checkout_url,mercado_pago_preference_id,site_origin,referral_code,referrer_order_id",
      limit: "1",
    });
    const response = await fetch(`${url}/rest/v1/eco_orders?${query}`, {
      headers: supabaseHeaders(key),
    });
    if (!response.ok) throw new Error("database_read_failed");
    const rows = await response.json() as JsonObject[];
    if (!rows[0]) return null;
    return {
      orderReference: String(rows[0].public_reference),
      externalReference: String(rows[0].external_reference),
      providerIdempotencyKey: String(rows[0].id),
      checkoutUrl: typeof rows[0].sandbox_checkout_url === "string"
        ? rows[0].sandbox_checkout_url
        : null,
      preferenceId: typeof rows[0].mercado_pago_preference_id === "string"
        ? rows[0].mercado_pago_preference_id
        : null,
      siteOrigin: String(rows[0].site_origin),
      referralCode: String(rows[0].referral_code),
      referralAttributed: typeof rows[0].referrer_order_id === "string",
    };
  }

  return {
    async createOrGet(idempotencyKey, buyer, siteOrigin, referralCode) {
      return await rpc("create_or_get_eco_order", {
        p_client_idempotency_key: idempotencyKey,
        p_buyer_name: buyer.name,
        p_buyer_email: buyer.email,
        p_buyer_whatsapp: buyer.whatsapp,
        p_delivery_street: buyer.address.street,
        p_delivery_number: buyer.address.number,
        p_delivery_complement: buyer.address.complement,
        p_delivery_neighborhood: buyer.address.neighborhood,
        p_delivery_city: buyer.address.city,
        p_delivery_state: buyer.address.state,
        p_delivery_postal_code: buyer.address.postalCode,
        p_site_origin: siteOrigin,
        p_referral_code: referralCode,
      }) as OrderRecord;
    },

    async claimPreference(orderReference) {
      return await rpc("claim_eco_order_preference", {
        p_order_reference: orderReference,
        p_claim_ttl_seconds: 120,
      }) as PreferenceClaim;
    },

    async completePreference(
      orderReference,
      claimToken,
      preferenceId,
      checkoutUrl,
    ) {
      return await rpc("complete_eco_order_preference", {
        p_order_reference: orderReference,
        p_claim_token: claimToken,
        p_preference_id: preferenceId,
        p_sandbox_checkout_url: checkoutUrl,
      }) as PreferenceClaim;
    },

    async releasePreferenceClaim(orderReference, claimToken) {
      await rpc("release_eco_order_preference_claim", {
        p_order_reference: orderReference,
        p_claim_token: claimToken,
      });
    },

    getOrder: selectOrder,

    async getStatus(orderReference) {
      const { url, key } = requireConfiguration();
      const query = new URLSearchParams({
        public_reference: `eq.${orderReference}`,
        select: "status,updated_at,referral_code",
        limit: "1",
      });
      const response = await fetch(`${url}/rest/v1/eco_orders?${query}`, {
        headers: supabaseHeaders(key),
      });
      if (!response.ok) throw new Error("database_read_failed");
      const rows = await response.json() as JsonObject[];
      if (!rows[0]) return null;
      return {
        status: String(rows[0].status),
        updatedAt: String(rows[0].updated_at),
        referralCode: String(rows[0].referral_code),
      };
    },

    async consumeStatusRateLimit(rateKey) {
      const value = await rpc("consume_eco_status_rate_limit", {
        p_rate_key: rateKey,
        p_window_seconds: 60,
        p_request_limit: 18,
      }) as JsonObject;
      return {
        allowed: value.allowed === true,
        retryAfter: Number(value.retryAfter),
      };
    },

    async getCampaignProgress() {
      return await rpc(
        "get_eco_campaign_progress",
        {},
      ) as CampaignProgress;
    },
  };
}

function createMercadoPagoAdapter(
  accessToken?: string,
): MercadoPagoAdapter {
  return {
    async createPreference(request) {
      if (!accessToken || !/^TEST-/u.test(accessToken)) {
        throw new Error("missing_or_live_provider_configuration");
      }
      const response = await fetch(
        "https://api.mercadopago.com/checkout/preferences",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "X-Idempotency-Key": request.providerIdempotencyKey,
          },
          body: JSON.stringify({
            items: [{
              title: request.item.title,
              quantity: request.item.quantity,
              currency_id: request.item.currencyId,
              unit_price: request.item.unitPrice,
            }],
            payer: {
              name: request.buyer.name,
              email: request.buyer.email,
              phone: { number: request.buyer.whatsapp },
              address: {
                zip_code: request.buyer.address.postalCode,
                street_name: request.buyer.address.street,
                street_number: request.buyer.address.number,
              },
            },
            shipments: {
              receiver_address: {
                zip_code: request.buyer.address.postalCode,
                street_name: request.buyer.address.street,
                street_number: request.buyer.address.number,
                city_name: request.buyer.address.city,
                state_name: request.buyer.address.state,
                country_name: "Brasil",
              },
            },
            external_reference: request.externalReference,
            back_urls: request.backUrls,
            notification_url: request.notificationUrl,
            auto_return: request.autoReturn,
          }),
        },
      );
      if (!response.ok) throw new Error("provider_request_failed");
      const value = await response.json() as JsonObject;
      if (value.live_mode === true) {
        throw new Error("production_provider_response");
      }
      return {
        preferenceId: typeof value.id === "string" ? value.id : "",
        checkoutUrl: typeof value.sandbox_init_point === "string"
          ? value.sandbox_init_point
          : "",
      };
    },
  };
}

if (import.meta.main) {
  const config: EcoApiConfig = {
    answer: Deno.env.get("ECO_SP_001_ANSWER"),
    allowedOrigins: Deno.env.get("ECO_ALLOWED_ORIGINS"),
    supabaseUrl: Deno.env.get("SUPABASE_URL"),
    supabaseServiceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    mercadoPagoAccessToken: Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN"),
    statusRateLimitSalt: Deno.env.get("ECO_STATUS_RATE_LIMIT_SALT"),
  };
  Deno.serve(createEcoApiHandler({
    config,
    orders: createSupabaseOrderRepository(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
    ),
    mercadoPago: createMercadoPagoAdapter(
      config.mercadoPagoAccessToken,
    ),
    logger: {
      error: (message) => console.error(message),
      info: (entry) => console.info(JSON.stringify(entry)),
    },
  }));
}
