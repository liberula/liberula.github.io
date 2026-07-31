import {
  type Buyer,
  type CampaignProgress,
  createEcoApiHandler,
  createMercadoPagoAdapter,
  ECO_PRODUCT,
  type EcoApiConfig,
  isAcceptedCaseAnswer,
  type MercadoPagoAdapter,
  normalizeCaseAnswer,
  type OrderRecord,
  type OrderRepository,
  parseAcceptedAnswers,
  type PreferenceClaim,
  type PreferenceRequest,
} from "./index.ts";

const ORIGIN = "https://liberula.com";
const IDEMPOTENCY_KEY = "123e4567-e89b-42d3-a456-426614174000";
const ORDER_REFERENCE = "order_01J123456789ABCDEFGH";
const CHECKOUT_URL =
  "https://sandbox.mercadopago.com/mla/checkout/pay?pref_id=synthetic";

const validBuyer: Buyer = {
  name: "Ana Júlia da Silva",
  email: "ana.julia@example.com",
  whatsapp: "11998765432",
  address: {
    street: "Rua São Bento",
    number: "123",
    complement: "Apto. 42",
    neighborhood: "Sé",
    city: "São Paulo",
    state: "SP",
    postalCode: "01011100",
  },
};

const completeConfig: EcoApiConfig = {
  answer: "Local Sintético",
  allowedOrigins: "https://preview.example.pages.dev",
  supabaseUrl: "https://synthetic-project.supabase.co",
  supabaseServiceRoleKey: "synthetic-service-role",
  mercadoPagoAccessToken: "TEST-synthetic-access-token",
  mercadoPagoEnvironment: "test",
  statusRateLimitSalt: "synthetic-rate-limit-salt-32bytes",
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

class MemoryOrders implements OrderRepository {
  byKey = new Map<string, OrderRecord>();
  byReference = new Map<string, OrderRecord>();
  claimToken: string | null = null;
  createCalls = 0;
  claimCalls = 0;
  completeCalls = 0;
  releaseCalls = 0;
  failCreate = false;
  failStatus = false;
  failProgress = false;
  lastReferralCode: string | null = null;
  rateAllowed = true;
  rateKeys: string[] = [];
  status: {
    status: string;
    updatedAt: string;
    referralCode: string;
  } | null = {
    status: "pending",
    updatedAt: "2026-07-29T12:00:00.000Z",
    referralCode: "A1B2C3D4E5F6",
  };
  progress: CampaignProgress = {
    campaignId: "eco-sp-001-founder",
    confirmed: 37,
    target: 100,
    goalReached: false,
    status: "collecting",
    closesAt: "2026-08-31T23:59:59-03:00",
  };

  createOrGet(
    idempotencyKey: string,
    _buyer: Buyer,
    siteOrigin: string,
    referralCode: string | null,
  ): Promise<OrderRecord> {
    this.createCalls += 1;
    this.lastReferralCode = referralCode;
    if (this.failCreate) {
      return Promise.reject(new Error("synthetic database failure"));
    }
    const existing = this.byKey.get(idempotencyKey);
    if (existing) return Promise.resolve(existing);
    const order: OrderRecord = {
      orderReference: ORDER_REFERENCE,
      externalReference: "eco_synthetic_external_reference",
      providerIdempotencyKey: "123e4567-e89b-42d3-a456-426614174999",
      checkoutUrl: null,
      preferenceId: null,
      siteOrigin,
      referralCode: "A1B2C3D4E5F6",
      referralAttributed: referralCode === "ABCDEF123456",
    };
    this.byKey.set(idempotencyKey, order);
    this.byReference.set(order.orderReference, order);
    return Promise.resolve(order);
  }

  claimPreference(): Promise<PreferenceClaim> {
    this.claimCalls += 1;
    const order = this.byReference.get(ORDER_REFERENCE);
    if (order?.checkoutUrl && order.preferenceId) {
      return Promise.resolve({
        state: "existing",
        checkoutUrl: order.checkoutUrl,
        preferenceId: order.preferenceId,
      });
    }
    if (this.claimToken) return Promise.resolve({ state: "busy" });
    this.claimToken = "123e4567-e89b-42d3-a456-426614174888";
    return Promise.resolve({ state: "claimed", claimToken: this.claimToken });
  }

  completePreference(
    orderReference: string,
    claimToken: string,
    preferenceId: string,
    checkoutUrl: string,
  ): Promise<PreferenceClaim> {
    this.completeCalls += 1;
    if (this.claimToken !== claimToken) {
      return Promise.resolve({ state: "claim_lost" });
    }
    const order = this.byReference.get(orderReference);
    if (!order) return Promise.resolve({ state: "missing" });
    order.checkoutUrl = checkoutUrl;
    order.preferenceId = preferenceId;
    this.claimToken = null;
    return Promise.resolve({
      state: "completed",
      checkoutUrl,
      preferenceId,
    });
  }

  releasePreferenceClaim(
    _orderReference: string,
    claimToken: string,
  ): Promise<void> {
    this.releaseCalls += 1;
    if (this.claimToken === claimToken) this.claimToken = null;
    return Promise.resolve();
  }

  getOrder(orderReference: string): Promise<OrderRecord | null> {
    return Promise.resolve(this.byReference.get(orderReference) ?? null);
  }

  getStatus(): Promise<
    { status: string; updatedAt: string; referralCode: string } | null
  > {
    if (this.failStatus) {
      return Promise.reject(new Error("synthetic status failure"));
    }
    return Promise.resolve(this.status);
  }

  consumeStatusRateLimit(
    rateKey: string,
  ): Promise<{ allowed: boolean; retryAfter: number }> {
    this.rateKeys.push(rateKey);
    return Promise.resolve({ allowed: this.rateAllowed, retryAfter: 17 });
  }

  getCampaignProgress() {
    if (this.failProgress) {
      return Promise.reject(new Error("synthetic progress failure"));
    }
    return Promise.resolve(this.progress);
  }
}

class CapturingProvider implements MercadoPagoAdapter {
  calls: PreferenceRequest[] = [];
  failuresRemaining = 0;
  response = {
    preferenceId: "synthetic-preference-id",
    checkoutUrl: CHECKOUT_URL,
  };
  waitFor: Promise<void> | null = null;

  async createPreference(request: PreferenceRequest) {
    this.calls.push(request);
    if (this.waitFor) await this.waitFor;
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error("synthetic provider failure");
    }
    return this.response;
  }
}

