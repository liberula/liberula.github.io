import {
  createFounderRecordHandler,
  renderFounderRecordPage,
} from "./index.ts";

const TOKEN = "b".repeat(64);
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function request(method = "GET", token = TOKEN): Request {
  return new Request(`https://records.example.test/quina?access=${token}`, {
    method,
  });
}

function imageRequest(token = TOKEN, origin?: string): Request {
  return new Request(
    `https://records.example.test/quina?access=${token}&asset=image`,
    { headers: origin ? { Origin: origin } : undefined },
  );
}

function handler(
  { allowed = true, rateAllowed = true }: {
    allowed?: boolean;
    rateAllowed?: boolean;
  } = {},
) {
  const logs: string[] = [];
  return {
    logs,
    handle: createFounderRecordHandler({
      rateLimitSalt: "synthetic-rate-limit-salt-at-least-32-bytes",
      recordApiUrl:
        "https://records.example.test/functions/v1/eco-founder-record",
      repository: {
        consumeRateLimit: () => Promise.resolve(rateAllowed),
        hasAccess: () => Promise.resolve(allowed),
      },
      loadImage: () => Promise.resolve(new Uint8Array([137, 80, 78, 71])),
      logger: {
        info: (value) => logs.push(value),
        error: (value) => logs.push(value),
      },
    }),
  };
}

Deno.test("invalid, missing, unpaid, and rate-limited record access is rejected", async () => {
  assert(
    (await handler().handle(request("GET", "invalid"))).status === 404,
    "invalid token accepted",
  );
  assert(
    (await handler({ allowed: false }).handle(request())).status === 404,
    "unpaid token accepted",
  );
  assert(
    (await handler({ rateAllowed: false }).handle(request())).status === 429,
    "rate limit ignored",
  );
});

Deno.test("paid access returns a private noindex textual transcript", async () => {
  const context = handler();
  const response = await context.handle(request());
  const html = await response.text();
  assert(response.status === 200, "paid record rejected");
  assert(
    response.headers.get("x-robots-tag")?.includes("noindex"),
    "noindex header missing",
  );
  assert(
    response.headers.get("cache-control")?.includes("no-store"),
    "private response cached",
  );
  assert(
    html.includes("Cacete...") && html.includes("ME TIRA DAQUI!"),
    "approved transcript incomplete",
  );
  assert(
    html.includes("Transcrição operacional do agente Quina"),
    "textual transcript label missing",
  );
  assert(!html.includes("<audio"), "audio player was rendered");
  assert(!/mp3|ECO_FOUNDER_AUDIO_URL/iu.test(html), "audio dependency leaked");
  assert(
    context.logs.includes("eco_founder_record_opened"),
    "open event missing",
  );
  assert(
    html.includes(
      "https://records.example.test/functions/v1/eco-founder-record?access=",
    ) && html.includes("&amp;asset=image"),
    "protected image did not use the configured public API URL",
  );
  assert(
    !html.includes("https://records.example.test/quina?"),
    "internal request URL leaked into the protected image",
  );
});

Deno.test("the final image uses the same paid capability and is never public or cached", async () => {
  const paid = await handler().handle(imageRequest());
  assert(paid.status === 200, "paid image rejected");
  assert(paid.headers.get("content-type") === "image/png", "wrong image type");
  assert(
    paid.headers.get("cache-control")?.includes("no-store"),
    "protected image cached",
  );
  assert(
    (await handler({ allowed: false }).handle(imageRequest())).status === 404,
    "unpaid image exposed",
  );
  assert(
    (await handler().handle(
      new Request("https://records.example.test/quina?asset=image"),
    )).status === 404,
    "tokenless image exposed",
  );
});

Deno.test("sandboxed document can load protected subresources without opening access", async () => {
  assert(
    (await handler().handle(imageRequest(TOKEN, "null"))).status === 200,
    "sandboxed iframe origin rejected",
  );
  assert(
    (await handler().handle(imageRequest(TOKEN, "https://attacker.test")))
      .status === 404,
    "untrusted web origin accepted",
  );
  assert(
    (await handler({ allowed: false }).handle(imageRequest(TOKEN, "null")))
      .status === 404,
    "opaque origin bypassed paid access",
  );
});

Deno.test("record is a complete textual transcript with no media dependency", () => {
  const html = renderFounderRecordPage(
    "https://records.example.test/quina?access=opaque&asset=image",
  );
  assert(html.includes("Transcrição operacional"), "transcript missing");
  assert(
    !/<audio|mp3|audio_started|audio_completed/iu.test(html),
    "audio infrastructure remains",
  );
});
