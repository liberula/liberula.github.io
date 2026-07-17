import { createEcoLeadHandler } from "./index.ts";

const origin = "https://liberula.com";
const validPayload = {
  project: "eco",
  funnel: "free_recruitment",
  name: "Ada Lovelace",
  email: "ADA@example.com ",
  consent: true,
  utm_source: "meta",
  utm_medium: "paid",
  utm_campaign: "eco",
  utm_content: "dossier",
  utm_term: "misterio",
  fbclid: "test-click-id",
  source_url: "https://liberula.com/eco?utm_source=meta",
  submitted_at: "2026-07-17T12:00:00.000Z",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function request(method = "POST", payload: unknown = validPayload, requestOrigin = origin): Request {
  return new Request("http://localhost/eco-lead", {
    method,
    headers: { Origin: requestOrigin, "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify(payload) : undefined,
  });
}

Deno.test("valid POST normalizes and persists attribution", async () => {
  let inserted: Record<string, unknown> | undefined;
  const handler = createEcoLeadHandler({ insertLead: async (lead) => { inserted = lead; return "created"; } });
  const response = await handler(request());
  assert(response.status === 200, "expected 200");
  assert(inserted?.email === "ada@example.com", "email was not normalized");
  assert(inserted?.utm_source === "meta" && inserted?.fbclid === "test-click-id", "attribution was not persisted");
  assert(JSON.stringify(await response.json()) === JSON.stringify({ success: true, duplicate: false }), "unexpected response");
});

Deno.test("duplicate is an idempotent success", async () => {
  const handler = createEcoLeadHandler({ insertLead: async () => "duplicate" });
  const body = await (await handler(request())).json();
  assert(body.success === true && body.duplicate === true, "expected duplicate success");
});

for (const [name, patch] of [
  ["invalid name", { name: "A" }],
  ["invalid email", { email: "not-an-email" }],
  ["false consent", { consent: false }],
] as const) {
  Deno.test(`${name} returns 400`, async () => {
    const handler = createEcoLeadHandler({ insertLead: async () => "created" });
    assert((await handler(request("POST", { ...validPayload, ...patch }))).status === 400, "expected 400");
  });
}

Deno.test("GET returns 405 and OPTIONS returns CORS headers", async () => {
  const handler = createEcoLeadHandler({ insertLead: async () => "created" });
  assert((await handler(request("GET"))).status === 405, "GET should return 405");
  const options = await handler(request("OPTIONS"));
  assert(options.status === 204, "OPTIONS should return 204");
  assert(options.headers.get("access-control-allow-origin") === origin, "missing CORS origin");
});

Deno.test("unauthorized origin is rejected", async () => {
  const handler = createEcoLeadHandler({ insertLead: async () => "created" });
  assert((await handler(request("POST", validPayload, "https://attacker.example"))).status === 403, "expected 403");
});

Deno.test("localhost is accepted", async () => {
  const handler = createEcoLeadHandler({ insertLead: async () => "created" });
  assert((await handler(request("POST", validPayload, "http://localhost:3000"))).status === 200, "localhost should be accepted");
});

Deno.test("honeypot returns generic success without inserting", async () => {
  let inserts = 0;
  const handler = createEcoLeadHandler({ insertLead: async () => { inserts += 1; return "created"; } });
  const response = await handler(request("POST", { ...validPayload, website: "spam.example" }));
  const body = await response.json();
  assert(response.status === 200 && body.duplicate === true, "expected generic success");
  assert(inserts === 0, "honeypot submission was inserted");
});

Deno.test("oversized and incorrectly typed fields are rejected", async () => {
  const handler = createEcoLeadHandler({ insertLead: async () => "created" });
  assert((await handler(request("POST", { ...validPayload, utm_source: "x".repeat(256) }))).status === 400, "oversized UTM should fail");
  assert((await handler(request("POST", { ...validPayload, fbclid: 123 }))).status === 400, "non-string fbclid should fail");
});
