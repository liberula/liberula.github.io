import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildDeliveryEmailContent,
  buildDeliveryUrl,
  createDeliveryPreparationHandler,
  createPostmarkSender,
  createSupabaseDeliveryPreparation,
  createSupabaseDeliverySendStore,
  type DeliveryClaimOutcome,
  type DeliveryEmail,
  type DeliveryPreparation,
  DeliveryPreparationFailure,
  type DeliveryPreparationRequest,
  normalizePublicBaseUrl,
  parseDeliveryPreparationRequest,
  parseDeliverySendRequest,
  type PostmarkErrorCode,
  PostmarkFailure,
} from "./index.ts";

const SECRET = "synthetic-delivery-admin-secret-never-production";
const PARTICIPANT_A = "123e4567-e89b-42d3-a456-426614174000";
const PARTICIPANT_B = "223e4567-e89b-42d3-a456-426614174001";
const DELIVERY_A = "323e4567-e89b-42d3-a456-426614174002";
const DELIVERY_B = "423e4567-e89b-42d3-a456-426614174003";
const REFERENCE_A = "QWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4";
const REFERENCE_B = "eHl6MDEyMzQ1Njc4OUFCQ0RFRkdISUpL";

function validPayload() {
  return {
    action: "prepare",
    case_id: "eco-sp-001",
    participant_ids: [PARTICIPANT_A],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function request(options: {
  method?: string;
  contentType?: string;
  authorization?: string | null;
  payload?: unknown;
  rawBody?: string;
} = {}) {
  const headers = new Headers();
  if (options.contentType !== null) {
    headers.set("Content-Type", options.contentType ?? "application/json");
  }
  if (options.authorization !== null) {
    headers.set("Authorization", options.authorization ?? `Bearer ${SECRET}`);
  }
  return new Request("http://localhost/functions/v1/eco-case-delivery", {
    method: options.method ?? "POST",
    headers,
    body: (options.method ?? "POST") === "POST"
      ? options.rawBody ?? JSON.stringify(options.payload ?? validPayload())
      : undefined,
  });
}

function preparation(
  overrides: Partial<DeliveryPreparation> = {},
): DeliveryPreparation {
  return {
    caseId: "eco-sp-001",
    entryPath: "/eco/eco-sp-001/iniciar/",
    results: [{
      participantId: PARTICIPANT_A,
      deliveryId: DELIVERY_A,
      result: "created",
      status: "pending",
      deliveryReference: REFERENCE_A,
    }],
    ...overrides,
  };
}

function handler(
  prepare: (
    request: DeliveryPreparationRequest,
  ) => Promise<DeliveryPreparation> = async () => preparation(),
) {
  return createDeliveryPreparationHandler({
    secret: SECRET,
    publicBaseUrl: "https://liberula.com/",
    prepare,
  });
}

Deno.test("valid authenticated request returns one individual landing URL", async () => {
  let captured: DeliveryPreparationRequest | null = null;
  const response = await handler(async (value) => {
    captured = value;
    return preparation();
  })(request());
  assertEquals(response.status, 200);
  assertEquals(captured, {
    action: "prepare",
    caseId: "eco-sp-001",
    participantIds: [PARTICIPANT_A],
  });
  assertEquals(await response.json(), {
    success: true,
    case_id: "eco-sp-001",
    results: [{
      participant_id: PARTICIPANT_A,
      delivery_id: DELIVERY_A,
      result: "created",
      status: "pending",
      delivery_url:
        `https://liberula.com/eco/eco-sp-001/iniciar/?delivery=${REFERENCE_A}`,
    }],
  });
});

Deno.test("missing and invalid authentication are rejected before preparation", async () => {
  let calls = 0;
  const guarded = handler(async () => {
    calls += 1;
    return preparation();
  });
  for (const authorization of [null, "Bearer wrong-secret", "Basic value"]) {
    const response = await guarded(request({ authorization }));
    assertEquals(response.status, 401);
    assertEquals(await response.json(), {
      success: false,
      error: "unauthorized",
    });
  }
  assertEquals(calls, 0);
});

Deno.test("wrong method, content type, malformed JSON, and oversized body fail", async () => {
  const cases = [
    request({ method: "GET" }),
    request({ contentType: "text/plain" }),
    request({ rawBody: "{" }),
    request({ rawBody: JSON.stringify({ padding: "x".repeat(9000) }) }),
  ];
  for (const candidate of cases) {
    const response = await handler()(candidate);
    assert(response.status >= 400 && response.status < 500);
    assertEquals(await response.json(), {
      success: false,
      error: "invalid_request",
    });
  }
});

const invalidRequests: Array<[string, () => unknown]> = [
  ["unsupported action", () => ({ ...validPayload(), action: "send" })],
  ["missing case ID", () => ({ ...validPayload(), case_id: "" })],
  [
    "empty participant list",
    () => ({ ...validPayload(), participant_ids: [] }),
  ],
  [
    "more than ten participants",
    () => ({
      ...validPayload(),
      participant_ids: Array.from(
        { length: 11 },
        (_, index) =>
          `123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}`,
      ),
    }),
  ],
  [
    "duplicated participant IDs",
    () => ({
      ...validPayload(),
      participant_ids: [PARTICIPANT_A, PARTICIPANT_A],
    }),
  ],
  [
    "malformed participant UUID",
    () => ({ ...validPayload(), participant_ids: ["not-a-uuid"] }),
  ],
  ["unknown property", () => ({ ...validPayload(), email: "not-accepted" })],
];

for (const [name, createPayload] of invalidRequests) {
  Deno.test(`${name} is rejected before writes`, async () => {
    let writes = 0;
    const response = await handler(async () => {
      writes += 1;
      return preparation();
    })(request({ payload: createPayload() }));
    assertEquals(response.status, 400);
    assertEquals(writes, 0);
  });
}

Deno.test("request parser trims case ID and normalizes UUID casing", () => {
  assertEquals(
    parseDeliveryPreparationRequest({
      ...validPayload(),
      case_id: " eco-sp-001 ",
      participant_ids: [PARTICIPANT_A.toUpperCase()],
    }),
    {
      action: "prepare",
      caseId: "eco-sp-001",
      participantIds: [PARTICIPANT_A],
    },
  );
});

for (
  const scenario of [
    "unknown case",
    "inactive case",
    "missing case entry path",
    "malformed case entry path",
    "unknown participant",
  ]
) {
  Deno.test(`${scenario} returns generic not_found without writes`, async () => {
    const response = await handler(async () => {
      throw new DeliveryPreparationFailure("not_found");
    })(request());
    assertEquals(response.status, 404);
    assertEquals(await response.json(), { success: false, error: "not_found" });
  });
}

for (const status of ["registered", "active", "paused"]) {
  Deno.test(`${status} participant is eligible`, async () => {
    const response = await handler()(request());
    assertEquals(response.status, 200);
  });
}

for (const status of ["blocked", "completed"]) {
  Deno.test(`${status} participant is rejected without partial output`, async () => {
    const response = await handler(async () => {
      throw new DeliveryPreparationFailure("ineligible_participant");
    })(request());
    assertEquals(response.status, 409);
    assertEquals(await response.json(), {
      success: false,
      error: "ineligible_participant",
    });
  });
}

for (const status of ["pending", "sent", "failed", "cancelled"] as const) {
  Deno.test(`existing ${status} delivery preserves reference and status`, async () => {
    const response = await handler(async () =>
      preparation({
        results: [{
          participantId: PARTICIPANT_A,
          deliveryId: DELIVERY_A,
          result: "existing",
          status,
          deliveryReference: REFERENCE_A,
        }],
      })
    )(request());
    const body = await response.json();
    assertEquals(body.results[0].result, "existing");
    assertEquals(body.results[0].status, status);
    assert(String(body.results[0].delivery_url).endsWith(REFERENCE_A));
  });
}

Deno.test("two participants receive separate opaque URLs in request order", async () => {
  const response = await handler(async () =>
    preparation({
      results: [
        {
          participantId: PARTICIPANT_A,
          deliveryId: DELIVERY_A,
          result: "created",
          status: "pending",
          deliveryReference: REFERENCE_A,
        },
        {
          participantId: PARTICIPANT_B,
          deliveryId: DELIVERY_B,
          result: "created",
          status: "pending",
          deliveryReference: REFERENCE_B,
        },
      ],
    })
  )(request({
    payload: {
      ...validPayload(),
      participant_ids: [PARTICIPANT_A, PARTICIPANT_B],
    },
  }));
  const body = await response.json();
  assertEquals(body.results.length, 2);
  assert(String(body.results[0].delivery_url).endsWith(REFERENCE_A));
  assert(String(body.results[1].delivery_url).endsWith(REFERENCE_B));
  for (const item of body.results) {
    assert(!item.delivery_url.includes(item.participant_id));
    assert(!item.delivery_url.includes("eco-sp-001?"));
  }
});

Deno.test("concurrent uniqueness conflict converges on the existing delivery", async () => {
  let call = 0;
  const concurrentHandler = handler(async () => {
    call += 1;
    return preparation({
      results: [{
        participantId: PARTICIPANT_A,
        deliveryId: DELIVERY_A,
        result: call === 1 ? "created" : "existing",
        status: "pending",
        deliveryReference: REFERENCE_A,
      }],
    });
  });
  const [first, second] = await Promise.all([
    concurrentHandler(request()),
    concurrentHandler(request()),
  ]);
  const [firstBody, secondBody] = await Promise.all([
    first.json(),
    second.json(),
  ]);
  assertEquals(firstBody.results[0].delivery_id, DELIVERY_A);
  assertEquals(secondBody.results[0].delivery_id, DELIVERY_A);
  assertEquals(
    firstBody.results[0].delivery_url,
    secondBody.results[0].delivery_url,
  );
  assertEquals(
    new Set([
      firstBody.results[0].result,
      secondBody.results[0].result,
    ]),
    new Set(["created", "existing"]),
  );
});

Deno.test("URL builder uses catalog path and normalizes configured trailing slash", () => {
  assertEquals(
    normalizePublicBaseUrl("https://liberula.com///"),
    "https://liberula.com",
  );
  assertEquals(
    normalizePublicBaseUrl("https://liberula.com/"),
    "https://liberula.com",
  );
  assertEquals(
    buildDeliveryUrl(
      "https://liberula.com/",
      "/eco/eco-sp-001/iniciar/",
      REFERENCE_A,
    ),
    `https://liberula.com/eco/eco-sp-001/iniciar/?delivery=${REFERENCE_A}`,
  );
  assertEquals(
    buildDeliveryUrl("https://liberula.com", "https://evil.test/", REFERENCE_A),
    null,
  );
  assertEquals(
    buildDeliveryUrl("https://liberula.com", "//evil.test/case", REFERENCE_A),
    null,
  );
  assertEquals(
    buildDeliveryUrl("https://liberula.com", "/case/?x=1", REFERENCE_A),
    null,
  );
});

Deno.test("invalid database output fails closed", async () => {
  for (
    const value of [
      preparation({ entryPath: "" }),
      preparation({ entryPath: "/case/?unsafe=1" }),
      preparation({ results: [] }),
      preparation({
        results: [{
          ...preparation().results[0],
          deliveryReference: "short",
        }],
      }),
    ]
  ) {
    const response = await handler(async () => value)(request());
    assertEquals(response.status, 500);
    assertEquals(await response.json(), {
      success: false,
      error: "internal_error",
    });
  }
});

Deno.test("Supabase adapter calls only the transactional preparation RPC", async () => {
  let capturedUrl = "";
  let capturedBody: Record<string, unknown> | null = null;
  let fetchCalls = 0;
  const prepare = createSupabaseDeliveryPreparation(
    "https://synthetic.supabase.co",
    "synthetic-service-role",
    async (input, init) => {
      fetchCalls += 1;
      capturedUrl = String(input);
      capturedBody = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          case_id: "eco-sp-001",
          entry_path: "/eco/eco-sp-001/iniciar/",
          results: [{
            participant_id: PARTICIPANT_A,
            delivery_id: DELIVERY_A,
            result: "created",
            status: "pending",
            delivery_reference: REFERENCE_A,
          }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  );
  const result = await prepare({
    action: "prepare",
    caseId: "eco-sp-001",
    participantIds: [PARTICIPANT_A],
  });
  assertEquals(fetchCalls, 1);
  assert(capturedUrl.endsWith("/rest/v1/rpc/prepare_eco_case_deliveries"));
  assertEquals(capturedBody, {
    p_case_id: "eco-sp-001",
    p_participant_ids: [PARTICIPANT_A],
  });
  assertEquals(result.results[0].deliveryReference, REFERENCE_A);
});

Deno.test("RPC business errors retain only approved public categories", async () => {
  for (
    const code of [
      "invalid_request",
      "not_found",
      "ineligible_participant",
    ] as const
  ) {
    const prepare = createSupabaseDeliveryPreparation(
      "https://synthetic.supabase.co",
      "synthetic-service-role",
      async () =>
        new Response(JSON.stringify({ error: code }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    let captured: unknown;
    try {
      await prepare({
        action: "prepare",
        caseId: "eco-sp-001",
        participantIds: [PARTICIPANT_A],
      });
    } catch (error) {
      captured = error;
    }
    assert(captured instanceof DeliveryPreparationFailure);
    assertEquals(captured.code, code);
  }
});

Deno.test("logs contain no participant identifiers, secrets, or database details", async () => {
  const logs: string[] = [];
  const response = await createDeliveryPreparationHandler({
    secret: SECRET,
    publicBaseUrl: "https://liberula.com",
    prepare: async () => {
      throw new Error(
        `database ${PARTICIPANT_A} ${SECRET} person@example.test`,
      );
    },
    logger: {
      info: (entry) => logs.push(JSON.stringify(entry)),
      error: (entry) => logs.push(JSON.stringify(entry)),
    },
  })(request());
  assertEquals(response.status, 500);
  const output = logs.join(" ");
  for (const sensitive of [PARTICIPANT_A, SECRET, "person@example.test"]) {
    assert(!output.includes(sensitive), `log leaked ${sensitive}`);
  }
});

const MESSAGE_ID = "523e4567-e89b-42d3-a456-426614174004";

function sendPayload(deliveryIds = [DELIVERY_A]) {
  return { action: "send", delivery_ids: deliveryIds };
}

function claimedDelivery(
  overrides: Partial<Extract<DeliveryClaimOutcome, { result: "claimed" }>> = {},
): Extract<DeliveryClaimOutcome, { result: "claimed" }> {
  return {
    result: "claimed",
    deliveryId: DELIVERY_A,
    status: "sending",
    caseId: "eco-sp-001",
    entryPath: "/eco/eco-sp-001/iniciar/",
    deliveryReference: REFERENCE_A,
    participantEmail: "controlled@example.test",
    participantName: "Pessoa Controlada",
    ...overrides,
  };
}

function sendHandler(overrides: {
  claimDelivery?: (deliveryId: string) => Promise<DeliveryClaimOutcome>;
  completeDelivery?: (
    deliveryId: string,
    messageId: string,
  ) => Promise<boolean>;
  failDelivery?: (
    deliveryId: string,
    code: PostmarkErrorCode,
  ) => Promise<boolean>;
  sendEmail?: (email: DeliveryEmail) => Promise<{ messageId: string }>;
  logs?: string[];
} = {}) {
  return createDeliveryPreparationHandler({
    secret: SECRET,
    publicBaseUrl: "https://liberula.com",
    prepare: async () => preparation(),
    claimDelivery: overrides.claimDelivery ?? (async () => claimedDelivery()),
    completeDelivery: overrides.completeDelivery ?? (async () => true),
    failDelivery: overrides.failDelivery ?? (async () => true),
    sendEmail: overrides.sendEmail ?? (async () => ({ messageId: MESSAGE_ID })),
    logger: overrides.logs
      ? {
        info: (entry) => overrides.logs?.push(JSON.stringify(entry)),
        error: (entry) => overrides.logs?.push(JSON.stringify(entry)),
      }
      : undefined,
  });
}

Deno.test("valid authenticated send claims before Postmark and persists success", async () => {
  const stages: string[] = [];
  const sentEmails: DeliveryEmail[] = [];
  const response = await sendHandler({
    claimDelivery: async () => {
      stages.push("claim");
      return claimedDelivery();
    },
    sendEmail: async (email) => {
      stages.push("postmark");
      sentEmails.push(email);
      return { messageId: MESSAGE_ID };
    },
    completeDelivery: async (deliveryId, messageId) => {
      stages.push("complete");
      assertEquals(deliveryId, DELIVERY_A);
      assertEquals(messageId, MESSAGE_ID);
      return true;
    },
  })(request({ payload: sendPayload() }));
  assertEquals(stages, ["claim", "postmark", "complete"]);
  assertEquals(
    sentEmails[0].deliveryUrl,
    `https://liberula.com/eco/eco-sp-001/iniciar/?delivery=${REFERENCE_A}`,
  );
  assertEquals(await response.json(), {
    success: true,
    results: [{ delivery_id: DELIVERY_A, result: "sent", status: "sent" }],
  });
});

Deno.test("send request validation requires one to ten unique UUIDs", () => {
  assertEquals(parseDeliverySendRequest(sendPayload()), {
    action: "send",
    deliveryIds: [DELIVERY_A],
  });
  for (
    const payload of [
      { action: "send", delivery_ids: [] },
      { action: "send", delivery_ids: [DELIVERY_A, DELIVERY_A] },
      { action: "send", delivery_ids: ["not-a-uuid"] },
      { action: "send", delivery_ids: Array(11).fill(DELIVERY_A) },
      { action: "send", delivery_ids: [DELIVERY_A], case_id: "eco-sp-001" },
      { action: "automatic", delivery_ids: [DELIVERY_A] },
    ]
  ) assertEquals(parseDeliverySendRequest(payload), null);
});

Deno.test("invalid send structure performs no claim or provider call", async () => {
  let claims = 0;
  let sends = 0;
  const response = await sendHandler({
    claimDelivery: async () => {
      claims += 1;
      return claimedDelivery();
    },
    sendEmail: async () => {
      sends += 1;
      return { messageId: MESSAGE_ID };
    },
  })(request({ payload: { action: "send", delivery_ids: [] } }));
  assertEquals(response.status, 400);
  assertEquals(claims, 0);
  assertEquals(sends, 0);
});

for (
  const [name, outcome, expected] of [
    ["unknown delivery", { result: "not_found" }, "not_found"],
    [
      "sending delivery",
      { result: "ineligible_state", status: "sending" },
      "ineligible_state",
    ],
    [
      "sent delivery",
      { result: "already_sent", status: "sent" },
      "already_sent",
    ],
    [
      "cancelled delivery",
      { result: "ineligible_state", status: "cancelled" },
      "ineligible_state",
    ],
    [
      "retry limit",
      { result: "retry_limit_reached", status: "failed" },
      "retry_limit_reached",
    ],
    [
      "blocked participant",
      { result: "ineligible_state", status: "pending" },
      "ineligible_state",
    ],
    [
      "completed participant",
      { result: "ineligible_state", status: "pending" },
      "ineligible_state",
    ],
    ["invalid participant email", {
      result: "ineligible_state",
      status: "pending",
    }, "ineligible_state"],
    [
      "inactive case",
      { result: "ineligible_state", status: "pending" },
      "ineligible_state",
    ],
    ["invalid entry path or reference", {
      result: "ineligible_state",
      status: "pending",
    }, "ineligible_state"],
  ] as const
) {
  Deno.test(`${name} never calls Postmark`, async () => {
    let sends = 0;
    const response = await sendHandler({
      claimDelivery: async () => outcome as DeliveryClaimOutcome,
      sendEmail: async () => {
        sends += 1;
        return { messageId: MESSAGE_ID };
      },
    })(request({ payload: sendPayload() }));
    const body = await response.json();
    assertEquals(body.results[0].result, expected);
    assertEquals(sends, 0);
  });
}

Deno.test("pending and explicitly failed deliveries are claimable", async () => {
  for (const originalStatus of ["pending", "failed"]) {
    let sends = 0;
    const response = await sendHandler({
      claimDelivery: async () => claimedDelivery(),
      sendEmail: async () => {
        sends += 1;
        return { messageId: MESSAGE_ID };
      },
    })(request({ payload: sendPayload() }));
    assertEquals(response.status, 200, originalStatus);
    assertEquals(sends, 1, originalStatus);
  }
});

Deno.test("provider failure finalizes failed and never retries automatically", async () => {
  let sends = 0;
  const failures: string[] = [];
  const response = await sendHandler({
    sendEmail: async () => {
      sends += 1;
      throw new PostmarkFailure("postmark_rejected");
    },
    failDelivery: async (deliveryId, code) => {
      assertEquals(deliveryId, DELIVERY_A);
      failures.push(code);
      return true;
    },
  })(request({ payload: sendPayload() }));
  assertEquals(sends, 1);
  assertEquals(failures, ["postmark_rejected"]);
  assertEquals((await response.json()).results[0], {
    delivery_id: DELIVERY_A,
    result: "failed",
    status: "failed",
    error: "postmark_rejected",
  });
});

Deno.test("ambiguous network result is persisted for manual Postmark inspection", async () => {
  let failureCode = "";
  const response = await sendHandler({
    sendEmail: async () => {
      throw new TypeError("synthetic network loss with PII");
    },
    failDelivery: async (_deliveryId, code) => {
      failureCode = code;
      return true;
    },
  })(request({ payload: sendPayload() }));
  assertEquals(failureCode, "postmark_result_unknown");
  assertEquals(
    (await response.json()).results[0].error,
    "postmark_result_unknown",
  );
});

Deno.test("one failed batch item does not prevent the next explicit send", async () => {
  let sendCount = 0;
  const response = await sendHandler({
    claimDelivery: async (deliveryId) => claimedDelivery({ deliveryId }),
    sendEmail: async () => {
      sendCount += 1;
      if (sendCount === 1) throw new PostmarkFailure("postmark_rejected");
      return { messageId: MESSAGE_ID };
    },
  })(request({ payload: sendPayload([DELIVERY_A, DELIVERY_B]) }));
  const body = await response.json();
  assertEquals(sendCount, 2);
  assertEquals(
    body.results.map((item: Record<string, unknown>) => item.result),
    [
      "failed",
      "sent",
    ],
  );
});

Deno.test("concurrent sends result in one provider call", async () => {
  let claimed = false;
  let sends = 0;
  const concurrentHandler = sendHandler({
    claimDelivery: async () => {
      if (claimed) return { result: "ineligible_state", status: "sending" };
      claimed = true;
      return claimedDelivery();
    },
    sendEmail: async () => {
      sends += 1;
      return { messageId: MESSAGE_ID };
    },
  });
  const responses = await Promise.all([
    concurrentHandler(request({ payload: sendPayload() })),
    concurrentHandler(request({ payload: sendPayload() })),
  ]);
  const bodies = await Promise.all(
    responses.map((response) => response.json()),
  );
  assertEquals(sends, 1);
  assertEquals(
    new Set(bodies.map((body) => body.results[0].result)),
    new Set(["sent", "ineligible_state"]),
  );
});

Deno.test("prepare action cannot invoke the Postmark dependency", async () => {
  let sends = 0;
  const response = await sendHandler({
    sendEmail: async () => {
      sends += 1;
      return { messageId: MESSAGE_ID };
    },
  })(request());
  assertEquals(response.status, 200);
  assertEquals(sends, 0);
});

Deno.test("email applies the ECO identity and Aspirante presentation safely", () => {
  const named = buildDeliveryEmailContent({
    deliveryId: DELIVERY_A,
    caseId: "eco-sp-001",
    recipientEmail: "controlled@example.test",
    participantName: "  João   da Silva <script>alert('x')</script>  ",
    deliveryUrl:
      `https://liberula.com/eco/eco-sp-001/iniciar/?delivery=${REFERENCE_A}`,
  });
  assertEquals(
    named.subject,
    "E.C.O. — Caso ECO-SP-001 disponível",
  );
  assertEquals(
    named.preheader,
    "Seu acesso individual ao Caso ECO-SP-001 está disponível.",
  );
  for (
    const text of [
      "E.C.O.",
      "Encontrar. Conter. Ocultar.",
      "TRANSMISSÃO ECO-SP-001",
      "ASPIRANTE:",
      "Seu primeiro caso está disponível.",
      "ACESSAR CASO",
    ]
  ) {
    assert(named.textBody.includes(text));
    assert(named.htmlBody.includes(text));
  }
  assert(
    named.textBody.includes(
      "ASPIRANTE: JOÃO DA SILVA <SCRIPT>ALERT('X')</SCRIPT>",
    ),
  );
  assert(
    named.htmlBody.includes(
      "ASPIRANTE: JOÃO DA SILVA &lt;SCRIPT&gt;ALERT(&#39;X&#39;)&lt;/SCRIPT&gt;",
    ),
  );
  assert(!named.htmlBody.includes("<SCRIPT>"));
  assert(named.textBody.includes(REFERENCE_A));
  assert(named.htmlBody.includes(REFERENCE_A));
  assert(!named.htmlBody.includes("eco-emblem.webp"));
  assert(!named.htmlBody.includes("<img"));
  assert(!named.htmlBody.includes("<script"));
  assert(!named.htmlBody.includes("data:image"));
  assert(!named.htmlBody.includes("<link"));
  assert(!named.htmlBody.includes("background-image"));
  assert(
    !/attachment|canonical answer|resposta correta|pagamento|oferta|parabéns|você foi selecionado|\bagente\b/i
      .test(
        JSON.stringify(named),
      ),
  );

  const generic = buildDeliveryEmailContent({
    deliveryId: DELIVERY_A,
    caseId: "eco-sp-001",
    recipientEmail: "controlled@example.test",
    participantName: null,
    deliveryUrl: "https://liberula.com/case?delivery=opaque-reference-1234",
  });
  assert(generic.textBody.includes("\nASPIRANTE\n"));
  assert(generic.htmlBody.includes(">ASPIRANTE<"));
  assert(!generic.textBody.includes("IDENTIDADE NÃO REGISTRADA"));

  const bounded = buildDeliveryEmailContent({
    deliveryId: DELIVERY_A,
    caseId: "eco-sp-001",
    recipientEmail: "controlled@example.test",
    participantName: "á".repeat(81),
    deliveryUrl: `https://liberula.com/case?delivery=${REFERENCE_A}`,
  });
  assert(bounded.textBody.includes(`ASPIRANTE: ${"Á".repeat(80)}\n`));
  assert(!bounded.textBody.includes("Á".repeat(81)));
});

Deno.test("Postmark sender uses only configured transactional fields and safe metadata", async () => {
  let requestUrl = "";
  const capturedHeaders: Array<Record<string, string>> = [];
  const capturedPayloads: Array<Record<string, unknown>> = [];
  const sender = createPostmarkSender({
    token: "synthetic-postmark-token",
    fromEmail: "eco@example.test",
    replyTo: "reply@example.test",
    messageStream: "outbound",
    publicBaseUrl: "https://liberula.com",
  }, async (input, init) => {
    requestUrl = String(input);
    capturedHeaders.push(Object.fromEntries(new Headers(init?.headers)));
    capturedPayloads.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({ ErrorCode: 0, MessageID: MESSAGE_ID }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  });
  const accepted = await sender({
    deliveryId: DELIVERY_A,
    caseId: "eco-sp-001",
    recipientEmail: "controlled@example.test",
    participantName: null,
    deliveryUrl: `https://liberula.com/case?delivery=${REFERENCE_A}`,
  });
  const headers = capturedHeaders[0];
  const payload = capturedPayloads[0];
  assertEquals(accepted.messageId, MESSAGE_ID);
  assertEquals(requestUrl, "https://api.postmarkapp.com/email");
  assertEquals(
    headers["x-postmark-server-token"],
    "synthetic-postmark-token",
  );
  assertEquals(payload.From, "eco@example.test");
  assertEquals(payload.ReplyTo, "reply@example.test");
  assertEquals(payload.MessageStream, "outbound");
  assertEquals(payload.Metadata, {
    case_id: "eco-sp-001",
    delivery_id: DELIVERY_A,
  });
  assert(!("Attachments" in payload));
  assert(
    !JSON.stringify(payload.Metadata).includes("controlled@example.test"),
  );
  assert(!JSON.stringify(payload.Metadata).includes(REFERENCE_A));
});

Deno.test("Postmark rejects missing configuration and invalid provider results", async () => {
  const missing = createPostmarkSender({});
  let missingError: unknown;
  try {
    await missing({} as DeliveryEmail);
  } catch (error) {
    missingError = error;
  }
  assert(missingError instanceof PostmarkFailure);
  assertEquals(missingError.code, "postmark_configuration_missing");

  for (
    const [status, body, code] of [
      [401, {}, "postmark_unauthorized"],
      [422, {}, "postmark_rejected"],
      [503, {}, "postmark_server_error"],
      [
        200,
        { ErrorCode: 1, MessageID: MESSAGE_ID },
        "postmark_invalid_response",
      ],
      [200, { ErrorCode: 0, MessageID: "" }, "postmark_invalid_response"],
    ] as const
  ) {
    const sender = createPostmarkSender({
      token: "token",
      fromEmail: "from@example.test",
      replyTo: "reply@example.test",
      messageStream: "outbound",
      publicBaseUrl: "https://liberula.com",
    }, async () => new Response(JSON.stringify(body), { status }));
    let captured: unknown;
    try {
      await sender({
        deliveryId: DELIVERY_A,
        caseId: "eco-sp-001",
        recipientEmail: "controlled@example.test",
        participantName: null,
        deliveryUrl: "https://liberula.com/case?delivery=opaque-reference-1234",
      });
    } catch (error) {
      captured = error;
    }
    assert(captured instanceof PostmarkFailure);
    assertEquals(captured.code, code);
  }
});

Deno.test("Supabase send store uses claim, complete, and fail RPCs only", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const store = createSupabaseDeliverySendStore(
    "https://synthetic.supabase.co",
    "synthetic-service-role",
    async (input, init) => {
      const url = String(input);
      const body = JSON.parse(String(init?.body));
      calls.push({ url, body });
      if (url.endsWith("claim_eco_case_delivery_send")) {
        return new Response(
          JSON.stringify({
            result: "claimed",
            delivery_id: DELIVERY_A,
            status: "sending",
            case_id: "eco-sp-001",
            entry_path: "/eco/eco-sp-001/iniciar/",
            delivery_reference: REFERENCE_A,
            participant_email: "controlled@example.test",
            participant_name: null,
          }),
          { status: 200 },
        );
      }
      return new Response("true", { status: 200 });
    },
  );
  assertEquals((await store.claimDelivery(DELIVERY_A)).result, "claimed");
  assert(await store.completeDelivery(DELIVERY_A, MESSAGE_ID));
  assert(await store.failDelivery(DELIVERY_A, "postmark_rejected"));
  assertEquals(calls.map((call) => call.url.split("/").at(-1)), [
    "claim_eco_case_delivery_send",
    "complete_eco_case_delivery_send",
    "fail_eco_case_delivery_send",
  ]);
});

Deno.test("send logs contain no PII, token, link, reference, or provider body", async () => {
  const logs: string[] = [];
  const response = await sendHandler({
    logs,
    sendEmail: async () => {
      throw new Error(
        `controlled@example.test ${REFERENCE_A} synthetic-postmark-token provider body`,
      );
    },
  })(request({ payload: sendPayload() }));
  assertEquals(response.status, 200);
  const output = logs.join(" ");
  for (
    const sensitive of [
      "controlled@example.test",
      REFERENCE_A,
      "synthetic-postmark-token",
      "provider body",
      "https://liberula.com",
    ]
  ) assert(!output.includes(sensitive), `log leaked ${sensitive}`);
});