function dependencies(overrides: {
  config?: EcoApiConfig;
  orders?: MemoryOrders;
  provider?: CapturingProvider;
  logs?: string[];
} = {}) {
  const orders = overrides.orders ?? new MemoryOrders();
  const provider = overrides.provider ?? new CapturingProvider();
  const logs = overrides.logs ?? [];
  return {
    orders,
    provider,
    logs,
    handler: createEcoApiHandler({
      config: overrides.config ?? completeConfig,
      orders,
      mercadoPago: provider,
      sleep: () => Promise.resolve(),
      logger: {
        error: (entry) =>
          logs.push(typeof entry === "string" ? entry : JSON.stringify(entry)),
        info: (entry) => logs.push(JSON.stringify(entry)),
      },
    }),
  };
}

function apiRequest(
  path: string,
  {
    method = "POST",
    origin = ORIGIN,
    body,
    contentType = "application/json",
    idempotencyKey,
  }: {
    method?: string;
    origin?: string;
    body?: unknown;
    contentType?: string;
    idempotencyKey?: string;
  } = {},
): Request {
  const headers = new Headers({ Origin: origin });
  if (contentType) headers.set("Content-Type", contentType);
  if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
  return new Request(`http://localhost/eco-sp-001-api${path}`, {
    method,
    headers,
    body: body === undefined || method === "GET" || method === "OPTIONS"
      ? undefined
      : typeof body === "string"
      ? body
      : JSON.stringify(body),
  });
}

function orderRequest(
  buyer: unknown = validBuyer,
  patch: Record<string, unknown> = {},
): Request {
  return apiRequest("/orders", {
    body: { buyer, ...patch },
    idempotencyKey: IDEMPOTENCY_KEY,
  });
}

Deno.test("answer validation normalizes case, accents, and whitespace", async () => {
  const { handler } = dependencies();
  for (
    const answer of [
      "local sintético",
      "  LOCAL   SINTETICO ",
      "Local Sinte\u0301tico",
    ]
  ) {
    const response = await handler(apiRequest("/validate", {
      body: { answer },
    }));
    assert(response.status === 200, "expected successful validation");
    assertEquals(await response.json(), { correct: true }, "wrong response");
    assert(
      response.headers.get("cache-control") === "no-store",
      "must not cache",
    );
  }
});

Deno.test("case-answer normalization handles punctuation, street notation, and numeric separators", () => {
  assertEquals(
    normalizeCaseAnswer("R. Exemplo, 123"),
    normalizeCaseAnswer("Rua Exemplo 123"),
    "street abbreviation should normalize",
  );
  assertEquals(
    normalizeCaseAnswer("Rua   Exemplo, 123"),
    "rua exemplo 123",
    "punctuation and whitespace should normalize",
  );
  assertEquals(
    normalizeCaseAnswer("CEP 01005-000"),
    normalizeCaseAnswer("CEP 01005000"),
    "numeric address punctuation should be removed",
  );
  assert(
    normalizeCaseAnswer("Rua Exemplo") !==
      normalizeCaseAnswer("Rua Exemplo 123"),
    "address number must remain meaningful",
  );
});

Deno.test("accepted-answer parser includes canonical, deduplicates, and permits absent or empty aliases", () => {
  for (const aliasesJson of [undefined, "[]"]) {
    const accepted = parseAcceptedAnswers(
      "Arquivo Técnico Aurora",
      aliasesJson,
    );
    assert(accepted !== null, "valid configuration should parse");
    assert(
      isAcceptedCaseAnswer("ARQUIVO TECNICO AURORA", accepted),
      "canonical answer should be included automatically",
    );
  }

  const accepted = parseAcceptedAnswers(
    "Arquivo Técnico Aurora",
    JSON.stringify([
      "Posto Aurora",
      "posto aurora",
      "POSTO ÁURORA",
    ]),
  );
  assert(accepted !== null, "aliases should parse");
  assert(accepted.size === 2, "normalized duplicates should be removed");
});

