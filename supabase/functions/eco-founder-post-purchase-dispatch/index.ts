import { renderFounderPostPurchaseEmail } from "../../../lib/eco/founder-post-purchase-email.mjs";

const MAX_BODY_BYTES = 2048;
const POSTMARK_TIMEOUT_MS = 5000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/u;
const REFERENCE_PATTERN = /^[A-Za-z0-9_-]{16,200}$/u;

type JsonObject = Record<string, unknown>;
export type FounderMessage = {
  messageId: string;
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  amountCents: number;
  currency: "BRL";
  orderReference: string;
  accessToken: string;
  attemptCount: number;
};
export type FounderFailureCode =
  | "postmark_configuration_missing"
  | "postmark_unauthorized"
  | "postmark_rejected"
  | "postmark_server_error"
  | "postmark_invalid_response"
  | "postmark_result_unknown"
  | "invalid_message";

export class FounderEmailFailure extends Error {
  constructor(readonly code: FounderFailureCode, readonly retryable: boolean) {
    super(code);
    this.name = "FounderEmailFailure";
  }
}

export type FounderDispatcherDependencies = {
  secret?: string;
  claim: (limit: number) => Promise<FounderMessage[]>;
  complete: (messageId: string, providerMessageId: string) => Promise<boolean>;
  fail: (
    messageId: string,
    code: FounderFailureCode,
    retryable: boolean,
  ) => Promise<"pending" | "failed" | "unchanged">;
  retry: (orderReference: string) => Promise<boolean>;
  send: (message: FounderMessage) => Promise<{ messageId: string }>;
  logger?: {
    info?: (message: string) => void;
    error?: (message: string) => void;
  };
};

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function json(status: number, body: JsonObject): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function secretsMatch(
  expected: string,
  actual: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftValue, rightValue] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
  ]);
  const left = new Uint8Array(leftValue);
  const right = new Uint8Array(rightValue);
  let difference = left.length ^ right.length;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ (right[index] ?? 0);
  }
  return difference === 0;
}

async function parseBody(request: Request): Promise<JsonObject | null> {
  if (
    !/^application\/json(?:\s*;|$)/iu.test(
      request.headers.get("content-type") ?? "",
    )
  ) return null;
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return null;
    const value: unknown = JSON.parse(raw);
    return isPlainObject(value) ? value : null;
  } catch {
    return null;
  }
}

function exactKeys(value: JsonObject, expected: string[]): boolean {
  return JSON.stringify(Object.keys(value).sort()) ===
    JSON.stringify([...expected].sort());
}

export function createFounderDispatcherHandler(
  dependencies: FounderDispatcherDependencies,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return json(405, { success: false, error: "invalid_request" });
    }
    if (!dependencies.secret) {
      return json(503, { success: false, error: "service_unavailable" });
    }
    const authorization = request.headers.get("authorization") ?? "";
    const supplied = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";
    if (!supplied || !(await secretsMatch(dependencies.secret, supplied))) {
      return json(401, { success: false, error: "unauthorized" });
    }
    const body = await parseBody(request);
    if (!body) return json(400, { success: false, error: "invalid_request" });

    if (body.action === "retry") {
      if (
        !exactKeys(body, ["action", "order_reference"]) ||
        typeof body.order_reference !== "string" ||
        !REFERENCE_PATTERN.test(body.order_reference)
      ) {
        return json(400, { success: false, error: "invalid_request" });
      }
      try {
        return json(200, {
          success: true,
          queued: await dependencies.retry(body.order_reference),
        });
      } catch {
        return json(500, { success: false, error: "internal_error" });
      }
    }

    if (
      body.action !== "dispatch" || !exactKeys(body, ["action", "limit"]) ||
      !Number.isInteger(body.limit) || Number(body.limit) < 1 ||
      Number(body.limit) > 10
    ) {
      return json(400, { success: false, error: "invalid_request" });
    }

    let messages: FounderMessage[];
    try {
      messages = await dependencies.claim(Number(body.limit));
    } catch {
      return json(500, { success: false, error: "internal_error" });
    }
    const counts = {
      claimed: messages.length,
      sent: 0,
      failed: 0,
      rescheduled: 0,
    };
    for (const message of messages) {
      dependencies.logger?.info?.("eco_founder_email_requested");
      try {
        const accepted = await dependencies.send(message);
        if (
          !(await dependencies.complete(message.messageId, accepted.messageId))
        ) {
          throw new FounderEmailFailure("postmark_result_unknown", false);
        }
        counts.sent += 1;
        dependencies.logger?.info?.("eco_founder_email_sent");
      } catch (error) {
        const failure = error instanceof FounderEmailFailure
          ? error
          : new FounderEmailFailure("postmark_result_unknown", false);
        try {
          const disposition = await dependencies.fail(
            message.messageId,
            failure.code,
            failure.retryable,
          );
          if (disposition === "pending") counts.rescheduled += 1;
          else counts.failed += 1;
        } catch {
          counts.failed += 1;
        }
        dependencies.logger?.error?.(
          `eco_founder_email_failed: ${failure.code}`,
        );
      }
    }
    return json(200, { success: true, counts });
  };
}

