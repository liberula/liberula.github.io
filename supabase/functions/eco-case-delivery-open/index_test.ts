import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createDeliveryOpenHandler,
  createSupabaseDeliveryOpenPersistence,
  isAllowedDeliveryOpenOrigin,
  parseDeliveryOpenRequest,
} from "./index.ts";

const REFERENCE = "QWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4";

function request(options: {
  method?: string;
  contentType?: string | null;
  body?: string;
  payload?: unknown;
  origin?: string;
} = {}) {
  const method = options.method ?? "POST";
  const headers = new Headers();
  if (options.contentType !== null) {
    headers.set("Content-Type", options.contentType ?? "application/json");
  }
  if (options.origin) headers.set("Origin", options.origin);
  return new Request(
    "http://localhost/functions/v1/eco-case-delivery-open",
    {
      method,
      headers,
      body: method === "POST"
        ? options.body ?? JSON.stringify(
          options.payload ?? { delivery_reference: REFERENCE },
        )
        : undefined,
    },
  );
}

Deno.test("only POST mutates; browser preflight is side-effect-free", async () => {
  let calls = 0;
  const handler = createDeliveryOpenHandler({
    persist: async () => {
      calls += 1;
    },
  });
  assertEquals((await handler(request({ method: "GET" }))).status, 405);
  assertEquals((await handler(request({ method: "PUT" }))).status, 405);
  const preflight = await handler(request({
    method: "OPTIONS",
    origin: "https://liberula.com",
  }));
  assertEquals(preflight.status, 204);
  assertEquals(calls, 0);
  assertEquals((await handler(request())).status, 202);
  assertEquals(calls, 1);
});

Deno.test("content type, JSON, body size, shape, and reference are strict", async () => {
  let calls = 0;
  const handler = createDeliveryOpenHandler({
    persist: async () => {
      calls += 1;
    },
  });
  const invalidRequests = [
    request({ contentType: "text/plain" }),
    request({ contentType: "application/json; charset=utf-8" }),
    request({ body: "{" }),
    request({ body: JSON.stringify({ padding: "x".repeat(1100) }) }),
    request({ payload: {} }),
    request({ payload: { delivery_reference: REFERENCE, extra: true } }),
    request({ payload: { delivery_reference: [REFERENCE] } }),
    request({ payload: { delivery_reference: "too-short" } }),
    request({ payload: { delivery_reference: "has spaces 123456789" } }),
    request({ payload: { delivery_reference: "https://example.test/token" } }),
    request({ payload: { delivery_reference: "person@example.test" } }),
  ];
  for (const candidate of invalidRequests) {
    const response = await handler(candidate);
    assertEquals(response.status, 400);
    assertEquals(await response.json(), {
      success: false,
      error: "invalid_request",
    });
  }
  assertEquals(calls, 0);
  assertEquals(parseDeliveryOpenRequest({ delivery_reference: ` ${REFERENCE} ` }), REFERENCE);
});

Deno.test("valid-looking outcomes and persistence errors are indistinguishable", async () => {
  for (const persist of [
    async () => {},
    async () => {
      throw new Error("synthetic database failure");
    },
  ]) {
    const response = await createDeliveryOpenHandler({ persist })(request());
    assertEquals(response.status, 202);
    assertEquals(await response.json(), { success: true });
  }
});

Deno.test("CORS allows production and localhost without credentials", async () => {
  assertEquals(isAllowedDeliveryOpenOrigin("https://liberula.com"), true);
  assertEquals(isAllowedDeliveryOpenOrigin("http://localhost:3000"), true);
  assertEquals(isAllowedDeliveryOpenOrigin("http://127.0.0.1:3000"), true);
  assertEquals(isAllowedDeliveryOpenOrigin("https://attacker.example"), false);
  const response = await createDeliveryOpenHandler({ persist: async () => {} })(
    request({ origin: "https://liberula.com" }),
  );
  assertEquals(response.headers.get("access-control-allow-origin"), "https://liberula.com");
  assertEquals(response.headers.get("access-control-allow-credentials"), null);
});

Deno.test("Supabase persistence uses the bounded RPC and server credentials", async () => {
  let captured: { input: RequestInfo | URL; init?: RequestInit } | null = null;
  const persist = createSupabaseDeliveryOpenPersistence(
    "https://project.supabase.co",
    "synthetic-service-role-key",
    async (input, init) => {
      captured = { input, init };
      return new Response("null", { status: 200 });
    },
  );
  await persist(REFERENCE);
  assertEquals(
    String(captured!.input),
    "https://project.supabase.co/rest/v1/rpc/record_eco_case_delivery_open",
  );
  assertEquals(captured!.init?.method, "POST");
  assertEquals(JSON.parse(String(captured!.init?.body)), {
    p_delivery_reference: REFERENCE,
  });
  assertEquals(
    new Headers(captured!.init?.headers).get("authorization"),
    "Bearer synthetic-service-role-key",
  );

  await assertRejects(() => createSupabaseDeliveryOpenPersistence()(
    REFERENCE,
  ));
});