Deno.test("accepted-answer parser rejects malformed or unsafe configuration", () => {
  const malformed = [
    "",
    "not json",
    "null",
    "{}",
    "123",
    '"alias"',
    '["válido", 1]',
    '["válido", null]',
    '[["aninhado"]]',
    '["   "]',
    JSON.stringify(Array.from({ length: 101 }, (_, index) => `Alias ${index}`)),
    JSON.stringify(["x".repeat(201)]),
  ];
  for (const aliasesJson of malformed) {
    assert(
      parseAcceptedAnswers("Arquivo Técnico Aurora", aliasesJson) === null,
      `configuration should fail: ${aliasesJson.slice(0, 30)}`,
    );
  }
  assert(
    parseAcceptedAnswers("   ", "[]") === null,
    "blank canonical answer should fail",
  );
});

const productionAliases = JSON.stringify([
  "Posto Telefônica",
  "Posto de Serviços Telefônica Benjamin Constant",
  "Posto de Serviços Telefônica da Rua Benjamin Constant",
  "Posto Telefônica Benjamin Constant",
  "Central Telefônica Benjamin Constant",
  "Central Telefônica da Rua Benjamin Constant",
  "Antiga Central Telefônica da Benjamin Constant",
  "Antiga Central Telefônica da Rua Benjamin Constant",
  "Rua Benjamin Constant 196",
  "R. Benjamin Constant 196",
  "Benjamin Constant 196",
  "Rua Benjamin Constant 196 Sé",
  "Rua Benjamin Constant 196 São Paulo",
  "Rua Benjamin Constant 196 Sé São Paulo",
]);

const productionValidationConfig: EcoApiConfig = {
  ...completeConfig,
  answer: "Posto de Serviços Telefônica",
  answerAliases: productionAliases,
};

Deno.test("configured ECO-SP-001 equivalents are accepted exactly", async () => {
  const acceptedAnswers = [
    "Posto de Serviços Telefônica",
    "POSTO DE SERVICOS TELEFONICA",
    "Posto Telefônica",
    "posto telefonica",
    "Central Telefônica Benjamin Constant",
    "central telefonica da rua benjamin constant",
    "Antiga central telefônica da Benjamin Constant",
    "Rua Benjamin Constant, 196",
    "R. Benjamin Constant 196",
    "Benjamin Constant, 196",
    "Rua Benjamin Constant, 196, Sé, São Paulo",
  ];
  for (const answer of acceptedAnswers) {
    const response = await dependencies({
      config: productionValidationConfig,
    }).handler(apiRequest("/validate", { body: { answer } }));
    assert(response.status === 200, "accepted answer should return 200");
    assertEquals(
      await response.json(),
      { correct: true },
      `expected accepted answer: ${answer}`,
    );
  }
});

Deno.test("vague, unrelated, near, prefixed, and suffixed answers remain rejected", async () => {
  const rejectedAnswers = [
    "Central telefônica",
    "Central antiga",
    "Posto",
    "Posto de serviços",
    "Telefônica",
    "Benjamin Constant",
    "Rua Benjamin Constant",
    "196",
    "Sé",
    "São Paulo",
    "Estação Pedro II",
    "Escola Santi",
    "Dublin Hotel",
    "Rua Benjamin Constant 195",
    "Rua Benjamin Constant 1960",
    "Posto de Serviços Telefônica errado",
    "Acho que talvez seja uma central telefônica",
  ];
  for (const answer of rejectedAnswers) {
    const response = await dependencies({
      config: productionValidationConfig,
    }).handler(apiRequest("/validate", { body: { answer } }));
    assert(response.status === 200, "rejected answer should return 200");
    assertEquals(
      await response.json(),
      { correct: false },
      `expected rejected answer: ${answer}`,
    );
  }
});

Deno.test("incorrect answer returns only correct false", async () => {
  const { handler } = dependencies();
  const response = await handler(apiRequest("/validate", {
    body: { answer: "resposta incorreta" },
  }));
  assertEquals(await response.json(), { correct: false }, "unexpected body");
});

for (
  const [name, request] of [
    ["wrong method", apiRequest("/validate", { method: "GET" })],
    [
      "wrong content type",
      apiRequest("/validate", {
        body: { answer: "x" },
        contentType: "text/plain",
      }),
    ],
    ["malformed JSON", apiRequest("/validate", { body: "{" })],
    [
      "unknown answer field",
      apiRequest("/validate", {
        body: { answer: "x", fallback: "x" },
      }),
    ],
    ["empty answer", apiRequest("/validate", { body: { answer: " " } })],
    ["non-string answer", apiRequest("/validate", { body: { answer: 1 } })],
  ] as const
) {
  Deno.test(`validation rejects ${name}`, async () => {
    const response = await dependencies().handler(request);
    assert(response.status >= 400, `${name} should fail`);
  });
}

Deno.test("validation rejects oversized JSON", async () => {
  const response = await dependencies().handler(apiRequest("/validate", {
    body: { answer: "x".repeat(5000) },
  }));
  assert(response.status === 413, "expected 413");
});

