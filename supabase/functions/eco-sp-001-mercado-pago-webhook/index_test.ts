import {
  type AuthoritativePayment,
  createWebhookHandler,
  type PaymentEvent,
  type PaymentProvider,
  type PaymentRepository,
  type StoredOrder,
  validateWebhookSignature,
  type WebhookConfig,
} from "./index.ts";

const SECRET = "synthetic-webhook-secret";
const PAYMENT_ID = "123456789";
const REQUEST_ID = "req-001";
const TIMESTAMP = "1753800000";
const FIXED_SIGNATURE =
  "ts=1753800000,v1=136fa5c0aabcdf852b0925beb382acb2446a5bb906605c52ff1afd8279244d69";
const EXTERNAL_REFERENCE = `eco_${"a".repeat(32)}`;
const COLLECTOR_ID = "3575880016";

const config: WebhookConfig = {
  webhookSecret: SECRET,
  mercadoPagoAccessToken: "APP_USR-synthetic-test-access-token",
  mercadoPagoEnvironment: "test",
  expectedCollectorId: COLLECTOR_ID,
  supabaseUrl: "https://synthetic-project.supabase.co",
  supabaseServiceRoleKey: "synthetic-service-role",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nactual=${JSON.stringify(actual)}\nexpected=${
        JSON.stringify(expected)
      }`,
    );
  }
}

function payment(
  patch: Partial<AuthoritativePayment> = {},
): AuthoritativePayment {
  return {
    id: PAYMENT_ID,
    liveMode: false,
    testPayer: false,
    collectorId: COLLECTOR_ID,
    externalReference: EXTERNAL_REFERENCE,
    preferenceId: "synthetic-preference-id",
    currency: "BRL",
    amount: 29.90,
    status: "approved",
    updatedAt: "2026-07-29T12:00:00.000Z",
    ...patch,
  };
}

class MemoryProvider implements PaymentProvider {
  calls: string[] = [];
  value: AuthoritativePayment | null = payment();
  fail = false;

  getPayment(paymentId: string): Promise<AuthoritativePayment | null> {
    this.calls.push(paymentId);
    if (this.fail) return Promise.reject(new Error("provider sentinel"));
    return Promise.resolve(this.value);
  }
}

class MemoryRepository implements PaymentRepository {
  order: StoredOrder | null = {
    caseId: "eco-sp-001",
    amountCents: 2990,
    currency: "BRL",
    externalReference: EXTERNAL_REFERENCE,
    preferenceId: "synthetic-preference-id",
    providerPaymentId: null,
  };
  orderStatus = "pending";
  providerUpdatedAt: string | null = null;
  observations = new Set<string>();
  events: PaymentEvent[] = [];
  readCalls = 0;
  processCalls = 0;
  failRead = false;
  failProcess = false;
  forcedResult:
    | Awaited<
      ReturnType<PaymentRepository["processPaymentEvent"]>
    >
    | null = null;

  getOrderByExternalReference(
    externalReference: string,
  ): Promise<StoredOrder | null> {
    this.readCalls += 1;
    if (this.failRead) return Promise.reject(new Error("database sentinel"));
    if (this.order?.externalReference !== externalReference) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.order);
  }

  processPaymentEvent(
    event: PaymentEvent,
  ): Promise<
    Awaited<ReturnType<PaymentRepository["processPaymentEvent"]>>
  > {
    this.processCalls += 1;
    if (this.failProcess) {
      return Promise.reject(new Error("rpc sentinel"));
    }
    if (this.forcedResult) return Promise.resolve(this.forcedResult);
    if (!this.order) return Promise.resolve("unknown_order");
    if (this.observations.has(event.observationKey)) {
      return Promise.resolve("duplicate");
    }
    if (
      this.order.providerPaymentId &&
      this.order.providerPaymentId !== event.providerPaymentId
    ) {
      return Promise.resolve("payment_id_conflict");
    }
    let result:
      | "updated"
      | "ignored_older"
      | "ignored_protected" = "updated";
    if (
      this.providerUpdatedAt &&
      Date.parse(event.providerUpdatedAt) <= Date.parse(this.providerUpdatedAt)
    ) {
      result = "ignored_older";
    } else if (
      (this.orderStatus === "paid" &&
        ["pending", "rejected", "cancelled"].includes(
          event.mappedOrderStatus,
        )) ||
      (this.orderStatus === "refunded" &&
        event.mappedOrderStatus !== "refunded")
    ) {
      result = "ignored_protected";
      this.providerUpdatedAt = event.providerUpdatedAt;
      this.order.providerPaymentId = event.providerPaymentId;
    } else {
      this.orderStatus = event.mappedOrderStatus;
      this.providerUpdatedAt = event.providerUpdatedAt;
      this.order.providerPaymentId = event.providerPaymentId;
    }
    this.observations.add(event.observationKey);
    this.events.push(event);
    return Promise.resolve(result);
  }
}

function run(overrides: {
  provider?: MemoryProvider;
  repository?: MemoryRepository;
  config?: WebhookConfig;
  requestFounderEmailDispatch?: () => Promise<void>;
  defer?: (work: Promise<void>) => void;
} = {}) {
  const provider = overrides.provider ?? new MemoryProvider();
  const repository = overrides.repository ?? new MemoryRepository();
  const logs: unknown[] = [];
  return {
    provider,
    repository,
    logs,
    handler: createWebhookHandler({
      config: overrides.config ?? config,
      provider,
      repository,
      requestFounderEmailDispatch: overrides.requestFounderEmailDispatch,
      defer: overrides.defer,
      logger: { info: (entry) => logs.push(entry) },
    }),
  };
}

function webhookRequest({
  method = "POST",
  signature = FIXED_SIGNATURE,
  requestId = REQUEST_ID,
  queryPaymentId = PAYMENT_ID,
  queryType = "payment",
  body = { type: "payment", data: { id: PAYMENT_ID } },
  contentType = "application/json",
}: {
  method?: string;
  signature?: string | null;
  requestId?: string | null;
  queryPaymentId?: string | null;
  queryType?: string | null;
  body?: unknown;
  contentType?: string | null;
} = {}): Request {
  const url = new URL(
    "https://synthetic-project.supabase.co/functions/v1/eco-sp-001-mercado-pago-webhook",
  );
  if (queryPaymentId !== null) {
    url.searchParams.set("data.id", queryPaymentId);
  }
  if (queryType !== null) url.searchParams.set("type", queryType);
  const headers = new Headers();
  if (signature !== null) headers.set("x-signature", signature);
  if (requestId !== null) headers.set("x-request-id", requestId);
  if (contentType !== null) headers.set("content-type", contentType);
  return new Request(url, {
    method,
    headers,
    body: method === "POST"
      ? typeof body === "string" ? body : JSON.stringify(body)
      : undefined,
  });
}

Deno.test("official manifest fixture validates with Web Crypto", async () => {
  assert(
    await validateWebhookSignature(
      SECRET,
      PAYMENT_ID,
      REQUEST_ID,
      FIXED_SIGNATURE,
    ),
    "fixed HMAC-SHA256 vector did not validate",
  );
});

Deno.test("valid signed approved payment is reconciled and stored", async () => {
  const { handler, repository } = run();
  const response = await handler(webhookRequest());
  assert(response.status === 200, "valid webhook should succeed");
  assertEquals(
    await response.json(),
    { processed: true, result: "updated" },
    "wrong response",
  );
  assert(repository.orderStatus === "paid", "approved was not mapped to paid");
  assert(repository.events.length === 1, "event was not persisted");
  assert(
    /^[a-f0-9]{64}$/u.test(
      repository.events[0].correlationMetadata.requestIdHash,
    ),
    "correlation metadata was not hashed",
  );
});

Deno.test("only an authoritative paid result requests deferred founder email dispatch", async () => {
  let dispatchCalls = 0;
  const deferred: Promise<void>[] = [];
  const paid = run({
    requestFounderEmailDispatch: () => {
      dispatchCalls += 1;
      return Promise.resolve();
    },
    defer: (work) => deferred.push(work),
  });
  assert(
    (await paid.handler(webhookRequest())).status === 200,
    "paid webhook failed",
  );
  assert(dispatchCalls === 1, "paid did not request founder email dispatch");
  assert(deferred.length === 1, "email dispatch was not detached from webhook");
  await Promise.all(deferred);

  const pendingProvider = new MemoryProvider();
  pendingProvider.value = payment({ status: "pending" });
  const pending = run({
    provider: pendingProvider,
    requestFounderEmailDispatch: () => {
      dispatchCalls += 1;
      return Promise.resolve();
    },
  });
  assert(
    (await pending.handler(webhookRequest())).status === 200,
    "pending webhook failed",
  );
  assert(dispatchCalls === 1, "non-paid webhook requested founder email");
});

Deno.test("authoritative paid referral conversion is accepted and logged once", async () => {
  const repository = new MemoryRepository();
  repository.forcedResult = "eco_referral_converted";
  const { handler, logs } = run({ repository });
  const response = await handler(webhookRequest());
  assert(response.status === 200, "converted referral should succeed");
  assertEquals(
    await response.json(),
    { processed: true, result: "eco_referral_converted" },
    "conversion result changed",
  );
  assert(
    JSON.stringify(logs).includes("eco_referral_converted"),
    "conversion event was not logged",
  );
});

Deno.test("signature failures happen before provider and database access", async () => {
  for (
    const request of [
      webhookRequest({ signature: null }),
      webhookRequest({ requestId: null }),
      webhookRequest({ queryPaymentId: null }),
      webhookRequest({ signature: "malformed" }),
      webhookRequest({
        signature:
          "ts=1753800000,v1=036fa5c0aabcdf852b0925beb382acb2446a5bb906605c52ff1afd8279244d69",
      }),
    ]
  ) {
    const { handler, provider, repository } = run();
    const response = await handler(request);
    assert(response.status === 401, "signature input should be unauthorized");
    assert(
      provider.calls.length === 0,
      "provider called before authentication",
    );
    assert(repository.readCalls === 0, "database called before authentication");
  }
});

Deno.test("missing or invalid environment configuration fails closed without details", async () => {
  for (
    const incomplete of [
      { ...config, webhookSecret: undefined },
      { ...config, mercadoPagoEnvironment: undefined },
      { ...config, expectedCollectorId: undefined },
      { ...config, supabaseServiceRoleKey: undefined },
    ]
  ) {
    const response = await run({ config: incomplete }).handler(
      webhookRequest(),
    );
    assert(response.status === 503, "invalid config should be unavailable");
    assertEquals(
      await response.json(),
      { error: "service_unavailable" },
      "configuration leaked",
    );
  }
});

Deno.test("method, content type, JSON, size, topic, and shape are rejected", async () => {
  const cases: Array<[Request, number]> = [
    [webhookRequest({ method: "GET" }), 405],
    [webhookRequest({ contentType: "text/plain" }), 415],
    [webhookRequest({ body: "{" }), 400],
    [webhookRequest({ body: { padding: "x".repeat(17000) } }), 413],
    [webhookRequest({ queryType: "merchant_order" }), 400],
    [
      webhookRequest({
        body: { type: "merchant_order", data: { id: PAYMENT_ID } },
      }),
      400,
    ],
    [webhookRequest({ body: { type: "payment", data: { id: "999" } } }), 400],
  ];
  for (const [request, expected] of cases) {
    const response = await run().handler(request);
    assert(
      response.status === expected,
      `expected ${expected}, got ${response.status}`,
    );
  }
});

Deno.test("unknown provider payment and unknown order are rejected", async () => {
  const provider = new MemoryProvider();
  provider.value = null;
  const unknownPayment = await run({ provider }).handler(webhookRequest());
  assert(
    unknownPayment.status === 200,
    "unknown payment should be acknowledged",
  );

  const repository = new MemoryRepository();
  repository.order = null;
  const unknownOrder = await run({ repository }).handler(webhookRequest());
  assert(unknownOrder.status === 200, "unknown order should be acknowledged");
});

const paymentMismatchCases: Array<[string, Partial<AuthoritativePayment>]> = [
  ["signed resource", { id: "999" }],
  ["external reference", { externalReference: "invalid" }],
  ["currency", { currency: "USD" }],
  ["amount", { amount: 29.91 }],
  ["fractional-cent amount", { amount: 29.904 }],
  ["unsupported status", { status: "charged_back" }],
  ["provider timestamp", { updatedAt: "not-a-date" }],
];

for (const [name, patch] of paymentMismatchCases) {
  Deno.test(`authoritative reconciliation rejects ${name} mismatch`, async () => {
    const provider = new MemoryProvider();
    provider.value = payment(patch);
    const { handler, repository } = run({ provider });
    const response = await handler(webhookRequest());
    assert(response.status === 200, `${name} should be acknowledged`);
    assertEquals(
      await response.json(),
      { processed: false, result: "notification_rejected" },
      `${name} exposed an unstable rejection response`,
    );
    assert(repository.processCalls === 0, "mismatch reached mutation RPC");
  });
}

const orderMismatchCases: Array<[string, Partial<StoredOrder>]> = [
  ["external reference", { externalReference: `eco_${"b".repeat(32)}` }],
  ["case", { caseId: "eco-other" }],
  ["amount", { amountCents: 1 }],
  ["currency", { currency: "USD" }],
  ["preference ID", { preferenceId: "different-preference" }],
  ["payment ID", { providerPaymentId: "different-payment" }],
];

for (const [name, patch] of orderMismatchCases) {
  Deno.test(`stored order reconciliation rejects ${name} mismatch`, async () => {
    const repository = new MemoryRepository();
    repository.order = { ...repository.order!, ...patch };
    const response = await run({ repository }).handler(webhookRequest());
    assert(
      response.status === 200,
      `${name} should be rejected`,
    );
    assert(
      repository.processCalls === 0,
      "order mismatch reached mutation RPC",
    );
  });
}

for (
  const [providerStatus, internalStatus] of [
    ["approved", "paid"],
    ["pending", "pending"],
    ["in_process", "pending"],
    ["rejected", "rejected"],
    ["cancelled", "cancelled"],
    ["refunded", "refunded"],
  ]
) {
  Deno.test(`maps ${providerStatus} to ${internalStatus}`, async () => {
    const provider = new MemoryProvider();
    provider.value = payment({ status: providerStatus });
    const { handler, repository } = run({ provider });
    const response = await handler(webhookRequest());
    assert(response.status === 200, `${providerStatus} should process`);
    assert(
      repository.orderStatus === internalStatus,
      `${providerStatus} mapped incorrectly`,
    );
  });
}

Deno.test("duplicate and concurrent duplicate delivery produce one effect", async () => {
  const shared = run();
  const first = await shared.handler(webhookRequest());
  const duplicate = await shared.handler(webhookRequest());
  assert(
    first.status === 200 && duplicate.status === 200,
    "serial duplicate failed",
  );
  assertEquals(
    await duplicate.json(),
    { processed: true, result: "duplicate" },
    "duplicate was not acknowledged idempotently",
  );
  assert(
    shared.repository.events.length === 1,
    "serial duplicate inserted twice",
  );

  const concurrent = run();
  const responses = await Promise.all([
    concurrent.handler(webhookRequest()),
    concurrent.handler(webhookRequest()),
  ]);
  assert(
    responses.every((response) => response.status === 200),
    "concurrent delivery failed",
  );
  assert(
    concurrent.repository.events.length === 1,
    "concurrent duplicate inserted twice",
  );
});

async function deliver(
  context: ReturnType<typeof run>,
  status: string,
  updatedAt: string,
): Promise<Response> {
  context.provider.value = payment({ status, updatedAt });
  return await context.handler(webhookRequest());
}

Deno.test("older and protected observations cannot downgrade paid", async () => {
  for (const status of ["pending", "rejected", "cancelled"]) {
    const older = run();
    await deliver(older, "approved", "2026-07-29T12:00:00.000Z");
    const olderResponse = await deliver(
      older,
      status,
      "2026-07-29T11:59:00.000Z",
    );
    assert(
      olderResponse.status === 200,
      "older event should be safely recorded",
    );
    assert(
      older.repository.orderStatus === "paid",
      "older event downgraded paid",
    );

    const newer = run();
    await deliver(newer, "approved", "2026-07-29T12:00:00.000Z");
    const protectedResponse = await deliver(
      newer,
      status,
      "2026-07-29T12:01:00.000Z",
    );
    assert(
      protectedResponse.status === 200,
      "protected event should be acknowledged",
    );
    assert(
      newer.repository.orderStatus === "paid",
      "newer non-refund downgraded paid",
    );
  }
});

Deno.test("authoritative newer refund moves paid to refunded", async () => {
  const context = run();
  await deliver(context, "approved", "2026-07-29T12:00:00.000Z");
  const response = await deliver(
    context,
    "refunded",
    "2026-07-29T12:01:00.000Z",
  );
  assert(response.status === 200, "refund should process");
  assert(
    context.repository.orderStatus === "refunded",
    "paid was not refunded",
  );
});

Deno.test("authoritative payment live_mode must match the configured environment", async () => {
  const testProvider = new MemoryProvider();
  testProvider.value = payment({ liveMode: true });
  const testContext = run({ provider: testProvider });
  const rejectedTest = await testContext.handler(webhookRequest());
  assert(rejectedTest.status === 200, "mode mismatch should be acknowledged");
  assert(
    testContext.repository.processCalls === 0,
    "live payment reached test DB",
  );

  const simulatedTestProvider = new MemoryProvider();
  simulatedTestProvider.value = payment({ liveMode: true, testPayer: true });
  const simulatedTest = run({ provider: simulatedTestProvider });
  const acceptedSimulatedTest = await simulatedTest.handler(webhookRequest({
    body: { live_mode: false, type: "payment", data: { id: PAYMENT_ID } },
  }));
  assert(
    acceptedSimulatedTest.status === 200,
    "simulated test-buyer payment should be acknowledged",
  );
  assert(
    simulatedTest.repository.orderStatus === "paid",
    "simulated test-buyer payment was not stored",
  );

  const liveNotificationTestProvider = new MemoryProvider();
  liveNotificationTestProvider.value = payment({
    liveMode: true,
    testPayer: true,
  });
  const liveNotificationTest = run({ provider: liveNotificationTestProvider });
  await liveNotificationTest.handler(webhookRequest({
    body: { live_mode: true, type: "payment", data: { id: PAYMENT_ID } },
  }));
  assert(
    liveNotificationTest.repository.processCalls === 0,
    "live notification reached test DB",
  );

  const developmentProvider = new MemoryProvider();
  developmentProvider.value = payment({ liveMode: false });
  const development = run({
    provider: developmentProvider,
    config: { ...config, mercadoPagoEnvironment: "development" },
  });
  const acceptedDevelopment = await development.handler(webhookRequest());
  assert(
    acceptedDevelopment.status === 200,
    "sandbox payment should process in development",
  );
  assert(
    development.repository.orderStatus === "paid",
    "development sandbox payment was not stored",
  );

  const productionProvider = new MemoryProvider();
  productionProvider.value = payment({ liveMode: true });
  const production = run({
    provider: productionProvider,
    config: { ...config, mercadoPagoEnvironment: "production" },
  });
  const acceptedProduction = await production.handler(webhookRequest({
    body: { live_mode: true, type: "payment", data: { id: PAYMENT_ID } },
  }));
  assert(
    acceptedProduction.status === 200,
    "live payment should process in production",
  );
  assert(
    production.repository.orderStatus === "paid",
    "live payment was not stored",
  );
});

Deno.test("collector mismatch is permanent and never mutates the order", async () => {
  const collectorProvider = new MemoryProvider();
  collectorProvider.value = payment({ collectorId: "999" });
  const collector = run({ provider: collectorProvider });
  assert(
    (await collector.handler(webhookRequest())).status === 200,
    "collector mismatch must not be retryable",
  );
  assert(
    collector.repository.processCalls === 0,
    "collector mismatch mutated order",
  );
});

Deno.test("a protected newer observation also blocks an older refund", async () => {
  const context = run();
  await deliver(context, "approved", "2026-07-29T12:00:00.000Z");
  await deliver(context, "cancelled", "2026-07-29T12:02:00.000Z");
  const response = await deliver(
    context,
    "refunded",
    "2026-07-29T12:01:00.000Z",
  );
  assert(response.status === 200, "older refund should be safely recorded");
  assert(
    context.repository.orderStatus === "paid",
    "older refund overwrote the latest authoritative observation",
  );
});

Deno.test("older observation cannot overwrite a newer non-paid state", async () => {
  const context = run();
  await deliver(context, "rejected", "2026-07-29T12:01:00.000Z");
  await deliver(context, "pending", "2026-07-29T12:00:00.000Z");
  assert(
    context.repository.orderStatus === "rejected",
    "older state overwrote newer",
  );
});

Deno.test("provider, Supabase read, and RPC failures return retryable errors", async () => {
  const provider = new MemoryProvider();
  provider.fail = true;
  assert(
    (await run({ provider }).handler(webhookRequest())).status === 503,
    "provider failure must be retryable",
  );

  const readFailure = new MemoryRepository();
  readFailure.failRead = true;
  assert(
    (await run({ repository: readFailure }).handler(webhookRequest()))
      .status === 503,
    "read failure must be retryable",
  );

  const rpcFailure = new MemoryRepository();
  rpcFailure.failProcess = true;
  assert(
    (await run({ repository: rpcFailure }).handler(webhookRequest())).status ===
      503,
    "RPC failure must be retryable",
  );
});

Deno.test("permanent transactional RPC rejection is safely acknowledged", async () => {
  for (
    const result of [
      "unknown_order",
      "order_invariant_mismatch",
      "payment_id_conflict",
      "invalid_event",
    ] as const
  ) {
    const repository = new MemoryRepository();
    repository.forcedResult = result;
    const response = await run({ repository }).handler(webhookRequest());
    assert(response.status === 200, `${result} should stop provider retries`);
  }
});

Deno.test("responses and logs contain no signatures, tokens, PII, or payloads", async () => {
  const context = run();
  const response = await context.handler(webhookRequest());
  const observable = `${await response.text()} ${JSON.stringify(context.logs)}`;
  for (
    const sensitive of [
      FIXED_SIGNATURE,
      SECRET,
      config.mercadoPagoAccessToken!,
      config.supabaseServiceRoleKey!,
      EXTERNAL_REFERENCE,
      PAYMENT_ID,
      "buyer@example.com",
    ]
  ) {
    assert(!observable.includes(sensitive), "sensitive value was observable");
  }
});
