import { renderFounderPostPurchaseEmail } from "../../../lib/eco/founder-post-purchase-email.mjs";
import {
  createFounderDispatcherHandler,
  createFounderPostmarkSender,
  FounderEmailFailure,
  type FounderMessage,
} from "./index.ts";

const SECRET = "synthetic-founder-email-secret";
const MESSAGE_ID = "123e4567-e89b-42d3-a456-426614174000";
const ORDER_ID = "123e4567-e89b-42d3-a456-426614174001";
const PROVIDER_ID = "123e4567-e89b-42d3-a456-426614174002";
const TOKEN = "a".repeat(64);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const message: FounderMessage = {
  messageId: MESSAGE_ID,
  orderId: ORDER_ID,
  buyerName: "  João <Fundador>  ",
  buyerEmail: "founder@example.test",
  amountCents: 4990,
  currency: "BRL",
  orderReference: "order_01J123456789ABCDEFGH",
  accessToken: TOKEN,
  attemptCount: 1,
};

function request(body: unknown, secret = SECRET): Request {
  return new Request("https://example.test/dispatch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(body),
  });
}

function dependencies(
  overrides: Partial<Parameters<typeof createFounderDispatcherHandler>[0]> = {},
) {
  const calls = { complete: 0, fail: 0, send: 0, retry: 0 };
  const logs: string[] = [];
  return {
    calls,
    logs,
    handler: createFounderDispatcherHandler({
      secret: SECRET,
      claim: () => Promise.resolve([message]),
      complete: () => {
        calls.complete += 1;
        return Promise.resolve(true);
      },
      fail: () => {
        calls.fail += 1;
        return Promise.resolve("failed");
      },
      retry: () => {
        calls.retry += 1;
        return Promise.resolve(true);
      },
      send: () => {
        calls.send += 1;
        return Promise.resolve({ messageId: PROVIDER_ID });
      },
      logger: {
        info: (value) => logs.push(value),
        error: (value) => logs.push(value),
      },
      ...overrides,
    }),
  };
}

Deno.test("founder dispatcher authenticates and sends a claimed message once", async () => {
  const context = dependencies();
  const response = await context.handler(
    request({ action: "dispatch", limit: 3 }),
  );
  assert(response.status === 200, "dispatch failed");
  assert(
    context.calls.send === 1 && context.calls.complete === 1,
    "message was not completed once",
  );
  assert(context.calls.fail === 0, "successful message was failed");
  assert(
    context.logs.includes("eco_founder_email_requested"),
    "request event missing",
  );
  assert(context.logs.includes("eco_founder_email_sent"), "sent event missing");

  const empty = dependencies({ claim: () => Promise.resolve([]) });
  await empty.handler(request({ action: "dispatch", limit: 3 }));
  assert(empty.calls.send === 0, "empty/duplicate claim sent a message");
});

Deno.test("founder dispatcher persists failures and bounded retry disposition", async () => {
  const retryable = dependencies({
    send: () =>
      Promise.reject(new FounderEmailFailure("postmark_server_error", true)),
    fail: (_id, code, retry) => {
      assert(
        code === "postmark_server_error" && retry,
        "retry classification changed",
      );
      return Promise.resolve("pending");
    },
  });
  const response = await retryable.handler(
    request({ action: "dispatch", limit: 1 }),
  );
  const body = await response.json();
  assert(
    body.counts.rescheduled === 1,
    "transient failure was not rescheduled",
  );

  const ambiguous = dependencies({
    send: () =>
      Promise.reject(new FounderEmailFailure("postmark_result_unknown", false)),
    fail: (_id, code, retry) => {
      assert(
        code === "postmark_result_unknown" && !retry,
        "ambiguous send became retryable",
      );
      return Promise.resolve("failed");
    },
  });
  await ambiguous.handler(request({ action: "dispatch", limit: 1 }));
  assert(
    ambiguous.logs.some((line) => line.includes("eco_founder_email_failed")),
    "failure event missing",
  );
});