Deno.test("missing answer configuration returns generic service error", async () => {
  for (const answer of [undefined, "   "]) {
    const response = await dependencies({
      config: { ...completeConfig, answer },
    }).handler(apiRequest("/validate", { body: { answer: "anything" } }));
    assert(response.status === 503, "expected 503");
    assertEquals(
      await response.json(),
      { error: "service_unavailable" },
      "configuration leaked",
    );
  }
});

Deno.test("malformed aliases return a generic service error without logging configured values", async () => {
  const secretCanonical = "Arquivo Técnico Não Registrar";
  const secretAlias = "Local Confidencial Não Registrar";
  const invalidConfigurations = [
    "not-json",
    JSON.stringify({ alias: secretAlias }),
    JSON.stringify([secretAlias, 123]),
    JSON.stringify(["   "]),
    JSON.stringify(Array.from({ length: 101 }, (_, index) => `Item ${index}`)),
  ];

  for (const answerAliases of invalidConfigurations) {
    const logs: string[] = [];
    const response = await dependencies({
      config: {
        ...completeConfig,
        answer: secretCanonical,
        answerAliases,
      },
      logs,
    }).handler(apiRequest("/validate", { body: { answer: secretAlias } }));
    assert(response.status === 503, "expected generic configuration failure");
    assertEquals(
      await response.json(),
      { error: "service_unavailable" },
      "configuration details leaked in response",
    );
    const logOutput = logs.join(" ");
    assert(!logOutput.includes(secretCanonical), "canonical leaked in logs");
    assert(!logOutput.includes(secretAlias), "alias leaked in logs");
  }
});

Deno.test("CORS accepts production, localhost, and explicit preview origins", async () => {
  const { handler } = dependencies();
  for (
    const origin of [
      "https://liberula.com",
      "https://www.liberula.com",
      "http://localhost:3000",
      "https://localhost:3000",
      "https://preview.example.pages.dev",
    ]
  ) {
    const response = await handler(apiRequest("/validate", {
      method: "OPTIONS",
      origin,
    }));
    assert(response.status === 204, `${origin} should be accepted`);
    assert(
      response.headers.get("access-control-allow-origin") === origin,
      "origin not reflected",
    );
  }
});

Deno.test("CORS rejects missing, wildcard-like, and unlisted origins", async () => {
  const { handler } = dependencies();
  for (
    const origin of [
      "https://attacker.example",
      "https://unlisted.pages.dev",
      "https://liberula.com.attacker.example",
    ]
  ) {
    const response = await handler(apiRequest("/validate", {
      body: { answer: "x" },
      origin,
    }));
    assert(response.status === 403, `${origin} should be rejected`);
    assert(
      response.headers.get("access-control-allow-origin") === null,
      "rejected origin was reflected",
    );
  }
});

Deno.test("order request normalizes buyer and fixes all commerce fields", async () => {
  const { handler, provider } = dependencies();
  const buyer = {
    ...validBuyer,
    name: "  Ana   Júlia  ",
    email: " ANA@EXAMPLE.COM ",
    whatsapp: "(11) 99876-5432",
    address: {
      ...validBuyer.address,
      state: "sp",
      postalCode: "01011-100",
    },
  };
  const response = await handler(orderRequest(buyer));
  assert(response.status === 201, "expected order creation");
  assertEquals(
    await response.json(),
    {
      checkoutUrl: CHECKOUT_URL,
      orderReference: ORDER_REFERENCE,
      referralCode: "A1B2C3D4E5F6",
      referralAttributed: false,
    },
    "unexpected public response",
  );
  assert(provider.calls.length === 1, "expected one provider call");
  const request = provider.calls[0];
  assertEquals(request.item, {
    title: ECO_PRODUCT.title,
    quantity: 1,
    currencyId: "BRL",
    unitPrice: 79.9,
  }, "commerce values were not fixed");
  assert(request.buyer.name === "Ana Júlia", "name not normalized");
  assert(request.buyer.email === "ana@example.com", "email not normalized");
  assert(request.buyer.whatsapp === "11998765432", "phone not normalized");
  assert(request.buyer.address.state === "SP", "state not normalized");
  assert(request.buyer.address.postalCode === "01011100", "CEP not normalized");
  assert(request.autoReturn === "approved", "auto return missing");
  assert(
    request.externalReference === "eco_synthetic_external_reference",
    "external reference not server-controlled",
  );
});

const invalidBuyerMutations: Array<[string, (buyer: JsonBuyer) => void]> = [
  ["name", (buyer) => buyer.name = ""],
  ["email", (buyer) => buyer.email = "invalid"],
  ["whatsapp", (buyer) => buyer.whatsapp = "123"],
  ["street", (buyer) => buyer.address.street = ""],
  ["number", (buyer) => buyer.address.number = ""],
  ["complement", (buyer) => buyer.address.complement = "x".repeat(81)],
  ["complement type", (buyer) => buyer.address.complement = null],
  ["neighborhood", (buyer) => buyer.address.neighborhood = ""],
  ["city", (buyer) => buyer.address.city = ""],
  ["state", (buyer) => buyer.address.state = "S"],
  ["postalCode", (buyer) => buyer.address.postalCode = "123"],
];

type JsonBuyer = {
  name: unknown;
  email: unknown;
  whatsapp: unknown;
  address: Record<string, unknown>;
};

