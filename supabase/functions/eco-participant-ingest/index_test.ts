import {
  createParticipantIngestHandler,
  createSupabaseParticipantIngest,
  type IngestionResult,
  parseParticipantEvent,
  type ParticipantEvent,
} from "./index.ts";

const SECRET = "synthetic-ingest-secret-at-least-32-characters";
const EVENT_ID = "123e4567-e89b-42d3-a456-426614174000";

const validPayload = {
  event_id: EVENT_ID,
  event_type: "eco.participant.registered",
  event_version: 1,
  occurred_at: "2026-07-31T12:00:00.000Z",
  source: {
    system: "quaero",
    record_id: "lead-synthetic-001",
  },
  participant: {
    name: "  Ada Lovelace  ",
    email: "  ADA@EXAMPLE.COM  ",
    consent: true,
  },
  acquisition: {
    project: "eco",
    funnel: "free_recruitment",
    utm_source: "  synthetic-source  ",
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    fbclid: null,
    source_url: "https://example.test/eco",
    referrer: null,
    metadata: { cohort: "synthetic" },
  },
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

function clone<T>(value: T): T {
  return structuredClone(value);
}

function eventRequest({
  method = "POST",
  payload = validPayload as unknown,
  authorization = `Bearer ${SECRET}`,
  contentType = "application/json",
  rawBody,
}: {
  method?: string;
  payload?: unknown;
  authorization?: string | null;
  contentType?: string;
  rawBody?: string;
} = {}): Request {
  const headers = new Headers();
  if (authorization !== null) headers.set("Authorization", authorization);
  if (contentType) headers.set("Content-Type", contentType);
  return new Request("http://localhost/eco-participant-ingest", {
    method,
    headers,
    body: method === "POST" ? rawBody ?? JSON.stringify(payload) : undefined,
  });
}

type MemoryParticipant = {
  email: string;
  name: string | null;
  registeredAt: string;
};

class MemoryIngestion {
  participants = new Map<string, MemoryParticipant>();
  sources = new Map<
    string,
    { email: string; acquisition: Record<string, unknown> }
  >();
  events = new Set<string>();
  deliveries: unknown[] = [];

  ingest = async (event: ParticipantEvent): Promise<IngestionResult> => {
    const sourceKey = `${event.sourceSystem}:${event.sourceRecordId}`;
    if (this.events.has(event.eventId) || this.sources.has(sourceKey)) {
      return "duplicate";
    }

    const existing = this.participants.get(event.participantEmail);
    const result: IngestionResult = existing ? "linked" : "created";
    if (existing) {
      if (!existing.name && event.participantName) {
        existing.name = event.participantName;
      }
      if (Date.parse(event.occurredAt) < Date.parse(existing.registeredAt)) {
        existing.registeredAt = event.occurredAt;
      }
    } else {
      this.participants.set(event.participantEmail, {
        email: event.participantEmail,
        name: event.participantName,
        registeredAt: event.occurredAt,
      });
    }
    this.sources.set(sourceKey, {
      email: event.participantEmail,
      acquisition: event.acquisition,
    });
    this.events.add(event.eventId);
    return result;
  };
}

Deno.test("valid event normalizes and creates participant, source, and event without delivery", async () => {
  const memory = new MemoryIngestion();
  const response = await createParticipantIngestHandler({
    secret: SECRET,
    ingest: memory.ingest,
  })(eventRequest());

  assert(response.status === 200, "expected success");
  assertEquals(
    await response.json(),
    { success: true, result: "created" },
    "unexpected response",
  );
  assert(memory.participants.has("ada@example.com"), "participant missing");
  assert(memory.sources.has("quaero:lead-synthetic-001"), "source missing");
  assert(memory.events.has(EVENT_ID), "event record missing");
  assert(memory.deliveries.length === 0, "delivery must not be created");
  const source = memory.sources.get("quaero:lead-synthetic-001");
  assert(
    source?.acquisition.utm_source === "synthetic-source",
    "acquisition was not preserved",
  );
});

Deno.test("parser accepts omitted optional name and rejects impossible calendar timestamps", () => {
  const withoutName = clone(validPayload);
  delete (withoutName.participant as { name?: string }).name;
  assert(
    parseParticipantEvent(withoutName) !== null,
    "name should be optional",
  );
  const impossibleDate = clone(validPayload);
  impossibleDate.occurred_at = "2026-02-30T12:00:00Z";
  assert(
    parseParticipantEvent(impossibleDate) === null,
    "date should be invalid",
  );
});

for (
  const [name, request, expectedStatus, expectedError] of [
    [
      "missing authorization",
      eventRequest({ authorization: null }),
      401,
      "unauthorized",
    ],
    [
      "invalid authorization",
      eventRequest({ authorization: "Bearer wrong" }),
      401,
      "unauthorized",
    ],
    ["wrong method", eventRequest({ method: "GET" }), 405, "invalid_request"],
    [
      "wrong content type",
      eventRequest({ contentType: "text/plain" }),
      415,
      "invalid_request",
    ],
    ["malformed JSON", eventRequest({ rawBody: "{" }), 400, "invalid_request"],
    [
      "excessive body",
      eventRequest({
        rawBody: JSON.stringify({ data: "x".repeat(33 * 1024) }),
      }),
      413,
      "invalid_request",
    ],
  ] as const
) {
  Deno.test(name, async () => {
    const response = await createParticipantIngestHandler({
      secret: SECRET,
      ingest: async () => "created",
    })(request);
    assert(response.status === expectedStatus, `${name}: wrong status`);
    assertEquals(
      await response.json(),
      { success: false, error: expectedError },
      `${name}: wrong body`,
    );
  });
}

const invalidPayloads: Array<[string, () => Record<string, unknown>]> = [
  ["invalid UUID", () => ({ ...clone(validPayload), event_id: "not-a-uuid" })],
  [
    "unsupported event type",
    () => ({ ...clone(validPayload), event_type: "eco.other" }),
  ],
  ["unsupported version", () => ({ ...clone(validPayload), event_version: 2 })],
  [
    "invalid timestamp",
    () => ({ ...clone(validPayload), occurred_at: "yesterday" }),
  ],
  [
    "wrong source system",
    () => ({
      ...clone(validPayload),
      source: { ...validPayload.source, system: "other" },
    }),
  ],
  [
    "empty source record",
    () => ({
      ...clone(validPayload),
      source: { ...validPayload.source, record_id: " " },
    }),
  ],
  [
    "invalid email",
    () => ({
      ...clone(validPayload),
      participant: { ...validPayload.participant, email: "invalid" },
    }),
  ],
  [
    "absent consent",
    () => {
      const payload = clone(validPayload) as Record<string, unknown>;
      const participant = payload.participant as Record<string, unknown>;
      delete participant.consent;
      return payload;
    },
  ],
  [
    "false consent",
    () => ({
      ...clone(validPayload),
      participant: { ...validPayload.participant, consent: false },
    }),
  ],
  [
    "wrong project",
    () => ({
      ...clone(validPayload),
      acquisition: { ...validPayload.acquisition, project: "other" },
    }),
  ],
  [
    "wrong funnel",
    () => ({
      ...clone(validPayload),
      acquisition: { ...validPayload.acquisition, funnel: "other" },
    }),
  ],
  [
    "malformed metadata",
    () => ({
      ...clone(validPayload),
      acquisition: { ...validPayload.acquisition, metadata: [] },
    }),
  ],
];

for (const [name, createPayload] of invalidPayloads) {
  Deno.test(`${name} returns generic invalid request`, async () => {
    const response = await createParticipantIngestHandler({
      secret: SECRET,
      ingest: async () => "created",
    })(eventRequest({ payload: createPayload() }));
    assert(response.status === 400, `${name}: expected 400`);
    assertEquals(
      await response.json(),
      { success: false, error: "invalid_request" },
      `${name}: details leaked`,
    );
  });
}

Deno.test("event and source retries are idempotent while a new source links", async () => {
  const memory = new MemoryIngestion();
  const handler = createParticipantIngestHandler({
    secret: SECRET,
    ingest: memory.ingest,
  });
  const first = await handler(eventRequest());
  assert((await first.json()).result === "created", "first should create");

  const replay = await handler(eventRequest());
  assert(
    (await replay.json()).result === "duplicate",
    "event replay should duplicate",
  );

  const sameSource = clone(validPayload);
  sameSource.event_id = "223e4567-e89b-42d3-a456-426614174001";
  const sourceReplay = await handler(eventRequest({ payload: sameSource }));
  assert(
    (await sourceReplay.json()).result === "duplicate",
    "source replay should duplicate",
  );

  const newSource = clone(validPayload);
  newSource.event_id = "323e4567-e89b-42d3-a456-426614174002";
  newSource.source.record_id = "lead-synthetic-002";
  const linked = await handler(eventRequest({ payload: newSource }));
  assert((await linked.json()).result === "linked", "new source should link");
  assert(memory.participants.size === 1, "participant was duplicated");
  assert(memory.sources.size === 2, "source was not linked");
  assert(memory.events.size === 2, "unexpected event count");
});

Deno.test("blank name is filled, non-empty name and earliest registration are preserved", async () => {
  const memory = new MemoryIngestion();
  memory.participants.set("ada@example.com", {
    email: "ada@example.com",
    name: null,
    registeredAt: "2026-08-02T12:00:00.000Z",
  });
  const handler = createParticipantIngestHandler({
    secret: SECRET,
    ingest: memory.ingest,
  });
  const response = await handler(eventRequest());
  assert((await response.json()).result === "linked", "expected linked");
  const participant = memory.participants.get("ada@example.com");
  assert(participant?.name === "Ada Lovelace", "blank name was not filled");
  assert(
    participant?.registeredAt === "2026-07-31T12:00:00.000Z",
    "earliest timestamp was not preserved",
  );

  const anotherSource = clone(validPayload);
  anotherSource.event_id = "423e4567-e89b-42d3-a456-426614174003";
  anotherSource.source.record_id = "lead-synthetic-003";
  anotherSource.participant.name = "Replacement Name";
  anotherSource.occurred_at = "2026-08-03T12:00:00.000Z";
  await handler(eventRequest({ payload: anotherSource }));
  assert(participant?.name === "Ada Lovelace", "existing name was overwritten");
  assert(
    participant?.registeredAt === "2026-07-31T12:00:00.000Z",
    "registration timestamp moved later",
  );
});

Deno.test("configuration and database failures are generic and logs contain no PII or secrets", async () => {
  const missingSecret = await createParticipantIngestHandler({
    ingest: async () => "created",
  })(eventRequest());
  assert(missingSecret.status === 500, "missing secret should fail");

  const logs: string[] = [];
  const response = await createParticipantIngestHandler({
    secret: SECRET,
    ingest: async () => {
      throw new Error("database included ada@example.com and secret");
    },
    logger: {
      info: (entry) => logs.push(JSON.stringify(entry)),
      error: (entry) => logs.push(JSON.stringify(entry)),
    },
  })(eventRequest());
  assert(response.status === 500, "database failure should be internal");
  assertEquals(
    await response.json(),
    { success: false, error: "internal_error" },
    "database detail leaked",
  );
  const output = logs.join(" ");
  for (
    const sensitive of [
      "Ada Lovelace",
      "ada@example.com",
      "lead-synthetic-001",
      SECRET,
      "synthetic-source",
    ]
  ) {
    assert(!output.includes(sensitive), `log leaked ${sensitive}`);
  }

  const maliciousType = clone(validPayload);
  maliciousType.event_type = "ada@example.com";
  await createParticipantIngestHandler({
    secret: SECRET,
    ingest: async () => "created",
    logger: {
      error: (entry) => logs.push(JSON.stringify(entry)),
    },
  })(eventRequest({ payload: maliciousType }));
  assert(
    !logs.join(" ").includes("ada@example.com"),
    "invalid event type leaked PII",
  );
});

Deno.test("Supabase adapter calls only the transactional RPC", async () => {
  let capturedUrl = "";
  let capturedBody: Record<string, unknown> | null = null;
  const ingest = createSupabaseParticipantIngest(
    "https://synthetic-project.supabase.co",
    "synthetic-service-role",
    async (input, init) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ result: "created" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  const parsed = parseParticipantEvent(validPayload);
  assert(parsed !== null, "fixture should parse");
  assert(await ingest(parsed) === "created", "wrong adapter result");
  assert(
    capturedUrl.endsWith("/rest/v1/rpc/ingest_eco_participant_event"),
    "adapter did not call RPC",
  );
  const body = capturedBody as Record<string, unknown> | null;
  assert(body !== null, "RPC body was not captured");
  assert(
    body.p_participant_email === "ada@example.com",
    "email not normalized",
  );
  assert(body.p_acquisition !== undefined, "acquisition missing");
});
