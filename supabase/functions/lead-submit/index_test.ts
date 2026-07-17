import { createLeadSubmitHandler } from "./index.ts";

const origin = "https://quaero.com.br";
const validPayload = {
  project: "memora",
  funnel: "interest",
  name: "Ada Lovelace",
  email: " ADA@Example.com ",
  phone: "+55 11 99999-9999",
  message: "Tenho interesse.",
  consent: true,
  utm_source: "meta",
  utm_medium: "paid",
  utm_campaign: "memora",
  utm_content: "card",
  utm_term: "presente",
  fbclid: "test-click-id",
  source_url: "https://quaero.com.br/memora",
  referrer: "https://example.com",
  metadata: { variant: "a" },
  website: "",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function request(method = "POST", payload: unknown = validPayload, requestOrigin = origin): Request {
  return new Request("http://localhost/lead-submit", {
    method,
    headers: { Origin: requestOrigin, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(payload) : undefined,
  });
}

Deno.test("valid POST normalizes and persists all fields", async () => {
  let inserted: Record<string, unknown> | undefined;
  const handler = createLeadSubmitHandler({
    insertLead: async (lead) => {
      inserted = lead;
      return "created";
    },
  });
  const response = await handler(request());
  assert(response.status === 200, "expected 200");
  assert(inserted?.email === "ada@example.com", "email was not normalized");
  assert(inserted?.project === "memora" && inserted?.funnel === "interest", "form was not persisted");
  assert((inserted?.metadata as Record<string, unknown>)?.variant === "a", "metadata was not persisted");
  assert(
    JSON.stringify(await response.json()) === JSON.stringify({ success: true, duplicate: false }),
    "unexpected response",
  );
});

Deno.test("duplicate is an idempotent success", async () => {
  const handler = createLeadSubmitHandler({ insertLead: async () => "duplicate" });
  const body = await (await handler(request())).json();
  assert(body.success === true && body.duplicate === true, "expected duplicate success");
});

Deno.test("all configured project and funnel pairs are accepted", async () => {
  const handler = createLeadSubmitHandler({ insertLead: async () => "created" });
  for (const [project, funnels] of Object.entries({
    memora: ["interest", "father_day_card"],
    aferia: ["contact", "guide_interest"],
  })) {
    for (const funnel of funnels) {
      assert(
        (await handler(request("POST", { ...validPayload, project, funnel }))).status === 200,
        `${project}/${funnel} should be accepted`,
      );
    }
  }
});

Deno.test("unsupported project or funnel returns unsupported_form", async () => {
  const handler = createLeadSubmitHandler({ insertLead: async () => "created" });
  for (const payload of [
    { ...validPayload, project: "eco" },
    { ...validPayload, funnel: "unknown" },
  ]) {
    const response = await handler(request("POST", payload));
    const body = await response.json();
    assert(response.status === 400 && body.error === "unsupported_form", "expected unsupported_form");
  }
});

for (const [name, patch] of [
  ["short name", { name: "A" }],
  ["invalid email", { email: "not-an-email" }],
  ["missing consent", { consent: false }],
  ["array metadata", { metadata: [] }],
  ["oversized phone", { phone: "1".repeat(41) }],
] as const) {
  Deno.test(`${name} returns invalid_request`, async () => {
    const handler = createLeadSubmitHandler({ insertLead: async () => "created" });
    const response = await handler(request("POST", { ...validPayload, ...patch }));
    const body = await response.json();
    assert(response.status === 400 && body.error === "invalid_request", "expected invalid_request");
  });
}

Deno.test("CORS accepts production and localhost origins", async () => {
  const handler = createLeadSubmitHandler({ insertLead: async () => "created" });
  for (const allowedOrigin of [
    "https://quaero.com.br",
    "https://www.quaero.com.br",
    "https://aferia.com.br",
    "https://www.aferia.com.br",
    "http://localhost:3000",
  ]) {
    const response = await handler(request("OPTIONS", validPayload, allowedOrigin));
    assert(response.status === 204, `${allowedOrigin} should be accepted`);
    assert(response.headers.get("access-control-allow-origin") === allowedOrigin, "missing CORS origin");
  }
});

Deno.test("CORS rejects an unauthorized origin without reflecting it", async () => {
  const handler = createLeadSubmitHandler({ insertLead: async () => "created" });
  const response = await handler(request("POST", validPayload, "https://attacker.example"));
  assert(response.status === 403, "expected 403");
  assert(response.headers.get("access-control-allow-origin") === null, "origin must not be reflected");
});

Deno.test("honeypot returns generic success without inserting", async () => {
  let inserts = 0;
  const handler = createLeadSubmitHandler({
    insertLead: async () => {
      inserts += 1;
      return "created";
    },
  });
  const response = await handler(request("POST", { ...validPayload, website: "spam.example" }));
  const body = await response.json();
  assert(response.status === 200 && body.success === true && body.duplicate === true, "expected generic success");
  assert(inserts === 0, "honeypot submission was inserted");
});

Deno.test("invalid JSON, content type, and oversized payload are rejected", async () => {
  const handler = createLeadSubmitHandler({ insertLead: async () => "created" });

  const invalidJson = new Request("http://localhost/lead-submit", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: "{",
  });
  assert((await handler(invalidJson)).status === 400, "invalid JSON should fail");

  const wrongType = new Request("http://localhost/lead-submit", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "text/plain" },
    body: JSON.stringify(validPayload),
  });
  assert((await handler(wrongType)).status === 415, "wrong content type should fail");

  const oversized = request("POST", { ...validPayload, message: "x".repeat(17 * 1024) });
  assert((await handler(oversized)).status === 413, "oversized payload should fail");
});

Deno.test("database failure returns internal_error", async () => {
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const handler = createLeadSubmitHandler({ insertLead: async () => { throw new Error("test"); } });
    const response = await handler(request());
    const body = await response.json();
    assert(response.status === 500 && body.error === "internal_error", "expected internal_error");
  } finally {
    console.error = originalError;
  }
});