for (const [field, mutate] of invalidBuyerMutations) {
  Deno.test(`order rejects invalid buyer ${field}`, async () => {
    const buyer = structuredClone(validBuyer) as unknown as JsonBuyer;
    mutate(buyer);
    const response = await dependencies().handler(orderRequest(buyer));
    assert(response.status === 400, `${field} should fail`);
  });
}

Deno.test("order rejects unknown buyer and client-controlled commerce fields", async () => {
  for (
    const request of [
      orderRequest({ ...validBuyer, status: "paid" }),
      orderRequest({
        ...validBuyer,
        address: { ...validBuyer.address, providerId: "private" },
      }),
      orderRequest(validBuyer, { amount: 1 }),
      orderRequest(validBuyer, { currency: "USD" }),
      orderRequest(validBuyer, { returnUrl: "https://attacker.example" }),
      orderRequest(validBuyer, { caseId: "other" }),
    ]
  ) {
    const response = await dependencies().handler(request);
    assert(response.status === 400, "client commerce field should fail");
  }
});

Deno.test("order rejects missing and malformed idempotency keys", async () => {
  for (
    const key of [
      undefined,
      "not-a-uuid",
      "123e4567-e89b-42d3-7456-426614174000",
    ]
  ) {
    const response = await dependencies().handler(apiRequest("/orders", {
      body: { buyer: validBuyer },
      idempotencyKey: key,
    }));
    assert(response.status === 400, `${key} should fail`);
  }
});

Deno.test("order rejects malformed, oversized, and non-JSON bodies", async () => {
  const requests = [
    apiRequest("/orders", {
      body: "{",
      idempotencyKey: IDEMPOTENCY_KEY,
    }),
    apiRequest("/orders", {
      body: { buyer: validBuyer, padding: "x".repeat(17000) },
      idempotencyKey: IDEMPOTENCY_KEY,
    }),
    apiRequest("/orders", {
      body: { buyer: validBuyer },
      contentType: "text/plain",
      idempotencyKey: IDEMPOTENCY_KEY,
    }),
  ];
  const statuses = [];
  for (const request of requests) {
    statuses.push((await dependencies().handler(request)).status);
  }
  assertEquals(statuses, [400, 413, 415], "wrong body rejection statuses");
});

Deno.test("serial duplicate requests create one preference and return the same order", async () => {
  const { handler, orders, provider } = dependencies();
  const first = await handler(orderRequest());
  const second = await handler(orderRequest());
  assert(first.status === 201 && second.status === 200, "duplicates failed");
  assert(provider.calls.length === 1, "duplicate provider request");
  assert(orders.byKey.size === 1, "duplicate internal order");
  assertEquals(await first.json(), await second.json(), "responses differ");
});

Deno.test("concurrent duplicate request is controlled while one worker owns the claim", async () => {
  const provider = new CapturingProvider();
  const gate = deferred<void>();
  provider.waitFor = gate.promise;
  const { handler, orders } = dependencies({ provider });

  const firstPromise = handler(orderRequest());
  while (provider.calls.length === 0) await Promise.resolve();
  const second = await handler(orderRequest());
  assert(second.status === 409, "concurrent request should be retryable");
  assertEquals(
    await second.json(),
    { error: "preference_in_progress", retryable: true },
    "wrong controlled response",
  );
  assert(provider.calls.length === 1, "duplicate provider request");
  assert(orders.byKey.size === 1, "duplicate internal order");
  gate.resolve();
  assert((await firstPromise).status === 201, "claim owner should complete");
});

Deno.test("preference completion requires the current claim owner", async () => {
  const orders = new MemoryOrders();
  await orders.createOrGet(IDEMPOTENCY_KEY, validBuyer, ORIGIN, null);
  const claim = await orders.claimPreference();
  assert(claim.state === "claimed", "expected claim ownership");
  const completion = await orders.completePreference(
    ORDER_REFERENCE,
    "123e4567-e89b-42d3-a456-426614174777",
    "wrong-owner-preference",
    CHECKOUT_URL,
  );
  assertEquals(
    completion,
    { state: "claim_lost" },
    "wrong owner completed claim",
  );
  assert(orders.completeCalls === 1, "completion was not attempted");
});

Deno.test("provider idempotency key and URLs remain stable across recoverable retry", async () => {
  const provider = new CapturingProvider();
  provider.failuresRemaining = 1;
  const { handler, orders } = dependencies({ provider });

  assert(
    (await handler(orderRequest())).status === 502,
    "first call should fail",
  );
  assert(orders.releaseCalls === 1, "failed claim was not released");
  assert(
    (await handler(orderRequest())).status === 201,
    "retry should recover",
  );
  assert(provider.calls.length === 2, "expected a retried provider call");
  assert(
    provider.calls[0].providerIdempotencyKey ===
      provider.calls[1].providerIdempotencyKey,
    "provider idempotency key changed",
  );
  const expectedReturn =
    `https://liberula.com/eco/eco-sp-001/comprar?order=${ORDER_REFERENCE}`;
  assertEquals(provider.calls[1].backUrls, {
    success: expectedReturn,
    pending: expectedReturn,
    failure: expectedReturn,
  }, "back URLs are wrong");
  assert(
    provider.calls[1].notificationUrl ===
      "https://synthetic-project.supabase.co/functions/v1/eco-sp-001-mercado-pago-webhook",
    "notification URL is wrong",
  );
});

