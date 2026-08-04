import {
  createFounderRecordHandler,
  renderFounderRecordPage,
} from "./index.ts";

const TOKEN = "b".repeat(64);
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function request(method = "GET", token = TOKEN, body?: unknown): Request {
  return new Request(`https://records.example.test/quina?access=${token}`, {
    method,
    headers: method === "POST"
      ? { "Content-Type": "application/json" }
      : undefined,
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function imageRequest(token = TOKEN, origin?: string): Request {
  return new Request(
    `https://records.example.test/quina?access=${token}&asset=image`,
    { headers: origin ? { Origin: origin } : undefined },
  );
}

function handler(
  { allowed = true, rateAllowed = true, audioUrl }: {
    allowed?: boolean;
    rateAllowed?: boolean;
    audioUrl?: string;
  } = {},
) {
  const logs: string[] = [];
  return {
    logs,
    handle: createFounderRecordHandler({
      rateLimitSalt: "synthetic-rate-limit-salt-at-least-32-bytes",
      audioUrl,
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

Deno.test("paid access returns a private noindex transcript with an honest audio placeholder", async () => {
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
    html.includes("ARQUIVO DE ÁUDIO PENDENTE"),
    "missing audio was presented as final",
  );
  assert(
    context.logs.includes("eco_founder_record_opened"),
    "open event missing",
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

Deno.test("configured MP3 renders an accessible player and safe fallback", () => {
  const html = renderFounderRecordPage(
    "https://liberula.com/eco/eco-sp-001/audio/quina-final-log.mp3",
  );
  assert(
    html.includes("<audio") && html.includes("controls"),
    "audio player missing",
  );
  assert(
    html.includes("Seu navegador não reproduz este áudio"),
    "player fallback missing",
  );
  assert(
    html.includes("eco_founder_audio_started") &&
      html.includes("eco_founder_audio_completed"),
    "audio analytics missing",
  );
});

Deno.test("audio analytics are allowlisted and contain no access token or PII", async () => {
  const context = handler({
    audioUrl: "https://liberula.com/eco/eco-sp-001/audio/quina-final-log.mp3",
  });
  const response = await context.handle(
    request("POST", TOKEN, { event: "eco_founder_audio_started" }),
  );
  assert(response.status === 204, "valid audio event rejected");
  assert(
    context.logs.join(" ") === "eco_founder_audio_started",
    "analytics log contains unexpected data",
  );
  assert(!context.logs.join(" ").includes(TOKEN), "access token was logged");
  assert(
    (await context.handle(
      request("POST", TOKEN, { event: "email@example.test" }),
    )).status === 404,
    "arbitrary analytics event accepted",
  );
});
