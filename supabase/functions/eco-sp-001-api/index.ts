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
const PRODUCTION_CHECKOUT_HOSTS = new Set([
  "www.mercadopago.com",
  "www.mercadopago.com.br",
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
  mercadoPagoEnvironment?: "test" | "production";
  statusRateLimitSalt?: string;
};

type EcoLogEntry = {
  event: string;
  requestId?: string;
  stage?: string;
  campaignId?: string;
  durationMs?: number;
  hasReferral?: boolean;
  reused?: boolean;
  errorType?: string;
  errorCode?: string;
  upstreamStatus?: number;
  safeMessage?: string;
  missingKey?: string;
  claimReleaseFailed?: boolean;
  campaign_id?: string;
  has_referral?: boolean;
};

export type EcoApiDependencies = {
  config: EcoApiConfig;
  orders: OrderRepository;
  mercadoPago: MercadoPagoAdapter;
  sleep?: (milliseconds: number) => Promise<void>;
  logger?: {
    error: (entry: string | EcoLogEntry) => void;
    info?: (entry: EcoLogEntry) => void;
  };
};

class OperationalError extends Error {
  constructor(
    readonly errorType: "database" | "mercado_pago" | "application",
    readonly errorCode: string,
    readonly safeMessage: string,
    readonly upstreamStatus?: number,
  ) {
    super(errorCode);
    this.name = "OperationalError";
  }
}

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

function configuredCheckoutUrl(
  value: string,
  environment: "test" | "production",
): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !(environment === "test"
        ? SANDBOX_CHECKOUT_HOSTS
        : PRODUCTION_CHECKOUT_HOSTS).has(url.hostname)
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function paymentReturnUrl(siteOrigin: string, orderReference: string): string {
  const url = new URL("/eco/eco-sp-001/comprar", siteOrigin);
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

function orderConfigurationIssue(
  config: EcoApiConfig,
): { errorCode: string; safeMessage: string; missingKey?: string } | null {
  for (
    const [key, present] of [
      ["SUPABASE_URL", Boolean(config.supabaseUrl)],
      ["SUPABASE_SERVICE_ROLE_KEY", Boolean(config.supabaseServiceRoleKey)],
      ["MERCADO_PAGO_ACCESS_TOKEN", Boolean(config.mercadoPagoAccessToken)],
      [
        "MERCADO_PAGO_ENVIRONMENT",
        config.mercadoPagoEnvironment === "test" ||
        config.mercadoPagoEnvironment === "production",
      ],
    ] as const
  ) {
    if (!present) {
      return {
        errorCode: "missing_configuration",
        safeMessage: "required server configuration is missing",
        missingKey: key,
      };
    }
  }
  if (!webhookUrl(config.supabaseUrl!)) {
    return {
      errorCode: "invalid_supabase_url",
      safeMessage: "server callback URL is invalid",
      missingKey: "SUPABASE_URL",
    };
  }
  return null;
}

function operationalFailure(error: unknown): {
  errorType: string;
  errorCode: string;
  safeMessage: string;
  upstreamStatus?: number;
} {
  if (error instanceof OperationalError) {
    return {
      errorType: error.errorType,
      errorCode: error.errorCode,
      safeMessage: error.safeMessage,
      ...(error.upstreamStatus === undefined
        ? {}
        : { upstreamStatus: error.upstreamStatus }),
    };
  }
  return {
    errorType: "application",
    errorCode: "unexpected_failure",
    safeMessage: "unexpected operation failure",
  };
}

function logOrderFailure(
  dependencies: EcoApiDependencies,
  requestId: string,
  stage: string,
  error: unknown,
  startedAt: number,
  claimReleaseFailed = false,
  extra: Pick<EcoLogEntry, "missingKey"> = {},
) {
  dependencies.logger?.error({
    event: "eco_order_failed",
    requestId,
    stage,
    campaignId: ECO_CAMPAIGN.id,
    durationMs: Date.now() - startedAt,
    ...operationalFailure(error),
    ...(claimReleaseFailed ? { claimReleaseFailed: true } : {}),
    ...extra,
  });
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
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const { config, orders, mercadoPago } = dependencies;
  dependencies.logger?.info?.({
    event: "eco_order_started",
    requestId,
    stage: "request_validation",
    campaignId: ECO_CAMPAIGN.id,
  });

  const configurationIssue = orderConfigurationIssue(config);
  if (configurationIssue) {
    logOrderFailure(
      dependencies,
      requestId,
      "configuration_validation",
      new OperationalError(
        "application",
        configurationIssue.errorCode,
        configurationIssue.safeMessage,
      ),
      startedAt,
      false,
      { missingKey: configurationIssue.missingKey },
    );
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
  const hasReferral = referralCode !== null;

  function successResponse(
    status: 200 | 201,
    body: JsonObject,
    reused: boolean,
  ) {
    dependencies.logger?.info?.({
      event: "eco_order_succeeded",
      requestId,
      stage: "response_created",
      campaignId: ECO_CAMPAIGN.id,
      durationMs: Date.now() - startedAt,
      hasReferral,
      reused,
    });
    return json(status, body, origin);
  }

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
  } catch (error) {
    logOrderFailure(
      dependencies,
      requestId,
      "order_rpc",
      error,
      startedAt,
    );
    return json(503, { error: "service_unavailable" }, origin);
  }

  if (order.checkoutUrl) {
    const checkoutUrl = configuredCheckoutUrl(
      order.checkoutUrl,
      config.mercadoPagoEnvironment!,
    );
    if (!checkoutUrl) {
      logOrderFailure(
        dependencies,
        requestId,
        "existing_checkout_validation",
        new OperationalError(
          "application",
          "invalid_stored_checkout_url",
          "stored checkout URL is invalid",
        ),
        startedAt,
      );
      return json(503, { error: "service_unavailable" }, origin);
    }
    return successResponse(200, {
      checkoutUrl,
      orderReference: order.orderReference,
      referralCode: order.referralCode,
      referralAttributed: order.referralAttributed,
    }, true);
  }

  let claim: PreferenceClaim;
  try {
    claim = await orders.claimPreference(order.orderReference);
  } catch (error) {
    logOrderFailure(
      dependencies,
      requestId,
      "preference_claim",
      error,
      startedAt,
    );
    return json(503, { error: "service_unavailable" }, origin);
  }

  if (claim.state === "existing" || claim.state === "completed") {
    const checkoutUrl = configuredCheckoutUrl(
      claim.checkoutUrl,
      config.mercadoPagoEnvironment!,
    );
    if (!checkoutUrl) {
      logOrderFailure(
        dependencies,
        requestId,
        "existing_checkout_validation",
        new OperationalError(
          "application",
          "invalid_stored_checkout_url",
          "stored checkout URL is invalid",
        ),
        startedAt,
      );
      return json(503, { error: "service_unavailable" }, origin);
    }
    return successResponse(200, {
      checkoutUrl,
      orderReference: order.orderReference,
      referralCode: order.referralCode,
      referralAttributed: order.referralAttributed,
    }, true);
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
          const checkoutUrl = configuredCheckoutUrl(
            current.checkoutUrl,
            config.mercadoPagoEnvironment!,
          );
          if (checkoutUrl) {
            return successResponse(200, {
              checkoutUrl,
              orderReference: order.orderReference,
              referralCode: current.referralCode,
              referralAttributed: current.referralAttributed,
            }, true);
          }
        }
      }
    } catch (error) {
      logOrderFailure(
        dependencies,
        requestId,
        "preference_reload",
        error,
        startedAt,
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
    logOrderFailure(
      dependencies,
      requestId,
      "preference_claim",
      new OperationalError(
        "application",
        "invalid_claim_state",
        "preference claim returned an invalid state",
      ),
      startedAt,
    );
    return json(503, { error: "service_unavailable" }, origin);
  }
  const claimToken = claim.claimToken;

  async function releaseClaim(): Promise<boolean> {
    try {
      await orders.releasePreferenceClaim(
        order.orderReference,
        claimToken,
      );
      return false;
    } catch {
      return true;
    }
  }

  let created: { preferenceId: string; checkoutUrl: string };
  try {
    created = await mercadoPago.createPreference(
      preferenceRequest(order, buyer, config.supabaseUrl!),
    );
    const checkoutUrl = configuredCheckoutUrl(
      created.checkoutUrl,
      config.mercadoPagoEnvironment!,
    );
    if (!created.preferenceId || !checkoutUrl) {
      throw new OperationalError(
        "mercado_pago",
        "invalid_provider_response",
        "provider response did not contain a checkout URL for the configured environment",
      );
    }
    created = { ...created, checkoutUrl };
  } catch (error) {
    const releaseFailed = await releaseClaim();
    logOrderFailure(
      dependencies,
      requestId,
      "mercado_pago_preference",
      error,
      startedAt,
      releaseFailed,
    );
    return json(502, { error: "checkout_unavailable" }, origin);
  }

  try {
    const completed = await orders.completePreference(
      order.orderReference,
      claimToken,
      created.preferenceId,
      created.checkoutUrl,
    );
    if (
      completed.state !== "completed" &&
      completed.state !== "existing"
    ) {
      throw new OperationalError(
        "database",
        "preference_persistence_failed",
        "checkout preference could not be persisted",
      );
    }
    const persistedUrl = configuredCheckoutUrl(
      completed.checkoutUrl,
      config.mercadoPagoEnvironment!,
    );
    if (!persistedUrl) {
      throw new OperationalError(
        "database",
        "invalid_persisted_checkout_url",
        "persisted checkout URL is invalid",
      );
    }

    return successResponse(201, {
      checkoutUrl: persistedUrl,
      orderReference: order.orderReference,
      referralCode: order.referralCode,
      referralAttributed: order.referralAttributed,
    }, false);
  } catch (error) {
    const releaseFailed = await releaseClaim();
    logOrderFailure(
      dependencies,
      requestId,
      "checkout_persistence",
      error,
      startedAt,
      releaseFailed,
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

function safeErrorCode(value: unknown, fallback: string): string {
  return typeof value === "string" && /^[A-Za-z0-9_.:-]{1,80}$/u.test(value)
    ? value
    : fallback;
}

function sensitiveStrings(value: unknown): string[] {
  if (typeof value === "string") return value.length >= 3 ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(sensitiveStrings);
  if (isPlainObject(value)) {
    return Object.values(value).flatMap(sensitiveStrings);
  }
  return [];
}

function sanitizeUpstreamMessage(
  value: unknown,
  secrets: string[],
  fallback: string,
): string {
  if (typeof value !== "string" || value.length === 0) return fallback;
  let sanitized = value.replace(/[\r\n\t]+/gu, " ");
  for (const secret of secrets.sort((a, b) => b.length - a.length)) {
    sanitized = sanitized.split(secret).join("[redacted]");
  }
  sanitized = sanitized
    .replace(/[^\s@]+@[^\s@]+/gu, "[redacted-email]")
    .replace(/https?:\/\/\S+/giu, "[redacted-url]")
    .replace(/\b\d{7,}\b/gu, "[redacted-number]")
    .replace(/\b(?:Bearer|Basic)\s+\S+/giu, "[redacted-authorization]")
    .slice(0, 200)
    .trim();
  return sanitized || fallback;
}

async function responseJson(response: Response): Promise<JsonObject | null> {
  const text = await response.text();
  if (!text) return null;
  try {
    const value: unknown = JSON.parse(text);
    return isPlainObject(value) ? value : null;
  } catch {
    return null;
  }
}

export function createSupabaseOrderRepository(
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
    const value = await responseJson(response);
    if (!response.ok) {
      throw new OperationalError(
        "database",
        safeErrorCode(value?.code, "database_rpc_failed"),
        sanitizeUpstreamMessage(
          value?.message,
          sensitiveStrings(body),
          "database RPC returned an error",
        ),
        response.status,
      );
    }
    if (value === null) {
      throw new OperationalError(
        "database",
        "database_invalid_json",
        "database RPC returned an invalid response",
        response.status,
      );
    }
    return value;
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

export function createMercadoPagoAdapter(
  accessToken?: string,
  fetcher: typeof fetch = fetch,
  environment: "test" | "production" = "test",
): MercadoPagoAdapter {
  return {
    async createPreference(request) {
      if (!accessToken) {
        throw new OperationalError(
          "application",
          "missing_configuration",
          "Mercado Pago configuration is missing",
        );
      }
      const response = await fetcher(
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
      const value = await responseJson(response);
      const sensitive = [
        accessToken,
        request.buyer.name,
        request.buyer.email,
        request.buyer.whatsapp,
        request.buyer.address.street,
        request.buyer.address.number,
        request.buyer.address.complement,
        request.buyer.address.neighborhood,
        request.buyer.address.city,
        request.buyer.address.postalCode,
        request.externalReference,
        request.providerIdempotencyKey,
      ].filter((entry) => entry.length >= 3);
      if (value === null) {
        throw new OperationalError(
          "mercado_pago",
          "provider_invalid_json",
          "Mercado Pago returned an invalid response",
          response.status,
        );
      }
      if (!response.ok) {
        throw new OperationalError(
          "mercado_pago",
          safeErrorCode(
            value?.error ?? value?.code,
            "provider_request_failed",
          ),
          sanitizeUpstreamMessage(
            value?.message,
            sensitive,
            "Mercado Pago rejected the preference",
          ),
          response.status,
        );
      }
      return {
        preferenceId: typeof value.id === "string" ? value.id : "",
        checkoutUrl: typeof (
            environment === "test" ? value.sandbox_init_point : value.init_point
          ) === "string"
          ? String(
            environment === "test"
              ? value.sandbox_init_point
              : value.init_point,
          )
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
    mercadoPagoEnvironment: Deno.env.get("MERCADO_PAGO_ENVIRONMENT") as
      | "test"
      | "production"
      | undefined,
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
      fetch,
      config.mercadoPagoEnvironment,
    ),
    logger: {
      error: (entry) =>
        console.error(
          typeof entry === "string" ? entry : JSON.stringify(entry),
        ),
      info: (entry) => console.info(JSON.stringify(entry)),
    },
  }));
}