Deno.test("production checkout response is rejected and claim released", async () => {
  const provider = new CapturingProvider();
  provider.response.checkoutUrl =
    "https://www.mercadopago.com/checkout/start?pref_id=live";
  const { handler, orders } = dependencies({ provider });
  const response = await handler(orderRequest());
  assert(response.status === 502, "production checkout should fail");
  assert(orders.releaseCalls === 1, "claim should be recoverable");
});

Deno.test("production configuration accepts only the provider production URL", async () => {
  const provider = new CapturingProvider();
  provider.response.checkoutUrl =
    "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=live";
  const { handler, orders } = dependencies({
    provider,
    config: { ...completeConfig, mercadoPagoEnvironment: "production" },
  });
  const response = await handler(orderRequest());
  assert(response.status === 201, "production checkout should be returned");
  assert(orders.releaseCalls === 0, "valid preference claim was released");
});

Deno.test("APP_USR sandbox credentials reach checkout while missing configuration fails safely", async () => {
  const accepted = dependencies({
    config: {
      ...completeConfig,
      mercadoPagoAccessToken: "APP_USR-synthetic-sandbox-token",
    },
  });
  assert(
    (await accepted.handler(orderRequest())).status === 201,
    "APP_USR credential was rejected before the provider",
  );
  assert(accepted.provider.calls.length === 1, "provider was not called");

  const logs: string[] = [];
  const response = await dependencies({
    config: { ...completeConfig, supabaseServiceRoleKey: undefined },
    logs,
  }).handler(orderRequest());
  assert(response.status === 503, "missing configuration should fail");
  assertEquals(
    await response.json(),
    { error: "service_unavailable" },
    "configuration leaked",
  );
  assert(
    logs.join(" ").includes("SUPABASE_SERVICE_ROLE_KEY"),
    "missing key name was not diagnosed",
  );
  assert(
    !logs.join(" ").includes(completeConfig.mercadoPagoAccessToken!),
    "configured token leaked",
  );

  const missingEnvironment = await dependencies({
    config: { ...completeConfig, mercadoPagoEnvironment: undefined },
  }).handler(orderRequest());
  assert(
    missingEnvironment.status === 503,
    "missing checkout environment should fail closed",
  );
});