function parseMessage(value: unknown): FounderMessage | null {
  if (
    !isPlainObject(value) || typeof value.message_id !== "string" ||
    !UUID_PATTERN.test(value.message_id) ||
    typeof value.order_id !== "string" || !UUID_PATTERN.test(value.order_id) ||
    typeof value.buyer_email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.buyer_email) ||
    (typeof value.buyer_name !== "string" && value.buyer_name !== null) ||
    !Number.isInteger(value.amount_cents) || Number(value.amount_cents) < 1 ||
    value.currency !== "BRL" || typeof value.order_reference !== "string" ||
    !REFERENCE_PATTERN.test(value.order_reference) ||
    typeof value.access_token !== "string" ||
    !TOKEN_PATTERN.test(value.access_token) ||
    !Number.isInteger(value.attempt_count) || Number(value.attempt_count) < 1 ||
    Number(value.attempt_count) > 3
  ) return null;
  return {
    messageId: value.message_id,
    orderId: value.order_id,
    buyerName: value.buyer_name ?? "",
    buyerEmail: value.buyer_email,
    amountCents: Number(value.amount_cents),
    currency: "BRL",
    orderReference: value.order_reference,
    accessToken: value.access_token,
    attemptCount: Number(value.attempt_count),
  };
}

export function createSupabaseFounderMessageStore(
  supabaseUrl?: string,
  serviceRoleKey?: string,
  fetcher: typeof fetch = fetch,
) {
  async function rpc(name: string, body: JsonObject): Promise<unknown> {
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("missing_configuration");
    }
    const response = await fetcher(
      `${supabaseUrl.replace(/\/+$/u, "")}/rest/v1/rpc/${name}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) throw new Error("database_failure");
    return await response.json().catch(() => null);
  }
  return {
    claim: async (limit: number) => {
      const value = await rpc("claim_eco_founder_messages", { p_limit: limit });
      if (!Array.isArray(value)) throw new Error("invalid_claim_response");
      const parsed = value.map(parseMessage);
      if (parsed.some((message) => message === null)) {
        throw new Error("invalid_claim_response");
      }
      return parsed as FounderMessage[];
    },
    complete: async (messageId: string, providerMessageId: string) =>
      await rpc("complete_eco_founder_message", {
        p_message_id: messageId,
        p_provider_message_id: providerMessageId,
      }) === true,
    fail: async (
      messageId: string,
      code: FounderFailureCode,
      retryable: boolean,
    ) => {
      const result = String(
        await rpc("fail_eco_founder_message", {
          p_message_id: messageId,
          p_error_code: code,
          p_retryable: retryable,
        }),
      );
      if (!["pending", "failed", "unchanged"].includes(result)) {
        throw new Error("invalid_failure_response");
      }
      return result as "pending" | "failed" | "unchanged";
    },
    retry: async (orderReference: string) =>
      await rpc("retry_eco_founder_message", {
        p_order_reference: orderReference,
      }) === true,
  };
}

function safeHttpsBase(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" || url.username || url.password || url.search ||
      url.hash
    ) return null;
    return url.toString().replace(/\/+$/u, "");
  } catch {
    return null;
  }
}

export function createFounderPostmarkSender(
  configuration: {
    token?: string;
    fromEmail?: string;
    replyTo?: string;
    messageStream?: string;
    recordPageUrl?: string;
    recordApiUrl?: string;
    supportEmail?: string;
  },
  fetcher: typeof fetch = fetch,
) {
  return async (message: FounderMessage): Promise<{ messageId: string }> => {
    const token = configuration.token?.trim();
    const fromEmail = configuration.fromEmail?.trim();
    const replyTo = configuration.replyTo?.trim();
    const messageStream = configuration.messageStream?.trim();
    const recordPageUrl = safeHttpsBase(configuration.recordPageUrl);
    const recordApiUrl = safeHttpsBase(configuration.recordApiUrl);
    const supportEmail = configuration.supportEmail?.trim();
    if (
      !token || !fromEmail || !replyTo || !messageStream || !recordPageUrl ||
      !recordApiUrl || !supportEmail
    ) {
      throw new FounderEmailFailure("postmark_configuration_missing", false);
    }
    let content;
    try {
      content = renderFounderPostPurchaseEmail({
        buyerName: message.buyerName,
        amountCents: message.amountCents,
        currency: message.currency,
        orderReference: message.orderReference,
        recordUrl: `${recordPageUrl}?access=${
          encodeURIComponent(message.accessToken)
        }`,
        imageUrl: `${recordApiUrl}?access=${
          encodeURIComponent(message.accessToken)
        }&asset=image`,
        supportEmail,
      });
    } catch {
      throw new FounderEmailFailure("invalid_message", false);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), POSTMARK_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetcher("https://api.postmarkapp.com/email", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": token,
        },
        body: JSON.stringify({
          From: fromEmail,
          To: message.buyerEmail,
          ReplyTo: replyTo,
          Subject: content.subject,
          TextBody: content.textBody,
          HtmlBody: content.htmlBody,
          MessageStream: messageStream,
          Tag: "eco-founder-confirmation",
          Metadata: { message_type: "eco_sp_001_founder_confirmation" },
        }),
        signal: controller.signal,
      });
    } catch {
      throw new FounderEmailFailure("postmark_result_unknown", false);
    } finally {
      clearTimeout(timeout);
    }
    if (response.status === 401 || response.status === 403) {
      throw new FounderEmailFailure("postmark_unauthorized", false);
    }
    if (response.status >= 500) {
      throw new FounderEmailFailure("postmark_server_error", true);
    }
    if (response.status !== 200) {
      throw new FounderEmailFailure("postmark_rejected", false);
    }
    const value: unknown = await response.json().catch(() => null);
    if (
      !isPlainObject(value) || value.ErrorCode !== 0 ||
      typeof value.MessageID !== "string" || !UUID_PATTERN.test(value.MessageID)
    ) {
      throw new FounderEmailFailure("postmark_invalid_response", false);
    }
    return { messageId: value.MessageID };
  };
}

if (import.meta.main) {
  const store = createSupabaseFounderMessageStore(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  );
  Deno.serve(createFounderDispatcherHandler({
    secret: Deno.env.get("ECO_FOUNDER_EMAIL_SECRET"),
    ...store,
    send: createFounderPostmarkSender({
      token: Deno.env.get("POSTMARK_SERVER_TOKEN"),
      fromEmail: Deno.env.get("POSTMARK_FROM_EMAIL"),
      replyTo: Deno.env.get("POSTMARK_REPLY_TO"),
      messageStream: Deno.env.get("POSTMARK_MESSAGE_STREAM"),
      recordPageUrl: Deno.env.get("ECO_FOUNDER_RECORD_PAGE_URL"),
      recordApiUrl: Deno.env.get("ECO_FOUNDER_RECORD_API_URL"),
      supportEmail: Deno.env.get("ECO_SUPPORT_EMAIL"),
    }),
    logger: {
      info: (message) => console.info(message),
      error: (message) => console.error(message),
    },
  }));
}