Deno.test("manual retry is protected, exact, and reuses the existing message", async () => {
  const context = dependencies();
  assert(
    (await context.handler(
      request(
        { action: "retry", order_reference: message.orderReference },
        "wrong",
      ),
    )).status === 401,
    "unauthorized retry accepted",
  );
  const response = await context.handler(
    request({ action: "retry", order_reference: message.orderReference }),
  );
  assert(
    response.status === 200 && context.calls.retry === 1,
    "manual retry was not queued",
  );
  assert(
    (await context.handler(
      request({
        action: "retry",
        order_reference: message.orderReference,
        extra: true,
      }),
    )).status === 400,
    "extra retry field accepted",
  );
});

Deno.test("founder email has safe narrative, dynamic financial data, and escaped content", () => {
  const content = renderFounderPostPurchaseEmail({
    buyerName: message.buyerName,
    amountCents: message.amountCents,
    currency: message.currency,
    orderReference: message.orderReference,
    recordUrl: `https://records.example.test/quina?access=${TOKEN}`,
    imageUrl:
      "https://liberula.com/eco/eco-sp-001/quina-final-transmission.png",
    supportEmail: "suporte@liberula.com",
  });
  assert(
    content.subject === "E.C.O. // Registro final do agente Quina",
    "subject changed",
  );
  assert(content.preheader.includes("agente fundador"), "preview missing");
  assert(
    content.htmlBody.includes("ABRIR REGISTRO RECUPERADO"),
    "transcript CTA missing",
  );
  assert(!/<audio|\.mp3/iu.test(content.htmlBody), "audio dependency rendered");
  assert(
    content.htmlBody.includes("R$&nbsp;49,90") ||
      content.htmlBody.includes("R$ 49,90") ||
      content.htmlBody.includes("R$\u00a049,90"),
    "historical amount not rendered",
  );
  assert(
    content.textBody.includes(message.orderReference),
    "public reference missing",
  );
  assert(
    !content.htmlBody.includes("<Fundador>"),
    "buyer name was not escaped",
  );
  assert(
    !/alt="[^"]*(entidade|reflexo|monstro|criatura)/iu.test(content.htmlBody),
    "alt text revealed hidden presence",
  );
  assert(
    !/próximo caso/iu.test(content.htmlBody),
    "email announced the next case",
  );
});

Deno.test("Postmark sender emits HTML and text without logging PII or private IDs", async () => {
  const payloads: Record<string, unknown>[] = [];
  const sender = createFounderPostmarkSender({
    token: "synthetic-postmark-token",
    fromEmail: "eco@liberula.com",
    replyTo: "suporte@liberula.com",
    messageStream: "outbound",
    recordPageUrl: "https://liberula.com/eco/eco-sp-001/registros/quina-final",
    recordApiUrl: "https://records.example.test/quina",
    supportEmail: "suporte@liberula.com",
  }, async (_input, init) => {
    payloads.push(JSON.parse(String(init?.body)));
    return new Response(
      JSON.stringify({ ErrorCode: 0, MessageID: PROVIDER_ID }),
      { status: 200 },
    );
  });
  const result = await sender(message);
  const payload = payloads[0];
  assert(result.messageId === PROVIDER_ID, "provider ID not returned");
  assert(
    typeof payload.HtmlBody === "string" &&
      typeof payload.TextBody === "string",
    "multipart bodies missing",
  );
  assert(
    String(payload.HtmlBody).includes("records.example.test/quina?access=") &&
      String(payload.HtmlBody).includes("asset=image"),
    "email image is not capability-protected",
  );
  assert(
    String(payload.TextBody).includes(
      "liberula.com/eco/eco-sp-001/registros/quina-final?access=",
    ),
    "CTA does not use the site record page",
  );
  assert(payload.To === message.buyerEmail, "persisted recipient not used");
  assert(
    !JSON.stringify(payload.Metadata).includes(message.orderId),
    "private order ID leaked to metadata",
  );
});