Deno.test("Mercado Pago adapter accepts a sandbox preference response", async () => {
  const adapter = createMercadoPagoAdapter(
    "APP_USR-synthetic-sandbox-token",
    async () =>
      new Response(
        JSON.stringify({
          id: "synthetic-preference-id",
          sandbox_init_point: CHECKOUT_URL,
          live_mode: false,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
  );
  const created = await adapter.createPreference({
    item: {
      title: ECO_PRODUCT.title,
      quantity: 1,
      currencyId: "BRL",
      unitPrice: 79.90,
    },
    buyer: validBuyer,
    externalReference: "synthetic-external-reference",
    providerIdempotencyKey: IDEMPOTENCY_KEY,
    backUrls: {
      success: `${ORIGIN}/success`,
      pending: `${ORIGIN}/pending`,
      failure: `${ORIGIN}/failure`,
    },
    notificationUrl:
      "https://synthetic-project.supabase.co/functions/v1/webhook",
    autoReturn: "approved",
  });
  assertEquals(
    created,
    {
      preferenceId: "synthetic-preference-id",
      checkoutUrl: CHECKOUT_URL,
    },
    "sandbox provider response changed",
  );
});

Deno.test("Mercado Pago adapter selects init_point only in production mode", async () => {
  const productionUrl =
    "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=live";
  const adapter = createMercadoPagoAdapter(
    "APP_USR-synthetic-production-token",
    async () =>
      new Response(
        JSON.stringify({
          id: "synthetic-production-preference",
          init_point: productionUrl,
          sandbox_init_point: CHECKOUT_URL,
        }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    "production",
  );
  const created = await adapter.createPreference({
    item: {
      title: ECO_PRODUCT.title,
      quantity: 1,
      currencyId: "BRL",
      unitPrice: 79.90,
    },
    buyer: validBuyer,
    externalReference: "synthetic-external-reference",
    providerIdempotencyKey: IDEMPOTENCY_KEY,
    backUrls: {
      success: `${ORIGIN}/success`,
      pending: `${ORIGIN}/pending`,
      failure: `${ORIGIN}/failure`,
    },
    notificationUrl:
      "https://synthetic-project.supabase.co/functions/v1/webhook",
    autoReturn: "approved",
  });
  assertEquals(created.checkoutUrl, productionUrl, "wrong production URL");
});

Deno.test("Mercado Pago failures and invalid JSON produce safe diagnostics", async () => {
  for (
    const [response, expectedCode] of [
      [
        new Response(
          JSON.stringify({
            error: "invalid_preference",
            message:
              `Rejected ${validBuyer.name} ${validBuyer.email} ${validBuyer.whatsapp} ${validBuyer.address.street}`,
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
        "invalid_preference",
      ],
      [
        new Response("<not-json>", {
          status: 502,
          headers: { "Content-Type": "text/plain" },
        }),
        "provider_invalid_json",
      ],
    ] as const
  ) {
    const logs: string[] = [];
    const token = "APP_USR-sensitive-synthetic-token";
    const handler = createEcoApiHandler({
      config: { ...completeConfig, mercadoPagoAccessToken: token },
      orders: new MemoryOrders(),
      mercadoPago: createMercadoPagoAdapter(
        token,
        async () => response.clone(),
      ),
      sleep: () => Promise.resolve(),
      logger: {
        error: (entry) =>
          logs.push(typeof entry === "string" ? entry : JSON.stringify(entry)),
        info: (entry) => logs.push(JSON.stringify(entry)),
      },
    });
    const result = await handler(orderRequest(validBuyer));
    assert(result.status === 502, "provider failure should be 502");
    assertEquals(
      await result.json(),
      { error: "checkout_unavailable" },
      "provider detail leaked publicly",
    );
    const observable = logs.join(" ");
    assert(observable.includes(expectedCode), "safe provider code missing");
    assert(observable.includes("mercado_pago_preference"), "stage missing");
    for (
      const secret of [
        token,
        validBuyer.name,
        validBuyer.email,
        validBuyer.whatsapp,
        validBuyer.address.street,
        completeConfig.supabaseServiceRoleKey!,
      ]
    ) {
      assert(!observable.includes(secret), `diagnostic leaked: ${secret}`);
    }
  }
});

Deno.test("database and provider failures return generic non-leaking responses and logs", async () => {
  const sensitiveBuyer = {
    ...validBuyer,
    email: "buyer-sentinel@example.com",
  };
  const logs: string[] = [];
  const database = new MemoryOrders();
  database.failCreate = true;
  const databaseRun = dependencies({ orders: database, logs });
  const databaseResponse = await databaseRun.handler(
    orderRequest(sensitiveBuyer),
  );
  assert(databaseResponse.status === 503, "database failure should be 503");

  const provider = new CapturingProvider();
  provider.failuresRemaining = 1;
  const providerRun = dependencies({ provider, logs });
  const providerResponse = await providerRun.handler(
    orderRequest(sensitiveBuyer),
  );
  assert(providerResponse.status === 502, "provider failure should be 502");
  const observable = `${logs.join(" ")} ${await databaseResponse
    .text()} ${await providerResponse.text()}`;
  for (
    const secret of [
      sensitiveBuyer.email,
      completeConfig.mercadoPagoAccessToken!,
      completeConfig.supabaseServiceRoleKey!,
      "synthetic provider failure",
    ]
  ) {
    assert(!observable.includes(secret), `sensitive value leaked: ${secret}`);
  }
});

Deno.test("preference persistence failure is retryable and releases the claim", async () => {
  const orders = new MemoryOrders();
  orders.completePreference = () =>
    Promise.reject(new Error("synthetic completion failure"));
  const { handler } = dependencies({ orders });
  const response = await handler(orderRequest());
  assert(response.status === 502, "persistence failure should be retryable");
  assert(orders.releaseCalls === 1, "owned claim should be released");
  assertEquals(
    await response.json(),
    { error: "checkout_unavailable" },
    "database detail leaked",
  );
});

Deno.test("optional referral codes are normalized without blocking invalid codes", async () => {
  const valid = dependencies();
  const validResponse = await valid.handler(
    orderRequest(validBuyer, { referralCode: "  abcdef123456 " }),
  );
  assert(validResponse.status === 201, "valid referral should not block order");
  assert(
    valid.orders.lastReferralCode === "ABCDEF123456",
    "referral was not normalized",
  );
  assert(
    !valid.logs.join("\n").includes("ABCDEF123456"),
    "referral code leaked into logs",
  );

  const invalid = dependencies();
  const invalidResponse = await invalid.handler(
    orderRequest(validBuyer, { referralCode: "not-a-valid-code" }),
  );
  assert(
    invalidResponse.status === 201,
    "invalid referral must not block checkout",
  );
  assert(invalid.orders.lastReferralCode === null, "invalid code was trusted");
});

Deno.test("campaign progress returns only aggregate public data for all boundaries", async () => {
  for (
    const [confirmed, status] of [
      [0, "collecting"],
      [1, "collecting"],
      [99, "collecting"],
      [100, "goal_reached"],
      [137, "goal_reached"],
    ] as const
  ) {
    const orders = new MemoryOrders();
    orders.progress = {
      ...orders.progress,
      confirmed,
      goalReached: confirmed >= 100,
      status,
    };
    const response = await dependencies({ orders }).handler(
      apiRequest("/campaign-progress", { method: "GET" }),
    );
    assert(response.status === 200, `progress ${confirmed} should succeed`);
    const body = await response.json();
    assertEquals(body, orders.progress, "aggregate response changed");
    const serialized = JSON.stringify(body);
    for (const privateField of ["buyer", "email", "payment", "order"]) {
      assert(
        !serialized.toLocaleLowerCase().includes(privateField),
        `progress leaked ${privateField}`,
      );
    }
    assert(
      response.headers.get("cache-control")?.includes("max-age=30") === true,
      "short cache header missing",
    );
  }
});

Deno.test("closed campaign stays distinct and progress failures are controlled", async () => {
  const closedOrders = new MemoryOrders();
  closedOrders.progress = {
    ...closedOrders.progress,
    confirmed: 137,
    goalReached: true,
    status: "closed",
  };
  const closed = await dependencies({ orders: closedOrders }).handler(
    apiRequest("/campaign-progress", { method: "GET" }),
  );
  assertEquals(
    (await closed.json()).status,
    "closed",
    "closed campaign was reopened at goal",
  );

  const failingOrders = new MemoryOrders();
  failingOrders.failProgress = true;
  const unavailable = await dependencies({ orders: failingOrders }).handler(
    apiRequest("/campaign-progress", { method: "GET" }),
  );
  assert(unavailable.status === 503, "progress failure should be controlled");
  assertEquals(
    await unavailable.json(),
    { error: "service_unavailable" },
    "database details leaked",
  );
});

Deno.test("status returns only stored status and timestamp", async () => {
  const { handler, orders } = dependencies();
  const response = await handler(apiRequest(
    `/orders/${ORDER_REFERENCE}/status?status=paid&payment_id=attacker`,
    { method: "GET" },
  ));
  assert(response.status === 200, "status should succeed");
  assertEquals(await response.json(), {
    status: "pending",
    updatedAt: "2026-07-29T12:00:00.000Z",
    referralCode: "A1B2C3D4E5F6",
  }, "status response is not minimal");
  assert(
    orders.rateKeys.length === 1 &&
      /^[a-f0-9]{64}$/u.test(orders.rateKeys[0]),
    "status limit must store only a salted opaque key",
  );
});

Deno.test("status rate limit is distributed and does not reveal order existence", async () => {
  for (
    const status of [
      { status: "pending", updatedAt: "2026-07-29T12:00:00.000Z" },
      null,
    ]
  ) {
    const orders = new MemoryOrders();
    orders.status = status ? { ...status, referralCode: "A1B2C3D4E5F6" } : null;
    orders.rateAllowed = false;
    const response = await dependencies({ orders }).handler(
      apiRequest(`/orders/${ORDER_REFERENCE}/status`, { method: "GET" }),
    );
    assert(response.status === 429, "rate limit should run before status read");
    assertEquals(
      await response.json(),
      { error: "rate_limited" },
      "rate-limit response leaked existence",
    );
    assert(response.headers.get("retry-after") === "17", "retry hint missing");
  }
});

Deno.test("status fails closed when the server-only rate-limit salt is missing or weak", async () => {
  for (const statusRateLimitSalt of [undefined, "", "too-short"]) {
    const response = await dependencies({
      config: { ...completeConfig, statusRateLimitSalt },
    }).handler(
      apiRequest(`/orders/${ORDER_REFERENCE}/status`, { method: "GET" }),
    );
    assert(
      response.status === 503,
      "weak rate-limit configuration should fail",
    );
    assertEquals(
      await response.json(),
      { error: "service_unavailable" },
      "rate-limit configuration leaked",
    );
  }
});

Deno.test("status exposes every supported stored state without query authority", async () => {
  for (
    const state of ["pending", "paid", "rejected", "cancelled", "refunded"]
  ) {
    const orders = new MemoryOrders();
    orders.status = {
      status: state,
      updatedAt: "2026-07-29T12:00:00.000Z",
      referralCode: "A1B2C3D4E5F6",
    };
    const response = await dependencies({ orders }).handler(
      apiRequest(
        `/orders/${ORDER_REFERENCE}/status?status=paid&collection_status=approved`,
        { method: "GET" },
      ),
    );
    assert(response.status === 200, `${state} should be public`);
    assertEquals((await response.json()).status, state, "query changed state");
  }
});

Deno.test("status handles unknown, malformed, and database failure safely", async () => {
  const unknownOrders = new MemoryOrders();
  unknownOrders.status = null;
  const unknown = await dependencies({ orders: unknownOrders }).handler(
    apiRequest(`/orders/${ORDER_REFERENCE}/status`, { method: "GET" }),
  );
  assert(unknown.status === 404, "unknown reference should be 404");

  const malformed = await dependencies().handler(
    apiRequest("/orders/short/status", { method: "GET" }),
  );
  assert(malformed.status === 400, "malformed reference should be 400");

  const malformedEncoding = await dependencies().handler(
    apiRequest("/orders/%E0%A4%A/status", { method: "GET" }),
  );
  assert(
    malformedEncoding.status === 400,
    "malformed encoding should be 400",
  );

  const failingOrders = new MemoryOrders();
  failingOrders.failStatus = true;
  const unavailable = await dependencies({ orders: failingOrders }).handler(
    apiRequest(`/orders/${ORDER_REFERENCE}/status`, { method: "GET" }),
  );
  assert(unavailable.status === 503, "database failure should be 503");
});

Deno.test("route methods and unknown routes are rejected", async () => {
  const { handler } = dependencies();
  assert(
    (await handler(apiRequest("/orders", { method: "GET" }))).status === 405,
    "orders GET should be 405",
  );
  assert(
    (await handler(apiRequest(`/orders/${ORDER_REFERENCE}/status`, {
      method: "POST",
      body: {},
    }))).status === 405,
    "status POST should be 405",
  );
  assert(
    (await handler(apiRequest("/unknown", { method: "GET" }))).status === 404,
    "unknown route should be 404",
  );
});
